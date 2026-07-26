# QR Safety Application: iOS Development Start Guide

**Prepared:** 24 July 2026  
**Purpose:** Practical foundation for starting the native iOS application, choosing the correct Apple membership, using GitHub Copilot responsibly, and reaching the first TestFlight build.

---

## 1. Short answer

You can start building and testing the iOS application for free with:

- A compatible Mac.
- The current stable Xcode release.
- A free Apple Account.
- A physical iPhone or the iOS Simulator.
- A free GitHub account.
- GitHub Copilot Free or any paid Copilot plan, if desired.

To distribute through TestFlight or the App Store, join the **Apple Developer Program**, currently **99 USD per membership year or the local-currency equivalent**.

You may use GitHub Copilot to build a commercial iOS application. Copilot does not remove your responsibility to:

- Review generated code.
- Test security-sensitive behavior.
- Check open-source licenses.
- Avoid introducing copyrighted or incompatible code.
- Protect secrets, user data, private URLs, and threat-intelligence data.
- Comply with Apple, GitHub, dependency, model, and dataset terms.

---

## 2. Required hardware and software

### 2.1 Mac

Native iOS development requires macOS and Xcode.

Use a Mac capable of running the current stable Xcode release and its supported macOS version. Apple changes Xcode and macOS requirements regularly, so verify them when purchasing hardware or installing an update.

For this application, an Apple-silicon Mac is strongly recommended because it provides:

- Faster Xcode builds.
- Better iOS Simulator performance.
- Core ML conversion and testing.
- Local model experimentation.
- Better support for current Apple tooling.

Recommended practical minimum:

- Apple-silicon Mac.
- 16 GB RAM.
- At least 512 GB storage.

This is an engineering recommendation rather than an Apple licensing requirement. Larger local models and multiple simulators can justify more memory and storage.

### 2.2 Xcode

Install Xcode from:

- The Mac App Store for the current stable release.
- Apple Developer downloads when a specific version or beta is required.

Xcode includes:

- Swift compiler.
- SwiftUI.
- iOS SDK.
- Simulator.
- Debugger.
- Instruments.
- Code signing and provisioning tools.
- XCTest and Swift Testing support.

Source:

