package no.qravn.android.ui.scan

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import no.qravn.android.EngineStatus
import no.qravn.android.R
import no.qravn.android.ScanUiState
import no.qravn.android.platform.UrlOpener

/**
 * The whole product in one screen: point the camera, get an answer.
 *
 * Everything optional lives behind one settings button. The camera is the
 * default surface because the primary job is scanning, not configuring.
 */
@Composable
fun ScanScreen(
    state: ScanUiState,
    requestImagePick: Boolean,
    onImagePickHandled: () -> Unit,
    onPayloadDecoded: (String) -> Unit,
    onImagePicked: (android.net.Uri) -> Unit,
    onClipboardRequested: () -> Unit,
    onTorchToggled: (Boolean) -> Unit,
    onCameraError: () -> Unit,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var hasCameraPermission by rememberSaveable {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    var permissionRequested by rememberSaveable { mutableStateOf(false) }
    var torchAvailable by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        hasCameraPermission = granted
        permissionRequested = true
    }

    val imagePicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri -> uri?.let(onImagePicked) }

    LaunchedEffect(requestImagePick) {
        if (requestImagePick) {
            imagePicker.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
            )
            onImagePickHandled()
        }
    }

    // The torch is a physical light. Leaving it on after the screen goes away
    // would be both surprising and a battery drain.
    DisposableEffect(Unit) { onDispose { onTorchToggled(false) } }

    Box(modifier = modifier.fillMaxSize().background(Color.Black)) {
        when {
            state.engineStatus == EngineStatus.UNAVAILABLE -> EngineUnavailable()

            hasCameraPermission -> CameraViewfinder(
                scanningEnabled = state.cameraScanningEnabled,
                torchEnabled = state.torchEnabled,
                onTorchAvailabilityChanged = { torchAvailable = it },
                onPayloadDecoded = onPayloadDecoded,
                onCameraError = onCameraError,
                modifier = Modifier.fillMaxSize(),
            )

            else -> CameraPermissionPanel(
                deniedBefore = permissionRequested,
                onRequest = { permissionLauncher.launch(Manifest.permission.CAMERA) },
                onOpenAppSettings = { UrlOpener.openAppSettings(context) },
            )
        }

        if (hasCameraPermission && state.engineStatus != EngineStatus.UNAVAILABLE) {
            ScanFrameOverlay(modifier = Modifier.align(Alignment.Center))
        }

        TopBar(
            onOpenSettings = onOpenSettings,
            modifier = Modifier.align(Alignment.TopEnd),
        )

        HintBanner(
            visible = hasCameraPermission && state.engineStatus == EngineStatus.READY,
            modifier = Modifier.align(Alignment.TopCenter),
        )

        BottomActions(
            torchEnabled = state.torchEnabled,
            torchAvailable = torchAvailable && hasCameraPermission,
            onTorchToggled = onTorchToggled,
            onPickImage = {
                imagePicker.launch(
                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                )
            },
            onClipboardRequested = onClipboardRequested,
            modifier = Modifier.align(Alignment.BottomCenter),
        )

        AnimatedVisibility(
            visible = state.isAnalysing,
            modifier = Modifier.align(Alignment.Center),
        ) {
            AnalysingIndicator()
        }
    }
}

@Composable
private fun TopBar(onOpenSettings: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .statusBarsPadding()
            .padding(8.dp),
    ) {
        IconButton(
            onClick = onOpenSettings,
            modifier = Modifier.testTag("settingsButton"),
        ) {
            Icon(
                painter = painterResource(R.drawable.ic_settings),
                contentDescription = stringResource(R.string.scan_settings),
                tint = Color.White,
            )
        }
    }
}

