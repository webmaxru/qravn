package no.qravn.android.platform

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.net.toUri

/**
 * The only code path in the app that can hand a scanned address to another app.
 *
 * Nothing here ever runs automatically. It is called from a user gesture that
 * the core has explicitly permitted, and it refuses any scheme other than
 * http and https so a scanned `intent://`, `file://` or vendor deep link can
 * never be used to reach another component.
 */
object UrlOpener {

    enum class Result { OPENED, NO_BROWSER, REFUSED }

    private val ALLOWED_SCHEMES = setOf("http", "https")

    fun open(context: Context, url: String): Result {
        val uri = runCatching { url.toUri() }.getOrNull() ?: return Result.REFUSED
        if (uri.scheme?.lowercase() !in ALLOWED_SCHEMES) return Result.REFUSED
        if (uri.host.isNullOrEmpty()) return Result.REFUSED

        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
            addCategory(Intent.CATEGORY_BROWSABLE)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            // Keep the destination out of this app's task and out of its history.
            addFlags(Intent.FLAG_ACTIVITY_NEW_DOCUMENT)
        }
        return try {
            context.startActivity(intent)
            Result.OPENED
        } catch (_: ActivityNotFoundException) {
            Result.NO_BROWSER
        } catch (_: SecurityException) {
            Result.REFUSED
        }
    }

    fun share(context: Context, text: String, chooserTitle: String): Boolean {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }
        return try {
            context.startActivity(
                Intent.createChooser(intent, chooserTitle)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            true
        } catch (_: ActivityNotFoundException) {
            false
        }
    }

    fun openAppSettings(context: Context): Boolean {
        val intent = Intent(
            android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", context.packageName, null),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            context.startActivity(intent)
            true
        } catch (_: ActivityNotFoundException) {
            false
        }
    }
}
