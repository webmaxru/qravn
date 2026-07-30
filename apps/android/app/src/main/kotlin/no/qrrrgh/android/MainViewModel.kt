package no.qrrrgh.android

import android.app.Application
import android.net.Uri
import androidx.annotation.StringRes
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import no.qrrrgh.android.data.SettingsRepository
import no.qrrrgh.android.data.UserSettings
import no.qrrrgh.android.platform.ImageDecodeResult
import no.qrrrgh.android.platform.ImageQrDecoder
import no.qrrrgh.android.platform.Incoming
import no.qrrrgh.android.platform.IncomingIntentParser
import no.qrrrgh.safety.Assessment
import no.qrrrgh.safety.SafetyEngine
import no.qrrrgh.safety.SafetyEngineUnavailableException

enum class EngineStatus { LOADING, READY, UNAVAILABLE }

/** A one-shot message. Errors are always distinct from a result, never a verdict. */
data class UiMessage(@param:StringRes val textRes: Int, val id: Long = System.nanoTime())

data class ScanUiState(
    val engineStatus: EngineStatus = EngineStatus.LOADING,
    val engineVersion: String = "",
    val rulesVersion: String = "",
    val isAnalysing: Boolean = false,
    val assessment: Assessment? = null,
    val verdictDetail: String = "",
    val message: UiMessage? = null,
    val torchEnabled: Boolean = false,
    val pendingImagePick: Boolean = false,
    val settings: UserSettings = UserSettings(),
) {
    /** The camera must stop reading while a result is on screen. */
    val cameraScanningEnabled: Boolean
        get() = engineStatus == EngineStatus.READY && assessment == null && !isAnalysing
}

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val settingsRepository = SettingsRepository(application)
    private val engineProvider = (application as QrSafetyApplication).engineProvider

    private val _state = MutableStateFlow(ScanUiState())
    val state: StateFlow<ScanUiState> = _state.asStateFlow()

    private var analysisJob: Job? = null
    private var engine: SafetyEngine? = null

    init {
        viewModelScope.launch {
            settingsRepository.settings.collect { settings ->
                _state.update { it.copy(settings = settings) }
            }
        }
        viewModelScope.launch { ensureEngine() }
    }

    private suspend fun ensureEngine(): SafetyEngine? {
        engine?.let { return it }
        return try {
            val created = engineProvider.engine(currentLocale())
            engine = created
            _state.update {
                it.copy(engineStatus = EngineStatus.READY, engineVersion = created.version)
            }
            created
        } catch (_: SafetyEngineUnavailableException) {
            _state.update { it.copy(engineStatus = EngineStatus.UNAVAILABLE) }
            null
        } catch (_: UnsatisfiedLinkError) {
            _state.update { it.copy(engineStatus = EngineStatus.UNAVAILABLE) }
            null
        }
    }

    fun onIncoming(incoming: Incoming) {
        when (incoming) {
            is Incoming.Text -> analyse(incoming.value)
            is Incoming.Image -> analyseImage(incoming.uri)
            Incoming.CheckImageRequested -> _state.update { it.copy(pendingImagePick = true) }
            Incoming.Unsupported -> showMessage(R.string.error_shared_unsupported)
            Incoming.ScanRequested, Incoming.None -> Unit
        }
    }

    fun onImagePickHandled() = _state.update { it.copy(pendingImagePick = false) }

    fun onPayloadDecoded(payload: String) = analyse(payload)

    fun onClipboardText(text: String?) {
        when (val incoming = text?.let(IncomingIntentParser::sanitizeText) ?: Incoming.Unsupported) {
            is Incoming.Text -> analyse(incoming.value)
            else -> showMessage(R.string.error_clipboard_empty)
        }
    }

    fun onImagePicked(uri: Uri) = analyseImage(uri)

    private fun analyseImage(uri: Uri) {
        if (_state.value.isAnalysing) return
        analysisJob?.cancel()
        _state.update { it.copy(isAnalysing = true, torchEnabled = false) }
        analysisJob = viewModelScope.launch {
            when (val result = ImageQrDecoder.decode(getApplication(), uri)) {
                is ImageDecodeResult.Decoded -> assess(result.payload)
                ImageDecodeResult.NoCodeFound -> finishWithMessage(R.string.error_no_qr_in_image)
                ImageDecodeResult.TooLarge -> finishWithMessage(R.string.error_image_too_large)
                ImageDecodeResult.Unreadable -> finishWithMessage(R.string.error_image_unreadable)
            }
        }
    }

    private fun analyse(payload: String) {
        if (_state.value.isAnalysing) return
        analysisJob?.cancel()
        _state.update { it.copy(isAnalysing = true, torchEnabled = false) }
        analysisJob = viewModelScope.launch { assess(payload) }
    }

    private suspend fun assess(payload: String) {
        val safetyEngine = ensureEngine()
        if (safetyEngine == null) {
            _state.update { it.copy(isAnalysing = false) }
            return
        }
        val assessment = safetyEngine.assess(
            payload = payload,
            nowMs = System.currentTimeMillis(),
            locale = currentLocale(),
        )
        val detail = safetyEngine
            .catalogEntry(assessment.verdict.catalogCode, assessment.locale)
            ?.detail
            .orEmpty()
        _state.update {
            it.copy(
                isAnalysing = false,
                assessment = assessment,
                verdictDetail = detail,
                rulesVersion = assessment.rulesVersion,
                engineVersion = assessment.engineVersion.ifEmpty { it.engineVersion },
            )
        }
    }

    private fun finishWithMessage(@StringRes textRes: Int) {
        _state.update { it.copy(isAnalysing = false, message = UiMessage(textRes)) }
    }

    fun showMessage(@StringRes textRes: Int) {
        _state.update { it.copy(message = UiMessage(textRes)) }
    }

    fun consumeMessage() = _state.update { it.copy(message = null) }

    fun dismissResult() {
        analysisJob?.cancel()
        _state.update { it.copy(assessment = null, verdictDetail = "", isAnalysing = false) }
    }

    fun setTorchEnabled(enabled: Boolean) = _state.update { it.copy(torchEnabled = enabled) }

    fun setHapticsEnabled(enabled: Boolean) {
        viewModelScope.launch { settingsRepository.setHapticsEnabled(enabled) }
    }

    fun setAlwaysShowTechnicalDetails(enabled: Boolean) {
        viewModelScope.launch { settingsRepository.setAlwaysShowTechnicalDetails(enabled) }
    }

    fun setMatchWallpaperColors(enabled: Boolean) {
        viewModelScope.launch { settingsRepository.setMatchWallpaperColors(enabled) }
    }

    private fun currentLocale(): String {
        val application = getApplication<Application>()
        val locales = androidx.core.os.ConfigurationCompat.getLocales(
            application.resources.configuration,
        )
        return locales[0]?.language ?: "en"
    }
}
