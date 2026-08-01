import XCTest

/// The opening policy is the last gate before a scanned address reaches another
/// app, so it is tested on its own, without a running application.
///
/// The Swift counterpart of the scheme allow-list in
/// `apps/android/app/src/main/kotlin/no/qravn/android/platform/UrlOpener.kt`.
final class UrlOpenerTests: XCTestCase {

    func testHttpAndHttpsArePermitted() {
        XCTAssertNotNil(UrlOpener.permitted("https://example.no/path"))
        XCTAssertNotNil(UrlOpener.permitted("http://example.no"))
    }

    func testTheSchemeComparisonIsCaseInsensitive() {
        XCTAssertNotNil(UrlOpener.permitted("HTTPS://example.no"))
    }

    /// A scanned code must never be able to reach the dialler, the file system,
    /// the App Store or another app's custom scheme.
    func testEveryOtherSchemeIsRefused() {
        for raw in [
            "tel:+4712345678",
            "sms:+4712345678",
            "mailto:someone@example.no",
            "file:///etc/passwd",
            "javascript:alert(1)",
            "itms-apps://apps.apple.com/app/id1",
            "qravn://scan?url=https://evil.example",
            "data:text/html;base64,PHNjcmlwdD4=",
        ] {
            XCTAssertNil(UrlOpener.permitted(raw), "\(raw) must not be openable")
        }
    }

    func testAnAddressWithoutAHostIsRefused() {
        XCTAssertNil(UrlOpener.permitted("https://"))
        XCTAssertNil(UrlOpener.permitted("https:///path"))
    }

    func testGarbageIsRefusedRatherThanGuessedAt() {
        XCTAssertNil(UrlOpener.permitted(""))
        XCTAssertNil(UrlOpener.permitted("   "))
        XCTAssertNil(UrlOpener.permitted("example.no"))
    }

    /// The address handed to the system is the one that was assessed; the
    /// opener does not rewrite it.
    func testThePermittedUrlIsNotRewritten() {
        let raw = "https://trusted.no@evil.example/login?a=1#f"
        XCTAssertEqual(UrlOpener.permitted(raw)?.absoluteString, raw)
    }
}
