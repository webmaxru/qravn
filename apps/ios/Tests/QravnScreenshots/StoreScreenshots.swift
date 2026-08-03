import CoreGraphics
import Foundation
import XCTest

/// Captures the App Store screenshots from the shipping app.
///
/// This is not a test of behaviour; it is the camera. It exists because the
/// alternative — drawing a picture of an iPhone in a design tool — puts an
/// image in the listing that no build has ever produced, which is both a
/// Guideline 2.3.3 problem and a slow way to lie to yourself about what the
/// product looks like.
///
/// Every payload below is a golden test vector or a direct sibling of one, and
/// they are the same payloads `tools/store-shots/states.mjs` photographs for the
/// Microsoft Store, so the two listings cannot show different verdicts for the
/// same address.
///
/// Run it through `apps/ios/scripts/capture-store-screenshots.sh`, which picks
/// the 6.9" simulator the store wants and freezes the status bar. Every frame
/// is attached to the result bundle, and also written to `QRAVN_SCREENSHOT_DIR`
/// when the simulator is allowed to reach it.
final class StoreScreenshots: XCTestCase {

    /// One frame of the listing.
    private struct Shot {
        let name: String
        /// What is typed into the field under the viewfinder, or nil to
        /// photograph the first screen as it opens.
        let payload: String?
        /// Swipes before the shutter, to bring a lower section of the result
        /// into frame.
        let swipes: Int

        init(_ name: String, _ payload: String?, swipes: Int = 0) {
            self.name = name
            self.payload = payload
            self.swipes = swipes
        }
    }

    /// Order matters: App Store Connect shows the first three without
    /// scrolling, so those three have to carry the whole argument.
    private static let shots: [Shot] = [
        // test-vectors/golden/identity-attacks.json → cyrillic-a-apple.
        // A Cyrillic a in "apple.com". The headline claim, first.
        Shot("1-lookalike", "https://\u{0430}pple.com/"),

        // Second: the promise that a verdict is not advice. There is no control
        // on this screen that opens it, so the shot is taken further down,
        // where a button would have been.
        Shot("2-blocked", "javascript:alert(1)", swipes: 2),

        // test-vectors/golden/deceptive-urls.json → credentials in the
        // authority. Everything before the @ is decoration; the real host is
        // evil.example, and the address panel says so.
        Shot("3-address", "https://trusted.no@evil.example/login"),

        // The reasons, in the reader's language, with the finding list open.
        Shot("4-why", "http://192.0.2.1/pay", swipes: 1),

        // The honest quiet verdict. Never the word "safe": the app says it
        // found no known threat, which is a different and true statement.
        Shot("5-clear", "https://www.skatteetaten.no/skattemelding/"),

        // The first screen, for the line about the analysis staying on the
        // device. See the README: a simulator has no camera, so this one is
        // worth re-taking on hardware before upload.
        Shot("6-scan", nil),
    ]

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
    }

    @MainActor
    func testCaptureStoreScreenshots() {
        let environment = ProcessInfo.processInfo.environment
        let directory = environment["QRAVN_SCREENSHOT_DIR"]
        let language = environment["QRAVN_SCREENSHOT_LANGUAGE"] ?? "en"
        let locale = environment["QRAVN_SCREENSHOT_LOCALE"] ?? language

        for shot in Self.shots {
            let app = XCUIApplication()
            // Relaunched per frame rather than cleared between frames: a screen
            // photographed for a store listing should be one the app can
            // actually be opened into, not one reached by a sequence only this
            // test knows.
            app.launchArguments += [
                "-AppleLanguages", "(\(language))",
                "-AppleLocale", locale,
            ]
            app.launch()

            if let payload = shot.payload {
                enter(payload, in: app)
                XCTAssertTrue(
                    app.scrollViews["result_sheet"].waitForExistence(timeout: 20),
                    "\(shot.name): the result never appeared"
                )
            } else {
                XCTAssertTrue(
                    manualEntry(in: app).waitForExistence(timeout: 20),
                    "\(shot.name): the scan screen never appeared"
                )
            }

            for _ in 0..<shot.swipes {
                app.scrollViews["result_sheet"].swipeUp()
            }

            // SwiftUI sheet and scroll animations are not covered by the
            // existence waits above, and a half-presented sheet is a wasted
            // upload slot.
            Thread.sleep(forTimeInterval: 1.5)

            save(XCUIScreen.main.screenshot(), as: shot.name, in: directory)
            app.terminate()
        }
    }

    /// Types into the field under the viewfinder and asks for the check.
    @MainActor
    private func enter(_ payload: String, in app: XCUIApplication) {
        let field = manualEntry(in: app)
        XCTAssertTrue(field.waitForExistence(timeout: 20), "the entry field never appeared")
        field.tap()
        field.typeText(payload)

        let check = app.buttons["scan_check"]
        XCTAssertTrue(check.waitForExistence(timeout: 5), "the check button never appeared")
        if check.isHittable {
            check.tap()
        } else {
            // SwiftUI normally insets the layout for the keyboard, but a
            // multiline field does not always leave the button reachable. A
            // coordinate tap does not consult hit-testing.
            check.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
    }

    /// `TextField(axis: .vertical)` is a text field on some iOS versions and a
    /// text view on others, so poll for both rather than pin the capture to one
    /// and spend the timeout waiting for the wrong element type.
    @MainActor
    private func manualEntry(in app: XCUIApplication) -> XCUIElement {
        let identifier = "scan_manual_entry"
        let candidates = [app.textViews[identifier], app.textFields[identifier]]
        let deadline = Date().addingTimeInterval(20)
        while Date() < deadline {
            for candidate in candidates where candidate.exists {
                return candidate
            }
            Thread.sleep(forTimeInterval: 0.25)
        }
        return app.textFields[identifier]
    }

    /// Keeps every frame in the result bundle, which is what the capture script
    /// exports, and additionally tries to write it straight to the host. The
    /// simulator is sandboxed away from most of the host filesystem, so the
    /// direct write is a shortcut when it works rather than the mechanism.
    @MainActor
    private func save(_ screenshot: XCUIScreenshot, as name: String, in directory: String?) {
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)

        guard let directory = directory else { return }
        let url = URL(fileURLWithPath: directory, isDirectory: true)
        do {
            try FileManager.default.createDirectory(
                at: url,
                withIntermediateDirectories: true
            )
            try screenshot.pngRepresentation.write(
                to: url.appendingPathComponent("\(name).png")
            )
        } catch {
            // Not a failure: the attachment above is still in the result
            // bundle, and the capture script knows how to export it.
            print("could not write \(name).png to \(directory): \(error)")
        }
    }
}
