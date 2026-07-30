package no.qrrrgh.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.onAllNodesWithTag
import no.qrrrgh.android.ui.result.ResultPanel
import no.qrrrgh.android.ui.theme.QrSafetyTheme
import no.qrrrgh.safety.Assessment
import no.qrrrgh.safety.Finding
import no.qrrrgh.safety.PayloadKind
import no.qrrrgh.safety.RecommendedAction
import no.qrrrgh.safety.SCHEMA_VERSION
import no.qrrrgh.safety.Severity
import no.qrrrgh.safety.UrlBreakdown
import no.qrrrgh.safety.Verdict
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * These tests exist to protect product invariants, not visual styling.
 *
 * A regression in any of them would let the app either open something the core
 * refused, or show a result without showing the destination first.
 */
class ResultPanelSafetyTest {

    @get:Rule
    val composeRule = createComposeRule()

    private fun assessment(
        verdict: Verdict,
        actions: List<RecommendedAction>,
        payload: String = "https://phish.example/login",
    ) = Assessment(
        schemaVersion = SCHEMA_VERSION,
        payloadKind = PayloadKind.URL,
        rawPayload = payload,
        displayPayload = payload,
        url = UrlBreakdown(
            scheme = "https",
            host = "phish.example",
            path = "/login",
            registrableDomain = "phish.example",
        ),
        findings = listOf(
            Finding(code = "url.lookalike_domain", severity = Severity.HIGH, title = "Lookalike"),
        ),
        verdict = verdict,
        confidence = 0.9f,
        recommendedActions = actions,
        summary = "Known malicious",
    )

    @Test
    fun blockedResultOffersNoOpenAction() {
        var opened: String? = null
        composeRule.setContent {
            QrSafetyTheme(dynamicColor = false) {
                ResultPanel(
                    assessment = assessment(
                        Verdict.KNOWN_MALICIOUS,
                        listOf(RecommendedAction.OPEN_BLOCKED, RecommendedAction.COPY),
                    ),
                    verdictDetail = "",
                    alwaysShowTechnicalDetails = false,
                    onDismiss = {},
                    onOpen = { opened = it },
                    onCopy = {},
                    onShare = {},
                )
            }
        }

        composeRule.onAllNodesWithTag("openButton").assertCountEquals(0)
        composeRule.onNodeWithTag("openBlockedNotice").assertIsDisplayed()
        assertEquals(null, opened)
    }

    @Test
    fun blockedResultStillShowsTheDecodedDestination() {
        composeRule.setContent {
            QrSafetyTheme(dynamicColor = false) {
                ResultPanel(
                    assessment = assessment(
                        Verdict.KNOWN_MALICIOUS,
                        listOf(RecommendedAction.OPEN_BLOCKED),
                    ),
                    verdictDetail = "",
                    alwaysShowTechnicalDetails = false,
                    onDismiss = {},
                    onOpen = {},
                    onCopy = {},
                    onShare = {},
                )
            }
        }

        composeRule.onNodeWithTag("decodedPayload").assertIsDisplayed()
        composeRule.onNodeWithTag("destinationHost").assertIsDisplayed()
    }

    @Test
    fun allowedResultOpensDirectly() {
        var opened: String? = null
        composeRule.setContent {
            QrSafetyTheme(dynamicColor = false) {
                ResultPanel(
                    assessment = assessment(
                        Verdict.NO_KNOWN_THREAT_FOUND,
                        listOf(RecommendedAction.OPEN_ALLOWED),
                        payload = "https://example.no/",
                    ),
                    verdictDetail = "",
                    alwaysShowTechnicalDetails = false,
                    onDismiss = {},
                    onOpen = { opened = it },
                    onCopy = {},
                    onShare = {},
                )
            }
        }

        composeRule.onNodeWithTag("openButton").performClick()
        assertEquals("https://example.no/", opened)
    }

    @Test
    fun confirmationResultRequiresAnExplicitSecondStep() {
        var opened: String? = null
        composeRule.setContent {
            QrSafetyTheme(dynamicColor = false) {
                ResultPanel(
                    assessment = assessment(
                        Verdict.SUSPICIOUS,
                        listOf(RecommendedAction.OPEN_WITH_CONFIRMATION),
                    ),
                    verdictDetail = "",
                    alwaysShowTechnicalDetails = false,
                    onDismiss = {},
                    onOpen = { opened = it },
                    onCopy = {},
                    onShare = {},
                )
            }
        }

        composeRule.onNodeWithTag("openButton").performClick()
        assertEquals("nothing may open on the first tap", null, opened)

        composeRule.onNodeWithTag("confirmOpenButton").performClick()
        assertTrue(opened == "https://phish.example/login")
    }

    @Test
    fun anEmptyActionListIsTreatedAsBlocked() {
        composeRule.setContent {
            QrSafetyTheme(dynamicColor = false) {
                ResultPanel(
                    assessment = assessment(Verdict.INSUFFICIENT_EVIDENCE, emptyList()),
                    verdictDetail = "",
                    alwaysShowTechnicalDetails = false,
                    onDismiss = {},
                    onOpen = {},
                    onCopy = {},
                    onShare = {},
                )
            }
        }

        composeRule.onAllNodesWithTag("openButton").assertCountEquals(0)
        composeRule.onNodeWithTag("openBlockedNotice").assertIsDisplayed()
    }
}
