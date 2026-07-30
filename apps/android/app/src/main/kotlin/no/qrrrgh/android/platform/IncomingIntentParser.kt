package no.qrrrgh.android.platform

import android.content.Intent
import android.net.Uri

/**
 * Parses an incoming [Intent] into something the app is willing to analyse.
 *
 * Every field of an incoming Intent is attacker-controlled. This parser is
 * deliberately narrow: exactly one item, an exact action, an exact MIME type
 * family, and a hard size cap. Anything else is [Incoming.Unsupported] rather
 * than a best-effort guess.
 */
sealed interface Incoming {
    data class Text(val value: String) : Incoming
    data class Image(val uri: Uri) : Incoming
    data object ScanRequested : Incoming
    data object CheckImageRequested : Incoming
    data object None : Incoming
    data object Unsupported : Incoming
}

object IncomingIntentParser {

    const val ACTION_SCAN: String = "no.qrrrgh.android.action.SCAN"
    const val ACTION_CHECK_IMAGE: String = "no.qrrrgh.android.action.CHECK_IMAGE"

    /**
     * A QR code holds at most 4296 alphanumeric or 2953 binary characters, so
     * anything past this cap did not come from a QR code and is not worth the
     * parser's time.
     */
    const val MAX_PAYLOAD_CHARS: Int = 8192

    fun parse(intent: Intent?): Incoming {
        if (intent == null) return Incoming.None
        return when (intent.action) {
            ACTION_SCAN -> Incoming.ScanRequested
            ACTION_CHECK_IMAGE -> Incoming.CheckImageRequested
            Intent.ACTION_SEND -> parseSend(intent)
            Intent.ACTION_SEND_MULTIPLE -> Incoming.Unsupported
            else -> Incoming.None
        }
    }

    private fun parseSend(intent: Intent): Incoming {
        val type = intent.type ?: return Incoming.Unsupported
        return when {
            type == "text/plain" -> parseText(intent)
            type.startsWith("image/") -> parseImage(intent)
            else -> Incoming.Unsupported
        }
    }

    private fun parseText(intent: Intent): Incoming {
        // The declared MIME type is not trusted on its own; a stream extra on a
        // text/plain share is a mismatch and is refused rather than followed.
        if (intent.hasExtra(Intent.EXTRA_STREAM)) return Incoming.Unsupported
        val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
            ?: return Incoming.Unsupported
        return sanitizeText(text)
    }

    private fun parseImage(intent: Intent): Incoming {
        @Suppress("DEPRECATION")
        val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
            ?: return Incoming.Unsupported
        // Only opaque content references are accepted. A file path handed over
        // by another app must never be resolved directly.
        if (uri.scheme != "content") return Incoming.Unsupported
        return Incoming.Image(uri)
    }

    /**
     * Accepts pasted or shared text. The value is never trimmed into a
     * different string: the core must see what the user actually has. Only
     * surrounding whitespace, which no QR reader would have produced, is
     * removed, and only for the emptiness check.
     */
    fun sanitizeText(text: String): Incoming {
        if (text.isBlank()) return Incoming.Unsupported
        if (text.length > MAX_PAYLOAD_CHARS) return Incoming.Unsupported
        return Incoming.Text(text)
    }
}
