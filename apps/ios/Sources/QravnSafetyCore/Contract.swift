import Foundation

/// Swift projection of `contracts/v1/assessment.d.ts`.
///
/// This file is a mirror, not a design. It is the Swift twin of
/// `apps/android/safety-core/src/main/kotlin/no/qravn/safety/Contract.kt`: same
/// type names, same field names, same wire values. Never change the meaning of
/// an existing field; add new optional ones. The Rust core decides, this client
/// renders. Nothing here may re-derive a verdict or a recommended action.
public let SCHEMA_VERSION: Int = 1

/// The only four public verdicts. There is deliberately no "safe".
public enum Verdict: String, Codable, Sendable, CaseIterable {
    case knownMalicious = "known_malicious"
    case suspicious
    case insufficientEvidence = "insufficient_evidence"
    case noKnownThreatFound = "no_known_threat_found"

    /// Catalog key for the localized verdict wording.
    public var catalogCode: String { "verdict.\(rawValue)" }
}

public enum Severity: String, Codable, Sendable, CaseIterable {
    case info
    case low
    case medium
    case high
    case critical
}

public enum PayloadKind: String, Codable, Sendable, CaseIterable {
    case url
    case text
    case wifi
    case email
    case phone
    case sms
    case geo
    case contact
    case calendar
    case crypto
    case otp
    case deeplink
    case empty
    case binary
}

/// What the UI is permitted to offer. Derived by the core, never by the client.
/// `openBlocked` means no open affordance may be presented at all.
public enum RecommendedAction: String, Codable, Sendable, CaseIterable {
    case openAllowed = "open_allowed"
    case openWithConfirmation = "open_with_confirmation"
    case openBlocked = "open_blocked"
    case copy
    case expandRedirectOnline = "expand_redirect_online"
    case scanAgain = "scan_again"
    case report
}

/// Which URL a finding describes. Absent is equivalent to ``scanned``.
public enum FindingSubject: String, Codable, Sendable {
    case scanned
    case final
}

public struct Finding: Codable, Sendable, Equatable {
    public let code: String
    public let severity: Severity
    public let params: [String: String]
    public let title: String
    public let detail: String
    public let subject: FindingSubject?

    public init(
        code: String,
        severity: Severity,
        params: [String: String] = [:],
        title: String = "",
        detail: String = "",
        subject: FindingSubject? = nil
    ) {
        self.code = code
        self.severity = severity
        self.params = params
        self.title = title
        self.detail = detail
        self.subject = subject
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        code = try container.decode(String.self, forKey: .code)
        severity = try container.decode(Severity.self, forKey: .severity)
        params = try container.optional(.params, default: [:])
        title = try container.optional(.title, default: "")
        detail = try container.optional(.detail, default: "")
        subject = try container.decodeIfPresent(FindingSubject.self, forKey: .subject)
    }
}

public struct Limitation: Codable, Sendable, Equatable {
    public let code: String
    public let params: [String: String]
    public let text: String

    public init(code: String, params: [String: String] = [:], text: String = "") {
        self.code = code
        self.params = params
        self.text = text
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        code = try container.decode(String.self, forKey: .code)
        params = try container.optional(.params, default: [:])
        text = try container.optional(.text, default: "")
    }
}

public struct UrlBreakdown: Codable, Sendable, Equatable {
    public let scheme: String
    public let username: String?
    public let hasPassword: Bool
    /// Authority host, ASCII/Punycode form.
    public let host: String
    /// Unicode presentation form, when different from ``host``.
    public let unicodeHost: String?
    public let port: Int?
    public let path: String
    public let query: String?
    public let fragment: String?
    public let registrableDomain: String?
    public let publicSuffix: String?
    public let subdomains: [String]
    public let isIpLiteral: Bool
    public let hasCredentials: Bool
    public let hasPunycode: Bool
    public let isMixedScript: Bool
    public let scripts: [String]

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        scheme = try container.decode(String.self, forKey: .scheme)
        username = try container.decodeIfPresent(String.self, forKey: .username)
        hasPassword = try container.optional(.hasPassword, default: false)
        host = try container.decode(String.self, forKey: .host)
        unicodeHost = try container.decodeIfPresent(String.self, forKey: .unicodeHost)
        port = try container.decodeIfPresent(Int.self, forKey: .port)
        path = try container.optional(.path, default: "")
        query = try container.decodeIfPresent(String.self, forKey: .query)
        fragment = try container.decodeIfPresent(String.self, forKey: .fragment)
        registrableDomain = try container.decodeIfPresent(String.self, forKey: .registrableDomain)
        publicSuffix = try container.decodeIfPresent(String.self, forKey: .publicSuffix)
        subdomains = try container.optional(.subdomains, default: [])
        isIpLiteral = try container.optional(.isIpLiteral, default: false)
        hasCredentials = try container.optional(.hasCredentials, default: false)
        hasPunycode = try container.optional(.hasPunycode, default: false)
        isMixedScript = try container.optional(.isMixedScript, default: false)
        scripts = try container.optional(.scripts, default: [])
    }
}

