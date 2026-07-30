package no.qrrrgh.android.platform

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PayloadStabilizerTest {

    @Test
    fun `a single frame is never accepted`() {
        val stabilizer = PayloadStabilizer()
        assertNull(stabilizer.accept("https://example.no"))
    }

    @Test
    fun `two identical consecutive frames are accepted`() {
        val stabilizer = PayloadStabilizer()
        stabilizer.accept("https://example.no")
        assertEquals("https://example.no", stabilizer.accept("https://example.no"))
    }

    @Test
    fun `a differing frame restarts the count`() {
        val stabilizer = PayloadStabilizer()
        stabilizer.accept("https://example.no")
        assertNull(stabilizer.accept("https://other.example"))
        assertEquals("https://other.example", stabilizer.accept("https://other.example"))
    }

    @Test
    fun `a frame without a code clears the candidate`() {
        val stabilizer = PayloadStabilizer()
        stabilizer.accept("https://example.no")
        stabilizer.accept(null)
        assertNull(stabilizer.accept("https://example.no"))
    }

    @Test
    fun `acceptance resets so the next code needs its own confirmation`() {
        val stabilizer = PayloadStabilizer()
        stabilizer.accept("https://example.no")
        stabilizer.accept("https://example.no")
        assertNull(stabilizer.accept("https://example.no"))
    }
}
