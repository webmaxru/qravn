import SwiftUI
import Vision
import VisionKit

/// The live viewfinder.
///
/// The Swift twin of
/// `apps/android/app/src/main/kotlin/no/qravn/android/ui/scan/CameraViewfinder.kt`.
///
/// Frames never leave the device and are never retained: VisionKit hands back a
/// decoded string, the stabilizer requires it to agree across frames, and only
/// then is it passed to the core. Nothing here opens anything.
struct CameraViewfinder: UIViewControllerRepresentable {

    let onPayload: (String) -> Void

    /// `isSupported` covers the hardware, `isAvailable` covers the moment: the
    /// scanner is unavailable in Split View, in Stage Manager and on the
    /// Simulator. Both have to hold before a viewfinder is worth showing.
    static var isAvailable: Bool {
        DataScannerViewController.isSupported && DataScannerViewController.isAvailable
    }

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let controller = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.qr, .microQR])],
            qualityLevel: .balanced,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false,
            isHighlightingEnabled: true
        )
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: DataScannerViewController, context: Context) {
        try? controller.startScanning()
    }

    static func dismantleUIViewController(
        _ controller: DataScannerViewController,
        coordinator: Coordinator
    ) {
        controller.stopScanning()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onPayload: onPayload)
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {

        private let stabilizer = PayloadStabilizer()
        private let onPayload: (String) -> Void

        init(onPayload: @escaping (String) -> Void) {
            self.onPayload = onPayload
        }

        func dataScanner(
            _ dataScanner: DataScannerViewController,
            didAdd addedItems: [RecognizedItem],
            allItems: [RecognizedItem]
        ) {
            handle(addedItems)
        }

        func dataScanner(
            _ dataScanner: DataScannerViewController,
            didUpdate updatedItems: [RecognizedItem],
            allItems: [RecognizedItem]
        ) {
            handle(updatedItems)
        }

        private func handle(_ items: [RecognizedItem]) {
            for item in items {
                guard case let .barcode(barcode) = item else { continue }
                if let payload = stabilizer.accept(barcode.payloadStringValue) {
                    onPayload(payload)
                    return
                }
            }
        }
    }
}
