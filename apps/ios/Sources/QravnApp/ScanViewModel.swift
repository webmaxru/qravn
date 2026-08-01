import Foundation
import QravnSafetyCore

/// One finished assessment, ready to render.
///
/// The verdict wording is resolved here rather than in the view because the
/// catalog lives behind the engine actor, and because the view must never be in
/// a position to compose a security sentence itself.
struct ScanResult: Identifiable, Equatable {
    let id = UUID()
    let assessment: Assessment
    let verdictTitle: String
    let verdictDetail: String
}

/// Holds the engine and the current result.
///
/// The Swift twin of
/// `apps/android/app/src/main/kotlin/no/qravn/android/MainViewModel.kt`.
///
/// Note where the clock is read: here, in the host, and passed into the core as
/// `nowMs`. The core has no access to system time, no I/O and no network, and
/// this type is the boundary that keeps that true.
@MainActor
final class ScanViewModel: ObservableObject {

    enum Status: Equatable {
        case starting
        case ready
        case unavailable
    }

    @Published private(set) var status: Status = .starting
    @Published private(set) var result: ScanResult?
    @Published private(set) var isAssessing = false
    @Published var manualEntry: String = ""
    @Published var notice: String?

    private var engine: SafetyEngine?
    private let locale: String

    /// `nonisolated` so a SwiftUI `@StateObject` initializer can build it
    /// without hopping actors. It only assigns stored properties.
    nonisolated init(locale: String = LocalizationCatalogs.preferredLocale()) {
        self.locale = locale
    }

    var engineLocale: String { locale }

    func start() async {
        guard engine == nil else { return }
        do {
            engine = try SafetyEngine.create(locale: locale)
            status = .ready
        } catch {
            // There is no fallback analyser by design. A client that cannot run
            // the core says so rather than presenting a guess as an assessment.
            status = .unavailable
        }
    }

    func check(payload: String) async {
        guard case let .text(value) = IncomingTextParser.sanitizeText(payload) else {
            notice = String(localized: "error_shared_unsupported")
            return
        }
        guard let engine else {
            notice = String(localized: "error_engine_body")
            return
        }
        isAssessing = true
        defer { isAssessing = false }

        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        let assessment = await engine.assess(payload: value, nowMs: nowMs, locale: locale)
        let entry = await engine.catalogEntry(code: assessment.verdict.catalogCode, locale: locale)
        result = ScanResult(
            assessment: assessment,
            verdictTitle: entry?.title ?? "",
            verdictDetail: entry?.detail ?? ""
        )
    }

    func checkManualEntry() async {
        let entry = manualEntry
        guard !entry.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            notice = String(localized: "error_clipboard_empty")
            return
        }
        await check(payload: entry)
    }

    func dismissResult() {
        result = nil
    }
}
