package no.qrrrgh.safety

import android.content.res.AssetManager
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer

/**
 * The shared localization catalogs, copied verbatim from `localization/` at
 * build time.
 *
 * These are the only source of finding, limitation, verdict and UI wording.
 * The catalogs are handed to the core, which returns fully interpolated text,
 * so the client never assembles a security sentence itself.
 */
object LocalizationCatalogs {

    /** Locales the product ships. Norwegian first: this is a Norway-first product. */
    val supportedLocales: List<String> = listOf("nb", "nn", "en")

    const val FALLBACK_LOCALE: String = "en"

    private const val ASSET_DIR = "localization"

    private val serializer = MapSerializer(String.serializer(), CatalogEntry.serializer())

    fun normalizeLocale(tag: String?): String {
        val language = tag?.substringBefore('-')?.substringBefore('_')?.lowercase()
        return when (language) {
            "nb", "no" -> "nb"
            "nn" -> "nn"
            else -> FALLBACK_LOCALE
        }
    }

    fun loadAll(assets: AssetManager): Map<String, Map<String, CatalogEntry>> =
        supportedLocales.associateWith { locale -> load(assets, locale) }
            .filterValues { it.isNotEmpty() }

    private fun load(assets: AssetManager, locale: String): Map<String, CatalogEntry> =
        runCatching {
            assets.open("$ASSET_DIR/$locale.json").bufferedReader().use { reader ->
                SafetyEngine.json.decodeFromString(serializer, reader.readText())
            }
        }.getOrDefault(emptyMap())
}
