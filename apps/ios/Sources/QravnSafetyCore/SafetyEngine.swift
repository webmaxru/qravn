import Foundation

/// The offline safety engine.
///
/// The Swift twin of
/// `apps/android/safety-core/src/main/kotlin/no/qravn/safety/SafetyEngine.kt`.
/// Every verdict, finding, limitation and recommended action in the app comes
/// from here. The engine performs no I/O and reads no clock; ``assess`` injects
/// `nowMs`. Online redirect expansion is never performed by this type: a
/// resolution produced by isolated server infrastructure is passed in.
///
/// An actor rather than a class with a dispatcher: it gives the same
/// off-the-main-thread guarantee the Kotlin implementation gets from
/// `Dispatchers.Default`, and it makes the native handle unreachable from two
/// threads at once by construction.
public actor SafetyEngine {

    private let native: NativeSafetyEngine
    private let catalogs: [String: [String: CatalogEntry]]

    init(native: NativeSafetyEngine, catalogs: [String: [String: CatalogEntry]] = [:]) {
        self.native = native
        self.catalogs = catalogs
    }

    public var version: String { native.version() }

    /// Authored catalog text, for the few labels the assessment does not carry
    /// (such as the explanation under a verdict). This is a verbatim lookup of
    /// text written by humans; nothing here composes a security statement.
    public func catalogEntry(code: String, locale: String) -> CatalogEntry? {
        let normalized = LocalizationCatalogs.normalizeLocale(locale)
        return catalogs[normalized]?[code]
            ?? catalogs[LocalizationCatalogs.FALLBACK_LOCALE]?[code]
    }

    /// Assesses one decoded payload.
    ///
    /// A payload that cannot be assessed produces a cautious
    /// `insufficientEvidence` result rather than throwing, so a hostile code can
    /// never fail its way into looking clean.
    public func assess(
        payload: String,
        nowMs: Int64,
        locale: String? = nil,
        redirectResolution: RedirectResolution? = nil
    ) -> Assessment {
        let input = AssessInput(
            payload: payload,
            nowMs: nowMs,
            locale: locale,
            redirectResolution: redirectResolution
        )
        guard let requestData = try? JSONEncoder().encode(input),
              let requestJson = String(data: requestData, encoding: .utf8),
              let responseJson = native.assess(inputJson: requestJson),
              let responseData = responseJson.data(using: .utf8),
              let assessment = try? JSONDecoder().decode(Assessment.self, from: responseData)
        else {
            return Self.cautiousFallback(payload: payload, nowMs: nowMs, locale: locale)
        }
        return assessment
    }

    public func close() {
        native.close()
    }

    /// Builds an engine using the shared localization catalogs bundled with the
    /// framework. Throws ``SafetyEngineUnavailableError`` when the native core
    /// cannot start.
    public static func create(
        locale: String,
        bundle: Bundle = .qravnSafetyCore
    ) throws -> SafetyEngine {
        let catalogs = LocalizationCatalogs.loadAll(bundle: bundle)
        let config = EngineConfig(catalogs: catalogs, locale: locale)
        guard let configData = try? JSONEncoder().encode(config),
              let configJson = String(data: configData, encoding: .utf8)
        else {
            throw SafetyEngineUnavailableError("The engine configuration could not be encoded.")
        }
        let native = NativeSafetyEngine(configJson: configJson)
        guard native.isValid else {
            throw SafetyEngineUnavailableError("The native safety core returned no engine.")
        }
        return SafetyEngine(native: native, catalogs: catalogs)
    }

    static func cautiousFallback(payload: String, nowMs: Int64, locale: String?) -> Assessment {
        Assessment(
            schemaVersion: SCHEMA_VERSION,
            payloadKind: .text,
            rawPayload: payload,
            displayPayload: payload,
            limitations: [Limitation(code: "limitation.payload_not_understood")],
            verdict: .insufficientEvidence,
            confidence: 0,
            recommendedActions: [.copy, .scanAgain],
            locale: locale ?? "en",
            evaluatedAtMs: nowMs
        )
    }
}
