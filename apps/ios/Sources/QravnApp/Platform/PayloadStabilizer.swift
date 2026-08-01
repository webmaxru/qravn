import Foundation

/// Requires a payload to be seen in several consecutive frames before it counts
/// as a scan.
///
/// The Swift twin of
/// `apps/android/app/src/main/kotlin/no/qravn/android/platform/PayloadStabilizer.kt`.
///
/// A QR code that is half occluded, motion blurred or partially reflected can
/// still decode to something, and acting on a single frame turns that into a
/// wrong destination shown to the user. Requiring agreement across frames costs
/// a fraction of a second and removes that class of error.
final class PayloadStabilizer {

    private let requiredRepeats: Int
    private var candidate: String?
    private var seen = 0

    init(requiredRepeats: Int = 2) {
        precondition(requiredRepeats >= 1, "requiredRepeats must be at least 1")
        self.requiredRepeats = requiredRepeats
    }

    /// Returns the payload once it is stable, otherwise nil.
    @discardableResult
    func accept(_ payload: String?) -> String? {
        guard let payload else {
            reset()
            return nil
        }
        if payload == candidate {
            seen += 1
        } else {
            candidate = payload
            seen = 1
        }
        guard seen >= requiredRepeats else { return nil }
        reset()
        return payload
    }

    func reset() {
        candidate = nil
        seen = 0
    }
}
