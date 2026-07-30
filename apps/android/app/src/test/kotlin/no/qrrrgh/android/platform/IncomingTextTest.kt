package no.qrrrgh.android.platform

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class IncomingTextTest {

    @Test
    fun `blank text is refused`() {
        assertTrue(IncomingIntentParser.sanitizeText("   ") is Incoming.Unsupported)
        assertTrue(IncomingIntentParser.sanitizeText("") is Incoming.Unsupported)
    }

    @Test
    fun `text longer than any QR code is refused`() {
        val oversized = "a".repeat(IncomingIntentParser.MAX_PAYLOAD_CHARS + 1)
        assertTrue(IncomingIntentParser.sanitizeText(oversized) is Incoming.Unsupported)
    }

    @Test
    fun `accepted text is passed through byte for byte`() {
        // Leading whitespace and hostile characters must survive: the core
        // needs the exact payload to judge it, and the user needs to see what
        // was really in the code.
        val payload = " https://exam\u202Eple.no/path?a=1 "
        val result = IncomingIntentParser.sanitizeText(payload)
        assertTrue(result is Incoming.Text)
        assertEquals(payload, (result as Incoming.Text).value)
    }

    @Test
    fun `text at the cap is accepted`() {
        val exact = "b".repeat(IncomingIntentParser.MAX_PAYLOAD_CHARS)
        assertTrue(IncomingIntentParser.sanitizeText(exact) is Incoming.Text)
    }
}

class ImageSampleSizeTest {

    @Test
    fun `small images are not downsampled`() {
        assertEquals(1, ImageQrDecoder.sampleSizeFor(1080, 1920))
    }

    @Test
    fun `large images are downsampled by powers of two`() {
        assertEquals(2, ImageQrDecoder.sampleSizeFor(9000, 4000))
        assertEquals(8, ImageQrDecoder.sampleSizeFor(20000, 4000))
    }

    @Test
    fun `sample size is never zero`() {
        assertTrue(ImageQrDecoder.sampleSizeFor(1, 1) >= 1)
    }
}
