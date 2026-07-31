package no.qravn.android.ui.result

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SheetState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import java.util.Locale
import no.qravn.android.R
import no.qravn.safety.Assessment
import no.qravn.safety.Finding
import no.qravn.safety.FindingSubject
import no.qravn.safety.OpenAffordance
import no.qravn.safety.UrlBreakdown

/**
 * The result surface.
 *
 * Two rules are load-bearing here. The user sees the decoded destination
 * before any action is offered, and the open affordance is taken from
 * [Assessment.openAffordance] — the client never decides for itself that
 * something may be opened.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ResultSheet(
    assessment: Assessment,
    verdictDetail: String,
    alwaysShowTechnicalDetails: Boolean,
    sheetState: SheetState,
    onDismiss: () -> Unit,
    onOpen: (String) -> Unit,
    onCopy: (String) -> Unit,
    onShare: (String) -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        modifier = Modifier.testTag("resultSheet"),
    ) {
        ResultPanel(
            assessment = assessment,
            verdictDetail = verdictDetail,
            alwaysShowTechnicalDetails = alwaysShowTechnicalDetails,
            onDismiss = onDismiss,
            onOpen = onOpen,
            onCopy = onCopy,
            onShare = onShare,
        )
    }
}

/**
 * The sheet body, separated so it can be exercised without a bottom sheet
 * around it. The open-gating rules live here and are covered by UI tests.
 */
@Composable
internal fun ResultPanel(
    assessment: Assessment,
    verdictDetail: String,
    alwaysShowTechnicalDetails: Boolean,
    onDismiss: () -> Unit,
    onOpen: (String) -> Unit,
    onCopy: (String) -> Unit,
    onShare: (String) -> Unit,
) {
    var confirmOpen by rememberSaveable(assessment.rawPayload) { mutableStateOf(false) }

    ResultContent(
        assessment = assessment,
        verdictDetail = verdictDetail,
        alwaysShowTechnicalDetails = alwaysShowTechnicalDetails,
        onRequestOpen = { url ->
            when (assessment.openAffordance) {
                OpenAffordance.ALLOWED -> onOpen(url)
                OpenAffordance.NEEDS_CONFIRMATION -> confirmOpen = true
                OpenAffordance.BLOCKED -> Unit
            }
        },
        onCopy = onCopy,
        onShare = onShare,
        onDismiss = onDismiss,
    )

    if (confirmOpen) {
        val target = assessment.url?.let { it.unicodeHost ?: it.host }.orEmpty()
        AlertDialog(
            onDismissRequest = { confirmOpen = false },
            title = { Text(stringResource(R.string.result_confirm_title)) },
            text = { Text(stringResource(R.string.result_confirm_body, target)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmOpen = false
                        onOpen(assessment.rawPayload)
                    },
                    modifier = Modifier.testTag("confirmOpenButton"),
                ) { Text(stringResource(R.string.result_confirm_open)) }
            },
            dismissButton = {
                TextButton(onClick = { confirmOpen = false }) {
                    Text(stringResource(R.string.result_cancel))
                }
            },
        )
    }
}

