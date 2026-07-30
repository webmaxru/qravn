package no.qrrrgh.safety

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * These tests guard the frozen v1 seam. They intentionally use hand-written
 * JSON rather than round-tripping Kotlin objects, because the thing that must
 * not break is the wire shape the Rust core emits.
 */
class ContractSerializationTest {

    private val json = SafetyEngine.json

    private fun decode(text: String): Assessment =
        json.decodeFromString(Assessment.serializer(), text)

    @Test
    fun `decodes a full url assessment as the core emits it`() {
        val assessment = decode(
            """
            {
              "schemaVersion": 1,
              "payloadKind": "url",
              "rawPayload": "https://trusted.no@evil.example/a",
              "displayPayload": "https://trusted.no@evil.example/a",
              "url": {
                "scheme": "https",
                "username": "trusted.no",
                "hasPassword": false,
                "host": "evil.example",
                "path": "/a",
                "registrableDomain": "evil.example",
                "publicSuffix": "example",
                "subdomains": [],
                "isIpLiteral": false,
                "hasCredentials": true,
                "hasPunycode": false,
                "isMixedScript": false,
                "scripts": ["Latin"]
              },
              "findings": [
                {
                  "code": "url.credentials_in_authority",
                  "severity": "high",
                  "params": {"username": "trusted.no", "host": "evil.example"},
                  "title": "Skjult faktisk domene",
                  "detail": "Tekst foer @ ..."
                }
              ],
              "limitations": [
                {"code": "limitation.offline_no_reputation", "params": {}, "text": "..."}
              ],
              "verdict": "suspicious",
              "confidence": 0.7,
              "recommendedActions": ["open_with_confirmation", "copy", "scan_again"],
              "summary": "Mistenkelig",
              "engineVersion": "0.1.0",
              "rulesVersion": "dev",
              "locale": "nb",
              "evaluatedAtMs": 1700000000000
            }
            """.trimIndent(),
        )

        assertEquals(Verdict.SUSPICIOUS, assessment.verdict)
        assertEquals(PayloadKind.URL, assessment.payloadKind)
        assertEquals("evil.example", assessment.url?.host)
        assertTrue(assessment.url?.hasCredentials == true)
        assertEquals(Severity.HIGH, assessment.findings.single().severity)
        assertEquals(OpenAffordance.NEEDS_CONFIRMATION, assessment.openAffordance)
        assertFalse(assessment.canExpandRedirect)
        assertEquals(1700000000000L, assessment.evaluatedAtMs)
    }

    @Test
    fun `open is blocked when the core says so, even alongside other actions`() {
        val assessment = decode(
            """
            {
              "schemaVersion": 1,
              "payloadKind": "url",
              "rawPayload": "http://x",
              "displayPayload": "http://x",
              "findings": [],
              "limitations": [],
              "verdict": "known_malicious",
              "confidence": 0.95,
              "recommendedActions": ["open_blocked", "copy", "report", "open_allowed"],
              "summary": "",
              "engineVersion": "0.1.0",
              "rulesVersion": "dev",
              "locale": "en",
              "evaluatedAtMs": 1
            }
            """.trimIndent(),
        )

        assertEquals(OpenAffordance.BLOCKED, assessment.openAffordance)
    }

    @Test
    fun `an assessment with no open action at all is treated as blocked`() {
        val assessment = decode(
            """
            {
              "schemaVersion": 1,
              "payloadKind": "wifi",
              "rawPayload": "WIFI:S:Cafe;T:nopass;;",
              "displayPayload": "WIFI:S:Cafe;T:nopass;;",
              "findings": [],
              "limitations": [],
              "verdict": "insufficient_evidence",
              "confidence": 0.2,
              "recommendedActions": ["copy", "scan_again"],
              "summary": "",
              "engineVersion": "0.1.0",
              "rulesVersion": "dev",
              "locale": "en",
              "evaluatedAtMs": 1
            }
            """.trimIndent(),
        )

        assertEquals(OpenAffordance.BLOCKED, assessment.openAffordance)
        assertNull(assessment.url)
    }

    @Test
    fun `decodes a redirect analysis with a final-subject finding`() {
        val assessment = decode(
            """
            {
              "schemaVersion": 1,
              "payloadKind": "url",
              "rawPayload": "https://bit.ly/abc123",
              "displayPayload": "https://bit.ly/abc123",
              "redirect": {
                "hopCount": 2,
                "outcome": "resolved",
                "domainsTraversed": ["bit.ly", "evil.example"],
                "crossedRegistrableDomain": true,
                "downgradedToHttp": false
              },
              "findings": [
                {
                  "code": "url.insecure_scheme",
                  "severity": "medium",
                  "params": {},
                  "title": "t",
                  "detail": "d",
                  "subject": "final"
                }
              ],
              "limitations": [],
              "verdict": "suspicious",
              "confidence": 0.6,
              "recommendedActions": ["open_with_confirmation", "copy"],
              "summary": "",
              "engineVersion": "0.1.0",
              "rulesVersion": "dev",
              "locale": "en",
              "evaluatedAtMs": 1
            }
            """.trimIndent(),
        )

        assertEquals(RedirectOutcome.RESOLVED, assessment.redirect?.outcome)
        assertEquals(2, assessment.redirect?.hopCount)
        assertTrue(assessment.redirect?.crossedRegistrableDomain == true)
        assertEquals(FindingSubject.FINAL, assessment.findings.single().subject)
    }

    @Test
    fun `unknown future fields are ignored rather than fatal`() {
        val assessment = decode(
            """
            {
              "schemaVersion": 1,
              "payloadKind": "text",
              "rawPayload": "hello",
              "displayPayload": "hello",
              "findings": [],
              "limitations": [],
              "verdict": "no_known_threat_found",
              "confidence": 0.5,
              "recommendedActions": ["copy"],
              "summary": "",
              "engineVersion": "0.1.0",
              "rulesVersion": "dev",
              "locale": "en",
              "evaluatedAtMs": 1,
              "somethingAddedInV2": {"a": 1}
            }
            """.trimIndent(),
        )

        assertEquals(Verdict.NO_KNOWN_THREAT_FOUND, assessment.verdict)
    }

    @Test
    fun `verdict catalog codes match the shared localization keys`() {
        assertEquals("verdict.known_malicious", Verdict.KNOWN_MALICIOUS.catalogCode)
        assertEquals("verdict.suspicious", Verdict.SUSPICIOUS.catalogCode)
        assertEquals("verdict.insufficient_evidence", Verdict.INSUFFICIENT_EVIDENCE.catalogCode)
        assertEquals(
            "verdict.no_known_threat_found",
            Verdict.NO_KNOWN_THREAT_FOUND.catalogCode,
        )
    }

    @Test
    fun `locale normalization maps norwegian tags to the shipped catalogs`() {
        assertEquals("nb", LocalizationCatalogs.normalizeLocale("nb-NO"))
        assertEquals("nb", LocalizationCatalogs.normalizeLocale("no"))
        assertEquals("nn", LocalizationCatalogs.normalizeLocale("nn-NO"))
        assertEquals("en", LocalizationCatalogs.normalizeLocale("de-DE"))
        assertEquals("en", LocalizationCatalogs.normalizeLocale(null))
    }
}
