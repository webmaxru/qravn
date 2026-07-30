package no.qrrrgh.android.platform

/**
 * Requires a payload to be seen in several consecutive frames before it counts
 * as a scan.
 *
 * A QR code that is half occluded, motion blurred or partially reflected can
 * still decode to something, and acting on a single frame turns that into a
 * wrong destination shown to the user. Requiring agreement across frames costs
 * a fraction of a second and removes that class of error.
 */
internal class PayloadStabilizer(private val requiredRepeats: Int = 2) {

    private var candidate: String? = null
    private var seen = 0

    init {
        require(requiredRepeats >= 1) { "requiredRepeats must be at least 1" }
    }

    /** Returns the payload once it is stable, otherwise null. */
    fun accept(payload: String?): String? {
        if (payload == null) {
            reset()
            return null
        }
        if (payload == candidate) {
            seen++
        } else {
            candidate = payload
            seen = 1
        }
        if (seen < requiredRepeats) return null
        reset()
        return payload
    }

    fun reset() {
        candidate = null
        seen = 0
    }
}