public enum RedirectMechanism: String, Codable, Sendable {
    case httpStatus = "http_status"
    case htmlMetaRefresh = "html_meta_refresh"
    case unknown
}

public struct RedirectHop: Codable, Sendable, Equatable {
    public let url: String
    public let status: Int?
    public let via: RedirectMechanism?

    public init(url: String, status: Int? = nil, via: RedirectMechanism? = nil) {
        self.url = url
        self.status = status
        self.via = via
    }
}

public enum RedirectOutcome: String, Codable, Sendable {
    case resolved
    case maxHops = "max_hops"
    case timeout
    case networkError = "network_error"
    case blocked
    case loop
}

/// Produced by isolated server infrastructure and passed IN to the core. The
/// user's device never performs this fetch: checking a hostile code must not
/// tell the destination that anyone looked at it.
public struct RedirectResolution: Codable, Sendable, Equatable {
    public let chain: [RedirectHop]
    public let finalUrl: String?
    public let outcome: RedirectOutcome
    public let elapsedMs: Int64?
    public let resolver: String?

    public init(
        chain: [RedirectHop],
        finalUrl: String? = nil,
        outcome: RedirectOutcome,
        elapsedMs: Int64? = nil,
        resolver: String? = nil
    ) {
        self.chain = chain
        self.finalUrl = finalUrl
        self.outcome = outcome
        self.elapsedMs = elapsedMs
        self.resolver = resolver
    }
}

public struct RedirectAnalysis: Codable, Sendable, Equatable {
    public let hopCount: Int
    public let outcome: RedirectOutcome
    public let finalUrl: UrlBreakdown?
    public let domainsTraversed: [String]
    public let crossedRegistrableDomain: Bool
    public let downgradedToHttp: Bool

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        hopCount = try container.decode(Int.self, forKey: .hopCount)
        outcome = try container.decode(RedirectOutcome.self, forKey: .outcome)
        finalUrl = try container.decodeIfPresent(UrlBreakdown.self, forKey: .finalUrl)
        domainsTraversed = try container.optional(.domainsTraversed, default: [])
        crossedRegistrableDomain = try container.optional(.crossedRegistrableDomain, default: false)
        downgradedToHttp = try container.optional(.downgradedToHttp, default: false)
    }
}

public struct Assessment: Codable, Sendable, Equatable {
    public let schemaVersion: Int
    public let payloadKind: PayloadKind
    /// Exact decoded payload, never modified. Treat as hostile.
    public let rawPayload: String
    /// Presentation form. Bidi and control characters already neutralized.
    public let displayPayload: String
    public let url: UrlBreakdown?
    public let redirect: RedirectAnalysis?
    public let findings: [Finding]
    public let limitations: [Limitation]
    public let verdict: Verdict
    public let confidence: Double
    public let classifierScore: Double?
    public let recommendedActions: [RecommendedAction]
    public let summary: String
    public let engineVersion: String
    public let rulesVersion: String
    public let locale: String
    public let evaluatedAtMs: Int64

