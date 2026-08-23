import QravnSafetyCore
import SwiftUI
import UIKit

/// The result surface.
///
/// The Swift twin of
/// `apps/android/app/src/main/kotlin/no/qravn/android/ui/result/ResultSheet.kt`.
///
/// Two rules govern this view and both are asserted in the test suite:
///
/// 1. The destination is always shown next to the verdict. A result without the
///    address it describes is not a result.
/// 2. When the core says ``OpenAffordance/blocked`` there is no control on this
///    screen that can open the link. Not disabled, not behind a confirmation:
///    absent.
struct ResultSheet: View {

    let result: ScanResult
    let onScanAgain: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var isConfirmingOpen = false
    @State private var notice: String?

    private var assessment: Assessment { result.assessment }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    verdictHeader
                    destination
                    actions
                    if !assessment.findings.isEmpty { findings } else { noEvidence }
                    if !assessment.limitations.isEmpty { limitations }
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            // On the ScrollView rather than the stack inside it: a plain VStack
            // is accessibility-transparent, so SwiftUI pushes an identifier put
            // there down onto the leaves instead of exposing a container. The
            // store screenshot run waits on this element.
            .accessibilityIdentifier("result_sheet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("result_cancel") { dismiss() }
                }
            }
        }
    }

    private var verdictHeader: some View {
        let verdictVisual = visual(for: assessment.verdict)
        return VStack(alignment: .leading, spacing: 8) {
            Label {
                Text(result.verdictTitle)
                    .font(.title2.weight(.semibold))
            } icon: {
                Image(systemName: verdictVisual.systemImage)
                    .font(.title2)
            }
            .foregroundStyle(verdictVisual.onContainer)

            if !result.verdictDetail.isEmpty {
                Text(result.verdictDetail)
                    .font(.callout)
                    .foregroundStyle(verdictVisual.onContainer)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            verdictVisual.container,
            in: RoundedRectangle(cornerRadius: 16, style: .continuous)
        )
        // One announcement rather than three fragments, and the icon carries no
        // information a screen reader would otherwise miss.
        .accessibilityElement(children: .combine)
    }

    private var destination: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("result_destination")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
            // displayPayload, never rawPayload: the core has already neutralized
            // the bidi and control characters that make a hostile address read
            // as a safe one.
            Text(assessment.displayPayload)
                .font(.body.monospaced())
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var findings: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("result_why")
                .font(.headline)
            ForEach(assessment.findings, id: \.code) { finding in
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(finding.title.isEmpty ? finding.code : finding.title)
                            .font(.subheadline.weight(.semibold))
                        if !finding.detail.isEmpty {
                            Text(finding.detail).font(.footnote)
                        }
                        if finding.subject == .final {
                            Text("result_subject_final")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                } icon: {
                    Image(systemName: systemImage(for: finding.severity))
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    private var noEvidence: some View {
        Text("result_no_evidence")
            .font(.footnote)
            .foregroundStyle(.secondary)
    }

    private var limitations: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("result_limitations")
                .font(.headline)
            ForEach(assessment.limitations, id: \.code) { limitation in
                Text(limitation.text.isEmpty ? limitation.code : limitation.text)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var actions: some View {
        VStack(spacing: 12) {
            openControl

            Button {
                UIPasteboard.general.string = assessment.rawPayload
                notice = String(localized: "result_copied")
            } label: {
                Label("result_copy", systemImage: "doc.on.doc")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)

            ShareLink(item: assessment.rawPayload) {
                Label("result_share", systemImage: "square.and.arrow.up")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)

            Button {
                dismiss()
                onScanAgain()
            } label: {
                Label("scan_again", systemImage: "arrow.clockwise")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)

            if let notice {
                Text(notice)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .accessibilityAddTraits(.isStaticText)
            }
        }
    }

    /// The only place an open affordance is decided, and it asks the core.
    @ViewBuilder
    private var openControl: some View {
        switch assessment.openAffordance {
        case .allowed:
            Button {
                Task { await open() }
            } label: {
                Label("result_open_browser", systemImage: "safari")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)

        case .needsConfirmation:
            Button {
                isConfirmingOpen = true
            } label: {
                Label("result_open_anyway", systemImage: "exclamationmark.triangle")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .confirmationDialog(
                Text("result_confirm_title"),
                isPresented: $isConfirmingOpen,
                titleVisibility: .visible
            ) {
                Button("result_confirm_open", role: .destructive) {
                    Task { await open() }
                }
                Button("result_cancel", role: .cancel) {}
            } message: {
                // The catalog string carries the destination as %1$@; rendering
                // the key alone would show the placeholder to the user.
                Text(
                    String(
                        format: String(localized: "result_confirm_body"),
                        assessment.displayPayload
                    )
                )
            }

        case .blocked:
            // Deliberately not a Button. There is nothing here to tap.
            Label("result_open_blocked", systemImage: "hand.raised.fill")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
        }
    }

    private func open() async {
        switch await UrlOpener.open(assessment.rawPayload) {
        case .opened:
            break
        case .noBrowser:
            notice = String(localized: "result_no_browser")
        case .refused:
            notice = String(localized: "result_open_blocked")
        }
    }
}