- [Apple Xcode](https://developer.apple.com/xcode/)

### 2.3 Physical iPhone

The Simulator is useful for application UI and deterministic URL logic, but the project requires real-device testing for:

- Camera behavior.
- VisionKit `DataScannerViewController`.
- Performance and thermal measurements.
- Haptics.
- Lock Screen camera extension.
- Apple Foundation Models.
- Camera Control.
- App Store-like privacy permission behavior.

Do not plan to build the camera feature entirely in the Simulator.

---

## 3. Apple accounts and licenses

### 3.1 Free Apple Account

A free Apple Account provides:

- Xcode access.
- Documentation and sample code.
- Developer forums.
- Simulator use.
- Personal on-device testing through Xcode.

Xcode calls free signing a **Personal Team**.

Limitations include:

- No App Store distribution.
- No TestFlight distribution.
- Periodic reprovisioning/reinstallation on personal devices.
- Limited devices and identifiers.
- Limited advanced capabilities and entitlements.

This is sufficient to build the first standalone scanner prototype.

Sources:

- [Apple: Choosing a membership](https://developer.apple.com/support/compare-memberships/)
- [Apple: Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment)

### 3.2 Apple Developer Program

The standard paid program is required for:

- App Store distribution.
- TestFlight.
- App Store Connect.
- Team management.
- Distribution certificates.
- Production provisioning.
- Broad access to application capabilities and services.
- Managed Background Assets.
- Public distribution of Safari extensions.

The annual fee is:

- **99 USD**, or local currency where available.
- Regional taxes may apply.

Source:

- [Apple Developer Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment)

### 3.3 Individual enrollment

Choose individual enrollment when:

- You are publishing personally.
- You are a sole proprietor/single-person business.
- You accept that your legal personal name will appear as the App Store seller.

Requirements include:

- Apple Account.
- Two-factor authentication.
- Legal age of majority.
- Identity verification.

You do not need a D-U-N-S Number.

### 3.4 Organization enrollment

Choose organization enrollment if the application should be published under a company name.

Requirements include:

- A recognized legal entity.
- Legal entity name.
- D-U-N-S Number.
- Authority to bind the organization to legal agreements.
- Additional verification where requested.

The organization name appears as the App Store seller.

Source:

- [Apple Developer Program enrollment requirements](https://developer.apple.com/help/account/membership/program-enrollment)

### 3.5 Recommended enrollment for this product

If this is intended to become a real Norwegian security brand, form or use a legal company and enroll it as an organization before public launch.

Benefits:

- Company rather than personal seller name.
- Easier team access.
- Cleaner ownership of certificates, bundle identifiers, and App Store listing.
- Easier bank, telco, insurer, and institutional partnerships.
- Cleaner intellectual-property ownership.

You can still prototype under a free Personal Team before the organization enrollment is ready.

### 3.6 Apple Developer Enterprise Program

The Enterprise Program costs 299 USD per year and is intended for eligible organizations distributing proprietary applications directly to their own employees.

It is not the correct route for a public Norwegian consumer application.

### 3.7 App Store Small Business Program

Apple's Small Business Program reduces commission on paid applications and in-app purchases for eligible developers.

It is not required for a free application. If the consumer application remains free and has no in-app purchases, there is no App Store sales commission on the free download.

Source:

- [Apple App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/)

---

## 4. Apple framework licensing

The application can use Apple frameworks such as:

- SwiftUI.
- UIKit.
- Vision.
- VisionKit.
- AVFoundation.
- Core ML.
- App Intents.
- WidgetKit.
- LockedCameraCapture.
- Foundation Models.

These are used under Apple's Xcode/SDK and Apple Developer Program agreements. No separate per-user runtime royalty is required for ordinary App Store use.

Important exceptions:

- Some capabilities require entitlements.
- Some entitlements require Apple approval.
- Private or restricted frameworks must not be used.
- Beta SDKs remain subject to beta terms and should not be used for production unless Apple permits submission.

### 4.1 Foundation Models

Apple lists the Foundation Models framework among Apple Developer Program technologies.

The base `SystemLanguageModel` does not require shipping an Apple model yourself. It is provided by the operating system on eligible Apple Intelligence devices.

Source:

- [Apple Developer Program technologies](https://developer.apple.com/programs/whats-included/)

### 4.2 Foundation Model adapters

Custom Foundation Model adapters require:

- Apple Developer Program membership.
- Adapter toolkit agreement.
- Foundation Models Framework Adapter Entitlement.
- Version-specific adapter management.

Do not request this entitlement for the first prototype.

Source:

- [Apple Foundation Models Adapter Training Toolkit](https://developer.apple.com/apple-intelligence/foundation-models-adapter/)

---

## 5. Third-party license responsibilities

Every dependency and data source has its own license.

Create a dependency register containing:

| Item | Version | License | Used in | Attribution required | Redistribution allowed | Reviewed by |
|---|---|---|---|---|---|---|

Review:

- Swift packages.
- Rust crates.
- Public Suffix List.
- Unicode data.
- QR/image fixtures.
- Threat-intelligence feeds.
- Training datasets.
- Model weights.
- Tokenizers.
- Icons and fonts.

### 5.1 Open source does not mean unrestricted

Possible obligations include:

- Attribution.
- Copyright notices.
- Source distribution.
- Changes under the same license.
- Patent clauses.
- Restrictions on commercial use.
- Restrictions on model redistribution.

Do not copy a library into the repository without recording its license.

### 5.2 Model licensing

Different model categories have different terms:

- Apple Foundation Models: operating-system framework and Apple terms.
- Core ML model trained by the project: rights depend on training data and base models.
- Apache-2.0 models: permissive, with notices and patent terms.
- Gemma custom-license models: separate Gemma terms.
- Community-license models: may contain use or redistribution restrictions.

Do not describe every downloadable model as open source. Many are only **open weight**.

### 5.3 Training data

The project must have rights to:

- Download.
- Process.
- Label.
- Train on.
- Redistribute derived models where applicable.

Publicly accessible data is not automatically licensed for model training or redistribution.

---

## 6. GitHub repository setup

### 6.1 Repository ownership

Create the repository under:

- The future company's GitHub organization, preferably.
- A personal private repository for the prototype if the organization does not yet exist.

Before accepting outside contributions, decide:

- Who owns copyright.
- Whether contributor agreements are required.
- Whether the application source will remain private.
- Which parts, if any, may later be open sourced.

### 6.2 Initial repository structure

```text
qr-safety-ios/
  QRCodeSafety.xcodeproj
  App/
    QRCodeSafetyApp.swift
    AppEnvironment.swift
  Features/
    Scanner/
    ScanResult/
    ImageImport/
    Settings/
  SafetyCore/
    Payload/
    URL/
    Unicode/
    Rules/
    Classification/
    Evidence/
  Platform/
    Camera/
    Photos/
    Haptics/
    FoundationModels/
  Resources/
    Localizable.xcstrings
    Assets.xcassets
    Rules/
    Models/
  Extensions/
    ShareExtension/
    Widgets/
    LockedCamera/
  Tests/
    SafetyCoreTests/
    ScannerTests/
    IntegrationTests/
  UITests/
  Documentation/
  THIRD_PARTY_NOTICES.md
  PRIVACY.md
  README.md
```

Do not create all extension targets on day one. Begin with the main application and add targets after the core scanner works.

### 6.3 Branch protection

Once another developer joins:

- Protect the main branch.
- Require pull requests.
- Require tests.
- Require review for security-core changes.
- Enable secret scanning where available.
- Enable dependency update alerts.

Never commit:

- Signing certificates.
- Private keys.
- API keys.
- Provider credentials.
- Production URLs containing tokens.
- App Store Connect API private keys.

---

## 7. Create the Xcode project

### 7.1 New project

In Xcode:

1. Select **Create a new Xcode project**.
2. Select **iOS > App**.
3. Choose:
   - Interface: SwiftUI.
   - Language: Swift.
   - Testing: Swift Testing/XCTest according to the current template.
   - Data storage: none initially.
4. Choose a working product name.
5. Choose the organization identifier, for example:

```text
no.companyname
```

6. Resulting bundle identifier:

```text
no.companyname.qrsafety
```

Treat the bundle identifier as permanent once App Store records and entitlements depend on it.

### 7.2 Deployment target

Recommended initial deployment strategy:

- Minimum iOS 16 for VisionKit Data Scanner compatibility.
- Conditional iOS 18 features for Locked Camera Capture and newer controls.
- Conditional iOS 26 features for Foundation Models and Visual Intelligence.

This gives:

- Broad scanner coverage.
- Native modern integrations where available.
- Template/Core ML fallback on older devices.

Reassess the minimum version before launch using current Norway device adoption.

### 7.3 Signing

Open **Signing & Capabilities**:

1. Enable automatic signing.
2. Select the free Personal Team or paid organization team.
3. Verify the bundle identifier is unique.
4. Run on a physical device.

Do not manually create certificates until automatic signing becomes insufficient.

---

## 8. First runnable milestone

The first milestone should do only this:

1. Request camera permission.
2. Display a native live scanner.
3. Decode a QR code locally.
4. Stop repeated scanning temporarily.
5. Display the raw payload.
6. If it is a URL, display:
   - Scheme.
   - Host.
   - Registrable domain placeholder.
7. Never open it automatically.
8. Provide **Scan again** and **Close**.

Do not begin with:

- Online threat intelligence.
- Redirect resolution.
- Generative AI.
- Accounts.
- Analytics.
- History synchronization.
- Widgets.

The first security property to prove is:

> Scanning never causes navigation or another external action.

---

## 9. Camera implementation

### 9.1 VisionKit path

Use `DataScannerViewController` where supported.

Advantages:

- Native Apple scanner behavior.
- Camera and recognition integration.
- QR filtering.
- Familiar focus and interaction.

Check:

- `DataScannerViewController.isSupported`
- `DataScannerViewController.isAvailable`

Source:

- [Apple DataScannerViewController](https://developer.apple.com/documentation/visionkit/datascannerviewcontroller)

### 9.2 AVFoundation fallback

Use:

- `AVCaptureSession`
- `AVCaptureDeviceInput`
- `AVCaptureMetadataOutput`
- `.qr` metadata type

Source:

- [Apple AVCaptureMetadataOutput](https://developer.apple.com/documentation/avfoundation/avcapturemetadataoutput)

The fallback requires more work for:

- Preview layer.
- Orientation.
- Focus.
- Zoom.
- Torch.
- Accessibility.
- Duplicate-result suppression.

### 9.3 Permission string

Add a clear camera purpose string:

```xml
<key>NSCameraUsageDescription</key>
<string>Camera access is used to read QR codes locally. A scanned link is never opened automatically.</string>
```

The exact Norwegian localized text should explain:

- Why the camera is needed.
- That QR decoding occurs locally.
- That no photo is retained by default.

Avoid generic text such as **Camera required**.

---

## 10. Build the offline Safety Core

Develop the following in order:

### 10.1 Payload classifier

Classify:

- URL.
- Text.
- Wi-Fi.
- Contact.
- Calendar.
- Telephone.
- SMS.
- Email.
- Location.
- Payment/deep link.
- Unknown scheme.

### 10.2 Safe URL parser

Keep:

- Raw value.
- Canonical value.
- Display value.

Extract:

- Scheme.
- User information.
- Host.
- Port.
- Path.
- Query.
- Fragment.

### 10.3 Deterministic findings

Implement:

- Dangerous scheme.
- Embedded credentials.
- IP-literal destination.
- Non-standard port.
- Excessive subdomains.
- Punycode/Unicode display.
- Mixed scripts.
- Lookalike brand.
- Known shortener.
- Suspicious file/download.

### 10.4 Evidence model

Return typed evidence rather than UI text:

```swift
enum RiskVerdict {
    case knownMalicious
    case suspicious
    case insufficientEvidence
    case noKnownThreat
}

struct Finding {
    let code: FindingCode
    let severity: FindingSeverity
    let technicalValue: String?
}

struct ScanAssessment {
    let verdict: RiskVerdict
    let findings: [Finding]
    let limitations: [AssessmentLimitation]
}
```

The UI localizes `FindingCode`; the security engine does not generate prose.

---

## 11. Testing from the beginning

### 11.1 Unit tests

Create tests for:

- `trusted.no@evil.example`
- Punycode and mixed scripts.
- Invalid percent encoding.
- Backslashes.
- IP literals.
- Unexpected ports.
- Long/nested URLs.
- `javascript:` and `data:`.
- Norwegian characters in legitimate domains.
- Non-URL QR content.

### 11.2 QR image fixtures

Maintain legally created test fixtures:

- Normal URL.
- Short URL.
- Wi-Fi.
- vCard.
- Blurred QR.
- Rotated QR.
- Low contrast.
- Unicode URL.
- Multiple QR codes.

Never put live malicious URLs in a test fixture that may be opened accidentally. Use reserved domains such as `.example` where possible.

### 11.3 UI tests

Verify:

- No automatic navigation.
- Permission denied path.
- Scan cancellation.
- VoiceOver result.
- Large text.
- Scan-again behavior.

---

## 12. Add platform integrations incrementally

Recommended order:

1. Main live scanner.
2. Image picker and Vision image scanning.
3. Share extension.
4. App Intents/Siri/Spotlight.
5. Widget and Control Center controls.
6. Locked Camera Capture.
7. Foundation Models explanation.
8. Visual Intelligence.

Each extension should call the same typed Safety Core.

---

## 13. Privacy and App Store requirements

### 13.1 Privacy policy

Apple requires a privacy policy for applications submitted to the App Store.

The policy should state:

- QR images are decoded locally by default.
- Images are not retained by default.
- URLs are not transmitted in offline mode.
- What online mode transmits.
- Which providers receive data.
- Retention periods.
- Whether history is stored.
- How users delete history.
- Contact information.

### 13.2 App Privacy details

App Store Connect requires privacy disclosures.

Avoiding these simplifies disclosure:

- Advertising SDKs.
- Cross-app tracking.
- Device fingerprinting.
- Mandatory accounts.
- Third-party analytics.

### 13.3 App Review notes

Provide:

- Explanation that links never open automatically.
- Sample QR codes.
- Instructions for offline and online modes.
- Explanation of redirect expansion.
- Demo account only if an account is later required.
- Explanation of any unusual entitlements.

Apple explicitly recommends providing App Review with sample QR codes and required resources for non-obvious functionality.

Source:

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

### 13.4 Security claims

Avoid:

- Guaranteed safe.
- Detects every malicious QR code.
- Prevents all phishing.

Use:

> Checks QR content and available risk signals before opening. No scanner can detect every scam.

---

## 14. TestFlight and App Store path

### Prototype

- Free Apple Account.
- Personal physical-device installation.
- No external testers.

### Internal alpha

- Paid Apple Developer Program.
- App Store Connect application record.
- Internal TestFlight testers.

### External beta

- TestFlight beta review.
- External testers or public invitation link.
- Privacy policy and support contact.
- Stable backend if online mode is enabled.

### Production

- Final App Store metadata.
- Screenshots.
- Privacy answers.
- Age rating.
- Export-compliance answers.
- Review notes.
- Support URL.
- Marketing URL where available.

The application uses HTTPS and standard cryptography provided by Apple. Complete Apple's export-compliance questionnaire accurately; do not guess.

---

## 15. Can GitHub Copilot be used?

Yes. GitHub Copilot can assist with a commercial native iOS application.

Useful tasks include:

- Swift and SwiftUI scaffolding.
- VisionKit wrappers.
- AVFoundation fallback implementation.
- Unit-test generation.
- Documentation.
- Localization structure.
- Refactoring.
- Accessibility review.
- Explaining Apple APIs.
- Creating deterministic test cases.

Copilot should not be treated as:

- A security authority.
- A license compliance system.
- A substitute for Apple documentation.
- A substitute for testing on physical devices.
- A source of trusted threat-intelligence logic.

---

## 16. GitHub Copilot plans

GitHub currently offers individual plans including:

- Copilot Free.
- Copilot Student.
- Copilot Pro.
- Copilot Pro+.
- Copilot Max.

Copilot Free is enough to test the workflow but has usage limits. A paid individual plan is more practical for sustained development.

Organizations can use Copilot Business or Enterprise for:

- Centralized policy.
- Seat management.
- Model controls.
- Business data protections.
- Organization-level public-code policy.

Source:

- [GitHub Copilot individual plans](https://docs.github.com/en/copilot/concepts/billing/individual-plans)

---

## 17. GitHub Copilot in Xcode

GitHub provides an official Copilot integration for Xcode.

General setup:

1. Obtain Copilot access.
2. Install the GitHub Copilot for Xcode application/extension using GitHub's current instructions.
3. Enable the Xcode source-editor extension in macOS settings if requested.
4. Sign in to GitHub.
5. Authorize the extension.
6. Enable Copilot in Xcode.

Because installation steps and macOS permission locations can change, use the current GitHub instructions rather than an old third-party guide.

Source:

- [GitHub: Install the Copilot extension for Xcode](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-extension?tool=xcode)

GitHub Copilot CLI can also assist from the repository terminal with:

- File generation.
- Test execution.
- Refactoring.
- Documentation.
- Git workflows.

Source:

- [GitHub Copilot CLI setup](https://docs.github.com/copilot/how-tos/set-up/install-copilot-cli)

---

## 18. Copilot licensing and ownership

### 18.1 Commercial use

GitHub Copilot is a development tool and may be used while creating commercial software, subject to the applicable GitHub plan and terms.

For volume-licensed customers, GitHub's March 2026 Generative AI Services Terms state:

- GitHub does not own inputs or outputs.
- Customers retain ownership they already have in their inputs.
- The customer is responsible for applications created using the service.
- Legal, regulatory, and licensing obligations remain with the customer.

Source:

- [GitHub Generative AI Services Terms](https://github.com/customer-terms/github-generative-ai-services-terms)

Individual subscribers are governed by the GitHub Terms of Service and Terms for Additional Products and Features.

Source:

- [GitHub Terms for Additional Products and Features](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#github-copilot)

This guide is not legal advice. Review the current terms before launch or substantial investment.

### 18.2 Public code matching

Copilot checks suggestions against public GitHub code in supported products. Depending on policy, matching suggestions can be:

- Blocked.
- Allowed with references.

GitHub states that code references can include repository URLs and detected license information.

Source:

- [GitHub Copilot code referencing](https://docs.github.com/en/copilot/concepts/completions/code-referencing)

Recommended project setting:

> **Suggestions matching public code: Block**

This reduces the risk of accepting near-verbatim public code with unknown or incompatible obligations.

GitHub's reference UI is not available identically in every Copilot client. Do not assume that Xcode will always display the same reference details as Visual Studio Code or GitHub.com.

### 18.3 Responsibility

Even when Copilot produces code:

- Review it.
- Understand it.
- Test it.
- Check licenses.
- Check security.
- Check platform API availability.

Copilot can produce:

- Incorrect code.
- Deprecated Apple APIs.
- Insecure URL parsing.
- Race conditions.
- Privacy violations.
- Incomplete entitlement configuration.
- Tests that confirm the wrong behavior.

---

## 19. Copilot data and privacy

### 19.1 Individual plans

GitHub states that interaction data from individual Copilot plans may be used to train and improve models according to settings and the GitHub privacy statement.

Individual users can opt out through Copilot policy settings.

Source:

- [GitHub: Hosting of models for Copilot](https://docs.github.com/en/copilot/reference/ai-models/model-hosting)
- [GitHub: Manage individual Copilot policies](https://docs.github.com/en/copilot/how-tos/manage-your-account/manage-policies)

Recommended:

- Disable model-training use of interaction data.
- Block suggestions matching public code.
- Disable unnecessary repository/agent access.

### 19.2 Business and Enterprise

GitHub states that it does not use Copilot Business or Enterprise customer data to train AI models.

Business/Enterprise provides stronger organizational controls and is preferable once:

- Multiple developers join.
- Proprietary threat-detection logic is valuable.
- Private partner data is introduced.
- Compliance and policy enforcement become important.

### 19.3 Never send these to Copilot

Do not include:

- Apple signing private keys.
- App Store Connect private keys.
- API secrets.
- Production threat-provider credentials.
- Private user scans.
- URLs containing private access tokens.
- Bank/telco partner datasets.
- Personal data.
- Unredacted incident reports.

Use synthetic or redacted examples in prompts.

---

## 20. Recommended Copilot workflow

### 20.1 Good prompt structure

Provide:

- Exact deployment target.
- Required Apple framework.
- Security invariants.
- Existing types/interfaces.
- Expected tests.
- Explicit prohibited behavior.

Example:

```text
Implement a Swift URL payload parser for iOS 16+.

Requirements:
- Preserve the exact raw string.
- Use Foundation.URLComponents only where standards-compatible.
- Never open the URL.
- Return typed evidence for userinfo, host, port, path, query and fragment.
- Reject control characters.
- Add unit tests for trusted.no@evil.example, punycode, IPv6 and invalid percent encoding.
- Do not add network calls or third-party dependencies.
```

### 20.2 Review checklist for generated code

- Does it use a documented public Apple API?
- Is the API available at the deployment target?
- Does it require `@available` handling?
- Does it access the network?
- Does it open a URL?
- Does it log sensitive data?
- Does it introduce a package?
- Is the package license acceptable?
- Are errors surfaced?
- Are concurrency and actor boundaries correct?
- Are tests adversarial rather than only happy-path?
- Does the implementation match the security invariant?

### 20.3 Separate generation and review

Recommended process:

1. Ask Copilot to propose a small implementation.
2. Review the API documentation.
3. Ask for tests separately.
4. Add adversarial tests manually.
5. Run static analysis and compiler warnings.
6. Review the diff.
7. Commit only understood code.

Do not ask Copilot to generate the entire application in one request.

---

## 21. Initial development roadmap

### Phase 0: Ownership and tooling

- Choose personal prototype or company ownership.
- Create private GitHub repository.
- Install Xcode.
- Configure free Apple signing.
- Install Copilot for Xcode if desired.
- Configure Copilot privacy/public-code policies.

### Phase 1: Scanner shell

- SwiftUI application.
- Camera permission.
- VisionKit scanner.
- AVFoundation fallback.
- Raw payload result.
- No automatic navigation.

### Phase 2: Offline deterministic engine

- Payload types.
- URL parsing.
- IDN/confusable display.
- Dangerous scheme checks.
- Evidence model.
- Bokmål/Nynorsk templates.
- Unit-test corpus.

### Phase 3: Offline classifier

- Train URL baseline outside the app.
- Convert to Core ML.
- Bundle model.
- Add calibration and version metadata.
- Benchmark physical devices.

### Phase 4: Images and sharing

- Photos picker.
- Vision barcode request.
- Share extension.
- App Group only where needed.

### Phase 5: Fast entry

- App Intents.
- Siri and Spotlight.
- Control Center control.
- Widget.
- Locked Camera Capture.

### Phase 6: Explicit online mode

- Privacy consent.
- Backend provider adapter.
- Reputation lookup.
- Redirect worker.
- Evidence timestamps.
- Clear offline/online distinction.

### Phase 7: TestFlight

- Paid Apple Developer Program.
- Organization enrollment if applicable.
- Privacy policy.
- Support site.
- Internal TestFlight.
- External beta.

---

## 22. Definition of the first TestFlight build

Required:

- Live QR scanner.
- Image import.
- No automatic URL opening.
- Full payload display.
- Deterministic URL warnings.
- Offline operation.
- Bokmål interface.
- Initial Nynorsk coverage.
- Clear privacy policy.
- No user account.
- No advertising.
- Crash reporting only if privacy-approved.
- Sample QR codes for review.

Optional:

- Small Core ML classifier.
- Share extension.
- Basic online reputation check.

Exclude initially:

- Large generative model.
- Foundation Model adapter.
- Browser rendering.
- Complex history synchronization.
- Partner dashboards.

---

## 23. Immediate checklist

1. Decide whether the App Store seller should be your personal name or a company.
2. Obtain a Mac and physical iPhone.
3. Install current stable Xcode.
4. Create a private GitHub repository.
5. Create a SwiftUI iOS application with a stable bundle identifier.
6. Enable free automatic signing.
7. Add a clear camera-purpose description.
8. Build the first scanner that never opens the result.
9. Add deterministic parser tests.
10. Join the Apple Developer Program before TestFlight distribution.
11. Publish privacy and support pages before App Store submission.

---

## 24. Official sources

### Apple

- [Apple: Compare memberships](https://developer.apple.com/support/compare-memberships/)
- [Apple: Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment)
- [Apple Developer Program](https://developer.apple.com/programs/)
- [What's included](https://developer.apple.com/programs/whats-included/)
- [Xcode](https://developer.apple.com/xcode/)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [DataScannerViewController](https://developer.apple.com/documentation/visionkit/datascannerviewcontroller)
- [AVCaptureMetadataOutput](https://developer.apple.com/documentation/avfoundation/avcapturemetadataoutput)
- [Core ML](https://developer.apple.com/documentation/coreml)
- [Foundation Models](https://developer.apple.com/documentation/foundationmodels)
- [Foundation Models Adapter Toolkit](https://developer.apple.com/apple-intelligence/foundation-models-adapter/)

### GitHub

- [GitHub Copilot plans](https://docs.github.com/en/copilot/concepts/billing/individual-plans)
- [Install Copilot for Xcode](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-extension?tool=xcode)
- [GitHub Copilot code referencing](https://docs.github.com/en/copilot/concepts/completions/code-referencing)
- [Manage individual Copilot policies](https://docs.github.com/en/copilot/how-tos/manage-your-account/manage-policies)
- [Copilot model hosting and data handling](https://docs.github.com/en/copilot/reference/ai-models/model-hosting)
- [GitHub Generative AI Services Terms](https://github.com/customer-terms/github-generative-ai-services-terms)
- [GitHub Terms for Additional Products and Features](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#github-copilot)
- [GitHub Copilot CLI](https://docs.github.com/copilot/how-tos/set-up/install-copilot-cli)

