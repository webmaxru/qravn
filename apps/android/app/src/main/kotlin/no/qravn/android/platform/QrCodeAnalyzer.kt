package no.qravn.android.platform

import android.annotation.SuppressLint
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Reads QR codes from the camera stream, entirely on device.
 *
 * Two rules matter here:
 *
 *  - A single transient frame is not a scan. The same payload must appear in
 *    two consecutive successful frames before it is accepted, which stops a
 *    partially decoded or half-occluded code from becoming a result.
 *  - The raw payload is passed on untouched. Analysis may normalise, but the
 *    evidence the user sees must be exactly what the code contained.
 */
class QrCodeAnalyzer(
    private val onDecoded: (String) -> Unit,
) : ImageAnalysis.Analyzer, AutoCloseable {

    private val scanner: BarcodeScanner = BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build(),
    )

    private val enabled = AtomicBoolean(true)

    private val stabilizer = PayloadStabilizer()

    fun setEnabled(value: Boolean) {
        enabled.set(value)
        if (!value) synchronized(stabilizer) { stabilizer.reset() }
    }

    @SuppressLint("UnsafeOptInUsageError")
    override fun analyze(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (!enabled.get() || mediaImage == null) {
            imageProxy.close()
            return
        }

        val input = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        scanner.process(input)
            .addOnSuccessListener(::onFrame)
            .addOnCompleteListener { imageProxy.close() }
    }

    private fun onFrame(barcodes: List<Barcode>) {
        if (!enabled.get()) return
        val payload = barcodes.firstNotNullOfOrNull(::payloadOf)
        val stable = synchronized(stabilizer) { stabilizer.accept(payload) } ?: return
        enabled.set(false)
        onDecoded(stable)
    }

    override fun close() {
        scanner.close()
    }

    companion object {
        /**
         * ML Kit gives text when the payload decodes as text. When it does not,
         * the bytes are mapped through Latin-1, which is lossless byte to char,
         * so the core can still see and report binary content instead of the
         * app silently discarding a code the user is looking at.
         */
        fun payloadOf(barcode: Barcode): String? =
            barcode.rawValue
                ?: barcode.rawBytes?.takeIf { it.isNotEmpty() }?.toString(Charsets.ISO_8859_1)
    }
}
