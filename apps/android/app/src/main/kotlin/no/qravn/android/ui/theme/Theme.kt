package no.qravn.android.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

/**
 * The brand neutrals: ink on paper, the only two colours a QR code may have.
 *
 * This is the default palette. The app is deliberately monochrome at rest,
 * because in this product colour means "something is wrong" and nothing else.
 *
 * Every role is set, including the ones the app does not obviously use. Any
 * role left unset keeps its baseline Material value, which is a purple, and
 * that purple leaks out through components that pick their own container role
 * — a bottom sheet reaches for `surfaceContainerLow` without being asked.
 * Error roles are neutral here too, because in this app a red surface is
 * reserved for a verdict and must never appear for a form error.
 */
private val LightScheme = lightColorScheme(
    primary = Color(0xFF111315),
    onPrimary = Color(0xFFFAFAF8),
    primaryContainer = Color(0xFFE4E6E4),
    onPrimaryContainer = Color(0xFF111315),
    inversePrimary = Color(0xFFE6E7E5),
    secondary = Color(0xFF41464A),
    onSecondary = Color(0xFFFAFAF8),
    secondaryContainer = Color(0xFFE4E6E4),
    onSecondaryContainer = Color(0xFF111315),
    tertiary = Color(0xFF41464A),
    onTertiary = Color(0xFFFAFAF8),
    tertiaryContainer = Color(0xFFE4E6E4),
    onTertiaryContainer = Color(0xFF111315),
    background = Color(0xFFFAFAF8),
    onBackground = Color(0xFF111315),
    surface = Color(0xFFFAFAF8),
    onSurface = Color(0xFF111315),
    surfaceVariant = Color(0xFFECEEEC),
    onSurfaceVariant = Color(0xFF4A4F52),
    surfaceTint = Color(0xFF111315),
    inverseSurface = Color(0xFF2A2E30),
    inverseOnSurface = Color(0xFFF2F3F1),
    surfaceBright = Color(0xFFFAFAF8),
    surfaceDim = Color(0xFFDCDDDB),
    surfaceContainerLowest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFF5F5F3),
    surfaceContainer = Color(0xFFF0F0EE),
    surfaceContainerHigh = Color(0xFFEAEAE8),
    surfaceContainerHighest = Color(0xFFE4E5E3),
    error = Color(0xFFD92B12),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFFFE1DA),
    onErrorContainer = Color(0xFF5E1608),
    outline = Color(0xFF5B6165),
    outlineVariant = Color(0xFFDCDFE0),
    scrim = Color(0xFF000000),
)

private val DarkScheme = darkColorScheme(
    primary = Color(0xFFE6E7E5),
    onPrimary = Color(0xFF111315),
    primaryContainer = Color(0xFF303436),
    onPrimaryContainer = Color(0xFFE6E7E5),
    inversePrimary = Color(0xFF111315),
    secondary = Color(0xFFC3C7C9),
    onSecondary = Color(0xFF111315),
    secondaryContainer = Color(0xFF303436),
    onSecondaryContainer = Color(0xFFE6E7E5),
    tertiary = Color(0xFFC3C7C9),
    onTertiary = Color(0xFF111315),
    tertiaryContainer = Color(0xFF303436),
    onTertiaryContainer = Color(0xFFE6E7E5),
    background = Color(0xFF121416),
    onBackground = Color(0xFFE6E7E5),
    surface = Color(0xFF121416),
    onSurface = Color(0xFFE6E7E5),
    surfaceVariant = Color(0xFF1E2123),
    onSurfaceVariant = Color(0xFFA8AEB1),
    surfaceTint = Color(0xFFE6E7E5),
    inverseSurface = Color(0xFFE6E7E5),
    inverseOnSurface = Color(0xFF1E2123),
    surfaceBright = Color(0xFF383B3D),
    surfaceDim = Color(0xFF121416),
    surfaceContainerLowest = Color(0xFF0D0F10),
    surfaceContainerLow = Color(0xFF1A1D1F),
    surfaceContainer = Color(0xFF1E2123),
    surfaceContainerHigh = Color(0xFF282B2D),
    surfaceContainerHighest = Color(0xFF333739),
    error = Color(0xFFFF8A70),
    onError = Color(0xFF111315),
    errorContainer = Color(0xFF4E150B),
    onErrorContainer = Color(0xFFFFD9D0),
    outline = Color(0xFFA8AEB1),
    outlineVariant = Color(0xFF333739),
    scrim = Color(0xFF000000),
)

