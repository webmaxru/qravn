package no.qrrrgh.safety

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Kotlin projection of `contracts/v1/assessment.d.ts`.
 *
 * This file is a mirror, not a design. Never change the meaning of an existing
 * field; add new optional ones. The Rust core decides, this client renders.
 * Nothing here may re-derive a verdict or a recommended action.
 */
const val SCHEMA_VERSION: Int = 1

/** The only four public verdicts. There is deliberately no "safe". */
@Serializable
enum class Verdict {
    @SerialName("known_malicious")
    KNOWN_MALICIOUS,

    @SerialName("suspicious")
    SUSPICIOUS,

    @SerialName("insufficient_evidence")
    INSUFFICIENT_EVIDENCE,

    @SerialName("no_known_threat_found")
    NO_KNOWN_THREAT_FOUND,
    ;

    /** Catalog key for the localized verdict wording. */
    val catalogCode: String
        get() = "verdict." + name.lowercase()
}

@Serializable
enum class Severity {
    @SerialName("info")
    INFO,

    @SerialName("low")
    LOW,

    @SerialName("medium")
    MEDIUM,

    @SerialName("high")
    HIGH,

    @SerialName("critical")
    CRITICAL,
}

@Serializable
enum class PayloadKind {
    @SerialName("url")
    URL,

    @SerialName("text")
    TEXT,

    @SerialName("wifi")
    WIFI,

    @SerialName("email")
    EMAIL,

    @SerialName("phone")
    PHONE,

    @SerialName("sms")
    SMS,

    @SerialName("geo")
    GEO,

    @SerialName("contact")
    CONTACT,

    @SerialName("calendar")
    CALENDAR,

    @SerialName("crypto")
    CRYPTO,

    @SerialName("otp")
    OTP,

    @SerialName("deeplink")
    DEEPLINK,

    @SerialName("empty")
    EMPTY,

    @SerialName("binary")
    BINARY,
}

/**
 * What the UI is permitted to offer. Derived by the core, never by the client.
 * [OPEN_BLOCKED] means no open affordance may be presented at all.
 */
@Serializable
enum class RecommendedAction {
    @SerialName("open_allowed")
    OPEN_ALLOWED,

    @SerialName("open_with_confirmation")
    OPEN_WITH_CONFIRMATION,

    @SerialName("open_blocked")
    OPEN_BLOCKED,

    @SerialName("copy")
    COPY,

    @SerialName("expand_redirect_online")
    EXPAND_REDIRECT_ONLINE,

    @SerialName("scan_again")
    SCAN_AGAIN,

    @SerialName("report")
    REPORT,
}

/** Which URL a finding describes. Absent is equivalent to [SCANNED]. */
@Serializable
enum class FindingSubject {
    @SerialName("scanned")
    SCANNED,

    @SerialName("final")
    FINAL,
}

@Serializable
data class Finding(
    val code: String,
    val severity: Severity,
    val params: Map<String, String> = emptyMap(),
    val title: String = "",
    val detail: String = "",
    val subject: FindingSubject? = null,
)

@Serializable
data class Limitation(
    val code: String,
    val params: Map<String, String> = emptyMap(),
    val text: String = "",
)

@Serializable
data class UrlBreakdown(
    val scheme: String,
    val username: String? = null,
    val hasPassword: Boolean = false,
    /** Authority host, ASCII/Punycode form. */
    val host: String,
    /** Unicode presentation form, when different from [host]. */
    val unicodeHost: String? = null,
    val port: Int? = null,
    val path: String = "",
    val query: String? = null,
    val fragment: String? = null,
    val registrableDomain: String? = null,
    val publicSuffix: String? = null,
    val subdomains: List<String> = emptyList(),
    val isIpLiteral: Boolean = false,
    val hasCredentials: Boolean = false,
    val hasPunycode: Boolean = false,
    val isMixedScript: Boolean = false,
    val scripts: List<String> = emptyList(),
)

@Serializable
enum class RedirectMechanism {
    @SerialName("http_status")
    HTTP_STATUS,

    @SerialName("html_meta_refresh")
    HTML_META_REFRESH,

    @SerialName("unknown")
    UNKNOWN,
}

@Serializable
data class RedirectHop(
    val url: String,
    val status: Int? = null,
    val via: RedirectMechanism? = null,
)

@Serializable
enum class RedirectOutcome {
    @SerialName("resolved")
    RESOLVED,

    @SerialName("max_hops")
    MAX_HOPS,

    @SerialName("timeout")
    TIMEOUT,

    @SerialName("network_error")
    NETWORK_ERROR,

    @SerialName("blocked")
    BLOCKED,

    @SerialName("loop")
    LOOP,
}

/**
 * Produced by isolated server infrastructure and passed IN to the core. The
 * user's device never performs this fetch: checking a hostile code must not
 * tell the destination that anyone looked at it.
 */
@Serializable
data class RedirectResolution(
    val chain: List<RedirectHop>,
    val finalUrl: String? = null,
    val outcome: RedirectOutcome,
    val elapsedMs: Long? = null,
    val resolver: String? = null,
)

@Serializable
data class RedirectAnalysis(
    val hopCount: Int,
    val outcome: RedirectOutcome,
    val finalUrl: UrlBreakdown? = null,
    val domainsTraversed: List<String> = emptyList(),
    val crossedRegistrableDomain: Boolean = false,
    val downgradedToHttp: Boolean = false,
)

@Serializable
data class Assessment(
    val schemaVersion: Int,
    val payloadKind: PayloadKind,
    /** Exact decoded payload, never modified. Treat as hostile. */
    val rawPayload: String,
    /** Presentation form. Bidi and control characters already neutralized. */
    val displayPayload: String,
    val url: UrlBreakdown? = null,
    val redirect: RedirectAnalysis? = null,
    val findings: List<Finding> = emptyList(),
    val limitations: List<Limitation> = emptyList(),
    val verdict: Verdict,
    val confidence: Float,
    val classifierScore: Float? = null,
    val recommendedActions: List<RecommendedAction> = emptyList(),
    val summary: String = "",
    val engineVersion: String = "",
    val rulesVersion: String = "",
    val locale: String = "en",
    val evaluatedAtMs: Long = 0,
) {
    /**
     * The single place the UI is allowed to ask whether an open affordance may
     * be shown. [RecommendedAction.OPEN_BLOCKED] always wins.
     */
    val openAffordance: OpenAffordance
        get() = when {
            RecommendedAction.OPEN_BLOCKED in recommendedActions -> OpenAffordance.BLOCKED
            RecommendedAction.OPEN_ALLOWED in recommendedActions -> OpenAffordance.ALLOWED
            RecommendedAction.OPEN_WITH_CONFIRMATION in recommendedActions ->
                OpenAffordance.NEEDS_CONFIRMATION
            else -> OpenAffordance.BLOCKED
        }

    val canExpandRedirect: Boolean
        get() = RecommendedAction.EXPAND_REDIRECT_ONLINE in recommendedActions
}

enum class OpenAffordance { ALLOWED, NEEDS_CONFIRMATION, BLOCKED }

@Serializable
data class CatalogEntry(val title: String, val detail: String)

@Serializable
data class EngineConfig(
    val rules: kotlinx.serialization.json.JsonElement? = null,
    val catalogs: Map<String, Map<String, CatalogEntry>> = emptyMap(),
    val locale: String? = null,
)

@Serializable
data class AssessInput(
    val payload: String,
    /** Injected clock. The core never reads system time. */
    val nowMs: Long,
    val locale: String? = null,
    val redirectResolution: RedirectResolution? = null,
)
