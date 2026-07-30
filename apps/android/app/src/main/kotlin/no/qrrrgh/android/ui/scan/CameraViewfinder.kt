package no.qrrrgh.android.ui.scan

import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import no.qrrrgh.android.R
import no.qrrrgh.android.platform.QrCodeAnalyzer
import java.util.concurrent.Executors

/**
 * Live camera preview with on-device QR detection.
 *
 * Frames are analysed in this process and are never stored or transmitted. The
 * app holds no INTERNET permission, so that is enforced by the OS rather than
 * by convention.
 */
@Composable
fun CameraViewfinder(
    scanningEnabled: Boolean,
    torchEnabled: Boolean,
    onTorchAvailabilityChanged: (Boolean) -> Unit,
    onPayloadDecoded: (String) -> Unit,
    onCameraError: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val currentOnPayload by rememberUpdatedState(onPayloadDecoded)
    val currentOnTorchAvailability by rememberUpdatedState(onTorchAvailabilityChanged)
    val currentOnCameraError by rememberUpdatedState(onCameraError)

    val previewView = remember {
        PreviewView(context).apply {
            scaleType = PreviewView.ScaleType.FILL_CENTER
            implementationMode = PreviewView.ImplementationMode.PERFORMANCE
        }
    }
    val analysisExecutor = remember { Executors.newSingleThreadExecutor() }
    val analyzer = remember { QrCodeAnalyzer { payload -> currentOnPayload(payload) } }
    var camera by remember { mutableStateOf<androidx.camera.core.Camera?>(null) }

    DisposableEffect(Unit) {
        onDispose {
            analyzer.close()
            analysisExecutor.shutdown()
        }
    }

    LaunchedEffect(Unit) {
        val providerFuture = ProcessCameraProvider.getInstance(context)
        providerFuture.addListener(
            {
                val provider = runCatching { providerFuture.get() }.getOrNull()
                if (provider == null) {
                    currentOnCameraError()
                    return@addListener
                }
                val preview = Preview.Builder().build().apply {
                    surfaceProvider = previewView.surfaceProvider
                }
                val analysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setResolutionSelector(
                        ResolutionSelector.Builder()
                            .setResolutionStrategy(
                                ResolutionStrategy(
                                    Size(1280, 720),
                                    ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
                                ),
                            )
                            .build(),
                    )
                    .build()
                    .apply { setAnalyzer(analysisExecutor, analyzer) }

                val bound = runCatching {
                    provider.unbindAll()
                    provider.bindToLifecycle(
                        lifecycleOwner,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        analysis,
                    )
                }.getOrNull()

                if (bound == null) {
                    currentOnCameraError()
                } else {
                    camera = bound
                    currentOnTorchAvailability(bound.cameraInfo.hasFlashUnit())
                }
            },
            ContextCompat.getMainExecutor(context),
        )
    }

    LaunchedEffect(scanningEnabled) { analyzer.setEnabled(scanningEnabled) }

    LaunchedEffect(camera, torchEnabled) {
        camera?.takeIf { it.cameraInfo.hasFlashUnit() }?.cameraControl?.enableTorch(torchEnabled)
    }

    val viewfinderDescription = stringResource(R.string.scan_viewfinder_description)

    val currentCamera by rememberUpdatedState(camera)

    Box(
        modifier = modifier
            .semantics { contentDescription = viewfinderDescription }
            .pointerInput(previewView) {
                detectTapGestures { offset ->
                    val activeCamera = currentCamera ?: return@detectTapGestures
                    val point = previewView.meteringPointFactory.createPoint(offset.x, offset.y)
                    runCatching {
                        activeCamera.cameraControl.startFocusAndMetering(
                            FocusMeteringAction.Builder(point).build(),
                        )
                    }
                }
            }
            .pointerInput(Unit) {
                detectTransformGestures { _, _, zoom, _ ->
                    if (zoom == 1f) return@detectTransformGestures
                    val activeCamera = currentCamera ?: return@detectTransformGestures
                    val zoomState = activeCamera.cameraInfo.zoomState.value
                        ?: return@detectTransformGestures
                    val target = (zoomState.zoomRatio * zoom)
                        .coerceIn(zoomState.minZoomRatio, zoomState.maxZoomRatio)
                    runCatching { activeCamera.cameraControl.setZoomRatio(target) }
                }
            },
    ) {
        AndroidView(factory = { previewView }, modifier = Modifier.fillMaxSize())
    }
}
