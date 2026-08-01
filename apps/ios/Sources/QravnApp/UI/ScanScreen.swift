import QravnSafetyCore
import SwiftUI

/// The scanner.
///
/// The Swift twin of
/// `apps/android/app/src/main/kotlin/no/qravn/android/ui/scan/ScanScreen.kt`.
///
/// A scan never opens anything. It produces an assessment, and the assessment
/// decides what the user is even offered.
struct ScanScreen: View {

    @StateObject private var viewModel = ScanViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                switch viewModel.status {
                case .starting:
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                case .unavailable:
                    engineUnavailable
                case .ready:
                    viewfinder
                    manualEntry
                }
            }
            .navigationTitle("scan_title")
            .navigationBarTitleDisplayMode(.inline)
        }
        .task { await viewModel.start() }
        .sheet(item: resultBinding) { result in
            ResultSheet(result: result) {
                viewModel.manualEntry = ""
            }
        }
    }

    private var resultBinding: Binding<ScanResult?> {
        Binding(
            get: { viewModel.result },
            set: { if $0 == nil { viewModel.dismissResult() } }
        )
    }

    @ViewBuilder
    private var viewfinder: some View {
        if CameraViewfinder.isAvailable {
            CameraViewfinder { payload in
                Task { await viewModel.check(payload: payload) }
            }
            .accessibilityLabel("scan_viewfinder_description")
            .overlay(alignment: .bottom) {
                Text("scan_hint")
                    .font(.footnote)
                    .padding(10)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.bottom, 16)
            }
        } else {
            // The Simulator, Split View and Stage Manager all land here, and so
            // does any device without a usable scanner. Saying so is better than
            // showing a black rectangle.
            ContentUnavailableMessage(
                systemImage: "camera.metering.unknown",
                title: "error_camera_unavailable",
                message: "scan_from_clipboard"
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var manualEntry: some View {
        VStack(spacing: 12) {
            HStack(spacing: 8) {
                TextField("scan_manual_entry_label", text: $viewModel.manualEntry, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .lineLimit(1...3)
                    .accessibilityLabel("scan_manual_entry_label")

                Button {
                    Task { await viewModel.checkManualEntry() }
                } label: {
                    if viewModel.isAssessing {
                        ProgressView()
                    } else {
                        Text("scan_check")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(viewModel.isAssessing)
                // The label is a spinner while a check runs, so the control
                // still needs a name for VoiceOver.
                .accessibilityLabel(Text("scan_check"))
                .accessibilityValue(viewModel.isAssessing ? Text("scan_analysing") : Text(""))
            }

            if let notice = viewModel.notice {
                Text(notice)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Text("settings_offline_notice")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .background(.background)
    }

    private var engineUnavailable: some View {
        ContentUnavailableMessage(
            systemImage: "exclamationmark.triangle",
            title: "error_engine_title",
            message: "error_engine_body"
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// `ContentUnavailableView` is iOS 17. The deployment target is 16, and this is
/// the whole of what the app needs from it.
struct ContentUnavailableMessage: View {

    let systemImage: String
    let title: LocalizedStringKey
    let message: LocalizedStringKey

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text(title)
                .font(.headline)
                .multilineTextAlignment(.center)
            Text(message)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .accessibilityElement(children: .combine)
    }
}
