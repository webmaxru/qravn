import XCTest
@testable import QravnSafetyCore

/// Exercises the real Rust core through the C ABI and the packaged
/// XCFramework, which is the only way to prove that the binding, the framework
/// packaging and the bundled catalogs actually fit together.
///
/// The counterpart of Android's `NativeSafetyEngineInstrumentedTest`, except
/// that these run in the simulator as ordinary unit tests because the engine
/// needs no Android context.
final class SafetyEngineTests: XCTestCase {

    private func makeEngine(locale: String = "nb") throws -> SafetyEngine {
        try SafetyEngine.create(locale: locale, bundle: .qravnSafetyCore)
    }

    func testTheNativeCoreStartsAndReportsAVersion() async throws {
        let engine = try makeEngine()
        let version = await engine.version
        XCTAssertFalse(version.isEmpty)
        await engine.close()
    }

    /// The canonical deception the product exists to catch: an authority that
    /// reads as a trusted Norwegian domain but resolves somewhere else.
    func testACredentialsInAuthorityUrlIsNotPresentedAsClean() async throws {
        let engine = try makeEngine()
        let assessment = await engine.assess(
            payload: "https://trusted.no@evil.example/login",
            nowMs: 1_700_000_000_000,
            locale: "nb"
        )

        XCTAssertEqual(assessment.payloadKind, .url)
        XCTAssertNotEqual(assessment.verdict, .noKnownThreatFound)
        XCTAssertNotEqual(assessment.openAffordance, .allowed)
        XCTAssertFalse(assessment.findings.isEmpty)
        XCTAssertEqual(assessment.evaluatedAtMs, 1_700_000_000_000)
        await engine.close()
    }

    /// The destination shown to the user is always the payload that was
    /// scanned, never a prettified or resolved version of it.
    func testTheDisplayPayloadIsTheScannedPayload() async throws {
        let engine = try makeEngine()
        let payload = "https://xn--dmin-moa0i.example/checkout"
        let assessment = await engine.assess(payload: payload, nowMs: 1, locale: "nb")
        XCTAssertEqual(assessment.rawPayload, payload)
        await engine.close()
    }

    func testAnEmptyPayloadIsHandledWithoutCrashing() async throws {
        let engine = try makeEngine()
        let assessment = await engine.assess(payload: "", nowMs: 1, locale: "nb")
        XCTAssertEqual(assessment.openAffordance, .blocked)
        await engine.close()
    }

    /// A payload far larger than any QR code must not take the engine down.
    func testAnOversizedPayloadIsHandledWithoutCrashing() async throws {
        let engine = try makeEngine()
        let assessment = await engine.assess(
            payload: String(repeating: "a", count: 40_000),
            nowMs: 1,
            locale: "nb"
        )
        XCTAssertNotEqual(assessment.verdict, .noKnownThreatFound)
        await engine.close()
    }

    /// Proves the shared catalogs are inside the framework bundle, in Norwegian
    /// first, and that an unknown locale falls back rather than returning nil.
    func testTheSharedCatalogsAreBundledWithTheFramework() async throws {
        let engine = try makeEngine()

        let bokmaal = await engine.catalogEntry(code: "verdict.suspicious", locale: "nb-NO")
        XCTAssertEqual(bokmaal?.title, "Mistenkelig")

        let nynorsk = await engine.catalogEntry(code: "verdict.suspicious", locale: "nn")
        XCTAssertFalse(nynorsk?.title.isEmpty ?? true)

        let fallback = await engine.catalogEntry(code: "verdict.suspicious", locale: "de-DE")
        XCTAssertFalse(fallback?.title.isEmpty ?? true)

        await engine.close()
    }

    func testEveryVerdictHasCatalogTextInEveryShippedLocale() {
        let catalogs = LocalizationCatalogs.loadAll(bundle: .qravnSafetyCore)
        XCTAssertEqual(Set(catalogs.keys), Set(LocalizationCatalogs.supportedLocales))

        for locale in LocalizationCatalogs.supportedLocales {
            for verdict in Verdict.allCases {
                XCTAssertNotNil(
                    catalogs[locale]?[verdict.catalogCode],
                    "\(locale) is missing \(verdict.catalogCode)"
                )
            }
        }
    }
}
