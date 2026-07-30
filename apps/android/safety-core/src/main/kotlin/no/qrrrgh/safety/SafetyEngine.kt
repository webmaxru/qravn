package no.qrrrgh.safety

import android.content.Context
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json

/**
 * The offline safety engine.
 *
 * Every verdict, finding, limitation and recommended action in the app comes
 * from here. The engine performs no I/O and reads no clock; [assess] injects
 * `nowMs`. Online redirect expansion is never performed by this class: a
 * resolution produced by isolated server infrastructure is passed in.
 */
class SafetyEngine internal constructor(
    private val native: NativeSafetyEngine,
    private val catalogs: Map<String, Map<String, CatalogEntry>> = emptyMap(),
    private val dispatcher: CoroutineDispatcher = Dispatchers.Default,
) : AutoCloseable {

    val version: String get() = native.version()

    /**
     * Authored catalog text, for the few labels the assessment does not carry
     * (such as the explanation under a verdict). This is a verbatim lookup of
     * text written by humans; nothing here composes a security statement.
     */
    fun catalogEntry(code: String, locale: String): CatalogEntry? {
        val normalized = LocalizationCatalogs.normalizeLocale(locale)
        return catalogs[normalized]?.get(code)
            ?: catalogs[LocalizationCatalogs.FALLBACK_LOCALE]?.get(code)
    }

    /**
     * Assesses one decoded payload.
     *
     * A payload that cannot be assessed produces a cautious
     * `insufficient_evidence` result rather than an exception, so a hostile
     * code can never fail its way into looking clean.
     */
    suspend fun assess(
        payload: String,
        nowMs: Long,
        locale: String? = null,
        redirectResolution: RedirectResolution? = null,
    ): Assessment = withContext(dispatcher) {
        val input = AssessInput(
            payload = payload,
            nowMs = nowMs,
            locale = locale,
            redirectResolution = redirectResolution,
        )
        val requestJson = json.encodeToString(AssessInput.serializer(), input)
        val responseJson = runCatching { native.assess(requestJson) }.getOrNull()
        responseJson
            ?.let { runCatching { json.decodeFromString(Assessment.serializer(), it) }.getOrNull() }
            ?: cautiousFallback(payload, nowMs, locale)
    }

    override fun close() = native.close()

    private fun cautiousFallback(payload: String, nowMs: Long, locale: String?): Assessment =
        Assessment(
            schemaVersion = SCHEMA_VERSION,
            payloadKind = PayloadKind.TEXT,
            rawPayload = payload,
            displayPayload = payload,
            verdict = Verdict.INSUFFICIENT_EVIDENCE,
            confidence = 0f,
            limitations = listOf(Limitation(code = "limitation.payload_not_understood")),
            recommendedActions = listOf(RecommendedAction.COPY, RecommendedAction.SCAN_AGAIN),
            locale = locale ?: "en",
            evaluatedAtMs = nowMs,
        )

    companion object {
        internal val json = Json {
            ignoreUnknownKeys = true
            explicitNulls = false
            encodeDefaults = false
        }

        /**
         * Builds an engine using the shared localization catalogs bundled as
         * library assets. Throws [SafetyEngineUnavailableException] when the
         * native core cannot start.
         */
        suspend fun create(
            context: Context,
            locale: String,
            dispatcher: CoroutineDispatcher = Dispatchers.Default,
        ): SafetyEngine = withContext(Dispatchers.IO) {
            val catalogs = LocalizationCatalogs.loadAll(context.assets)
            val config = EngineConfig(catalogs = catalogs, locale = locale)
            val configJson = json.encodeToString(EngineConfig.serializer(), config)
            val native = NativeSafetyEngine(configJson)
            if (!native.isValid) {
                throw SafetyEngineUnavailableException("The native safety core returned no engine.")
            }
            SafetyEngine(native, catalogs, dispatcher)
        }
    }
}
