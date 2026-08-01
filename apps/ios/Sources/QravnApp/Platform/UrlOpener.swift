import UIKit

/// The only code path in the app that can hand a scanned address to another app.
///
/// The Swift twin of
/// `apps/android/app/src/main/kotlin/no/qravn/android/platform/UrlOpener.kt`.
///
/// Nothing here ever runs automatically. It is called from a user gesture that
/// the core has explicitly permitted, and it refuses any scheme other than http
/// and https, so a scanned `tel:`, `file:` or vendor deep link can never be used
/// to reach another component.
enum UrlOpener {

    enum Result: Equatable {
        case opened
        case noBrowser
        case refused
    }

    private static let allowedSchemes: Set<String> = ["http", "https"]

    /// The policy on its own, with no side effects, so it can be tested without
    /// a running application.
    ///
    /// `URLComponents` rather than `URL.host`: it parses the authority without
    /// the legacy conveniences that make `URL` accept strings no browser would.
    static func permitted(_ raw: String) -> URL? {
        guard let components = URLComponents(string: raw),
              let scheme = components.scheme?.lowercased(),
              allowedSchemes.contains(scheme),
              let host = components.host,
              !host.isEmpty,
              let url = components.url
        else {
            return nil
        }
        return url
    }

    @MainActor
    static func open(_ raw: String) async -> Result {
        guard let url = permitted(raw) else { return .refused }
        guard UIApplication.shared.canOpenURL(url) else { return .noBrowser }
        return await UIApplication.shared.open(url) ? .opened : .noBrowser
    }
}
