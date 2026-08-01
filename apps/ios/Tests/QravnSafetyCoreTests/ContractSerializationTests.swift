import XCTest
@testable import QravnSafetyCore

/// These tests guard the frozen v1 seam. They intentionally use hand-written
/// JSON rather than round-tripping Swift values, because the thing that must
/// not break is the wire shape the Rust core emits.
///
/// The Swift twin of
/// `apps/android/safety-core/src/test/kotlin/no/qravn/safety/ContractSerializationTest.kt`.
/// The cases are kept in the same order and with the same payloads so a drift
/// between the two clients shows up as a diff here.
final class ContractSerializationTests: XCTestCase {

    private func decode(_ text: String) throws -> Assessment {
        let data = try XCTUnwrap(text.data(using: .utf8))
        return try JSONDecoder().decode(Assessment.self, from: data)
    }

    func testDecodesAFullUrlAssessmentAsTheCoreEmitsIt() throws {
        let assessment = try decode(
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
            """
        )

        XCTAssertEqual(assessment.verdict, .suspicious)
        XCTAssertEqual(assessment.payloadKind, .url)
        XCTAssertEqual(assessment.url?.host, "evil.example")
        XCTAssertEqual(assessment.url?.hasCredentials, true)
        XCTAssertEqual(assessment.findings.count, 1)
        XCTAssertEqual(assessment.findings.first?.severity, .high)
        XCTAssertEqual(assessment.openAffordance, .needsConfirmation)
        XCTAssertFalse(assessment.canExpandRedirect)
        XCTAssertEqual(assessment.evaluatedAtMs, 1_700_000_000_000)
    }

    func testOpenIsBlockedWhenTheCoreSaysSoEvenAlongsideOtherActions() throws {
        let assessment = try decode(
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
            """
        )

        XCTAssertEqual(assessment.openAffordance, .blocked)
    }

    func testAnAssessmentWithNoOpenActionAtAllIsTreatedAsBlocked() throws {
        let assessment = try decode(
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
            """
        )

        XCTAssertEqual(assessment.openAffordance, .blocked)
        XCTAssertNil(assessment.url)
    }

    func testDecodesARedirectAnalysisWithAFinalSubjectFinding() throws {
        let assessment = try decode(
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
            """
        )

        XCTAssertEqual(assessment.redirect?.outcome, .resolved)
        XCTAssertEqual(assessment.redirect?.hopCount, 2)
        XCTAssertEqual(assessment.redirect?.crossedRegistrableDomain, true)
        XCTAssertEqual(assessment.findings.first?.subject, .final)
    }

    func testUnknownFutureFieldsAreIgnoredRatherThanFatal() throws {
        let assessment = try decode(
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
            """
        )

        XCTAssertEqual(assessment.verdict, .noKnownThreatFound)
    }

    func testVerdictCatalogCodesMatchTheSharedLocalizationKeys() {
        XCTAssertEqual(Verdict.knownMalicious.catalogCode, "verdict.known_malicious")
        XCTAssertEqual(Verdict.suspicious.catalogCode, "verdict.suspicious")
        XCTAssertEqual(Verdict.insufficientEvidence.catalogCode, "verdict.insufficient_evidence")
        XCTAssertEqual(Verdict.noKnownThreatFound.catalogCode, "verdict.no_known_threat_found")
    }

    func testLocaleNormalizationMapsNorwegianTagsToTheShippedCatalogs() {
        XCTAssertEqual(LocalizationCatalogs.normalizeLocale("nb-NO"), "nb")
        XCTAssertEqual(LocalizationCatalogs.normalizeLocale("no"), "nb")
        XCTAssertEqual(LocalizationCatalogs.normalizeLocale("nn-NO"), "nn")
        XCTAssertEqual(LocalizationCatalogs.normalizeLocale("de-DE"), "en")
        XCTAssertEqual(LocalizationCatalogs.normalizeLocale(nil), "en")
    }

    /// A failure inside the engine must not be able to look like a clean scan.
    func testTheCautiousFallbackNeverPermitsOpening() {
        let fallback = SafetyEngine.cautiousFallback(
            payload: "https://evil.example",
            nowMs: 42,
            locale: "nb"
        )

        XCTAssertEqual(fallback.verdict, .insufficientEvidence)
        XCTAssertEqual(fallback.openAffordance, .blocked)
        XCTAssertEqual(fallback.evaluatedAtMs, 42)
        XCTAssertEqual(fallback.limitations.first?.code, "limitation.payload_not_understood")
    }
}
