# QR Safety Application: Technical Architecture and Native Mobile Integration Research

**Research date:** 24 July 2026  
**Target platforms:** Native iOS and Android  
**Primary launch market:** Norway  
**Product objective:** Decode QR codes without automatic navigation, inspect all encoded content, safely resolve shortened URLs and redirects, evaluate deterministic and machine-learning security signals, and provide clear Norwegian-language risk explanations.

---

## 1. Technical recommendation

Build the product as:

- A native Swift/SwiftUI application on iOS.
- A native Kotlin/Jetpack Compose application on Android.
- A small shared Rust security core for deterministic URL processing, evidence schemas, signed rules, and risk evaluation.
- A protected backend for optional threat-intelligence lookups and redirect expansion.
- Optional on-device machine-learning and generative explanation models.

The final security verdict should be determined by reproducible evidence and calibrated classification, not by a generative language model.

Recommended analysis order:

1. Local QR decoding.
2. Payload classification.
3. URL parsing and deterministic checks.
4. Local signed reputation/rule lookup.
5. Small local discriminative classifier.
6. Optional remote threat-intelligence check.
7. Optional protected redirect expansion.
8. Optional page-level analysis.
9. Generative or template-based explanation of already established evidence.

Core result labels:

- **Known malicious**
- **Suspicious**
- **Unknown or insufficient evidence**
- **No known threat found**

Never display an unqualified **Safe** result.

---

## 2. Product security principles

### 2.1 Never navigate automatically

Scanning a QR code must only decode information. The application must not:

- Open a browser.
- Launch another application.
- Dial a telephone number.
- Send an SMS or email.
- Join Wi-Fi.
- Add a contact.
- Install an application.
- Trigger a payment.
- Follow a deep link.

Every externally meaningful action requires a separate explicit user decision.

### 2.2 Treat all QR content as hostile

The payload, URL, redirect response, DNS data, TLS certificate, HTML, screenshot, and extracted text are untrusted.

The application must assume an attacker may intentionally construct content to:

- Confuse the URL parser.
- Hide the real host.
- Exploit bidirectional text rendering.
- Trigger internal-network requests.
- consume one-time links.
- expose private query tokens.
- evade threat-intelligence lists.
- prompt-inject a language model.
- overload image decoders or parsers.
- redirect differently by IP address, device, user agent, region, or time.

### 2.3 Keep the user's device away from suspicious destinations

The user's device should not contact a decoded destination during analysis. Optional redirect and page investigation must run in a separately isolated backend worker.

### 2.4 Separate evidence from explanation

The security engine produces:

- Normalized facts.
- Individual findings.
- Data-source provenance.
- Confidence.
- Verdict.

The explanation layer translates those facts into understandable language. It cannot change the verdict.

---

## 3. End-to-end user flows

### 3.1 Physical QR code

1. User opens the scanner through the application, widget, shortcut, Control Center, or other supported entry point.
2. Camera preview appears immediately.
3. QR decoding occurs locally.
4. Application freezes or outlines the detected code and provides haptic feedback.
5. Payload type and raw value are displayed.
6. Local deterministic analysis appears immediately.
7. Optional online checks continue without blocking the initial report.
8. Application shows reasons, destination, and confidence.
9. User may copy, report, dismiss, or deliberately open the destination.

### 3.2 QR code in a screenshot or photo

1. User chooses **Share** in Photos, Google Photos, Messages, Mail, Files, or the screenshot UI.
2. User selects **Check QR Safety**.
3. Share extension or receiving Activity decodes the image locally.
4. Compact local result appears.
5. User may open the full application for redirect expansion or deeper checks.

### 3.3 Pasted or shared URL

1. User shares text/URL to the application or taps **Paste and check**.
2. The application parses the explicit input.
3. The same URL pipeline is used as for QR codes.

Do not poll the clipboard. Read it only after explicit user action.

### 3.4 Shortened URL

1. The local application identifies a known or likely shortener.
2. It shows the shortener domain before making any remote request.
3. User consents to final-destination inspection.
4. Isolated backend resolves each redirect manually.
5. Every hop is recorded and validated.
6. Application shows:
   - Initial URL.
   - Each intermediate domain.
   - Status code.
   - Final destination.
   - Domain ownership changes.
   - Risk findings.

### 3.5 Non-URL QR payload

The application must provide a human-readable preview for:

- Plain text.
- Contact/vCard.
- Calendar event.
- Email address and `mailto:`.
- Phone number and `tel:`.
- SMS and `sms:`.
- Geographic location.
- Wi-Fi credentials.
- Payment/deep-link formats.
- Application links.
- ISBN/product identifiers.

Actions remain explicit and separate.

---

## 4. QR payload handling

### 4.1 Preserve multiple representations

Store distinct fields:

- `raw_payload`: exact decoded text.
- `display_payload`: safe visual rendering with control characters exposed.
- `payload_type`: URL, text, Wi-Fi, contact, payment, and so on.
- `parsed_payload`: structured representation.
- `canonical_url`: parser-generated URL for analysis.
- `lookup_url`: representation used for a reputation provider.
- `final_url`: destination after protected redirect expansion.

Never overwrite the raw payload with a normalized value.

### 4.2 Dangerous schemes

Only `http` and `https` are candidates for web navigation.

Treat these as blocked or requiring specialized handling:

- `javascript:`
- `data:`
- `file:`
- `intent:`
- `market:`
- custom application schemes
- operating-system settings schemes
- profile/configuration-installation schemes
- unknown schemes

Even benign-looking schemes can trigger state-changing actions. The application should describe them rather than automatically dispatch them.

### 4.3 Rendering protections

The report UI should:

- Make control characters visible.
- Neutralize or annotate bidirectional-control characters.
- Display the effective host separately.
- Prevent horizontal scrolling from hiding the host.
- Use a monospaced technical view when requested.
- Avoid clickable links in evidence strings.
- Avoid rendering attacker-controlled HTML or Markdown.

---

## 5. URL parsing and canonicalization

Use a standards-conforming WHATWG URL parser rather than regular expressions.

Source:

