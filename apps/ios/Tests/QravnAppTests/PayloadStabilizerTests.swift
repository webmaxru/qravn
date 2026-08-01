import XCTest

/// The Swift twin of
/// `apps/android/app/src/test/kotlin/no/qravn/android/platform/PayloadStabilizerTest.kt`.
///
/// This bundle compiles `Sources/QravnApp/Platform` directly instead of hosting
/// the app, exactly as the Android counterpart runs on a plain JVM: the logic
/// under test needs no application, and a host-free bundle needs no signing.
final class PayloadStabilizerTests: XCTestCase {

    func testASingleFrameIsNeverAccepted() {
        let stabilizer = PayloadStabilizer()
        XCTAssertNil(stabilizer.accept("https://example.no"))
    }

    func testTwoIdenticalConsecutiveFramesAreAccepted() {
        let stabilizer = PayloadStabilizer()
        stabilizer.accept("https://example.no")
        XCTAssertEqual(stabilizer.accept("https://example.no"), "https://example.no")
    }

    func testADifferingFrameRestartsTheCount() {
        let stabilizer = PayloadStabilizer()
        stabilizer.accept("https://example.no")
        XCTAssertNil(stabilizer.accept("https://other.example"))
        XCTAssertEqual(stabilizer.accept("https://other.example"), "https://other.example")
    }

    func testAFrameWithoutACodeClearsTheCandidate() {
        let stabilizer = PayloadStabilizer()
        stabilizer.accept("https://example.no")
        stabilizer.accept(nil)
        XCTAssertNil(stabilizer.accept("https://example.no"))
    }

    func testAcceptanceResetsSoTheNextCodeNeedsItsOwnConfirmation() {
        let stabilizer = PayloadStabilizer()
        stabilizer.accept("https://example.no")
        stabilizer.accept("https://example.no")
        XCTAssertNil(stabilizer.accept("https://example.no"))
    }
}
