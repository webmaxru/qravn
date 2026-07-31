package no.qravn.android

import android.app.Application
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import no.qravn.safety.SafetyEngine
import no.qravn.safety.SafetyEngineUnavailableException

class QrSafetyApplication : Application() {
    val engineProvider: SafetyEngineProvider by lazy { SafetyEngineProvider(this) }
}

/**
 * Owns the single offline engine instance for the process.
 *
 * There is deliberately no fallback analyser. If the Rust core cannot start,
 * the app says so instead of showing a guess, because an unqualified reassuring
 * result is the one failure mode this product must never have.
 */
class SafetyEngineProvider(private val application: Application) {
    private val mutex = Mutex()
    private var engine: SafetyEngine? = null

    @Throws(SafetyEngineUnavailableException::class)
    suspend fun engine(locale: String): SafetyEngine = mutex.withLock {
        engine ?: SafetyEngine.create(application, locale).also { engine = it }
    }
}