@Composable
private fun ResultContent(
    assessment: Assessment,
    verdictDetail: String,
    alwaysShowTechnicalDetails: Boolean,
    onRequestOpen: (String) -> Unit,
    onCopy: (String) -> Unit,
    onShare: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp)
            .navigationBarsPadding(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        VerdictBanner(assessment, verdictDetail)

        DestinationBlock(assessment)

        ActionButtons(
            assessment = assessment,
            onRequestOpen = onRequestOpen,
            onCopy = onCopy,
            onShare = onShare,
            onDismiss = onDismiss,
        )

        if (assessment.findings.isNotEmpty()) {
            ExpandableSection(
                title = stringResource(R.string.result_why),
                subtitle = pluralStringResource(
                    R.plurals.result_evidence_count,
                    assessment.findings.size,
                    assessment.findings.size,
                ),
                initiallyExpanded = false,
            ) {
                assessment.findings.forEach { FindingRow(it) }
            }
        } else {
            Text(
                text = stringResource(R.string.result_no_evidence),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        if (assessment.limitations.isNotEmpty()) {
            ExpandableSection(
                title = stringResource(R.string.result_limitations),
                subtitle = null,
                initiallyExpanded = false,
            ) {
                assessment.limitations.forEach { limitation ->
                    Text(
                        text = limitation.text.ifEmpty { limitation.code },
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(vertical = 4.dp),
                    )
                }
            }
        }

        assessment.url?.let { breakdown ->
            ExpandableSection(
                title = stringResource(R.string.result_technical),
                subtitle = null,
                initiallyExpanded = alwaysShowTechnicalDetails,
            ) {
                UrlBreakdownTable(breakdown)
            }
        }

        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun VerdictBanner(assessment: Assessment, verdictDetail: String) {
    val visual = visualFor(assessment.verdict)
    val title = assessment.summary.ifEmpty { assessment.verdict.name }
    Surface(
        color = visual.container,
        contentColor = visual.onContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
            .testTag("verdictBanner"),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Icon(
                painter = painterResource(visual.iconRes),
                contentDescription = null,
                modifier = Modifier.size(32.dp),
            )
            Spacer(Modifier.width(14.dp))
            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.semantics { heading() },
                )
                if (verdictDetail.isNotEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    Text(text = verdictDetail, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@Composable
private fun DestinationBlock(assessment: Assessment) {
    val url = assessment.url
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        FieldLabel(
            text = stringResource(
                if (url != null) R.string.result_destination else R.string.result_content,
            ),
            style = MaterialTheme.typography.labelLarge,
        )
        if (url != null) {
            Text(
                text = url.unicodeHost ?: url.host,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.testTag("destinationHost"),
            )
            url.unicodeHost?.let { unicode ->
                if (unicode != url.host) {
                    // A displayed name that differs from the real ASCII host is
                    // exactly the homograph case, so both are always shown.
                    LtrText(
                        text = url.host,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
        LtrText(
            text = assessment.displayPayload,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    MaterialTheme.colorScheme.surfaceVariant,
                    RoundedCornerShape(12.dp),
                )
                .padding(12.dp)
                .testTag("decodedPayload"),
        )
    }
}

@Composable
private fun ActionButtons(
    assessment: Assessment,
    onRequestOpen: (String) -> Unit,
    onCopy: (String) -> Unit,
    onShare: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val affordance = assessment.openAffordance
    val isUrl = assessment.url != null

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        when {
            !isUrl -> Unit

            affordance == OpenAffordance.BLOCKED -> Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        painter = painterResource(R.drawable.ic_verdict_critical),
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = stringResource(R.string.result_open_blocked),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.testTag("openBlockedNotice"),
                    )
                }
            }

            else -> Button(
                onClick = { onRequestOpen(assessment.rawPayload) },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("openButton"),
                colors = if (affordance == OpenAffordance.NEEDS_CONFIRMATION) {
                    ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer,
                        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
                    )
                } else {
                    ButtonDefaults.buttonColors()
                },
                contentPadding = PaddingValues(vertical = 14.dp),
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_open_in_new),
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    stringResource(
                        if (affordance == OpenAffordance.NEEDS_CONFIRMATION) {
                            R.string.result_open_anyway
                        } else {
                            R.string.result_open_browser
                        },
                    ),
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = { onCopy(assessment.rawPayload) },
                modifier = Modifier.weight(1f),
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_copy),
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(stringResource(R.string.result_copy))
            }
            OutlinedButton(
                onClick = { onShare(assessment.rawPayload) },
                modifier = Modifier.weight(1f),
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_share),
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(stringResource(R.string.result_share))
            }
        }

        TextButton(
            onClick = onDismiss,
            modifier = Modifier
                .fillMaxWidth()
                .testTag("scanAgainButton"),
        ) {
            Icon(
                painter = painterResource(R.drawable.ic_refresh),
                contentDescription = null,
                modifier = Modifier.size(18.dp),
            )
            Spacer(Modifier.width(6.dp))
            Text(stringResource(R.string.scan_again))
        }
    }
}

