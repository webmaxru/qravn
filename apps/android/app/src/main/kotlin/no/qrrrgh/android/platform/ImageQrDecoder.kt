package no.qrrrgh.android.platform

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume

sealed interface ImageDecodeResult {
    data class Decoded(val payload: String) : ImageDecodeResult
    data object NoCodeFound : ImageDecodeResult
    data object TooLarge : ImageDecodeResult
    data object Unreadable : ImageDecodeResult
}

/**
 * Decodes a QR code from an image the user explicitly picked or shared.
 *
 * The image is opened through its content URI only, never through a path, is
 * bounded before it is decoded so a decompression bomb cannot exhaust memory,
 * is sampled down to the smallest size that still resolves QR modules, and is
 * recycled immediately. Nothing is uploaded and nothing is persisted.
 */
object ImageQrDecoder {

    /** Guards against decompression bombs before any pixel is allocated. */
    private const val MAX_SOURCE_PIXELS = 80_000_000

    /** More than enough detail for a dense QR code on a phone photo. */
    private const val MAX_DECODE_EDGE = 2400

    suspend fun decode(context: Context, uri: Uri): ImageDecodeResult =
        withContext(Dispatchers.IO) {
            val bitmap = loadBounded(context, uri) ?: return@withContext ImageDecodeResult.Unreadable
            try {
                when (val payload = scan(bitmap)) {
                    null -> ImageDecodeResult.NoCodeFound
                    else -> ImageDecodeResult.Decoded(payload)
                }
            } catch (_: TooLargeException) {
                ImageDecodeResult.TooLarge
            } finally {
                bitmap.recycle()
            }
        }

    private class TooLargeException : Exception()

    private fun loadBounded(context: Context, uri: Uri): Bitmap? = runCatching {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }

        val width = bounds.outWidth
        val height = bounds.outHeight
        if (width <= 0 || height <= 0) return null
        if (width.toLong() * height.toLong() > MAX_SOURCE_PIXELS) throw TooLargeException()

        val options = BitmapFactory.Options().apply {
            inSampleSize = sampleSizeFor(width, height)
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        context.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, options)
        }
    }.getOrElse { error ->
        if (error is TooLargeException) throw error else null
    }

    internal fun sampleSizeFor(width: Int, height: Int): Int {
        var sample = 1
        var longEdge = maxOf(width, height)
        while (longEdge / 2 >= MAX_DECODE_EDGE) {
            longEdge /= 2
            sample *= 2
        }
        return sample
    }

    private suspend fun scan(bitmap: Bitmap): String? {
        val scanner = BarcodeScanning.getClient(
            BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build(),
        )
        return try {
            suspendCancellableCoroutine { continuation ->
                scanner.process(InputImage.fromBitmap(bitmap, 0))
                    .addOnSuccessListener { barcodes ->
                        continuation.resume(barcodes.firstNotNullOfOrNull(QrCodeAnalyzer::payloadOf))
                    }
                    .addOnFailureListener { continuation.resume(null) }
                    .addOnCanceledListener { continuation.resume(null) }
            }
        } finally {
            scanner.close()
        }
    }
}
