package no.qrrrgh.android.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException

/**
 * The only persisted state.
 *
 * There is no scan history by design: the app stores nothing about what a user
 * scanned. These are presentation preferences only, so nothing here is
 * sensitive and nothing needs encryption.
 */
data class UserSettings(
    val hapticsEnabled: Boolean = true,
    val alwaysShowTechnicalDetails: Boolean = false,
    val matchWallpaperColors: Boolean = false,
)

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

class SettingsRepository(private val context: Context) {

    val settings: Flow<UserSettings> = context.dataStore.data
        .catch { error ->
            if (error is IOException) emit(emptyPreferences()) else throw error
        }
        .map { preferences ->
            UserSettings(
                hapticsEnabled = preferences[HAPTICS] ?: true,
                alwaysShowTechnicalDetails = preferences[TECHNICAL] ?: false,
                matchWallpaperColors = preferences[WALLPAPER_COLORS] ?: false,
            )
        }

    suspend fun setHapticsEnabled(enabled: Boolean) {
        context.dataStore.edit { it[HAPTICS] = enabled }
    }

    suspend fun setAlwaysShowTechnicalDetails(enabled: Boolean) {
        context.dataStore.edit { it[TECHNICAL] = enabled }
    }

    suspend fun setMatchWallpaperColors(enabled: Boolean) {
        context.dataStore.edit { it[WALLPAPER_COLORS] = enabled }
    }

    private companion object {
        val HAPTICS = booleanPreferencesKey("haptics_enabled")
        val TECHNICAL = booleanPreferencesKey("always_show_technical")
        val WALLPAPER_COLORS = booleanPreferencesKey("match_wallpaper_colors")
    }
}