@Composable
private fun FindingRow(finding: Finding) {
    Row(
        modifier = Modifier.padding(vertical = 8.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(
            painter = painterResource(iconForSeverity(finding.severity)),
            contentDescription = null,
            modifier = Modifier.size(20.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.width(12.dp))
        Column {
            Text(
                text = finding.title.ifEmpty { finding.code },
                style = MaterialTheme.typography.titleSmall,
            )
            if (finding.detail.isNotEmpty()) {
                Text(
                    text = finding.detail,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (finding.subject == FindingSubject.FINAL) {
                Text(
                    text = stringResource(R.string.result_subject_final),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun UrlBreakdownTable(url: UrlBreakdown) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        BreakdownRow(stringResource(R.string.url_scheme), url.scheme)
        BreakdownRow(stringResource(R.string.url_host), url.host)
        url.unicodeHost?.let { BreakdownRow(stringResource(R.string.url_unicode_host), it) }
        url.registrableDomain?.let {
            BreakdownRow(stringResource(R.string.url_registrable_domain), it)
        }
        if (url.subdomains.isNotEmpty()) {
            BreakdownRow(stringResource(R.string.url_subdomains), url.subdomains.joinToString("."))
        }
        url.port?.let { BreakdownRow(stringResource(R.string.url_port), it.toString()) }
        if (url.path.isNotEmpty()) BreakdownRow(stringResource(R.string.url_path), url.path)
        url.query?.let { BreakdownRow(stringResource(R.string.url_query), it) }
        url.fragment?.let { BreakdownRow(stringResource(R.string.url_fragment), it) }
        url.username?.let { BreakdownRow(stringResource(R.string.url_credentials), it) }
    }
}

@Composable
private fun BreakdownRow(label: String, value: String) {
    Row(modifier = Modifier.padding(vertical = 4.dp)) {
        FieldLabel(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.width(120.dp),
        )
        LtrText(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.weight(1f),
        )
    }
}

/**
 * The machine's voice: monospace, tracked out and set in capitals, the same
 * treatment the web surface gives its field labels. It marks the boundary
 * between what the app is saying and what the payload claims.
 *
 * The capitals are visual only. The unmodified label is kept as the
 * accessibility text so a screen reader announces a word rather than
 * spelling it out.
 */
@Composable
private fun FieldLabel(
    text: String,
    style: androidx.compose.ui.text.TextStyle,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text.uppercase(Locale.getDefault()),
        style = style.copy(
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.1.em,
        ),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier.semantics { contentDescription = text },
    )
}

@Composable
private fun ExpandableSection(
    title: String,
    subtitle: String?,
    initiallyExpanded: Boolean,
    content: @Composable () -> Unit,
) {
    var expanded by rememberSaveable(title) { mutableStateOf(initiallyExpanded) }
    Column {
        HorizontalDivider()
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickableRow { expanded = !expanded }
                .padding(vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = title, style = MaterialTheme.typography.titleMedium)
                subtitle?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Icon(
                painter = painterResource(
                    if (expanded) R.drawable.ic_expand_less else R.drawable.ic_expand_more,
                ),
                contentDescription = null,
            )
        }
        AnimatedVisibility(visible = expanded) {
            Column(modifier = Modifier.padding(bottom = 8.dp)) { content() }
        }
    }
}

/**
 * URLs and hosts are rendered left-to-right regardless of UI direction so a
 * right-to-left character inside a hostile payload cannot reorder what the
 * user reads.
 */
@Composable
private fun LtrText(
    text: String,
    style: androidx.compose.ui.text.TextStyle,
    modifier: Modifier = Modifier,
) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Text(
            text = text,
            style = style.copy(fontFamily = FontFamily.Monospace),
            modifier = modifier,
        )
    }
}

private fun Modifier.clickableRow(onClick: () -> Unit): Modifier = this.clickable { onClick() }
