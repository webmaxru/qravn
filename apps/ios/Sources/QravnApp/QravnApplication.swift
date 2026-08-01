import SwiftUI

/// The application entry point.
///
/// The Swift twin of
/// `apps/android/app/src/main/kotlin/no/qravn/android/QrSafetyApplication.kt`
/// and `MainActivity.kt`.
///
/// There is deliberately nothing here that reacts to a scanned address on its
/// own. A link is only ever opened from a user gesture that the core has
/// permitted, in `ResultSheet`.
@main
struct QravnApplication: App {

    var body: some Scene {
        WindowGroup {
            ScanScreen()
        }
    }
}
