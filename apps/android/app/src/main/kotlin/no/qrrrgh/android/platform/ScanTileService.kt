package no.qrrrgh.android.platform

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.quicksettings.TileService
import no.qrrrgh.android.MainActivity

/**
 * Quick Settings tile. The point of scanning a suspicious code is that it
 * happens before the user acts on it, so the check has to be one pull-down
 * away rather than buried in an app drawer.
 */
class ScanTileService : TileService() {

    override fun onClick() {
        super.onClick()
        val intent = Intent(this, MainActivity::class.java).apply {
            action = IncomingIntentParser.ACTION_SCAN
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startScanActivity(intent)
    }

    @Suppress("DEPRECATION")
    @SuppressLint("StartActivityAndCollapseDeprecated")
    private fun startScanActivity(intent: Intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            startActivityAndCollapse(pendingIntent)
        } else {
            startActivityAndCollapse(intent)
        }
    }
}
