import Foundation

/// The shared localization catalogs, bundled verbatim from `localization/`.
///
/// The Swift twin of
/// `apps/android/safety-core/src/main/kotlin/no/qravn/safety/LocalizationCatalogs.kt`.
/// These are the only source of finding, limitation, verdict and UI wording.
/// The catalogs are handed to the core, which returns fully interpolated text,
/// so the client never assembles a security sentence itself.
public enum LocalizationCatalogs {

    /// Locales the product ships. Norwegian first: this is a Norway-first product.
    public static let supportedLocales: [String] = ["nb", "nn", "en"]

    public static let FALLBACK_LOCALE: String = "en"

    public static func normalizeLocale(_ tag: String?) -> String {
        let language = tag?
            .split(separator: "-", maxSplits: 1, omittingEmptySubsequences: false).first?
            .split(separator: "_", maxSplits: 1, omittingEmptySubsequences: false).first?
            .lowercased()
        switch language {
        case "nb", "no": return "nb"
        case "nn": return "nn"
        default: return FALLBACK_LOCALE
        }
    }

    /// The locale to run the engine in, derived from the device's preferences.
    public static func preferredLocale(
        from preferences: [String] = Locale.preferredLanguages
    ) -> String {
        for tag in preferences {
            let normalized = normalizeLocale(tag)
            if normalized != FALLBACK_LOCALE { return normalized }
            // An explicit English preference should win over a later Norwegian
            // one; anything unrecognised should not.
            if tag.lowercased().hasPrefix("en") { return FALLBACK_LOCALE }
        }
        return FALLBACK_LOCALE
    }

    public static func loadAll(bundle: Bundle = .qravnSafetyCore) -> [String: [String: CatalogEntry]] {
        var catalogs: [String: [String: CatalogEntry]] = [:]
        for locale in supportedLocales {
            let entries = load(locale: locale, bundle: bundle)
            if !entries.isEmpty {
                catalogs[locale] = entries
            }
        }
        return catalogs
    }

    static func load(locale: String, bundle: Bundle) -> [String: CatalogEntry] {
        guard let url = bundle.url(forResource: locale, withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let catalog = try? JSONDecoder().decode([String: CatalogEntry].self, from: data)
        else {
            return [:]
        }
        return catalog
    }
}

private final class BundleToken {}

extension Bundle {
    /// The framework's own bundle, which is where the catalogs are copied to.
    /// Computed rather than stored so it carries no global mutable state into
    /// a concurrency-checked build.
    public static var qravnSafetyCore: Bundle { Bundle(for: BundleToken.self) }
}
