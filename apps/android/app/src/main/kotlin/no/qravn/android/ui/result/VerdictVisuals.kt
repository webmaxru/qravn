package no.qravn.android.ui.result

import androidx.annotation.DrawableRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color
import no.qravn.android.R
import no.qravn.android.ui.theme.QrSafetyTheme
import no.qravn.safety.Severity
import no.qravn.safety.Verdict

/**
 * Presentation for a verdict.
 *
 * Colour is never the only signal: every verdict also carries a distinct icon
 * and the written verdict text from the shared catalog. That is a WCAG
 * requirement and it is also what makes the result legible in sunlight, which
 * is where most codes are actually scanned.
 */
@Immutable
data class VerdictVisual(
    @param:DrawableRes val iconRes: Int,
    val container: Color,
    val onContainer: Color,
)

@Composable
@ReadOnlyComposable
fun visualFor(verdict: Verdict): VerdictVisual {
    val colors = QrSafetyTheme.verdictColors
    return when (verdict) {
        Verdict.KNOWN_MALICIOUS -> VerdictVisual(
            iconRes = R.drawable.ic_verdict_critical,
            container = colors.criticalContainer,
            onContainer = colors.onCriticalContainer,
        )

        Verdict.SUSPICIOUS -> VerdictVisual(
            iconRes = R.drawable.ic_verdict_warning,
            container = colors.warningContainer,
            onContainer = colors.onWarningContainer,
        )

        Verdict.INSUFFICIENT_EVIDENCE -> VerdictVisual(
            iconRes = R.drawable.ic_verdict_unknown,
            container = colors.unknownContainer,
            onContainer = colors.onUnknownContainer,
        )

        Verdict.NO_KNOWN_THREAT_FOUND -> VerdictVisual(
            iconRes = R.drawable.ic_verdict_clear,
            container = colors.clearContainer,
            onContainer = colors.onClearContainer,
        )
    }
}

@DrawableRes
fun iconForSeverity(severity: Severity): Int = when (severity) {
    Severity.CRITICAL, Severity.HIGH -> R.drawable.ic_verdict_critical
    Severity.MEDIUM, Severity.LOW -> R.drawable.ic_verdict_warning
    Severity.INFO -> R.drawable.ic_info
}