- [WHATWG URL Standard](https://url.spec.whatwg.org/)

### 5.1 Required checks

For `http` and `https` URLs:

- Validate syntax.
- Reject forbidden control characters.
- Parse username, password, host, port, path, query, and fragment separately.
- Show that `trusted.example@evil.example` belongs to `evil.example`.
- Lowercase the scheme and host in the canonical representation.
- Remove only parser-defined default ports.
- Preserve the original query order and values.
- Preserve the raw fragment for display.
- Convert and display Unicode and ASCII/punycode host forms.
- Determine the registrable domain using the current Public Suffix List.
- Detect literal IP hosts.
- Detect unusual or ambiguous IPv4 representations.
- Detect excessive subdomains.
- Detect embedded credentials.
- Detect encoded separators and backslashes.
- Detect very long host/path/query values.
- Detect suspicious redirect parameter names.
- Detect authentication, payment, recovery, delivery, or urgent-action vocabulary.
- Detect known brand names embedded in an unrelated registrable domain.

### 5.2 Signals that must not imply trust

Do not treat these as proof of legitimacy:

- HTTPS.
- A valid TLS certificate.
- A padlock icon.
- `.no` top-level domain.
- A familiar CDN.
- A large cloud provider.
- A known autonomous system.
- DNSSEC.
- An old domain.
- A high popularity ranking.

All can be used by attackers or compromised services.

---

## 6. Internationalized domains and homograph detection

Use:

- IDNA/UTS #46 processing.
- Unicode UTS #39 confusable skeletons.
- Mixed-script detection.
- Restriction-level checks.
- Brand-specific confusable comparison.

Source:

- [Unicode UTS #39: Unicode Security Mechanisms](https://www.unicode.org/reports/tr39/)

### 6.1 Norwegian-specific handling

Norwegian characters such as `æ`, `ø`, and `å` can be legitimate. A non-ASCII host must not automatically be classified as malicious.

Recommended explanation:

> **Mistenkelig domenenavn**  
> Adressen bruker tegn som kan ligne på andre bokstaver. Den tekniske adressen er `xn--...`. Kontroller domenet nøye.

Display:

- Unicode host.
- Punycode host.
- Registrable domain.
- Scripts used.
- Confusable brand, when applicable.

IDN risk is evidence, not a standalone verdict.

---

## 7. Deterministic detection engine

The deterministic engine should produce independently testable findings.

### 7.1 Local findings

- Invalid or ambiguous URL.
- Non-web scheme.
- Embedded username/password.
- IP-address destination.
- Non-standard port.
- Mixed-script hostname.
- Brand lookalike.
- Excessive subdomains.
- Suspicious path or query wording.
- URL shortener.
- Known redirector/open-redirect pattern.
- Encoded URL inside a query parameter.
- File-extension or executable-download indicator.
- Login/payment request on an unrelated domain.
- Known malicious-domain or URL match.
- Known safe organization domain match, with a warning that allowlisting does not guarantee content safety.

### 7.2 Risk scoring

Prefer an evidence policy over a single opaque number.

Example:

```text
Verdict: Suspicious

Strong evidence
- Final domain is a confirmed phishing destination in provider X.

Supporting evidence
- Initial URL uses a public shortener.
- Final domain resembles bankid.no.
- Domain first appeared recently.

Uncertainty
- Page content was not rendered.
- Provider Y had no record.
```

Internally, a calibrated probability or score may be useful, but the user interface should emphasize evidence and uncertainty.

### 7.3 Signed rules

Distribute local rules as signed, versioned packages containing:

- Known malicious indicators allowed by licensing.
- Brand/domain mappings.
- Known shorteners.
- Dangerous schemes.
- Parser policy version.
- Feature thresholds.
- Expiry time.
- Emergency revocation/version information.

The client must:

- Verify signatures.
- Reject rollback.
- Preserve the last valid package.
- Clearly report stale offline data.

---

## 8. Small machine-learning classifier

Use a compact discriminative model as an additional signal, not as the sole verdict.

Candidate approaches:

- Logistic regression over lexical and structural features.
- LightGBM.
- Character n-gram model.
- fastText character/subword model.
- Compact neural URL classifier.

Sources:

- [LightGBM license](https://github.com/lightgbm-org/LightGBM/blob/master/LICENSE)
- [fastText license](https://github.com/facebookresearch/fastText/blob/main/LICENSE)

### 8.1 Suggested features

- Character n-grams.
- Host length.
- Path length.
- Query length.
- Number of labels/subdomains.
- Digit and separator ratios.
- Entropy-like lexical features.
- Brand tokens.
- Login/payment/delivery vocabulary.
- Presence of IP literal.
- IDN/mixed-script features.
- Shortener identity.
- Redirect count.
- Registrable-domain changes.
- Known provider findings.
- Domain-age and certificate first-seen buckets.

Threat-intelligence hits should remain separately visible rather than being hidden inside a model score.

### 8.2 Evaluation requirements

Do not use a random URL-level split as the principal evaluation because URLs from the same domain or campaign can leak across train and test sets.

Use:

- Time-based split.
- Registrable-domain split.
- Campaign separation where possible.
- Region/language slices.
- New-domain slice.
- Brand-impersonation slice.
- Shortener slice.

Report:

- Precision-recall area.
- Recall at a very low false-positive rate.
- False positives per thousand benign scans.
- Detection delay for newly observed campaigns.
- Calibration.
- Norwegian-language and Norwegian-brand performance.

Avoid publishing a simple **accuracy** percentage.

---

## 9. Safe redirect expansion

Redirect expansion is a major differentiator and a major security risk.

### 9.1 User consent

Expansion must be opt-in because contacting the URL can:

- Reveal a private token.
- Expose the scanner service's IP.
- activate tracking.
- consume a one-time link.
- trigger server-side state.
- reveal that a particular recipient received a campaign.

The user should see the initial host and a short privacy notice before expansion.

### 9.2 Isolated worker requirements

The worker must:

- Run outside the application device.
- Have no access to internal corporate networks.
- Have no access to cloud metadata.
- Have no access to databases, control planes, or other tenants.
- Allow only HTTP and HTTPS.
- Allow only ports 80 and 443 unless a documented product decision expands this.
- Use strict egress firewall policy.
- Use no user cookies, authentication, or browser state.
- Use no POST requests.
- Disable automatic redirects.
- Validate every redirect manually.
- Apply short timeouts.
- Apply small header and body limits.
- Apply a low redirect limit.
- Avoid persistent cache and cookies.
- Avoid executing JavaScript in the normal redirect-expansion tier.

### 9.3 SSRF defenses

Before every connection:

1. Parse the URL.
2. Confirm scheme and port.
3. Resolve A and AAAA records.
4. Reject all non-global destinations.
5. Pin the connection to the validated address.
6. Revalidate on every redirect.
7. Enforce egress policy at the network layer.

Reject:

- Loopback.
- RFC1918/private space.
- Link-local.
- Carrier-grade NAT.
- Multicast.
- Unspecified addresses.
- Documentation/test ranges.
- Cloud metadata addresses.
- IPv4-mapped IPv6 bypasses.
- All other IANA non-globally-routable ranges.

Do not maintain only a small hand-written list such as `10/8` and `127/8`.

Sources:

- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [IANA IPv4 Special-Purpose Address Registry](https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml)
- [IANA IPv6 Special-Purpose Address Registry](https://www.iana.org/assignments/iana-ipv6-special-registry/iana-ipv6-special-registry.xhtml)

### 9.4 Redirect evidence

For each hop record:

- Requested URL.
- Resolved IP and network category.
- Timestamp.
- HTTP status.
- `Location` value.
- Parsed next URL.
- Registrable domain.
- Cross-domain/cross-organization change.
- TLS outcome.
- Privacy-sensitive query indication.

Do not retain full sensitive query strings in operational logs.

### 9.5 HEAD versus GET

HEAD requests do not reliably reproduce redirect behavior. Some services:

- Reject HEAD.
- Return different responses.
- Require GET.
- Redirect only after HTML or JavaScript execution.

The basic worker may use bounded GET requests without executing page content. The report must state when final-destination confidence is limited.

---

## 10. DNS, TLS, registration, and certificate signals

These are supporting indicators, not proof.

### DNS

Possible evidence:

- A/AAAA records.
- Nameservers.
- ASN and hosting provider.
- TTL.
- DNSSEC.
- Recent infrastructure change where historical data is legally available.

Limitations:

- CDN and cloud infrastructure is shared.
- Short TTL can be legitimate.
- DNSSEC does not imply a trustworthy website.

### TLS

Strong technical warnings:

- Hostname mismatch.
- Expired certificate.
- Invalid chain.
- Unsupported protocol.

Weak context:

- Certificate first-seen time.
- Issuer.
- Certificate-transparency observations.

A valid certificate proves control of the domain at issuance, not legitimacy.

### RDAP/domain registration

Useful but incomplete:

- Registration event/date.
- Registrar.
- Status.
- Nameserver.

Limitations:

- Data may be redacted.
- Registry semantics differ.
- A recently registered domain is not necessarily malicious.
- An old domain may be compromised.

### Certificate Transparency

Certificate Transparency can provide a first-observed certificate signal. It does not provide definitive domain age because:

- Certificates can be renewed.
- Wildcard certificates cover many hosts.
- One certificate can include many names.
- A domain can exist before receiving a public certificate.

---

## 11. Threat-intelligence providers and licensing

Provider terms must be reviewed before implementation and periodically afterward.

| Provider | Appropriate use | Important constraint |
|---|---|---|
| Google Safe Browsing | Non-commercial prototype or qualified consumer warning | Free API is explicitly non-commercial |
| Google Web Risk | Commercial URL threat lookup | Pricing and architecture vary; choose APIs carefully |
| VirusTotal Public API | Manual research and internal testing | Prohibited as backend of commercial products/services; public submission privacy |
| URLhaus / abuse.ch | Malware-distribution URL intelligence | Not a general phishing feed; commercial terms may require subscription |
| OpenPhish community service | Research/personal experimentation | Commercial use requires permission or paid service |
| PhishTank | Supplementary phishing signal | Dynamic limits and current commercial terms require confirmation |
| Cloudflare Radar ranking | Popularity/context | Not a malicious-URL verdict |
| Cloudflare URL Scanner | Page-level investigation | Visibility and retention/privacy implications |
| urlscan.io | Analyst investigation | Public-by-default submission risk |

### 11.1 Google Web Risk

Google publishes a commercial pricing model for Web Risk. The Lookup approach includes a documented free usage allowance before paid requests. Local-list/hash-based designs can have different and potentially much higher confirmation costs.

Source:

- [Google Web Risk pricing](https://cloud.google.com/web-risk/pricing)

### 11.2 Google Safe Browsing

Google states that Safe Browsing APIs are for non-commercial use. It also imposes warning and attribution requirements and requires that warnings acknowledge false positives and false negatives.

Source:

- [Google Safe Browsing appropriate use](https://developers.google.com/safe-browsing/reference/Appropriate.Usage)

### 11.3 VirusTotal

VirusTotal's public API:

- Has strict rate limits.
- Is not intended for commercial product integration.
- Can expose submitted URLs to the security community.

Never submit private document links, password-reset links, signed storage URLs, or user-specific tokens to public scanning services.

Source:

- [VirusTotal Public versus Premium API](https://docs.virustotal.com/reference/public-vs-premium-api)

### 11.4 URLhaus

URLhaus focuses on URLs distributing malware. It explicitly does not serve as a complete general phishing database.

Sources:

- [URLhaus API](https://urlhaus.abuse.ch/api/)
- [abuse.ch terms](https://abuse.ch/terms-of-use/)

### 11.5 Cloudflare URL Scanner

Cloudflare documents public and unlisted visibility options and screenshot/page analysis. Public scanning is unsuitable for sensitive consumer URLs.

Source:

- [Cloudflare URL Scanner](https://developers.cloudflare.com/radar/investigate/url-scanner/)

### 11.6 Recommended provider architecture

- Use provider adapters behind a stable internal interface.
- Never expose provider API keys in mobile applications.
- Cache only legally permitted, minimized results.
- Record provider, timestamp, query type, and result age.
- Allow providers to be disabled without an application update.
- Do not merge providers into a misleading binary consensus.

---

## 12. Page rendering, HTML, OCR, and screenshot analysis

Do not render pages in the basic redirect worker.

If later implemented, use a separate high-risk analysis tier:

- Disposable browser/container.
- No internal network route.
- No persistent cookies or storage.
- Disabled camera, microphone, location, notifications, downloads, clipboard, and file access.
- Restricted egress.
- Strict CPU, memory, time, and response limits.
- No user authentication.
- No form submission.
- No human-user session state.

Treat as hostile:

- HTML.
- CSS-generated text.
- JavaScript.
- Metadata.
- OCR output.
- Alt text.
- Hidden elements.
- Screenshots.
- Accessibility tree.

The page may contain instructions intended to manipulate a language model. Page content must never be allowed to change scanner policy or invoke tools.

---

## 13. Generative AI role

### 13.1 Appropriate uses

- Explain structured evidence in Bokmål or Nynorsk.
- Produce simpler language for accessibility.
- Summarize why several weak signals are collectively concerning.
- Explain the difference between initial and final domains.
- Recommend a safe next step.
- Cluster and summarize analyst-reviewed campaigns.

### 13.2 Inappropriate uses

- Sole malicious/benign verdict.
- Autonomous browsing.
- Tool invocation.
- Domain allowlisting.
- Executing page instructions.
- Deciding whether to send credentials.
- Overriding deterministic findings.

### 13.3 Prompt-injection controls

The model receives only a structured object such as:

```json
{
  "verdict": "suspicious",
  "reasons": [
    {
      "type": "brand_lookalike",
      "observed_domain": "bankld-example.com",
      "reference_brand": "BankID"
    },
    {
      "type": "redirect_domain_change",
      "hop_count": 3
    }
  ],
  "uncertainties": [
    "No page rendering performed",
    "No provider had a confirmed malicious match"
  ],
  "recommended_actions": [
    "Do not sign in",
    "Open the official application directly"
  ]
}
```

Requirements:

- No network or tools available to the model.
- No secrets in the prompt.
- Attacker strings explicitly quoted as data.
- Fixed output schema.
- Output validation.
- Deterministic verdict inserted by the application, not generated.
- Fallback to templates if model output is invalid.

Source:

- [OWASP LLM Prompt Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)

### 13.4 Cost strategy

Open weights do not make cloud inference free. Compute, memory, bandwidth, monitoring, and abuse prevention still cost money.

For a free application:

1. Use deterministic Norwegian explanation templates at launch.
2. Add a small on-device classifier.
3. Offer an optional downloadable on-device generative model on capable devices.
4. Avoid mandatory cloud LLM calls.

### 13.5 Candidate local models

#### NB-BERT

Useful for Norwegian text classification after task-specific fine-tuning. It is not a generative model.

Source:

- [NB-BERT model card](https://huggingface.co/NbAiLab/nb-bert-base)

#### MobileBERT

Useful as a compact text-classification base. The published English model is not a Norwegian phishing classifier and would require relevant training.

Sources:

- [MobileBERT model card](https://huggingface.co/google/mobilebert-uncased)
- [MobileBERT paper](https://arxiv.org/abs/2004.02984)

#### Gemma 3n

Potential optional on-device explanation or multimodal model on capable hardware. It is open-weight under Gemma terms, not automatically equivalent to unrestricted open-source software.

Source:

- [Gemma 3n documentation](https://ai.google.dev/gemma/docs/gemma-3n)

#### Runtime

ONNX Runtime Mobile supports iOS and Android execution providers. Quantization can substantially reduce model weight storage.

Source:

- [ONNX Runtime Mobile](https://onnxruntime.ai/docs/tutorials/mobile/)

---

## 14. Native iOS implementation

### 14.1 Main live scanner

Preferred:

- Swift and SwiftUI application shell.
- VisionKit `DataScannerViewController` for an Apple-like scanner experience.
- Configure barcode recognition for QR symbology only.
- Check `isSupported` and hardware availability.

Fallback:

- AVFoundation `AVCaptureSession`.
- `AVCaptureMetadataOutput`.
- QR metadata object type.
- Custom preview, focus, zoom, accessibility, and duplicate suppression.

Sources:

- [Apple: Scanning data with the camera](https://developer.apple.com/documentation/visionkit/scanning-data-with-the-camera)
- [DataScannerViewController](https://developer.apple.com/documentation/visionkit/datascannerviewcontroller)
- [AVCaptureMetadataOutput](https://developer.apple.com/documentation/avfoundation/avcapturemetadataoutput)
- [QR metadata type](https://developer.apple.com/documentation/avfoundation/avmetadataobject/objecttype/qr)

### 14.2 Saved image scanning

Use Apple Vision:

- `DetectBarcodesRequest`/modern Vision API on current systems.
- `VNDetectBarcodesRequest` for older supported API surfaces.
- Restrict recognition to QR codes where practical.

Use the system Photos picker for explicit image selection rather than requesting full-library access.

Sources:

- [DetectBarcodesRequest](https://developer.apple.com/documentation/vision/detectbarcodesrequest)
- [VNDetectBarcodesRequest](https://developer.apple.com/documentation/vision/vndetectbarcodesrequest)
- [Apple Photos picker session](https://developer.apple.com/videos/play/wwdc2020/10652/)

### 14.3 Share extension

Create a Share extension accepting:

- Images.
- Files.
- URLs.
- Plain text.

Expected hosts include:

- Photos.
- Messages attachments.
- Mail attachments.
- Files.
- Safari.
- Other applications exposing standard share items.

The extension:

1. Loads only the explicitly shared content.
2. Decodes locally.
3. Runs lightweight deterministic checks.
4. Displays a compact verdict.
5. Offers **Open full report** for network analysis.

Source:

- [Apple Share extensions](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html)

### 14.4 Action and Photo Editing extensions

An Action extension can receive host content but is less universally appropriate than a Share extension.

A Photo Editing extension is technically embedded in Photos, but it is designed to create an edited photo or video. Using it solely for a QR security report would be poor product fit and could create review/design concerns.

Sources:

- [Apple Action extensions](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Action.html)
- [Apple Photo Editing extensions](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Photos.html)

### 14.5 Siri, App Intents, Shortcuts, and Spotlight

Expose App Intents such as:

- Open safe scanner.
- Check a URL.
- Show last result.
- Show scan history.
- Explain the most recent warning.

Provide phrases such as:

- “Siri, scan a QR code safely.”
- “Siri, check this link.”
- “Open QR Safety Scanner.”

Siri and App Shortcuts can launch the camera UI but cannot silently use the camera in the background.

Source:

- [Apple App Intents and system experiences](https://developer.apple.com/documentation/appintents/adopting-app-intents-to-support-system-experiences)

### 14.6 Widgets and controls

Potential widgets:

- **Scan QR**
- **Check image**
- Last result.
- Rule/feed freshness.

Widgets and Control Center controls launch an intent or app route. They are not live camera surfaces.

Source:

- [Apple widgets, Live Activities, and controls](https://developer.apple.com/documentation/appintents/widgets-live-activities-and-controls)
- [WidgetKit controls](https://developer.apple.com/documentation/widgetkit/creating-controls-to-perform-actions-across-the-system)

### 14.7 Locked Camera Capture

`LockedCameraCapture` on iOS 18+ offers the closest third-party equivalent to a built-in Lock Screen scanner.

Possible entry points after user configuration:

- Lock Screen control.
- Control Center.
- Action Button.

Critical locked-state limitations:

- Network access is unavailable.
- Shared App Group access is unavailable.
- The extension container may be erased after suspension.
- The extension must assume the main application is not running.

Recommended locked flow:

1. Open camera immediately.
2. Decode locally.
3. Run embedded deterministic rules.
4. Show preliminary result.
5. Require unlock for cloud reputation, redirect expansion, or opening sensitive content.

Source:

- [Apple: Creating a camera experience for the Lock Screen](https://developer.apple.com/documentation/lockedcameracapture/creating-a-camera-experience-for-the-lock-screen)

### 14.8 Camera Control

On supported iPhones, integrate native Camera Control interactions for focus, zoom, or capture behavior. Capability-check hardware and OS support rather than assuming all iPhones provide it.

Source:

- [Apple Camera Control integration](https://developer.apple.com/documentation/avfoundation/enhancing-your-app-experience-with-the-camera-control)

### 14.9 Visual Intelligence

iOS 26 Visual Intelligence and App Intents app-schema integration may allow the application to receive semantic visual content and return application results.

Potential QR flow:

1. Visual Intelligence supplies visual content.
2. Application's intent receives image/semantic data where eligible.
3. Vision detects QR payload.
4. Application returns a safety result.

Limitations:

- Apple does not guarantee that every QR image is routed to the application.
- It is not a general screenshot-monitoring entitlement.
- It is not a replacement for Camera.
- Eligibility and system ranking apply.

Sources:

- [Apple: Integrating with Visual Intelligence](https://developer.apple.com/documentation/visualintelligence/integrating-your-app-with-visual-intelligence)
- [SemanticContentDescriptor](https://developer.apple.com/documentation/visualintelligence/semanticcontentdescriptor)

### 14.10 Safari Web Extension

Optional later feature:

- Inspect QR images on the current webpage.
- Send selected images/URLs to the containing native application.
- Display safety context inside Safari.

It cannot:

- Access arbitrary Photos content.
- Intercept Camera results.
- Become a universal QR handler.

Source:

- [Safari Web Extensions](https://developer.apple.com/documentation/safariservices/safari-web-extensions)

### 14.11 iOS platform boundaries

No documented public API was found to:

- Replace Apple Code Scanner.
- Become the default QR scanner.
- Intercept Camera's QR result.
- Insert a general QR-security plugin inside Camera.
- Receive every QR code found by Photos or Live Text.
- Register as the handler for arbitrary `http` or `https` URLs.

Universal Links work only for domains controlled by the application operator.

Sources:

- [Apple Universal Links](https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content)
- [Apple custom URL schemes](https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app)

### 14.12 App Clip

An App Clip can provide a narrow scanner demonstration when invoked by the application's own URL or App Clip Code. It cannot become an uninstalled generic scanner for arbitrary QR codes.

Source:

- [Apple App Clip experiences](https://developer.apple.com/documentation/appclips/configuring-app-clip-experiences)

---

## 15. Native Android implementation

### 15.1 Main live scanner

Use:

- Kotlin.
- Jetpack Compose.
- CameraX `Preview`.
- CameraX `ImageAnalysis`.
- ML Kit Barcode Scanning restricted to QR format.

CameraX is the recommended starting point for modern Android camera applications and supports API level 21 and newer.

Sources:

- [Android CameraX](https://developer.android.com/media/camera/camerax)
- [ML Kit Barcode Scanning for Android](https://developers.google.com/ml-kit/vision/barcode-scanning/android)

### 15.2 Bundled versus Play Services model

ML Kit documents:

- A bundled scanner model that increases application size but is immediately available.
- An unbundled Play Services model with a smaller application footprint but a possible first-use download delay.

For a safety scanner whose primary feature must work offline on first launch, prefer the bundled model.

### 15.3 Google Code Scanner

Provide Google Code Scanner as:

- A permissionless fallback.
- A privacy-oriented option.
- An alternative when the user denies camera permission.

Properties:

- Uses Google Play Services.
- Presents Google's scanner UI.
- Returns a barcode result to the application.
- Does not give full control over camera presentation.

Source:

- [Google Code Scanner](https://developers.google.com/ml-kit/vision/barcode-scanning/code-scanner)

### 15.4 Saved screenshots and photos

Use Android Photo Picker:

- Request only a selected image.
- Avoid broad photo-library permission.
- Decode from the returned URI using ML Kit.

Source:

- [Android Photo Picker](https://developer.android.com/training/data-storage/shared/photo-picker)

### 15.5 Android Sharesheet

Register receiving Activities for:

```text
ACTION_SEND          image/*
ACTION_SEND          text/plain
ACTION_SEND_MULTIPLE image/*
```

Handle:

- `EXTRA_STREAM`.
- `EXTRA_TEXT`.
- Content URIs.
- Multiple images where useful.

Treat MIME types and URI data as attacker-controlled. Apply size limits and decode off the main thread.

Source:

- [Android: Receiving shared content](https://developer.android.com/training/sharing/receive)

### 15.6 App shortcuts

Publish:

- Static shortcut: **Scan QR safely**.
- Dynamic shortcut: **Check image**.
- Optional user-approved pinned shortcut.

A pinned shortcut creates a one-tap scanner entry on the Home Screen. Shortcuts launch Activities; they do not scan inside the launcher.

Source:

- [Android app shortcuts](https://developer.android.com/develop/ui/compose/system/shortcuts)

### 15.7 Home Screen widget

Build a Glance widget with:

- Scan camera.
- Check screenshot/photo.
- Paste and check.
- Last result.

The widget launches an Activity through a `PendingIntent`. It cannot host continuous camera analysis.

Source:

- [Jetpack Glance](https://developer.android.com/develop/ui/compose/glance)
- [Android App Widgets](https://developer.android.com/develop/ui/views/appwidgets/overview)

### 15.8 Quick Settings tile

An optional `TileService` can launch the scanner.

Limitations:

- User must add the tile.
- It usually requires opening Quick Settings and tapping.
- Android guidance discourages using a tile solely as a general app launcher.
- It cannot scan in the background.

Source:

- [Android Quick Settings tiles](https://developer.android.com/develop/ui/views/quicksettings-tiles)

### 15.9 Notifications

Possible uses:

- User-requested scan reminder.
- **Scan another** action.
- Completed remote-analysis result.

Do not use persistent notifications to simulate system integration. Android 13+ requires notification permission for ordinary notifications.

Source:

- [Android notification permission](https://developer.android.com/develop/ui/compose/notifications/notification-permission)

### 15.10 Assistant, App Actions, and Gemini

Android App Actions can map supported built-in intents to application functionality and shortcuts.

Research did not verify:

- A QR-scanning-specific built-in intent.
- Reliable universal invocation through Gemini.
- Consistent support across devices, languages, and Assistant surfaces.

Voice invocation should be an optional convenience, not a core launch promise.

Sources:

- [Google App Actions overview](https://developers.google.com/assistant/app)
- [Android shortcuts](https://developer.android.com/develop/ui/compose/system/shortcuts)

### 15.11 Lock Screen

Pixel exposes predefined system Lock Screen shortcuts including Camera and a system QR scanner. No public API was verified that allows a third-party application to register as the Pixel Lock Screen QR scanner.

Lock-screen widgets remain device, OS, and host dependent and cannot be promised as a universal phone capability.

### 15.12 App Links and URL handling

Verified Android App Links require:

- A domain controlled by the application operator.
- `android:autoVerify`.
- `/.well-known/assetlinks.json`.

An application cannot automatically claim arbitrary bank, merchant, shortener, or attacker domains.

Becoming a general browser/default browser would not provide raw QR results from Camera or Lens and would impose a much larger browser-product scope.

Source:

- [Android: Verify App Links](https://developer.android.com/training/app-links/verify-applinks)

### 15.13 Android platform boundaries

No documented public API was found to:

- Replace the Pixel system QR scanner.
- Intercept Pixel Camera QR results.
- Intercept Google Lens results.
- Insert a plugin into Google Photos.
- Become a universal default QR scanner.
- Reliably become the default camera across devices.

The supported integration is **Share to the application** or direct launch into the application's own scanner.

### 15.14 Approaches to avoid

#### Accessibility service

Do not use Accessibility Service to monitor other applications or capture QR results. Accessibility services are intended to assist users with disabilities and are subject to strict policy and disclosure requirements.

Source:

- [Android accessibility services](https://developer.android.com/guide/topics/ui/accessibility/service)

#### Overlay

Avoid `SYSTEM_ALERT_WINDOW` overlays:

- They create phishing-like UX.
- Require special permission.
- Do not reliably provide another application's QR payload.
- Damage consumer trust.

#### Clipboard polling

Do not poll the clipboard:

- Background clipboard access is restricted.
- Android shows privacy notifications for clipboard access.
- It is unnecessary when an explicit Paste action exists.

Source:

- [Android secure clipboard handling](https://developer.android.com/privacy-and-security/risks/secure-clipboard-handling)

#### Background camera

Do not attempt ambient scanning:

- Camera permission is a runtime dangerous permission.
- Camera should run in a visible, user-initiated Activity.
- Newer Android versions restrict camera foreground services started from the background.

Sources:

- [Android runtime permissions](https://developer.android.com/training/permissions/requesting)
- [Android foreground-service types](https://developer.android.com/develop/background-work/services/fgs/service-types)

---

## 16. Seamless native entry-point matrix

| Situation | iOS | Android | Actual capability |
|---|---|---|---|
| One-tap physical scan | Home/Lock Screen control, Control Center, app icon | Pinned shortcut, app icon, widget | Launches live scanner |
| Hardware/locked entry | Action Button, Camera Control, Locked Camera Capture | No universal third-party equivalent | iOS can locally scan while locked |
| Scan saved photo | Photos picker | Android Photo Picker | Direct image decoding |
| Scan from Photos/gallery | Share extension | Sharesheet receiving Activity | Direct image decoding |
| Scan screenshot | Screenshot Share → extension | Screenshot Share → application | Direct image decoding |
| Voice | Siri/App Intent | App Actions where supported | Launches scanner/check action |
| Widget | WidgetKit/Control | Glance App Widget | Launches scanner, shows cached state |
| Browser page | Safari extension or Share | Share to application | Analyze selected URL/image |
| Default Camera interception | Not supported | Not supported | Unavailable |
| Default QR scanner role | Not supported | No verified public role | Unavailable |

---

## 17. Cross-platform architecture

### 17.1 Recommended native shells

#### iOS

- Swift.
- SwiftUI.
- UIKit wrappers where framework APIs require them.
- VisionKit.
- Vision.
- AVFoundation.
- App Intents.
- WidgetKit.
- Share extension.
- LockedCameraCapture.

#### Android

- Kotlin.
- Jetpack Compose.
- CameraX.
- ML Kit.
- Glance.
- TileService.
- Sharesheet receiving Activity.
- App shortcuts and App Actions.

### 17.2 Shared Rust core

Use a narrow Rust library for:

- URL parsing policy.
- Canonicalization.
- Public-suffix processing.
- IDN and confusable analysis.
- Deterministic feature extraction.
- Rule evaluation.
- Signed rule verification.
- Risk-evidence schema.
- Redirect record validation.
- Serialization.
- Golden test vectors.

Use UniFFI or a similarly controlled binding layer.

Source:

- [Mozilla UniFFI](https://mozilla.github.io/uniffi-rs/latest/)

Do not put into Rust:

- Camera lifecycle.
- UI.
- App Intents.
- Widgets.
- Share extensions.
- Android Activities.
- Permissions.
- Platform storage handles.

### 17.3 Framework comparison

| Approach | Assessment |
|---|---|
| Native SwiftUI + Compose | Best integration, startup, accessibility, and lifecycle control |
| Kotlin Multiplatform | Good alternative for shared domain/network logic while keeping SwiftUI iOS UI |
| Rust shared core | Best for narrow, security-sensitive deterministic logic |
| React Native | Main UI possible, but every important system extension still requires native targets and bridges |
| Flutter | Main UI possible, but extension-heavy design still requires extensive native implementation |
| Capacitor | WebView-centric and poorly suited to camera/lock-screen/extension-critical product |

React Native, Flutter, or Capacitor do not remove the need for:

- iOS Share Extension.
- WidgetKit targets.
- App Intents.
- Locked Camera Capture.
- Android TileService.
- Android widgets.
- Native camera lifecycle.
- Sharesheet receiving Activities.

For this product, maximum code sharing would increase bridge complexity without eliminating the hardest native work.

Sources:

- [React Native native platform integration](https://reactnative.dev/docs/native-platform)
- [React Native Turbo Modules](https://reactnative.dev/docs/turbo-native-modules-introduction)
- [Flutter platform channels](https://docs.flutter.dev/platform-integration/platform-channels)
- [Capacitor iOS](https://capacitorjs.com/docs/ios)

---

## 27. Offline-first AI architecture

### 27.1 Product requirement

The application must remain useful with:

- Airplane mode enabled.
- No SIM or Wi-Fi.
- Apple Intelligence disabled.
- No Google Play Services.
- No AICore/Gemini Nano support.
- No previously downloaded optional language model.
- Threat-intelligence data that has not been refreshed recently.

The offline mode must not silently contact:

- Reputation providers.
- Redirect destinations.
- DNS resolvers outside normal operating-system behavior.
- Analytics providers.
- Cloud language models.
- Model-download services.

The user explicitly enables online mode. Online mode provides fresher and deeper evidence but must not replace the local baseline.

### 27.2 Core conclusion

The application does **not** need to ship a large generative model to provide useful offline protection.

The required offline stack is:

1. Bundled QR decoder.
2. Standards-conforming local URL parser.
3. Deterministic rules.
4. Signed local brand/domain and malicious-indicator data.
5. Compact discriminative URL classifier.
6. Optional compact Norwegian message/text classifier.
7. Deterministic Bokmål and Nynorsk explanation templates.

Generative AI is an optional presentation enhancement. It must not control the verdict.

### 27.3 What should be shipped in the base application

Ship these assets with the initial installation:

- QR decoding implementation/model.
- Public Suffix List snapshot.
- IDNA and Unicode-confusable data required by the parser.
- Deterministic security rules.
- Protected Norwegian brand/domain mappings.
- Small signed malicious-domain/URL-prefix snapshot where licensing permits.
- URL classifier.
- Norwegian explanation templates.
- Optional small text classifier if its measured benefit justifies the size.
- Self-test vectors and model/rule schema versions.

This guarantees useful first-run operation without downloading anything.

### 27.4 What should not be required in the base application

Do not make these mandatory:

- Apple Foundation Models.
- Gemini Nano.
- A bundled 0.5B-4B generative model.
- Cloud LLM access.
- Live threat-intelligence lookup.
- Redirect expansion.
- Page rendering.

---

## 28. Offline and online feature contract

| Capability | Offline default | Explicit online mode |
|---|---|---|
| QR decoding | Fully available | Fully available |
| Payload classification | Fully available | Fully available |
| URL canonicalization | Fully available | Fully available |
| IDN/confusable checks | Fully available | Fully available |
| Dangerous scheme checks | Fully available | Fully available |
| Local brand/domain rules | Fully available | Updated when user permits |
| Local URL classifier | Fully available | Same local model |
| Norwegian text classifier | Available if bundled | Same local model |
| Local malicious indicator snapshot | Available, timestamped | Refreshed with consent |
| DNS evidence | Not contacted | Available through protected service |
| Redirect expansion | Not performed | Available through isolated worker |
| TLS/RDAP/CT evidence | Not current | Available through protected service |
| Live reputation | Not available | Provider lookup with disclosure |
| Remote page rendering | Not available | Optional isolated analysis tier |
| Explanation | Templates; optional local OS model | Templates, local OS model, or separately consented server model |
| Analytics | Off | Still off by default |

Offline result language:

> No known warning from offline checks. Current reputation, redirects, and website behavior were not checked.

Stale-data language:

> Offline protection data was last updated on [date]. Newer threats may not be recognized.

---

## 29. Cross-platform device capability tiers

### Tier 0: Universal deterministic mode

Applies to every supported device.

Capabilities:

- QR decoding.
- Payload parsing.
- URL normalization.
- IDN/confusable detection.
- Local rules.
- Norwegian templates.

No AI model is required.

### Tier 1: Compact classifier mode

Adds:

- Small URL-risk classifier.
- Optional small Norwegian message classifier.

Implementation:

- Core ML on iOS.
- LiteRT on Android.

This is the recommended minimum production tier.

### Tier 2: Hardware-accelerated classifier mode

Adds acceleration where available:

- Apple Neural Engine/GPU through Core ML.
- Android GPU/NPU through LiteRT.

The application must retain CPU fallback.

### Tier 3: Operating-system generative explanation

Adds optional local natural-language explanations:

- Apple Foundation Models on eligible Apple Intelligence devices.
- Gemini Nano/AICore on explicitly supported Android devices.

The application must runtime-check availability and fall back to templates.

### Tier 4: Optional downloaded open-weight model

Adds a version-controlled application-managed generative model on capable devices.

This should be:

- Disabled by default.
- A separate large download.
- Restricted to explanation.
- Subject to RAM, storage, battery, and thermal checks.
- Removable by the user.

It is not recommended for the initial release.

---

## 30. Offline AI on iOS

### 30.1 Universal iOS baseline

A fully offline iOS application can use:

- Vision QR/barcode detection.
- AVFoundation live camera metadata.
- Deterministic Swift/Rust URL processing.
- A bundled Core ML classifier.
- Localized templates.

None of these requires Apple Intelligence.

### 30.2 Core ML as the classifier runtime

Core ML is the recommended production runtime for custom classifiers. Apple states that Core ML can use:

- CPU.
- GPU.
- Apple Neural Engine.

Strictly local Core ML inference does not require a network connection.

Source:

- [Apple Core ML](https://developer.apple.com/documentation/coreml)

Recommended model types:

- Logistic regression.
- Small neural character classifier.
- Compact text encoder.
- Shallow tree/feature model after compatible conversion.

Use `MLModelConfiguration.computeUnits`:

- `.all` for ordinary foreground classification.
- `.cpuOnly` where predictable background/extension behavior is preferable.
- `.cpuAndNeuralEngine` only after device benchmarking.

Source:

- [Apple MLComputeUnits](https://developer.apple.com/documentation/coreml/mlcomputeunits)

Do not assume every operation executes on the Neural Engine. Core ML may partition execution across units.

### 30.3 Core ML formats

Relevant formats:

- `.mlmodel`: model definition/source artifact.
- `.mlmodelc`: compiled runtime representation.
- `.mlpackage`: package container required for modern ML Program models.

Core ML Tools 7 and newer use ML Program as the default conversion target. ML Program deployment requires iOS 15 or newer.

Source:

- [Core ML Tools: Convert to ML Program](https://apple.github.io/coremltools/docs-guides/source/convert-to-ml-program.html)

Downloaded Core ML models can be compiled on device, but the security-critical classifier should be bundled so first-run offline behavior is guaranteed.

Source:

- [Apple: Downloading and compiling a model](https://developer.apple.com/documentation/coreml/downloading-and-compiling-a-model-on-the-user-s-device)

### 30.4 Compression

Evaluate:

- Linear quantization.
- Palettization.
- Pruning.
- Combined optimization.

Source:

- [Core ML Tools optimization](https://apple.github.io/coremltools/docs-guides/source/opt-conversion.html)

For the URL classifier, start with a model that is inherently small. Compression is not a substitute for an appropriately narrow model.

After every conversion:

- Run the complete chronological/domain-held-out test set.
- Recalculate calibration.
- Recheck thresholds.
- Benchmark actual compiled size and memory.

### 30.5 Apple Foundation Models

The iOS 26 Foundation Models framework provides access to Apple's on-device `SystemLanguageModel`.

Documented capabilities include:

- Text generation.
- Guided structured generation.
- Session handling.
- Tool calling.
- Newer multimodal capabilities.

Sources:

- [Apple Foundation Models](https://developer.apple.com/documentation/foundationmodels)
- [SystemLanguageModel](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel)

#### Offline behavior

`SystemLanguageModel` inference is on-device after:

- Apple Intelligence has been enabled.
- The device is eligible.
- The system model has been downloaded and is ready.

The application cannot guarantee that a newly configured device has the model before the user connects to the internet.

Do not use these in offline mode:

- `PrivateCloudComputeLanguageModel`.
- Remote providers.
- Tools capable of network access.

Source:

- [Apple: Server-side intelligence with Private Cloud Compute](https://developer.apple.com/documentation/foundationmodels/adding-server-side-intelligence-with-private-cloud-compute)

#### Device requirements

Apple's published Apple Intelligence requirements include:

- iPhone 15 Pro models.
- iPhone 16 models or later.
- Sufficient free storage.
- Apple Intelligence enabled.
- Matching supported device and Siri languages.

Foundation Models application APIs require iOS 26 or newer.

Source:

- [Apple Intelligence requirements](https://support.apple.com/en-us/121115)

The application must check:

```swift
if #available(iOS 26.0, *) {
    let model = SystemLanguageModel.default
    switch model.availability {
    case .available:
        // Optional explanation.
    case .unavailable(.deviceNotEligible),
         .unavailable(.modelNotReady):
        // Deterministic templates.
    default:
        // Deterministic templates.
    }
}
```

Never infer availability only from the device model.

#### Norwegian language support

Apple lists **Norwegian** among Apple Intelligence languages in iOS/iPadOS/macOS 26.1 and later.

Apple's public support list does not separately guarantee Bokmål and Nynorsk.

Check at runtime:

```swift
let bokmalSupported =
    SystemLanguageModel.default.supportsLocale(Locale(identifier: "nb_NO"))
let nynorskSupported =
    SystemLanguageModel.default.supportsLocale(Locale(identifier: "nn_NO"))
```

Use bundled templates whenever a locale is not explicitly supported.

Source:

- [Apple: Foundation Models languages and locales](https://developer.apple.com/documentation/foundationmodels/supporting-languages-and-locales-with-foundation-models)

#### Context limit

Apple documents a 4,096-token context window per session. Instructions, schema, previous turns, and tool data consume the context.

Source:

- [Apple: Managing the context window](https://developer.apple.com/documentation/foundationmodels/managing-the-context-window)

For one QR scan:

- Create a fresh session.
- Supply only structured reason codes and short evidence.
- Limit explanation length.
- Do not supply page HTML or long history.

#### Guided generation

Use `@Generable` and `@Guide` to request a constrained Swift structure.

Source:

- [Apple: Guided generation](https://developer.apple.com/documentation/foundationmodels/generating-swift-data-structures-with-guided-generation)

Guided generation guarantees shape, not factual correctness. The verdict remains external and immutable.

#### Tool calling

Disable tool calling for offline QR explanations.

The model can select tools and generate tool arguments. A tool capable of networking or opening a URL would undermine the offline and security boundary.

Source:

- [Apple: Foundation Models tool calling](https://developer.apple.com/documentation/foundationmodels/expanding-generation-with-tool-calling)

Use:

- No tools.
- No application actions.
- No destination opening.
- No network-capable callbacks.

Apple separately warns about prompt injection from untrusted external content.

Source:

- [Apple: Improving generative-model output safety](https://developer.apple.com/documentation/foundationmodels/improving-the-safety-of-generative-model-output)

### 30.6 Foundation Model adapters

Apple's Adapter Training Toolkit provides LoRA/parameter-efficient adaptation of the system model.

Documented characteristics:

- Base weights remain frozen.
- Export format is `.fmadapter`.
- Each adapter is approximately 160 MB.
- Deployment requires a Foundation Models Framework Adapter Entitlement.
- Adapters are tied to toolkit/system-model version ranges.
- An adapter for the iOS 26 generation may require retraining for a later system-model generation.

Source:

- [Apple Foundation Models Adapter Training Toolkit](https://developer.apple.com/apple-intelligence/foundation-models-adapter/)

Apple recommends distributing compatible adapters through Background Assets rather than bundling multiple versions.

Source:

- [Apple Background Assets](https://developer.apple.com/documentation/backgroundassets)

Recommendation:

- Do not use an adapter in the MVP.
- Do not fine-tune only to produce a preferred writing style.
- Consider an adapter only after controlled evaluation shows repeated failures that templates and the base model cannot solve.
- Budget for retraining and validation across OS model versions.

### 30.7 MLX and MLX Swift

MLX Swift can run local language and vision-language models on Apple silicon and includes iOS examples.

Source:

- [MLX Swift](https://github.com/ml-explore/mlx-swift)

Its project positioning emphasizes research and experimentation. For the production security path, prefer:

1. Vision and deterministic analysis.
2. Core ML classifier.
3. Apple Foundation Models for eligible-device explanations.
4. Custom generative Core ML only if there is a demonstrated requirement.

MLX would increase responsibility for:

- Model packaging.
- Tokenizers.
- Metal memory behavior.
- Runtime compatibility.
- Thermal testing.
- Model licenses.

### 30.8 iOS model packaging

#### Base bundle

Use for:

- Small classifier.
- Templates.
- Rules.
- Critical tokenizer/feature assets.

Advantages:

- Available immediately.
- Covered by normal application signing.
- No first-run download.

Apple's current documented maximum uncompressed iOS/iPadOS application size is 4 GB, with a separate executable-size limit. The product should remain far below these maximums.

Source:

- [Apple maximum build file sizes](https://developer.apple.com/help/app-store-connect/reference/app-uploads/maximum-build-file-sizes)

#### Background Assets

Use for optional:

- Large Core ML model.
- Foundation Model adapter.
- Large language pack.

Background Assets can manage hosted asset packs and updates. Optional assets cannot be considered available for first-run offline scanning.

Source:

- [Apple Background Assets](https://developer.apple.com/documentation/backgroundassets)

#### Integrity

- Bundled models inherit application signing.
- Downloaded assets need a signed manifest, version, hash, compatibility metadata, and rollback protection.
- Compile downloaded Core ML models only after verification.
- Retain the last-known-good model.

Core ML model encryption can increase the extraction barrier but does not replace signed delivery.

Source:

- [Apple: Encrypting a Core ML model](https://developer.apple.com/documentation/coreml/encrypting-a-model-in-your-app)

### 30.9 iOS extension limitations

Apple states that extensions:

- Have lower memory limits than foreground applications.
- Should launch well under one second.
- Can be aggressively terminated.
- Do not receive priority for shared GPU resources.

Source:

- [Apple: Creating an App Extension](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ExtensionCreation.html)

Share extension:

- Use parser, rules, and at most the tiny classifier.
- Do not load a generative model or adapter.
- Offer **Open full report** for richer local processing.

Locked Camera Capture:

- Cannot access the network while locked.
- Cannot access the App Group shared container.
- Has ephemeral extension storage.
- May be terminated quickly without an active camera view.

Source:

- [Apple Locked Camera Capture](https://developer.apple.com/documentation/lockedcameracapture/creating-a-camera-experience-for-the-lock-screen)

Use only:

- Vision QR detection.
- Embedded deterministic rules.
- Optional tiny embedded classifier after benchmarking.

Do not use Foundation Models, adapters, MLX, or a large model in the locked extension.

---

## 31. Offline AI on Android

### 31.1 Universal Android baseline

The application can work fully offline without Google Play Services by bundling:

- QR scanner/decoder.
- URL parser and deterministic rules.
- LiteRT classifier.
- Norwegian templates.

This should be the required baseline for every supported Android device.

### 31.2 Bundled ML Kit QR model

Google documents two barcode-scanner delivery options:

- Bundled model: approximately 2.4 MB application-size increase and immediately available.
- Play Services/unbundled model: much smaller application impact but may require first-use download.

For a first-run offline guarantee, use the bundled barcode dependency.

Source:

- [ML Kit Barcode Scanning](https://developers.google.com/ml-kit/vision/barcode-scanning/android)

### 31.3 LiteRT classifier

Use LiteRT for:

- URL feature classifier.
- Optional compact message classifier.

Google's current LiteRT stack supports:

- CPU.
- GPU.
- NPU where compatible.

Source:

- [LiteRT for Android](https://developers.google.com/edge/litert/android)

Use CPU as the universal baseline.

Do not build a new architecture directly around NNAPI. Android documents NNAPI as deprecated in Android 15.

Source:

- [Android NNAPI](https://developer.android.com/ndk/guides/neuralnetworks)

### 31.4 Android quantization

Google documents:

- Dynamic-range quantization.
- Full integer quantization.
- Float16 quantization.

Typical documented effects include substantially smaller weights and faster CPU inference, but actual performance and accuracy must be measured.

Source:

- [LiteRT post-training quantization](https://developers.google.com/edge/litert/conversion/tensorflow/quantization/post_training_quantization)

Recommended:

- INT8 URL classifier.
- INT8 or FP16 text model depending on accuracy and accelerator.
- Recalibrate after quantization.

### 31.5 Gemini Nano and AICore

Gemini Nano runs on device through Android AICore on explicitly supported devices.

Sources:

- [Android Gemini Nano](https://developer.android.com/ai/gemini-nano)
- [ML Kit GenAI](https://developers.google.com/ml-kit/genai)

#### Privacy and offline behavior

Google states that:

- Inference inputs and outputs are processed locally.
- AICore does not retain request input/output after processing.
- AICore itself does not have direct internet access.
- Model and configuration delivery can occur through Private Compute Services.

Therefore:

- Inference can work without a reliable connection after the feature is installed and available.
- A newly installed/reset device may need model or configuration downloads.
- It cannot provide a first-run offline guarantee.

#### Runtime availability

Handle:

- `UNAVAILABLE`
- `DOWNLOADABLE`
- `DOWNLOADING`
- `AVAILABLE`

Do not infer support from:

- Android version.
- Manufacturer.
- Chipset.
- Device marketing name.

Google maintains a changing allow-list of supported devices and capabilities.

Source:

- [ML Kit GenAI device support](https://developers.google.com/ml-kit/genai#device-support)

#### Prompt API

The Prompt API supports free-form text and, on supported configurations, multimodal input.

Current constraints documented during research include:

- Beta dependency/API status.
- Bounded input context.
- Runtime model availability.
- Foreground-only use.
- Per-application battery/burst quotas.

Source:

- [ML Kit GenAI Prompt API](https://developers.google.com/ml-kit/genai/prompt/android/get-started)

#### Language support

Google's specialized Summarization and Rewriting APIs document limited supported language lists that do not include Norwegian.

Sources:

- [ML Kit GenAI Summarization](https://developers.google.com/ml-kit/genai/summarization/android)
- [ML Kit GenAI Rewriting](https://developers.google.com/ml-kit/genai/rewriting/android)

The Prompt API does not provide a reliable published guarantee of Norwegian quality. Do not advertise Norwegian support without testing the exact device/model versions.

Use Norwegian templates as the guaranteed fallback.

#### Foreground and quota restrictions

ML Kit GenAI blocks inference unless the application is the top foreground application. A foreground service is not sufficient.

It also enforces:

- Burst limits.
- Longer-duration battery quotas.
- Busy/quota error states.

Source:

- [ML Kit GenAI quotas and background behavior](https://developers.google.com/ml-kit/genai)

Do not use Gemini Nano from:

- Widgets.
- Quick Settings tiles.
- Background services.
- Deferred background analysis.

### 31.6 LiteRT-LM for application-managed language models

MediaPipe LLM Inference is now documented as maintenance-only. Google recommends LiteRT-LM for new Android LLM work.

Sources:

- [MediaPipe LLM Inference maintenance notice](https://developers.google.com/edge/mediapipe/solutions/genai/llm_inference/android)
- [LiteRT-LM overview](https://developers.google.com/edge/litert-lm/overview)
- [LiteRT-LM Android API](https://developers.google.com/edge/litert-lm/android)

LiteRT-LM:

- Loads application-controlled model files.
- Does not require AICore.
- Can use CPU/GPU/NPU backends where supported.
- Supports model families such as Gemma, Llama, Phi, and Qwen.

Use it only for optional explanation or text assistance, not primary URL verdicts.

Large-model initialization may take seconds. Keep it outside the scan-to-verdict critical path.

### 31.7 Android model packaging

#### Base application

Bundle:

- QR model.
- Rules.
- Small URL classifier.
- Templates.

This is available immediately after installation.

#### Play for On-device AI / AI packs

Google Play supports:

- Install-time packs.
- Fast-follow packs.
- On-demand packs.

Source:

- [Google Play for On-device AI](https://developer.android.com/google/play/on-device-ai)

Interpretation:

- Install-time pack: available after Play installation completes.
- Fast-follow: not guaranteed at first launch.
- On-demand: downloaded only after request.

For a strict offline-first promise:

- Keep the critical classifier in the base application or install-time pack.
- Use on-demand only for an optional large model.

Large downloads may pause for Wi-Fi or user consent.

#### Integrity

- Android application packages are signed.
- Google Play App Signing signs delivered packages.
- Downloaded models need an application-verified signed manifest and hash.
- Play Integrity is an online backend signal, not a local offline model-integrity mechanism.

Sources:

- [Android app signing](https://developer.android.com/studio/publish/app-signing)
- [Play Integrity](https://developer.android.com/google/play/integrity)

### 31.8 Android widgets, tiles, and background limits

Do not initialize models inside:

- App widgets.
- `TileService`.
- Long-lived background services.

Widgets should display cached results and launch the scanner.

Tiles should launch the foreground scanner.

Sources:

- [Android App Widgets](https://developer.android.com/develop/ui/views/appwidgets)
- [Android TileService](https://developer.android.com/reference/android/service/quicksettings/TileService)

Gemini Nano inference specifically requires the application to be top foreground.

---

## 32. Do we need to ship an open-weight generative model?

### 32.1 Recommendation

Do not ship a generative model in version 1.

Reasons:

- It does not materially improve the security verdict.
- It adds hundreds of megabytes or multiple gigabytes.
- It increases RAM and startup requirements.
- It consumes battery and creates heat.
- It creates model licensing and update obligations.
- It increases prompt-injection and hallucination risk.
- Norwegian quality may still be inferior to reviewed templates.

### 32.2 Preferred explanation hierarchy

1. Deterministic templates on every device.
2. Apple Foundation Models on eligible iOS devices.
3. Gemini Nano on supported Android devices after runtime verification.
4. Optional downloaded application-managed open-weight model only if experiments show a substantial comprehension benefit.
5. Optional server model only after separate explicit consent.

### 32.3 Candidate open-weight models

Model status and licenses must be checked again at release time.

| Model | License/status | Approximate mobile reality | Norwegian evidence | Assessment |
|---|---|---|---|---|
| Gemma 4 E2B | Apache 2.0 open-weight model | Official mobile artifacts are around the sub-GB to ~1 GB class; runtime memory is higher | Trained on many languages, but no QR-security Norwegian benchmark | Best-supported Google mobile experiment; too large for default install |
| Gemma 4 E4B | Apache 2.0 open-weight model | Multi-GB storage/runtime class | Same language caveat | High-end optional download only |
| Gemma 3n E2B/E4B | Gemma custom terms | Designed for edge but still large | Broad multilingual training | Licensing and size make it less attractive than current Apache alternatives |
| Qwen3 0.6B | Apache 2.0 | Roughly several hundred MB after low-bit quantization, plus runtime | Broad language claim; Norwegian security quality unverified | Plausible explanation experiment |
| Qwen3 1.7B | Apache 2.0 | Roughly ~1 GB low-bit class plus runtime | Same caveat | Optional high-end devices only |
| EuroLLM-1.7B | Apache 2.0 | Roughly ~1 GB low-bit class plus runtime | Norwegian explicitly included | Strongest Norwegian-language candidate, but too large for default install |
| SmolLM3-3B | Apache 2.0 | Roughly 1.5-2+ GB low-bit class plus runtime | Native language list does not prioritize Norwegian | Not recommended for Norwegian-first use |

Sources:

- [Gemma model documentation](https://ai.google.dev/gemma/docs/core)
- [Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4)
- [Gemma terms](https://ai.google.dev/gemma/terms)
- [Qwen3 0.6B model card](https://huggingface.co/Qwen/Qwen3-0.6B)
- [Qwen3 license](https://huggingface.co/Qwen/Qwen3-0.6B/raw/main/LICENSE)
- [EuroLLM-1.7B model card](https://huggingface.co/utter-project/EuroLLM-1.7B)
- [SmolLM3-3B model card](https://huggingface.co/HuggingFaceTB/SmolLM3-3B)

Approximate sizes must not be used as final product requirements. Actual artifacts depend on:

- Quantization format.
- Tokenizer.
- Runtime.
- KV cache.
- Context length.
- Architecture support.
- Packaging overhead.

### 32.4 Optional model download UX

If a bundled open-weight model is later offered:

- Call it an optional **Offline AI explanation pack**.
- Show exact download size.
- Show expected storage and RAM class.
- Default to Wi-Fi-only download.
- Allow deletion.
- Never block scanning while absent.
- Verify signed manifest and hash.
- Run self-test before activation.
- Keep deterministic templates available.

---

## 33. Fine-tuning strategy

### 33.1 URL classifier

The URL classifier is not an LLM fine-tuning task.

Train a compact supervised classifier using:

- Lexical features.
- Structural features.
- Character n-grams.
- IDN/confusable features.
- Domain/path/query features.

Preferred first model:

- Regularized logistic regression with numeric features and hashed character n-grams.

Challenger:

- Shallow gradient-boosted trees.
- Compact character neural network.

Expected serialized size can be in the hundreds of kilobytes to a few megabytes.

Target latency should be negligible compared with camera and UI work.

### 33.2 Norwegian text classifier

Purpose:

- Classify user-shared SMS/message text.
- Classify QR-embedded text.
- Classify text extracted from a user-supplied image.
- Classify bounded text from an explicitly online-fetched page.

Options:

1. Character/word n-gram linear classifier.
2. Distilled Norwegian transformer.

Recommended sequence:

- Start with n-gram baseline.
- Use NB-BERT as a teacher/evaluation model.
- Distill only if semantic improvement is material.

NB-BERT's model card states that task-specific fine-tuning is expected.

Source:

- [NB-BERT model card](https://huggingface.co/NbAiLab/nb-bert-base)

Do not ship full BERT-base by default without device-size and latency justification.

### 33.3 Generative explanation

Do not fine-tune initially.

Use:

- Reviewed templates.
- Structured prompts to OS-provided models.
- Strict output-length and schema constraints.

Consider LoRA only if:

- Base model quality is measured on released devices.
- A stable failure pattern exists.
- The adapter produces a measurable comprehension improvement.
- Versioned retraining and evaluation are affordable.

Sources:

- [LoRA paper](https://arxiv.org/abs/2106.09685)
- [QLoRA paper](https://arxiv.org/abs/2305.14314)

The model must never be trained to determine or override the verdict.

### 33.4 Quantization order

For classifiers:

1. Train FP32/BF16.
2. Freeze validation/test sets.
3. Export.
4. Quantize.
5. Execute the exact mobile runtime.
6. Re-evaluate.
7. Recalibrate thresholds.

Use quantization-aware training only if post-training quantization causes unacceptable degradation.

For optional generative models:

- Fine-tune/adapt first.
- Merge or export using the selected supported workflow.
- Quantize.
- Re-run factuality, language, latency, memory, and thermal tests.

---

## 34. Training data strategy

### 34.1 URL positives

Possible sources where terms permit:

- Verified phishing feeds.
- Malware URL feeds.
- Partner-confirmed fraud URLs.
- Manually reviewed Norwegian scam campaigns.

Store:

- First-seen time.
- Verification time.
- Source.
- Target brand.
- Campaign family.
- Rights/license.
- Collection timestamp.

Do not use source name, feed membership, or feed position as model features.

### 34.2 URL negatives

Use:

- Legitimate Norwegian services.
- Legitimate international services.
- Long e-commerce URLs.
- Payment links.
- Tracking URLs.
- URL shorteners.
- Internationalized domains.
- Cloud-hosted sites.
- Marketing campaign URLs.

Absence from a phishing feed is not enough to establish a benign label.

### 34.3 Hard negatives

Include:

- Legitimate BankID/Vipps/bank URLs.
- Delivery tracking.
- Government campaigns.
- Authentication and password-reset flows.
- Legitimate short links.
- Legitimate recently registered businesses.

Hard negatives are essential to maintain consumer trust.

### 34.4 Norwegian text data

Potential sources:

- Public fraud warnings with clear reuse rights.
- Partner datasets from banks/telcos under agreements.
- Manually reviewed campaign examples.
- Multilingual scam corpora with verified Norwegian subsets.
- Synthetic variants used only as augmentation.

Remove:

- Phone numbers.
- Account numbers.
- One-time codes.
- Personal names where not necessary.
- Unique tracking identifiers.
- Private correspondence.

Never train on user scans by default.

### 34.5 Labels

Suggested text labels:

- `credential_or_payment_phish`
- `delivery_or_invoice_scam`
- `investment_or_impersonation_scam`
- `legitimate_transactional`
- `benign`
- `uncertain`

Do not classify every urgent or payment-related message as malicious.

---

## 35. Leakage-resistant evaluation

Use separate:

1. Chronological split.
2. Registrable-domain split.
3. Campaign/template split.
4. Data-source holdout.
5. Brand holdout.
6. Norwegian production-prevalence set.

Prevent overlap of:

- eTLD+1.
- Redirect-chain family.
- QR artwork.
- Message template.
- Campaign.
- Near duplicates.

Measure:

- Precision-recall area.
- Recall at fixed false-positive rates.
- False positives per 10,000 legitimate scans.
- Brier score.
- Calibration curve.
- Results by language.
- Results by brand.
- Results by shortener.
- Results by Unicode/IDN type.
- Results by device/runtime.
- Results after quantization.

### 35.1 Suggested launch policy

Final thresholds require product/legal approval and real data.

Initial research target:

- **Known malicious:** exact signed indicator match or explicit online provider confirmation.
- **High risk:** calibrated threshold selected for approximately 0.1% or lower false positives on a production-like legitimate holdout.
- **Caution:** suspicious but unconfirmed.
- **Insufficient evidence:** ordinary unknown link.

Never turn a classifier probability alone into **Known malicious**.

---

## 36. Model and rule update security

Every downloadable artifact should include:

- Artifact type.
- Version.
- Schema.
- SHA-256 hash.
- Signature.
- Key ID.
- Creation time.
- Expiry.
- Minimum/maximum application version.
- Runtime/OS compatibility.
- Rollback counter.

Client behavior:

1. Download to temporary storage.
2. Verify signed manifest.
3. Verify hash and size.
4. Verify compatibility.
5. Run model/rule self-tests.
6. Install atomically.
7. Retain last-known-good version.
8. Reject rollback.
9. Delete invalid artifacts.

Support:

- Key rotation.
- Emergency revocation.
- Multiple trusted signing keys during transition.
- Separate rule and model release cycles.

Do not silently switch from local to cloud when a model fails.

---

## 37. Memory, battery, and thermal policy

### 37.1 Classifiers

Expected behavior:

- Tiny URL classifier: always available.
- Small text classifier: loaded lazily or kept warm only when justified.
- Single inference at a time for the security path.

### 37.2 Generative models

Apply:

- Short prompts.
- Short outputs.
- One active generation.
- Bounded context.
- Cancellation.
- Thermal-state monitoring.
- Battery-aware disabling.
- Memory-pressure fallback.

Do not load a large model in:

- iOS Share extension.
- iOS Locked Camera Capture extension.
- Android widget.
- Android Quick Settings tile.
- Android background service.

If optional generation fails:

- Preserve the verdict.
- Display deterministic templates.
- Do not retry continuously.

---

## 38. Offline-first experiment plan

### Phase 1: Deterministic foundation

- Build parser and rules.
- Create signed artifact format.
- Write Bokmål and Nynorsk templates.
- Build QR and URL adversarial test corpus.

### Phase 2: URL classifier

- Train logistic-regression baseline.
- Create chronological/domain/campaign splits.
- Evaluate production-like prevalence.
- Convert to Core ML and LiteRT.
- Quantize and recalibrate.

### Phase 3: Norwegian text

- Train n-gram baseline.
- Evaluate Bokmål, Nynorsk, English, and code-switching.
- Build legitimate transactional hard negatives.
- Test distilled transformer only if baseline is insufficient.

### Phase 4: Device benchmark

Test:

- Older supported iPhone.
- Apple Intelligence-ineligible iPhone.
- Apple Intelligence-eligible iPhone.
- Low-, mid-, and high-tier Android.
- Android without Google Play Services.
- AICore-supported Android.

Measure:

- App size increase.
- Cold startup.
- Camera-to-result latency.
- Model load latency.
- Peak RAM.
- Battery per 100 scans.
- Thermal behavior.
- Extension survival.

### Phase 5: Explanation comparison

Compare:

- Templates.
- Apple Foundation Models.
- Gemini Nano.
- Optional Qwen3 0.6B.
- Optional EuroLLM-1.7B.
- Optional current Gemma mobile model.

Evaluate:

- Norwegian factual correctness.
- Nynorsk quality.
- Hallucinated reasons.
- Verdict preservation.
- User comprehension.
- Latency.
- RAM.
- Battery.
- Download size.

Only ship an optional generative model if it produces a material, measured comprehension improvement over templates.

---

## 39. Updated implementation plan

### MVP offline guarantee

The first public version should provide, without internet:

- Live QR scanning.
- Screenshot/photo scanning.
- Full payload display.
- Safe URL parsing.
- Unicode/lookalike checks.
- Norwegian brand-domain rules.
- Small URL classifier.
- Bokmål and Nynorsk template explanations.
- Clear stale-data and uncertainty messaging.

### Online mode

When explicitly enabled:

- Refresh signed rules/models.
- Query current reputation.
- Resolve redirects in isolated infrastructure.
- Retrieve DNS/TLS/RDAP/CT evidence.
- Optionally analyze a bounded page snapshot.
- Optionally use a separately consented server explanation.

### OS-model enhancement

Add after the offline baseline:

- Apple Foundation Models explanation where available.
- Gemini Nano explanation where available.

Both remain optional and non-authoritative.

### Open-weight model decision

Do not include a generative model in the default installation.

Revisit after:

- Classifier evaluation.
- Real user comprehension testing.
- OS-model coverage analysis.
- Storage/RAM/thermal benchmarking.
- Norwegian language evaluation.

If justified, distribute it as an optional removable offline explanation pack.

---

## 40. Additional offline-AI sources

### Apple

- [Apple Foundation Models](https://developer.apple.com/documentation/foundationmodels)
- [SystemLanguageModel](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel)
- [Apple Intelligence requirements and languages](https://support.apple.com/en-us/121115)
- [Foundation Models language support](https://developer.apple.com/documentation/foundationmodels/supporting-languages-and-locales-with-foundation-models)
- [Managing the Foundation Models context window](https://developer.apple.com/documentation/foundationmodels/managing-the-context-window)
- [Guided generation](https://developer.apple.com/documentation/foundationmodels/generating-swift-data-structures-with-guided-generation)
- [Tool calling](https://developer.apple.com/documentation/foundationmodels/expanding-generation-with-tool-calling)
- [Foundation Models output safety](https://developer.apple.com/documentation/foundationmodels/improving-the-safety-of-generative-model-output)
- [Foundation Models Adapter Training Toolkit](https://developer.apple.com/apple-intelligence/foundation-models-adapter/)
- [Apple Core ML](https://developer.apple.com/documentation/coreml)
- [Core ML Tools optimization](https://apple.github.io/coremltools/docs-guides/source/opt-conversion.html)
- [Background Assets](https://developer.apple.com/documentation/backgroundassets)
- [MLX Swift](https://github.com/ml-explore/mlx-swift)

### Android

- [Android Gemini Nano](https://developer.android.com/ai/gemini-nano)
- [ML Kit GenAI](https://developers.google.com/ml-kit/genai)
- [ML Kit GenAI Prompt API](https://developers.google.com/ml-kit/genai/prompt/android/get-started)
- [ML Kit GenAI Summarization](https://developers.google.com/ml-kit/genai/summarization/android)
- [ML Kit GenAI Rewriting](https://developers.google.com/ml-kit/genai/rewriting/android)
- [LiteRT Android](https://developers.google.com/edge/litert/android)
- [LiteRT quantization](https://developers.google.com/edge/litert/conversion/tensorflow/quantization/post_training_quantization)
- [LiteRT-LM](https://developers.google.com/edge/litert-lm/overview)
- [LiteRT-LM Android](https://developers.google.com/edge/litert-lm/android)
- [Google Play for On-device AI](https://developer.android.com/google/play/on-device-ai)
- [Android app signing](https://developer.android.com/studio/publish/app-signing)

### Models and training

- [NB-BERT](https://huggingface.co/NbAiLab/nb-bert-base)
- [Gemma model documentation](https://ai.google.dev/gemma/docs/core)
- [Qwen3 0.6B](https://huggingface.co/Qwen/Qwen3-0.6B)
- [EuroLLM-1.7B](https://huggingface.co/utter-project/EuroLLM-1.7B)
- [SmolLM3-3B](https://huggingface.co/HuggingFaceTB/SmolLM3-3B)
- [LoRA](https://arxiv.org/abs/2106.09685)
- [QLoRA](https://arxiv.org/abs/2305.14314)
- [Kotlin/Native Objective-C and Swift interop](https://kotlinlang.org/docs/native-objc-interop.html)

---

## 18. Evidence and data schema

Suggested versioned internal record:

```text
ScanEvidence
  schema_version
  scan_id
  captured_at
  source
    live_camera
    photo_picker
    share_extension
    shared_text
    manual_input

  raw_payload
  display_payload
  payload_type

  url
    raw
    canonical
    scheme
    unicode_host
    ascii_host
    registrable_domain
    port
    path
    query_redaction_map

  local_findings[]
    type
    severity
    evidence
    rule_id
    rule_version

  classifier
    model_version
    calibrated_score
    threshold_version

  providers[]
    provider
    checked_at
    result
    result_age
    data_disclosed

  redirect_hops[]
    requested_url_redacted
    response_status
    location_redacted
    destination_domain
    resolved_network_category
    tls_result

  verdict
  confidence
  uncertainties[]
  recommended_actions[]
```

Sensitive query values should be redacted or encrypted and excluded from routine logs.

---

## 19. Privacy architecture

### 19.1 Local by default

Perform locally:

- QR image decoding.
- Payload classification.
- URL parsing.
- IDN analysis.
- Local rules.
- Local model.
- Explanation templates.

### 19.2 Explicit remote actions

Ask separately for:

- Reputation lookup.
- Redirect expansion.
- Page rendering.
- Reporting a suspicious URL.
- Cloud-backed generative explanation.

The consent screen should name the category of provider and what is transmitted.

### 19.3 Retention

Recommended defaults:

- QR image: never retained.
- Raw payload: in memory only unless history enabled.
- Raw URL: do not include in ordinary logs.
- Scan history: off by default.
- Provider results: cache by privacy-preserving key only where legally and technically valid.
- Backend redirect records: short operational retention.
- Security incident samples: separate explicit reporting consent.

### 19.4 Accounts

Do not require an account for core scanning.

Optional account use cases:

- Cross-device history.
- Family sharing.
- Organization deployment.
- Merchant monitoring.

These should be separate from the base privacy proposition.

---

## 20. Performance and reliability

### 20.1 Startup priorities

Before camera preview:

- Do not initialize a large language model.
- Do not run database migrations synchronously.
- Do not fetch remote configuration.
- Do not wait for threat-intelligence providers.
- Do not resolve DNS.

Sequence:

1. Render scanner shell.
2. Start camera.
3. Load compact rules asynchronously.
4. Decode.
5. Display local result.
6. Start optional network enrichment.

### 20.2 iOS extensions

Apple states that extensions should launch well under one second and operate with lower memory limits than foreground applications.

Keep Share and locked-camera extensions small:

- No large model.
- No browser engine.
- No unnecessary framework runtime.
- Compact local rules.
- Atomic App Group handoff when available.

Source:

- [Apple: Creating an App Extension](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ExtensionCreation.html)

### 20.3 Android startup

Measure:

- Time to initial display.
- Time to fully interactive scanner.
- Time to camera preview.
- Time to first decode.
- Time to preliminary verdict.
- Time to online enrichment.

Source:

- [Android launch-time guidance](https://developer.android.com/topic/performance/vitals/launch-time)

### 20.4 Offline behavior

Offline mode must:

- Decode QR codes.
- Display payload.
- Run deterministic checks.
- Run local model.
- Show rule/feed age.
- Report online checks as unavailable.

Correct result:

> Unknown - online reputation and final-destination checks are unavailable.

Incorrect result:

> Safe.

---

## 21. Accessibility and consumer UX

### 21.1 Scanner accessibility

- VoiceOver and TalkBack labels.
- Large touch targets.
- Dynamic Type/scalable text.
- High contrast.
- Reduced motion.
- Haptic and optional sound confirmation.
- Manual focus/zoom where required.
- Non-camera import option.

### 21.2 Result accessibility

Do not communicate by color alone.

Use:

- Icon.
- Text label.
- Short summary.
- Expandable evidence.
- Spoken accessibility announcement.

Example:

> **Mistenkelig**  
> Lenken går gjennom to videresendinger og ender på et domene som ligner på BankID, men som ikke er `bankid.no`.

### 21.3 Action design

Primary safe actions:

- Close.
- Copy technical details.
- Open official application.
- Search for the organization manually.
- Report false positive.
- Report suspicious QR code.

The **Open destination** action should be visually secondary for suspicious results.

---

## 22. Testing strategy

### 22.1 Parser tests

Create golden cases for:

- Userinfo host confusion.
- Backslashes.
- Mixed encodings.
- Unicode controls.
- Punycode.
- IPv4 variants.
- IPv6 literals.
- Default and non-default ports.
- Empty and invalid hosts.
- Nested encoded URLs.
- Excessively long values.

### 22.2 Redirect-worker tests

Test:

- Private IPv4 and IPv6 destinations.
- DNS rebinding.
- Redirect to metadata service.
- Redirect loops.
- Excessive redirects.
- Large headers/body.
- Slow response.
- Invalid `Location`.
- Scheme change.
- Port change.
- IPv4-mapped IPv6.
- Domain changing after DNS resolution.
- HEAD/GET differences.

### 22.3 QR image tests

Include:

- Rotated codes.
- Blurred codes.
- Low contrast.
- Damaged codes.
- Codes in screenshots.
- Multiple codes.
- Nested/split visual patterns where supported.
- Unicode payloads.
- Maximum-size payloads.
- Unsupported ECI encodings.

### 22.4 Security-model tests

- Time-based holdout.
- New domains.
- Norwegian brands.
- Legitimate Norwegian IDNs.
- URL shorteners.
- Compromised legitimate domains.
- False-positive review.
- Calibration drift.

### 22.5 Mobile integration tests

#### iOS

- Camera permission denied/restricted.
- Share extension from each host.
- Locked-state operation.
- Unlock handoff.
- Widget/Control/App Intent routes.
- Low-memory termination.
- Older unsupported VisionKit device fallback.

#### Android

- Camera permission denied.
- Google Code Scanner unavailable.
- Photo Picker fallback.
- Sharesheet MIME variations.
- Content URI expiration.
- Tile and shortcut behavior.
- Process death/recreation.
- Devices without Google Play Services.

---

## 23. Staged implementation roadmap

### Stage 1: Local-first MVP

- Native iOS and Android scanners.
- Local QR decoding.
- Complete payload preview.
- WHATWG URL parsing.
- IDN/confusable checks.
- Dangerous-scheme handling.
- Norwegian deterministic explanations.
- Image picker.
- Share extension/Android share receiver.
- No accounts.
- No cloud LLM.

### Stage 2: Reputation enrichment

- Backend provider abstraction.
- Commercially permitted URL reputation.
- Signed rule updates.
- Provider evidence and timestamps.
- Optional scan history.
- False-positive reporting.

### Stage 3: Redirect inspection

- Isolated SSRF-resistant worker.
- Manual redirect handling.
- DNS/TLS/RDAP/CT evidence.
- Full redirect visualization.
- Privacy consent and redaction.

### Stage 4: Seamless platform integration

- iOS App Intents and Siri.
- iOS Control Center and widgets.
- iOS Locked Camera Capture.
- Android pinned shortcuts.
- Android Glance widget.
- Android Quick Settings tile.
- Optional Assistant/App Actions.

### Stage 5: Advanced analysis

- Compact local URL classifier.
- Page rendering in separate isolation tier.
- OCR/screenshot features.
- Optional on-device generative explanation.
- iOS Visual Intelligence integration.
- Safari extension.

### Stage 6: Business and institutional capabilities

- Verified organization profiles.
- Merchant QR monitoring.
- Managed deployment.
- Partner dashboards.
- Campaign intelligence with privacy controls.

---

## 24. Open technical decisions

- Minimum supported iOS and Android versions.
- Whether iOS 16+/A12+ is acceptable as the primary VisionKit baseline.
- Whether Android devices without Google Play Services must receive full support.
- Rust core versus duplicated native implementation for initial MVP.
- Commercial threat-intelligence provider.
- Backend hosting region and data-processing agreements.
- Exact retention for redirect evidence.
- Whether one-time/tokenized links should be refused or only warned.
- Model licensing and distribution.
- Nynorsk support at launch or shortly afterward.
- Whether suspicious page rendering is necessary for the first public release.
- How users can report physical sticker tampering safely.
- How partner verified-domain lists are governed and audited.

---

## 25. Final technical conclusions

1. QR decoding must be local and must never navigate automatically.
2. Deterministic evidence should control the verdict.
3. A small classifier can improve detection of previously unknown URLs.
4. Generative AI should explain evidence, not make security decisions.
5. Redirect expansion must run in an isolated SSRF-resistant backend.
6. Public URL scanners are inappropriate for sensitive consumer URLs.
7. Threat-intelligence licensing must be treated as a core architecture constraint.
8. Native SwiftUI and Compose shells are justified by the number of platform extensions.
9. A small Rust core is appropriate for stable security-sensitive logic.
10. iOS provides the strongest third-party system-level entry through Locked Camera Capture.
11. Android's best universal entry is a pinned shortcut/widget plus Sharesheet integration.
12. Neither platform permits interception of the built-in Camera/Lens QR result.
13. Share extensions are the legitimate way to integrate with Photos and Google Photos.
14. The initial result must work offline and appear before network enrichment.
15. Privacy, transparency, and uncertainty handling are product features, not only compliance work.

---

## 26. Technical source bibliography

### Core web and Unicode standards

- [WHATWG URL Standard](https://url.spec.whatwg.org/)
- [Unicode UTS #39](https://www.unicode.org/reports/tr39/)
- [Public Suffix List](https://publicsuffix.org/)

### Redirect and network security

- [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [IANA IPv4 Special-Purpose Registry](https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml)
- [IANA IPv6 Special-Purpose Registry](https://www.iana.org/assignments/iana-ipv6-special-registry/iana-ipv6-special-registry.xhtml)

### Threat intelligence

- [Google Web Risk pricing](https://cloud.google.com/web-risk/pricing)
- [Google Safe Browsing appropriate use](https://developers.google.com/safe-browsing/reference/Appropriate.Usage)
- [VirusTotal Public versus Premium API](https://docs.virustotal.com/reference/public-vs-premium-api)
- [URLhaus API](https://urlhaus.abuse.ch/api/)
- [abuse.ch terms](https://abuse.ch/terms-of-use/)
- [Cloudflare URL Scanner](https://developers.cloudflare.com/radar/investigate/url-scanner/)

### AI and machine learning

- [OWASP LLM Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
- [LightGBM](https://github.com/lightgbm-org/LightGBM)
- [fastText](https://github.com/facebookresearch/fastText)
- [NB-BERT](https://huggingface.co/NbAiLab/nb-bert-base)
- [MobileBERT](https://huggingface.co/google/mobilebert-uncased)
- [Gemma 3n](https://ai.google.dev/gemma/docs/gemma-3n)
- [ONNX Runtime Mobile](https://onnxruntime.ai/docs/tutorials/mobile/)

### Apple development

- [VisionKit Data Scanner](https://developer.apple.com/documentation/visionkit/datascannerviewcontroller)
- [Scanning data with the camera](https://developer.apple.com/documentation/visionkit/scanning-data-with-the-camera)
- [AVCaptureMetadataOutput](https://developer.apple.com/documentation/avfoundation/avcapturemetadataoutput)
- [Vision DetectBarcodesRequest](https://developer.apple.com/documentation/vision/detectbarcodesrequest)
- [VNDetectBarcodesRequest](https://developer.apple.com/documentation/vision/vndetectbarcodesrequest)
- [Apple Share extensions](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html)
- [Apple Action extensions](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Action.html)
- [Apple Photo Editing extensions](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Photos.html)
- [Apple App Intents](https://developer.apple.com/documentation/appintents/adopting-app-intents-to-support-system-experiences)
- [Apple widgets and controls](https://developer.apple.com/documentation/appintents/widgets-live-activities-and-controls)
- [Locked Camera Capture](https://developer.apple.com/documentation/lockedcameracapture/creating-a-camera-experience-for-the-lock-screen)
- [Camera Control](https://developer.apple.com/documentation/avfoundation/enhancing-your-app-experience-with-the-camera-control)
- [Visual Intelligence integration](https://developer.apple.com/documentation/visualintelligence/integrating-your-app-with-visual-intelligence)
- [Safari Web Extensions](https://developer.apple.com/documentation/safariservices/safari-web-extensions)
- [Universal Links](https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content)
- [App Clips](https://developer.apple.com/documentation/appclips/configuring-app-clip-experiences)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple app privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [Creating an App Extension](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ExtensionCreation.html)

### Android development

- [CameraX](https://developer.android.com/media/camera/camerax)
- [ML Kit Barcode Scanning](https://developers.google.com/ml-kit/vision/barcode-scanning/android)
- [Google Code Scanner](https://developers.google.com/ml-kit/vision/barcode-scanning/code-scanner)
- [Android Photo Picker](https://developer.android.com/training/data-storage/shared/photo-picker)
- [Receiving shared content](https://developer.android.com/training/sharing/receive)
- [Android app shortcuts](https://developer.android.com/develop/ui/compose/system/shortcuts)
- [Jetpack Glance](https://developer.android.com/develop/ui/compose/glance)
- [Android App Widgets](https://developer.android.com/develop/ui/views/appwidgets/overview)
- [Quick Settings tiles](https://developer.android.com/develop/ui/views/quicksettings-tiles)
- [Android notification permission](https://developer.android.com/develop/ui/compose/notifications/notification-permission)
- [Google App Actions](https://developers.google.com/assistant/app)
- [Verify Android App Links](https://developer.android.com/training/app-links/verify-applinks)
- [Android accessibility services](https://developer.android.com/guide/topics/ui/accessibility/service)
- [Android secure clipboard handling](https://developer.android.com/privacy-and-security/risks/secure-clipboard-handling)
- [Android runtime permissions](https://developer.android.com/training/permissions/requesting)
- [Android foreground service types](https://developer.android.com/develop/background-work/services/fgs/service-types)
- [Android launch-time guidance](https://developer.android.com/topic/performance/vitals/launch-time)

### Cross-platform and shared core

- [Mozilla UniFFI](https://mozilla.github.io/uniffi-rs/latest/)
- [Kotlin/Native Swift interop](https://kotlinlang.org/docs/native-objc-interop.html)
- [React Native native-platform integration](https://reactnative.dev/docs/native-platform)
- [React Native Turbo Modules](https://reactnative.dev/docs/turbo-native-modules-introduction)
- [Flutter platform channels](https://docs.flutter.dev/platform-integration/platform-channels)
- [Capacitor iOS](https://capacitorjs.com/docs/ios)
