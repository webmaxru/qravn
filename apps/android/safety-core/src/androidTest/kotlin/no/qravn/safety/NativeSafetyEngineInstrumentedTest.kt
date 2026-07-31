package no.qravn.safety

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Proves the Rust core actually runs on an Android device.
 *
 * The JVM unit tests only cover serialization, and the Compose tests use
 * hand-built assessments. Neither would notice if the JNI library failed to
 * load, if a symbol name drifted, or if the shared catalogs were missing from
 * the packaged assets. Each of those would reach a user as an app that cannot
 * judge anything, so they are worth a device test.
 *
 * Verdict logic itself is owned and tested by the Rust core. The payloads here
 * come from `test-vectors/golden/` so the assertions stay meaningful without
 * duplicating that suite.
 */
@RunWith(AndroidJUnit4::class)
class NativeSafetyEngineInstrumentedTest {

    private lateinit var engine: SafetyEngine

    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext

    @Before
    fun setUp() = runTest {
        engine = SafetyEngine.create(context, locale = "nb")
    }

    @After
    fun tearDown() {
        engine.close()
    }

    @Test
    fun theNativeCoreLoadsAndReportsItsVersion() {
        assertTrue("engine version should not be blank", engine.version.isNotBlank())
    }

    @Test
    fun sharedLocalizationCatalogsArePackagedAsAssets() {
        val catalogs = LocalizationCatalogs.loadAll(context.assets)
        assertEquals(LocalizationCatalogs.supportedLocales.toSet(), catalogs.keys)
        catalogs.forEach { (locale, entries) ->
            assertTrue("$locale catalog is empty", entries.isNotEmpty())
            Verdict.entries.forEach { verdict ->
                assertNotNull(
                    "$locale is missing ${verdict.catalogCode}",
                    entries[verdict.catalogCode],
                )
            }
        }
    }

    @Test
    fun aDeceptiveUrlIsJudgedByTheCoreAndNotClearedForOpening() = runTest {
        // test-vectors/golden/deceptive-urls.json: credentials-in-authority-basic
        val result = engine.assess("https://trusted.no@evil.example/login", nowMs = NOW)

        assertEquals(PayloadKind.URL, result.payloadKind)
        assertEquals("evil.example", result.url?.host)
        assertEquals(Verdict.SUSPICIOUS, result.verdict)
        assertTrue(
            "expected url.credentials_in_authority, got ${result.findings.map { it.code }}",
            result.findings.any { it.code == "url.credentials_in_authority" },
        )
        assertNotEquals(
            "a deceptive authority must never be opened without confirmation",
            OpenAffordance.ALLOWED,
            result.openAffordance,
        )
    }

    @Test
    fun aBenignNorwegianUrlIsNeverDescribedAsSafe() = runTest {
        // test-vectors/golden/norwegian-benign.json: legit-dnb
        val result = engine.assess("https://www.dnb.no/", nowMs = NOW)

        assertEquals(Verdict.NO_KNOWN_THREAT_FOUND, result.verdict)
        assertTrue(result.findings.none { it.code == "url.known_malicious" })

        // The absence of evidence is not evidence of safety, and the wording
        // the user reads has to reflect that.
        val summary = result.summary.orEmpty()
        assertTrue("summary should be populated", summary.isNotBlank())
        assertFalse(
            "verdict wording must not claim safety: \"$summary\"",
            Regex("""\b(trygg\w*|safe)\b""", RegexOption.IGNORE_CASE).containsMatchIn(summary),
        )
    }

    @Test
    fun theCoreAnswersInTheRequestedLanguage() = runTest {
        val bokmal = engine.assess("https://www.dnb.no/", nowMs = NOW, locale = "nb")
        val english = engine.assess("https://www.dnb.no/", nowMs = NOW, locale = "en")

        assertEquals("nb", bokmal.locale)
        assertEquals("en", english.locale)
        assertNotEquals(
            "Norwegian and English summaries should differ",
            bokmal.summary,
            english.summary,
        )
        assertNotNull(engine.catalogEntry(Verdict.NO_KNOWN_THREAT_FOUND.catalogCode, "nn"))
    }

    @Test
    fun anUnparseablePayloadFailsCautiouslyRatherThanCleanly() = runTest {
        val result = engine.assess("\uFFFE not a url at all \u202E", nowMs = NOW)

        assertEquals(OpenAffordance.BLOCKED, result.openAffordance)
        assertNotEquals(Verdict.NO_KNOWN_THREAT_FOUND, result.verdict)
    }

    private companion object {
        /** Fixed instant: the core reads no clock, callers supply the time. */
        const val NOW = 1_767_225_600_000L
    }
}
