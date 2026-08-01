import XCTest

/// The Swift twin of
/// `apps/android/app/src/test/kotlin/no/qravn/android/platform/IncomingTextTest.kt`.
final class IncomingTextTests: XCTestCase {

    func testBlankTextIsRefused() {
        XCTAssertEqual(IncomingTextParser.sanitizeText("   "), .unsupported)
        XCTAssertEqual(IncomingTextParser.sanitizeText(""), .unsupported)
    }

    func testTextLongerThanAnyQrCodeIsRefused() {
        let oversized = String(repeating: "a", count: IncomingTextParser.MAX_PAYLOAD_CHARS + 1)
        XCTAssertEqual(IncomingTextParser.sanitizeText(oversized), .unsupported)
    }

    func testAcceptedTextIsPassedThroughByteForByte() {
        // Leading whitespace and hostile characters must survive: the core
        // needs the exact payload to judge it, and the user needs to see what
        // was really in the code.
        let payload = " https://exam\u{202E}ple.no/path?a=1 "
        XCTAssertEqual(IncomingTextParser.sanitizeText(payload), .text(payload))
    }

    func testTextAtTheCapIsAccepted() {
        let exact = String(repeating: "b", count: IncomingTextParser.MAX_PAYLOAD_CHARS)
        XCTAssertEqual(IncomingTextParser.sanitizeText(exact), .text(exact))
    }

    /// The cap counts UTF-16 units, matching the Android client's
    /// `String.length`, so an emoji-heavy payload is measured identically on
    /// both platforms.
    func testTheCapIsMeasuredInUtf16UnitsLikeTheAndroidClient() {
        let surrogatePairs = String(repeating: "😀", count: IncomingTextParser.MAX_PAYLOAD_CHARS / 2)
        XCTAssertEqual(surrogatePairs.utf16.count, IncomingTextParser.MAX_PAYLOAD_CHARS)
        XCTAssertEqual(IncomingTextParser.sanitizeText(surrogatePairs), .text(surrogatePairs))
        XCTAssertEqual(IncomingTextParser.sanitizeText(surrogatePairs + "😀"), .unsupported)
    }

    func testAUniversalLinkCarriesThePayloadInTheUrlQueryItem() throws {
        let url = try XCTUnwrap(URL(string: "https://qravn.no/scan?url=https%3A%2F%2Fevil.example"))
        XCTAssertEqual(IncomingTextParser.parse(url: url), .text("https://evil.example"))
    }

    func testALinkWithoutAPayloadJustAsksForTheScanner() throws {
        let url = try XCTUnwrap(URL(string: "https://qravn.no/scan"))
        XCTAssertEqual(IncomingTextParser.parse(url: url), .scanRequested)
    }
}
