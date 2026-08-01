import Foundation

/// Text arriving from outside the app, narrowed to what it will analyse.
///
/// The Swift twin of `Incoming` in
/// `apps/android/app/src/main/kotlin/no/qravn/android/platform/IncomingIntentParser.kt`.
enum Incoming: Equatable {
    case text(String)
    case scanRequested
    case none
    case unsupported
}

/// Everything reaching this type is attacker-controlled: a share sheet payload,
/// a pasteboard string, a universal link query item. The parser is deliberately
/// narrow, with a hard size cap, and answers ``Incoming/unsupported`` rather
/// than making a best-effort guess.
enum IncomingTextParser {

    /// A QR code holds at most 4296 alphanumeric or 2953 binary characters, so
    /// anything past this cap did not come from a QR code and is not worth the
    /// parser's time.
    static let MAX_PAYLOAD_CHARS: Int = 8192

    /// Accepts pasted or shared text. The value is never trimmed into a
    /// different string: the core must see what the user actually has. Only
    /// surrounding whitespace, which no QR reader would have produced, is
    /// considered, and only for the emptiness check.
    ///
    /// The cap counts UTF-16 units so the limit is identical to the Android
    /// client's, which measures Kotlin `String.length`.
    static func sanitizeText(_ text: String) -> Incoming {
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return .unsupported }
        if text.utf16.count > MAX_PAYLOAD_CHARS { return .unsupported }
        return .text(text)
    }

    /// Universal links and the custom scheme carry the payload the same way the
    /// web app does: `?url=`. Anything else in the URL is ignored.
    static func parse(url: URL) -> Incoming {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return .unsupported
        }
        guard let value = components.queryItems?.first(where: { $0.name == "url" })?.value else {
            return .scanRequested
        }
        return sanitizeText(value)
    }
}
