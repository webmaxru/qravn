import Foundation
import QravnSafetyFFI

/// Thin bridge to `core/bindings/ios`.
///
/// The Swift twin of
/// `apps/android/safety-core/src/main/kotlin/no/qravn/safety/NativeSafetyEngine.kt`.
/// The boundary is JSON strings in both directions, exactly as
/// `contracts/v1/assessment.d.ts` prescribes, so the seam stays stable across
/// wasm-bindgen, JNI, the C ABI and any future binding technology.
///
/// The native side keeps engines in a handle registry, so a stale handle is
/// inert rather than dangerous. Callers must still ``close()`` to release
/// memory; ``deinit`` does it for them if they forget.
final class NativeSafetyEngine {

    private var handle: Int64

    init(configJson: String) {
        handle = configJson.withCString { qravn_safety_engine_create($0) }
    }

    var isValid: Bool { handle != 0 }

    /// Returns the `Assessment` JSON document, or nil when the core produced
    /// nothing at all. A nil here is treated by the caller as "no result",
    /// never as "no problem".
    func assess(inputJson: String) -> String? {
        let raw = inputJson.withCString { qravn_safety_engine_assess(handle, $0) }
        return consume(raw)
    }

    func version() -> String {
        consume(qravn_safety_engine_version()) ?? ""
    }

    func close() {
        let current = handle
        handle = 0
        if current != 0 {
            qravn_safety_engine_destroy(current)
        }
    }

    deinit {
        close()
    }

    /// Copies a string out of the core and hands the allocation straight back.
    /// Every exit path frees, so no assessment can leak the payload it carries.
    private func consume(_ raw: UnsafeMutablePointer<CChar>?) -> String? {
        guard let raw else { return nil }
        defer { qravn_safety_string_free(raw) }
        return String(cString: raw)
    }
}

/// Raised when the Rust core is unavailable.
///
/// There is no fallback analyser by design. A client that cannot run the core
/// must say so rather than present a guess as an assessment.
public struct SafetyEngineUnavailableError: Error, LocalizedError, Equatable {
    public let message: String

    public init(_ message: String) {
        self.message = message
    }

    public var errorDescription: String? { message }
}
