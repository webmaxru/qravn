package no.qravn.safety

/**
 * Thin JNI bridge to `core/bindings/android`.
 *
 * The boundary is JSON strings in both directions, exactly as
 * `contracts/v1/assessment.d.ts` prescribes, so the seam stays stable across
 * wasm-bindgen, JNI and any future binding technology.
 *
 * The native side keeps engines in a handle registry, so a stale handle is
 * inert rather than dangerous. Callers must still [close] to release memory.
 */
internal class NativeSafetyEngine(configJson: String) : AutoCloseable {

    init {
        NativeLibrary.ensureLoaded()
    }

    private var handle: Long = nativeCreate(configJson)

    val isValid: Boolean get() = handle != 0L

    fun assess(inputJson: String): String = nativeAssess(handle, inputJson)

    fun version(): String = nativeVersion()

    override fun close() {
        val current = handle
        handle = 0L
        if (current != 0L) {
            nativeDestroy(current)
        }
    }

    private external fun nativeCreate(configJson: String): Long

    private external fun nativeDestroy(handle: Long)

    private external fun nativeAssess(handle: Long, inputJson: String): String

    private external fun nativeVersion(): String
}

internal object NativeLibrary {
    @Volatile
    private var failure: Throwable? = null

    private val loaded: Boolean by lazy {
        runCatching { System.loadLibrary("qravn_safety_jni") }
            .onFailure { failure = it }
            .isSuccess
    }

    /** Throws [SafetyEngineUnavailableException] when the core cannot start. */
    fun ensureLoaded() {
        if (!loaded) {
            throw SafetyEngineUnavailableException(
                "The native safety core could not be loaded.",
                failure,
            )
        }
    }
}

/**
 * Raised when the Rust core is unavailable.
 *
 * There is no fallback analyser by design. A client that cannot run the core
 * must say so rather than present a guess as an assessment.
 */
class SafetyEngineUnavailableException(
    message: String,
    cause: Throwable? = null,
) : Exception(message, cause)
