package no.qrrrgh.android

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.HapticFeedbackConstants
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import no.qrrrgh.android.platform.IncomingIntentParser
import no.qrrrgh.android.platform.UrlOpener
import no.qrrrgh.android.ui.result.ResultSheet
import no.qrrrgh.android.ui.scan.ScanScreen
import no.qrrrgh.android.ui.settings.SettingsScreen
import no.qrrrgh.android.ui.theme.QrSafetyTheme
import no.qrrrgh.android.ui.theme.QrSafetyViewfinderTheme

class MainActivity : AppCompatActivity() {

    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        if (savedInstanceState == null) {
            viewModel.onIncoming(IncomingIntentParser.parse(intent))
        }

        setContent {
            val state by viewModel.state.collectAsStateWithLifecycle()
            QrSafetyTheme(dynamicColor = state.settings.matchWallpaperColors) {
                QrSafetyApp(viewModel)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        viewModel.onIncoming(IncomingIntentParser.parse(intent))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun QrSafetyApp(viewModel: MainViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val view = LocalView.current
    val snackbarHostState = remember { SnackbarHostState() }
    var showSettings by rememberSaveable { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val shareTitle = stringResource(R.string.result_share)

    state.message?.let { message ->
        val text = stringResource(message.textRes)
        LaunchedEffect(message.id) {
            snackbarHostState.showSnackbar(text)
            viewModel.consumeMessage()
        }
    }

    // A short confirmation buzz the moment a code is read, so the user knows
    // the scan landed without having to look away from the object.
    LaunchedEffect(state.assessment) {
        if (state.assessment != null && state.settings.hapticsEnabled) {
            view.performHapticFeedback(confirmHapticConstant())
        }
    }

    BackHandler(enabled = showSettings) { showSettings = false }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        if (showSettings) {
            SettingsScreen(
                settings = state.settings,
                engineVersion = state.engineVersion,
                rulesVersion = state.rulesVersion,
                onHapticsChanged = viewModel::setHapticsEnabled,
                onTechnicalDetailsChanged = viewModel::setAlwaysShowTechnicalDetails,
                onWallpaperColorsChanged = viewModel::setMatchWallpaperColors,
                onBack = { showSettings = false },
            )
        } else {
            QrSafetyViewfinderTheme {
                ScanScreen(
                    state = state,
                    requestImagePick = state.pendingImagePick,
                    onImagePickHandled = viewModel::onImagePickHandled,
                    onPayloadDecoded = viewModel::onPayloadDecoded,
                    onImagePicked = viewModel::onImagePicked,
                    onClipboardRequested = { viewModel.onClipboardText(readClipboard(context)) },
                    onTorchToggled = viewModel::setTorchEnabled,
                    onCameraError = { viewModel.showMessage(R.string.error_camera_unavailable) },
                    onOpenSettings = { showSettings = true },
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding(),
        )
    }

    state.assessment?.let { assessment ->
        ResultSheet(
            assessment = assessment,
            verdictDetail = state.verdictDetail,
            alwaysShowTechnicalDetails = state.settings.alwaysShowTechnicalDetails,
            sheetState = sheetState,
            onDismiss = viewModel::dismissResult,
            onOpen = { url ->
                when (UrlOpener.open(context, url)) {
                    UrlOpener.Result.OPENED -> viewModel.dismissResult()
                    UrlOpener.Result.NO_BROWSER,
                    UrlOpener.Result.REFUSED,
                    -> viewModel.showMessage(R.string.result_no_browser)
                }
            },
            onCopy = { value ->
                copyToClipboard(context, value)
                // Android 13 and later show their own copy confirmation, so a
                // second one would be redundant noise.
                if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.TIRAMISU) {
                    viewModel.showMessage(R.string.result_copied)
                }
            },
            onShare = { value ->
                if (!UrlOpener.share(context, value, shareTitle)) {
                    viewModel.showMessage(R.string.error_shared_unsupported)
                }
            },
        )
    }
}

/**
 * Android 11 added a dedicated confirmation haptic. Below that the closest
 * equivalent is the standard virtual key tick.
 */
private fun confirmHapticConstant(): Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        HapticFeedbackConstants.CONFIRM
    } else {
        HapticFeedbackConstants.VIRTUAL_KEY
    }

private fun copyToClipboard(context: Context, value: String) {    val clipboard = context.getSystemService(ClipboardManager::class.java) ?: return
    clipboard.setPrimaryClip(ClipData.newPlainText("qrrrgh", value))
}

private fun readClipboard(context: Context): String? {
    val clipboard = context.getSystemService(ClipboardManager::class.java) ?: return null
    val clip = clipboard.primaryClip ?: return null
    if (clip.itemCount == 0) return null
    return clip.getItemAt(0)?.coerceToText(context)?.toString()
}