@Composable
private fun HintBanner(visible: Boolean, modifier: Modifier = Modifier) {
    AnimatedVisibility(visible = visible, modifier = modifier) {
        Column(
            modifier = Modifier
                .statusBarsPadding()
                .padding(horizontal = 24.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = stringResource(R.string.scan_title),
                style = MaterialTheme.typography.titleMedium,
                color = Color.White,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = stringResource(R.string.scan_hint),
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.85f),
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun ScanFrameOverlay(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(260.dp)
            .background(Color.Transparent, RoundedCornerShape(28.dp))
            .alpha(0.9f),
    ) {
        androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxSize()) {
            val stroke = 4.dp.toPx()
            val corner = 44.dp.toPx()
            val color = Color.White
            // Four corner brackets rather than a full box: the brackets frame
            // the code without hiding what the camera is seeing.
            listOf(
                Triple(0f, 0f, 1f to 1f),
                Triple(size.width, 0f, -1f to 1f),
                Triple(0f, size.height, 1f to -1f),
                Triple(size.width, size.height, -1f to -1f),
            ).forEach { (x, y, dir) ->
                val (dx, dy) = dir
                drawLine(
                    color = color,
                    start = androidx.compose.ui.geometry.Offset(x, y),
                    end = androidx.compose.ui.geometry.Offset(x + corner * dx, y),
                    strokeWidth = stroke,
                )
                drawLine(
                    color = color,
                    start = androidx.compose.ui.geometry.Offset(x, y),
                    end = androidx.compose.ui.geometry.Offset(x, y + corner * dy),
                    strokeWidth = stroke,
                )
            }
        }
    }
}

@Composable
private fun BottomActions(
    torchEnabled: Boolean,
    torchAvailable: Boolean,
    onTorchToggled: (Boolean) -> Unit,
    onPickImage: () -> Unit,
    onClipboardRequested: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 16.dp),
        shape = RoundedCornerShape(28.dp),
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f),
        tonalElevation = 3.dp,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ActionChip(
                iconRes = R.drawable.ic_image,
                label = stringResource(R.string.scan_from_image),
                onClick = onPickImage,
                modifier = Modifier.testTag("pickImageButton"),
            )
            if (torchAvailable) {
                ActionChip(
                    iconRes = if (torchEnabled) {
                        R.drawable.ic_flash_off
                    } else {
                        R.drawable.ic_flash_on
                    },
                    label = stringResource(
                        if (torchEnabled) R.string.scan_torch_off else R.string.scan_torch_on,
                    ),
                    onClick = { onTorchToggled(!torchEnabled) },
                    modifier = Modifier.testTag("torchButton"),
                )
            }
            ActionChip(
                iconRes = R.drawable.ic_paste,
                label = stringResource(R.string.scan_from_clipboard),
                onClick = onClipboardRequested,
                modifier = Modifier.testTag("pasteButton"),
            )
        }
    }
}

@Composable
private fun ActionChip(
    iconRes: Int,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    FilledTonalButton(onClick = onClick, modifier = modifier) {
        Icon(
            painter = painterResource(iconRes),
            contentDescription = null,
            modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(8.dp))
        Text(text = label, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
private fun AnalysingIndicator() {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 6.dp,
    ) {
        Row(
            modifier = Modifier
                .padding(horizontal = 20.dp, vertical = 14.dp)
                .semantics { liveRegion = LiveRegionMode.Polite },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            Spacer(Modifier.width(12.dp))
            Text(stringResource(R.string.scan_analysing))
        }
    }
}

@Composable
private fun CameraPermissionPanel(
    deniedBefore: Boolean,
    onRequest: () -> Unit,
    onOpenAppSettings: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier.padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(
                painter = painterResource(R.drawable.ic_tile_scan),
                contentDescription = null,
                modifier = Modifier.size(56.dp),
                tint = Color.White,
            )
            Spacer(Modifier.height(20.dp))
            Text(
                text = stringResource(
                    if (deniedBefore) R.string.permission_denied_title
                    else R.string.permission_title,
                ),
                style = MaterialTheme.typography.headlineSmall,
                color = Color.White,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(10.dp))
            Text(
                text = stringResource(
                    if (deniedBefore) R.string.permission_denied_body
                    else R.string.permission_body,
                ),
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.85f),
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(24.dp))
            if (deniedBefore) {
                Button(onClick = onOpenAppSettings) {
                    Text(stringResource(R.string.permission_open_settings))
                }
            } else {
                Button(
                    onClick = onRequest,
                    modifier = Modifier.testTag("grantCameraButton"),
                ) {
                    Text(stringResource(R.string.permission_grant))
                }
            }
        }
    }
}

@Composable
private fun EngineUnavailable() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier
                .padding(32.dp)
                .testTag("engineUnavailable"),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(
                painter = painterResource(R.drawable.ic_verdict_critical),
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = Color.White,
            )
            Spacer(Modifier.height(16.dp))
            Text(
                text = stringResource(R.string.error_engine_title),
                style = MaterialTheme.typography.headlineSmall,
                color = Color.White,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.error_engine_body),
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.85f),
                textAlign = TextAlign.Center,
            )
        }
    }
}
