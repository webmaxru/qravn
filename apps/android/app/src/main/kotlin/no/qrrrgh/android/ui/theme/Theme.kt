package no.qrrrgh.android.ui.theme

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

private val LightScheme = lightColorScheme(
    primary = Color(0xFF31628D),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFCFE5FF),
    onPrimaryContainer = Color(0xFF001D33),
    surface = Color(0xFFFCFCFF),
    onSurface = Color(0xFF1A1C1E),
    surfaceVariant = Color(0xFFDEE3EB),
    onSurfaceVariant = Color(0xFF42474E),
)

private val DarkScheme = darkColorScheme(
    primary = Color(0xFF9CCBFB),
    onPrimary = Color(0xFF003354),
    primaryContainer = Color(0xFF144A73),
    onPrimaryContainer = Color(0xFFCFE5FF),
    surface = Color(0xFF1A1C1E),
    onSurface = Color(0xFFE2E2E5),
    surfaceVariant = Color(0xFF42474E),
    onSurfaceVariant = Color(0xFFC2C7CF),
)

/**
 * Verdict colours live outside the Material scheme on purpose.
 *
 * Dynamic colour may recolour the whole app to match the wallpaper. A safety
 * signal must not follow a wallpaper, so these four pairs are fixed and are
 * chosen for contrast in both light and dark. Colour is always accompanied by
 * an icon and a written verdict; it is never the only signal.
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
    criticalContainer = Color(0xFFFFDAD4),
    onCriticalContainer = Color(0xFF410100),
    warningContainer = Color(0xFFFFDEA6),
    onWarningContainer = Color(0xFF2A1800),
    unknownContainer = Color(0xFFE1E2EC),
    onUnknownContainer = Color(0xFF191C20),
    clearContainer = Color(0xFFBFF0CB),
    onClearContainer = Color(0xFF002110),
)

private val DarkVerdictColors = VerdictColors(
    criticalContainer = Color(0xFF7A2018),
    onCriticalContainer = Color(0xFFFFDAD4),
    warningContainer = Color(0xFF5B4200),
    onWarningContainer = Color(0xFFFFDEA6),
    unknownContainer = Color(0xFF3A3D45),
    onUnknownContainer = Color(0xFFE1E2EC),
    clearContainer = Color(0xFF00522A),
    onClearContainer = Color(0xFFBFF0CB),
)

private val LocalVerdictColors = staticCompositionLocalOf { LightVerdictColors }

object QrSafetyTheme {
    val verdictColors: VerdictColors
        @Composable @ReadOnlyComposable get() = LocalVerdictColors.current
}

@Composable
fun QrSafetyTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
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
