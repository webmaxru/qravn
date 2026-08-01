import QravnSafetyCore
import SwiftUI
import UIKit

/// Presentation for a verdict.
///
/// The Swift twin of
/// `apps/android/app/src/main/kotlin/no/qravn/android/ui/result/VerdictVisuals.kt`,
/// down to the palette.
///
/// Colour is never the only signal: every verdict also carries a distinct icon
/// and the written verdict text from the shared catalog. That is a WCAG
/// requirement and it is also what makes the result legible in sunlight, which
/// is where most codes are actually scanned.
struct VerdictVisual {
    let systemImage: String
    let container: Color
    let onContainer: Color
}

enum VerdictColors {
    static let criticalContainer = Color(light: 0xFFE1DA, dark: 0x4E150B)
    static let onCriticalContainer = Color(light: 0x5E1608, dark: 0xFFD9D0)
    static let warningContainer = Color(light: 0xFFEBC7, dark: 0x422703)
    static let onWarningContainer = Color(light: 0x4A2A02, dark: 0xFFE0AE)
    static let unknownContainer = Color(light: 0xE2E2F4, dark: 0x23264F)
    static let onUnknownContainer = Color(light: 0x1E2050, dark: 0xD5D6F2)
    static let clearContainer = Color(light: 0xF0F1EF, dark: 0x1E2123)
    static let onClearContainer = Color(light: 0x111315, dark: 0xE6E7E5)
}

func visual(for verdict: Verdict) -> VerdictVisual {
    switch verdict {
    case .knownMalicious:
        return VerdictVisual(
            systemImage: "exclamationmark.octagon.fill",
            container: VerdictColors.criticalContainer,
            onContainer: VerdictColors.onCriticalContainer
        )
    case .suspicious:
        return VerdictVisual(
            systemImage: "exclamationmark.triangle.fill",
            container: VerdictColors.warningContainer,
            onContainer: VerdictColors.onWarningContainer
        )
    case .insufficientEvidence:
        return VerdictVisual(
            systemImage: "questionmark.circle.fill",
            container: VerdictColors.unknownContainer,
            onContainer: VerdictColors.onUnknownContainer
        )
    case .noKnownThreatFound:
        return VerdictVisual(
            systemImage: "checkmark.shield.fill",
            container: VerdictColors.clearContainer,
            onContainer: VerdictColors.onClearContainer
        )
    }
}

func systemImage(for severity: Severity) -> String {
    switch severity {
    case .critical, .high: return "exclamationmark.octagon.fill"
    case .medium, .low: return "exclamationmark.triangle.fill"
    case .info: return "info.circle.fill"
    }
}

extension Color {
    /// The Android theme carries a light and a dark value for every verdict
    /// colour. A dynamic UIColor is the only way to keep both on iOS without
    /// duplicating the whole palette per appearance.
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { traits in
            UIColor(rgb: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension UIColor {
    fileprivate convenience init(rgb: UInt32) {
        self.init(
            red: CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue: CGFloat(rgb & 0xFF) / 255,
            alpha: 1
        )
    }
}