/**
 * Verdict colours live outside the Material scheme on purpose.
 *
 * Dynamic colour may recolour the whole app to match the wallpaper. A safety
 * signal must not follow a wallpaper, so these four pairs are fixed and are
 * chosen for contrast in both light and dark. Colour is always accompanied by
 * an icon and a written verdict; it is never the only signal.
 *
 * The ramp is a volume control, not a rainbow. A restrained green distinguishes
 * "no known threat found" without changing that qualified verdict into a
 * promise of safety; the written verdict and open-ring icon keep that boundary
 * explicit.
 */
@Immutable
data class VerdictColors(
    val criticalContainer: Color,
    val onCriticalContainer: Color,
    val warningContainer: Color,
    val onWarningContainer: Color,
    val unknownContainer: Color,
    val onUnknownContainer: Color,
    val clearContainer: Color,
    val onClearContainer: Color,
)

private val LightVerdictColors = VerdictColors(
    criticalContainer = Color(0xFFFFE1DA),
    onCriticalContainer = Color(0xFF5E1608),
    warningContainer = Color(0xFFFFEBC7),
    onWarningContainer = Color(0xFF4A2A02),
    unknownContainer = Color(0xFFE2E2F4),
    onUnknownContainer = Color(0xFF1E2050),
    clearContainer = Color(0xFFE3F4E8),
    onClearContainer = Color(0xFF174A2A),
)

private val DarkVerdictColors = VerdictColors(
    criticalContainer = Color(0xFF4E150B),
    onCriticalContainer = Color(0xFFFFD9D0),
    warningContainer = Color(0xFF422703),
    onWarningContainer = Color(0xFFFFE0AE),
    unknownContainer = Color(0xFF23264F),
    onUnknownContainer = Color(0xFFD5D6F2),
    clearContainer = Color(0xFF163521),
    onClearContainer = Color(0xFFC9F3D6),
)

private val LocalVerdictColors = staticCompositionLocalOf { LightVerdictColors }

object QrSafetyTheme {
    val verdictColors: VerdictColors
        @Composable @ReadOnlyComposable get() = LocalVerdictColors.current
}

/**
 * @param dynamicColor draw the chrome from the wallpaper palette instead of
 *   the brand neutrals. Off by default: Material You would repaint the app in
 *   whatever hue the wallpaper happens to be, and a product whose entire visual
 *   argument is "colour means something is wrong" cannot afford a lavender
 *   button that means nothing. It is offered as a setting because it is a real
 *   platform feature some people want, and [VerdictColors] stays outside the
 *   scheme either way, so no wallpaper can tint a verdict.
 */
@Composable
fun QrSafetyTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)

        darkTheme -> DarkScheme
        else -> LightScheme
    }

    CompositionLocalProvider(
        LocalVerdictColors provides if (darkTheme) DarkVerdictColors else LightVerdictColors,
    ) {
        MaterialTheme(colorScheme = colorScheme, content = content)
    }
}

/**
 * The viewfinder is always dark, whatever the system theme says, because its
 * background is the live camera image or black before the camera opens. Its
 * controls therefore have to be drawn from the dark palette or they would be
 * ink on black. This deliberately ignores the wallpaper setting too: the one
 * screen the user looks at while pointing the phone at something is the one
 * screen that cannot afford a legibility experiment.
 */
@Composable
fun QrSafetyViewfinderTheme(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalVerdictColors provides DarkVerdictColors) {
        MaterialTheme(colorScheme = DarkScheme, content = content)
    }
}