    public init(
        schemaVersion: Int,
        payloadKind: PayloadKind,
        rawPayload: String,
        displayPayload: String,
        url: UrlBreakdown? = nil,
        redirect: RedirectAnalysis? = nil,
        findings: [Finding] = [],
        limitations: [Limitation] = [],
        verdict: Verdict,
        confidence: Double,
        classifierScore: Double? = nil,
        recommendedActions: [RecommendedAction] = [],
        summary: String = "",
        engineVersion: String = "",
        rulesVersion: String = "",
        locale: String = "en",
        evaluatedAtMs: Int64 = 0
    ) {
        self.schemaVersion = schemaVersion
        self.payloadKind = payloadKind
        self.rawPayload = rawPayload
        self.displayPayload = displayPayload
        self.url = url
        self.redirect = redirect
        self.findings = findings
        self.limitations = limitations
        self.verdict = verdict
        self.confidence = confidence
        self.classifierScore = classifierScore
        self.recommendedActions = recommendedActions
        self.summary = summary
        self.engineVersion = engineVersion
        self.rulesVersion = rulesVersion
        self.locale = locale
        self.evaluatedAtMs = evaluatedAtMs
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        schemaVersion = try container.decode(Int.self, forKey: .schemaVersion)
        payloadKind = try container.decode(PayloadKind.self, forKey: .payloadKind)
        rawPayload = try container.decode(String.self, forKey: .rawPayload)
        displayPayload = try container.decode(String.self, forKey: .displayPayload)
        url = try container.decodeIfPresent(UrlBreakdown.self, forKey: .url)
        redirect = try container.decodeIfPresent(RedirectAnalysis.self, forKey: .redirect)
        findings = try container.optional(.findings, default: [])
        limitations = try container.optional(.limitations, default: [])
        verdict = try container.decode(Verdict.self, forKey: .verdict)
        confidence = try container.optional(.confidence, default: 0)
        classifierScore = try container.decodeIfPresent(Double.self, forKey: .classifierScore)
        recommendedActions = try container.optional(.recommendedActions, default: [])
        summary = try container.optional(.summary, default: "")
        engineVersion = try container.optional(.engineVersion, default: "")
        rulesVersion = try container.optional(.rulesVersion, default: "")
        locale = try container.optional(.locale, default: "en")
        evaluatedAtMs = try container.optional(.evaluatedAtMs, default: 0)
    }

    /// The single place the UI is allowed to ask whether an open affordance may
    /// be shown. ``RecommendedAction/openBlocked`` always wins.
    public var openAffordance: OpenAffordance {
        if recommendedActions.contains(.openBlocked) { return .blocked }
        if recommendedActions.contains(.openAllowed) { return .allowed }
        if recommendedActions.contains(.openWithConfirmation) { return .needsConfirmation }
        return .blocked
    }

    public var canExpandRedirect: Bool {
        recommendedActions.contains(.expandRedirectOnline)
    }
}

public enum OpenAffordance: Sendable, Equatable {
    case allowed
    case needsConfirmation
    case blocked
}

public struct CatalogEntry: Codable, Sendable, Equatable {
    public let title: String
    public let detail: String

    public init(title: String, detail: String) {
        self.title = title
        self.detail = detail
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.optional(.title, default: "")
        detail = try container.optional(.detail, default: "")
    }
}

public struct EngineConfig: Encodable, Sendable {
    public let catalogs: [String: [String: CatalogEntry]]
    public let locale: String?

    public init(catalogs: [String: [String: CatalogEntry]] = [:], locale: String? = nil) {
        self.catalogs = catalogs
        self.locale = locale
    }
}

public struct AssessInput: Encodable, Sendable {
    public let payload: String
    /// Injected clock. The core never reads system time.
    public let nowMs: Int64
    public let locale: String?
    public let redirectResolution: RedirectResolution?

    public init(
        payload: String,
        nowMs: Int64,
        locale: String? = nil,
        redirectResolution: RedirectResolution? = nil
    ) {
        self.payload = payload
        self.nowMs = nowMs
        self.locale = locale
        self.redirectResolution = redirectResolution
    }
}

/// Kotlin's `Json { explicitNulls = false }` skips absent fields entirely.
/// Swift's synthesized decoding has no notion of a default value, so every type
/// above that carries one decodes through this helper instead.
extension KeyedDecodingContainer {
    func optional<T: Decodable>(_ key: Key, default defaultValue: T) throws -> T {
        try decodeIfPresent(T.self, forKey: key) ?? defaultValue
    }
}
