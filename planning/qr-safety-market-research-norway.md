# QR Safety Application: Market, Competition, and Norway Go-to-Market Research

**Research date:** 24 July 2026  
**Primary launch market:** Norway  
**Proposed product:** A free consumer mobile application that scans QR codes without automatically opening them, explains the encoded content, expands shortened links and redirect chains in a protected environment, evaluates deterministic and machine-learning security signals, and provides a clear Norwegian-language risk explanation.

---

## 1. Executive summary

The opportunity is viable, but QR decoding alone is not a product advantage. Apple, Google, and many free applications already make QR codes easy to scan. The defensible opportunity is to become a trusted **QR destination inspector** that explains where a code leads before the user visits it.

The strongest market proposition is:

> **See where the QR code goes before you open it.**

In Norwegian:

> **Se hvor QR-koden går før du åpner den.**

The product should:

1. Decode the QR code locally without navigation.
2. Display its complete payload and content type.
3. Identify shortened links and show every redirect.
4. Display the actual registrable domain, including Unicode and punycode forms.
5. Check deterministic security indicators and legally usable threat-intelligence sources.
6. Explain the evidence in plain Norwegian.
7. Require a separate, deliberate action before opening a destination.

No security product can guarantee that a URL is safe. Product language should use:

- **Known malicious**
- **Suspicious**
- **Unknown or insufficient evidence**
- **No known threat found**

It should never report an unqualified **Safe** result.

Norway is a strong initial market because mobile and internet use are nearly universal, mobile payments and digital identity are deeply established, and fraud losses are material. The principal commercial challenge is trust rather than technology. A security application must be transparent about what leaves the device, avoid exaggerated promises, and preferably launch without advertising, mandatory registration, or persistent cloud scan history.

The competitive market is active but fragmented. Reputable security vendors provide either:

- A QR scanner with a simple blacklist verdict.
- General browser or network protection after navigation.
- An AI scam chatbot requiring content upload.
- A web-based URL checker.

No verified established competitor was found that combines all of the following:

- Norwegian-first consumer experience.
- Local QR decoding.
- Full payload inspection.
- Shortener and redirect-chain expansion.
- Evidence-based explanations.
- Norwegian brand impersonation detection.
- Privacy-first operation without an account.
- Identification of payment intents such as Vipps-related flows.

This is the primary market gap.

---

## 2. The consumer problem

A QR code conceals its payload inside an image. A user cannot visually determine whether it contains:

- A legitimate restaurant menu.
- A payment request.
- A Wi-Fi configuration.
- A phone number or SMS action.
- A deep link into an application.
- A shortened URL.
- A credential-phishing page.
- A fake payment site.
- A file download.
- A dangerous or misleading URI scheme.

Ordinary camera applications typically show a short link or action. They do not explain:

- The complete redirect chain.
- Whether the visible domain uses lookalike Unicode characters.
- Whether a shortener leads to a different organization or country.
- Why a destination is considered suspicious.
- Whether the result is based on a current threat-intelligence match or only a weak heuristic.
- Whether checking the URL will disclose a private token or trigger a one-time link.

Security specialists do not necessarily refuse to decode QR codes. They avoid opening unknown destinations directly on ordinary personal or corporate devices. They decode the payload, inspect it, check reputation and infrastructure, and use isolated environments where navigation is necessary. The proposed application productizes a simplified version of that workflow for consumers.

---

## 3. Important finding: native Apple and Google protection

The claim that native camera or photo applications provide no protection would be too broad.

The accurate market statement is:

> Apple and Google provide URL previews and browser-level phishing protection, but their documented standard Camera and Photos QR workflows do not provide a QR-specific pre-opening risk assessment, complete payload inspection, short-link expansion, redirect-chain visibility, or an explanation of the evidence.

### 3.1 Apple

Apple's Camera and Code Scanner recognize a QR code and present a tappable link or action. Apple's support documentation does not describe a QR-specific threat verdict at this stage.

Safari separately offers **Fraudulent Website Warning**. Apple states that Safari may check information calculated from the website address with Apple and Google Safe Browsing before visiting a suspected phishing or malware site.

Implications:

- Apple offers meaningful protection against known or detected malicious websites.
- Protection is attached to Safari navigation rather than the QR decoding experience.
- The user does not receive a complete QR payload report or redirect-chain analysis before tapping.
- Protection may depend on the destination being known or detectable at navigation time.

Sources:

- [Apple: Scan a QR code with iPhone or iPad](https://support.apple.com/en-us/102680)
- [Apple: Safari and Privacy](https://www.apple.com/legal/privacy/data/en/safari/)
- [Apple: Recognize and avoid social engineering schemes](https://support.apple.com/en-us/102568)

### 3.2 Google

Pixel Camera recognizes a QR code and displays a bubble or link. Google documentation instructs the user to tap the link to open it; it does not document a QR-specific reputation verdict inside the normal Camera workflow.

Chrome's Safe Browsing protection can subsequently warn about:

- Phishing.
- Malware.
- Unwanted software.
- Social engineering.
- Some lookalike addresses.

Google Lens and Circle to Search also provide an AI-assisted workflow in which users can manually submit a screenshot of a suspicious message for scam assessment. Google's official announcement describes suspicious messages and screenshot analysis. It does not establish that the ordinary QR scanning flow automatically invokes this assessment or follows redirects before the user taps.

Google ML Kit and Google Code Scanner decode structured QR data. ML Kit documentation does not state that the barcode decoder itself checks URL reputation. Google's use of the word **safer** for Code Scanner refers primarily to a permissionless scanner integration rather than a guarantee that decoded links are safe.

Sources:

- [Google: Scan QR codes with Pixel Camera](https://support.google.com/pixelcamera/answer/16561572?hl=en-GB)
- [Google Chrome: Manage warnings about unsafe sites](https://support.google.com/chrome/answer/99020?hl=en&co=GENIE.Platform%3DAndroid)
- [Google: Scam detection with Circle to Search and Lens](https://blog.google/products-and-platforms/products/search/scam-detection-circle-to-search-lens/)
- [Google ML Kit Barcode Scanning](https://developers.google.com/ml-kit/vision/barcode-scanning)
- [Google June 2026 fraud and scams advisory](https://blog.google/innovation-and-ai/technology/safety-security/fraud-scams-advisory-june-2026/)

### 3.3 Competitive interpretation

Apple and Google are important substitutes because their native tools are already installed and require no consumer acquisition. However, they leave a documented product gap:

- No complete pre-opening investigation.
- No full redirect-chain visualization.
- No evidence-based consumer explanation.
- No local Norwegian context.
- No explicit distinction among known malicious, suspicious, unknown, and no known threat.

Google Lens is an important strategic risk because Google could integrate its AI scam analysis more directly into QR scanning in the future. The application therefore needs differentiation beyond a simple reputation lookup.

---

## 4. Competitive landscape

### 4.1 Revised competitor ranking

| Rank | Product | Category | Current competitive significance |
|---|---|---|---|
| 1 | Trend Micro QR Scanner | Dedicated secure QR scanner | Strongest established standalone Android competitor |
| 2 | Sophos Intercept X for Mobile | Free mobile security suite with QR scanner | Strongest reputable security-suite QR competitor |
| 3 | Is This QR Safe? | Specialized web/native QR investigation service | Closest claimed functional match, including redirect expansion |
| 4 | Norton Genie | AI scam assistant | Strong free AI-based substitute with explanations |
| 5 | Bitdefender Scamio | AI scam assistant | Strong free chatbot substitute accepting QR codes and links |
| 6 | Scanly | Consumer QR scanner in Norwegian App Store | Direct store competitor, but safety is a paid feature and effectiveness is unverified |
| 7 | Safe QR Scanner AI | Consumer iPhone scanner | Very similar marketing, but limited traction and no Norwegian-language listing |
| 8 | McAfee Scam Detector | Paid security suite feature | Significant if its QR feature reaches Norway broadly |
| 9 | F-Secure Link Checker | Free web URL checker | Strong Nordic substitute, but not a QR workflow |
| 10 | Kaspersky QR Scanner | Legacy product | Historical benchmark rather than an active standalone Android competitor |

---

## 5. Direct competitor profiles

### 5.1 Trend Micro QR Scanner

**Category:** Dedicated secure QR scanner  
**Primary platform:** Android  
**Price:** Free  

Trend Micro states that its QR Scanner:

- Performs URL safety checks on scanned codes.
- Blocks and reports dangerous applications or websites.
- Scans from the live camera or saved images.
- Contains no third-party advertising.
- Is free.

The indexed Google Play listing observed during research displayed more than one million downloads, a rating around 4.4, and approximately 22,000 reviews. Direct retrieval of the Play Store page was blocked by the research fetch environment, so these metrics should be checked again before publication.

Trend Micro's older documentation also refers to a secure QR scanner inside Trend Micro Mobile Security for iOS. The current product page did not independently confirm the complete current iOS QR feature set, so the product should primarily be treated as a verified Android competitor.

**Strengths**

- Recognized cybersecurity brand.
- Dedicated, simple workflow.
- Free and ad-free positioning.
- Existing threat-intelligence infrastructure.
- Live-camera and saved-image support.

**Weaknesses and differentiation opportunities**

- No verified public documentation of a complete redirect-chain display.
- Limited explanation of individual evidence.
- No Norwegian-first positioning.
- A black-box vendor verdict is less transparent than an evidence report.
- Current iOS feature parity was not fully verified.

Sources:

- [Trend Micro: Scan QR codes safely](https://trendlife.com/en-us/blog/2018/06/18/scan-qr-codes-safely-with-the-trend-micro-qr-scanner)
- [Trend Micro Mobile Security](https://www.trendmicro.com/en_us/forHome/products/mobile-security.html)

### 5.2 Sophos Intercept X for Mobile

**Category:** Mobile security suite  
**Platforms:** iOS and Android  
**Price:** Free application, with broader managed-enterprise functionality depending on deployment  

Sophos documentation states that its QR Code Scanner checks the embedded URL for malicious or inappropriate content using SophosLabs classification. If reported safe, the user can continue to Safari.

It also handles:

- vCard contact information.
- Wi-Fi configurations.
- Warnings for insecure Wi-Fi configurations.

**Strengths**

- Credible security brand and threat-intelligence source.
- Pre-opening URL classification.
- Cross-platform suite.
- Broader mobile protection.

**Weaknesses and differentiation opportunities**

- QR scanning is part of a broader security suite rather than the central experience.
- No documented complete redirect-chain expansion.
- No detailed evidence report.
- No Norway-specific consumer interpretation.
- Broader suite complexity may be excessive for users who only want a scanner.

Source:

- [Sophos: QR Code Scanner documentation](https://docs.sophos.com/esg/sixm-ios/help/en-us/Features/QRCodeScanner/index.html)

### 5.3 Is This QR Safe?

**Category:** Specialized QR safety web service and claimed native applications  
**Price:** Free for personal checks, according to the service  

The service claims to:

- Accept camera scans and uploaded QR images.
- Extract the encoded URL.
- Follow every redirect.
- Check the final destination against VirusTotal and other reputation engines.
- Check domain registration and download/payment behavior.
- Decode images locally in the browser.

Its privacy statement on the page says that the QR image is not uploaded but that the extracted URL and standard request metadata are logged.

**Strengths**

- Closest functional match to the proposed product.
- Explicit redirect-chain proposition.
- Web access reduces installation friction.
- Strong education around quishing.

**Weaknesses and risks**

- Detection claims are self-reported and were not independently benchmarked.
- URLs and metadata are logged.
- VirusTotal public API terms prohibit use as the backend of a commercial product or service; the exact implementation and licensing arrangement are unknown.
- No Norwegian localization or local institutional trust.
- Browser-based camera experience may feel less native.

Source:

- [Is This QR Safe?](https://www.isthisqrsafe.com/)

### 5.4 Norton Genie

**Category:** AI-powered scam assistant  
**Platforms:** Web, iOS, Android  
**Price:** Free early-access service  

Norton describes Genie as combining AI with proprietary cybersecurity information. Users can:

- Paste text.
- Submit links.
- Upload screenshots.
- Ask whether a message, email, website, or social post appears to be a scam.
- Receive reasons and suggested next steps.

Norton explicitly warns that Genie will not always be able to determine whether something is a scam.

**Strengths**

- Well-known consumer security brand.
- Free access.
- AI explanations and recommended actions.
- Supports broader scam context, not only URL reputation.

**Weaknesses and differentiation opportunities**

- Not primarily a one-tap camera scanner.
- Content must be submitted to Norton's service.
- Cloud and account/privacy considerations.
- No verified full redirect-chain visualization.
- General conversational workflow may be slower than a purpose-built scanner.

Source:

- [Norton Genie FAQ](https://support.norton.com/sp/en/us/home/current/solutions/v20230717145233467)

### 5.5 Bitdefender Scamio

**Category:** AI scam chatbot  
**Channels:** Web, WhatsApp, Messenger, Discord  
**Price:** Free  

Bitdefender states that users can send:

- Text.
- Email.
- Social-media messages.
- Links.
- Images.
- QR codes.

Scamio combines predefined rules, Bitdefender's database of known scams and phishing attempts, and AI-assisted analysis. It provides practical advice.

**Strengths**

- Free.
- Strong security brand.
- Accepts QR codes directly.
- Broader social-engineering context.
- Useful explanations.

**Weaknesses and differentiation opportunities**

- Requires a Bitdefender account.
- Primarily a chatbot rather than a native camera utility.
- Sends content to cloud services.
- No verified complete redirect-chain display.
- WhatsApp and social-platform channels introduce additional data processors.

Source:

- [Bitdefender Scamio](https://www.bitdefender.com/en-us/consumer/scamio)

### 5.6 McAfee Scam Detector

**Category:** Security-suite scam protection  
**Price:** Included at no additional cost in McAfee plans, rather than a standalone free product  

McAfee's indexed 2026 product announcement confirms instant live QR-code scam checks. Official material did not clearly confirm image-gallery or screenshot QR upload.

The Norwegian App Store contains McAfee's mobile application, but its current Norwegian description did not explicitly mention QR scanning. Norway-specific rollout of the new QR feature could not be verified.

**Strengths**

- Major consumer security vendor.
- Existing paid distribution.
- Live QR check.
- Broader scam and device protection.

**Weaknesses and uncertainties**

- Requires a McAfee subscription.
- Norway feature availability is not confirmed.
- Screenshot/image support was not confirmed.
- The feature is part of a larger security application.

Sources:

- [McAfee Norwegian App Store listing](https://apps.apple.com/no/app/mcafee-stay-secure-private/id724596345)
- [McAfee newsroom](https://www.mcafee.com/en-us/newsroom/)

### 5.7 Scanly

**Category:** Consumer QR and barcode scanner  
**Platform:** iPhone listing in Norwegian App Store  
**Price:** Free download with Pro subscription  

The listing claims:

- Phishing and scam link warnings before opening.
- Local scanning.
- Saved scan history.
- Image and screenshot scanning.
- Barcode support.
- QR creation.

The listing also states that **Safe Scan link protection** is part of Scanly Pro.

**Strengths**

- Attractive consumer scanner positioning.
- Already visible in Norway.
- Image scanning and history.
- Privacy-focused marketing.

**Weaknesses and uncertainties**

- Core safety feature appears to require a subscription.
- Detection method and effectiveness are not independently documented.
- No evidence of complete redirect-chain analysis.
- No established Norwegian security brand.

Source:

- [Scanly on the Norwegian App Store](https://apps.apple.com/no/app/qr-code-scanner-scanly/id6777284121)

### 5.8 Safe QR Scanner AI

**Category:** Consumer QR scanner with AI marketing  
**Platform:** iPhone  
**Price:** Free download with premium features  

The Norwegian App Store listing claims:

- Link preview.
- Suspicious-link detection.
- Unsafe redirect checks.
- AI link summaries.
- Camera, photo, clipboard, and shared-content scanning.
- iCloud synchronization and scan statistics.

The listing states that advanced safety and AI capabilities require premium access. At research time it did not have enough ratings to display a review summary. Norwegian was not included in the listed languages.

**Strengths**

- Very similar product concept.
- Broad input methods.
- Consumer-friendly feature set.

**Weaknesses and uncertainties**

- Minimal visible traction.
- No independent security validation.
- No Norwegian language.
- Subscription-based advanced protection.

Source:

- [Safe QR Scanner AI on the Norwegian App Store](https://apps.apple.com/no/app/safe-qr-scanner-ai/id6761750661?l=nb)

### 5.9 Kaspersky QR Scanner

**Category:** Legacy dedicated scanner  

Kaspersky's official support documentation states:

- Standalone Android development stopped in October 2022.
- The application was removed from Google Play and Huawei AppGallery.
- Support was scheduled to end in 2023.
- QR scanning functionality moved into the main Kaspersky Android application.

The Norwegian Apple listing could not be reliably retrieved. Search results were contradictory, and direct access returned 404. It should not be represented as a current active standalone Norwegian competitor without a fresh store check.

Source:

- [Kaspersky: End of standalone QR Scanner support](https://support.kaspersky.co.uk/qrscanner-for-android/1.12)

---

## 6. Indirect competitors and substitutes

### 6.1 Native camera and photo applications

- Apple Camera and Code Scanner.
- Pixel Camera and the Android system QR scanner.
- Google Lens.
- Apple Photos/Live Text actions.
- Google Photos through Lens.

Their advantage is zero installation and familiar UX. Their weakness is the absence of a documented full pre-opening investigation.

### 6.2 Browser protection

- Safari Fraudulent Website Warning.
- Chrome Safe Browsing.
- Enhanced Safe Browsing.
- Other browsers using Google or proprietary threat intelligence.

These products can block known or detected malicious sites, but usually operate when navigation is attempted rather than presenting a complete QR report first.

### 6.3 URL checking services

| Service | Strength | Major limitation |
|---|---|---|
| Google Safe Browsing site status | Fast, recognized intelligence | Limited explanation and no QR workflow |
| VirusTotal | Aggregates many security engines | Public submissions and public API commercial restrictions |
| urlscan.io | Rich page-load, screenshot, redirect, and resource analysis | Public-by-default scans can expose private URLs |
| Cloudflare URL Scanner | Detailed page analysis | Public/default visibility and third-party retention concerns |
| F-Secure Link Checker | Simple Nordic consumer experience | Requires extracting or pasting the link |
| NordVPN Link Checker | Simple free check | No full redirect-chain explanation |
| ScamAdviser | Scam and domain reputation context | Not a complete technical malware analysis |
| IPQualityScore URL Scanner | Risk scores and redirect information | Free usage and depth limitations |
| Criminal IP | Infrastructure and historical-abuse context | Not a complete live consumer URL verdict |

### 6.4 Norwegian local substitutes

#### Vipps

Vipps provides QR scanning for payment flows. NorSIS advises using trusted payment applications for payment QR codes. Vipps is not a general-purpose link inspector.

#### Telenor Nettvern

Telenor Nettvern blocks known malicious destinations at the network level for eligible customers. It reduces harm but does not explain a QR code before the user attempts navigation.

#### Telia Nettvakt

Telia provides network-level harmful-site protection. Like Telenor's service, it is complementary rather than a direct pre-scan investigation tool.

#### BankID

BankID is not a QR scanner competitor, but it strongly shapes Norwegian trust and phishing behavior. A safety application should advise users to open BankID or their bank application directly instead of signing in through an unexpected QR destination.

Sources:

- [Vipps MobilePay QR support](https://help.vippsmobilepay.com/en-NO/articles/where-can-i-find-my-qr-code-and-order-stickers)
- [Telenor Nettvern](https://www.telenor.no/kundeservice/sikkerhet/nettvern/)
- [Telia Nettvakt](https://www.telia.no/trygghet/tjenester/nettvakt/)
- [BankID authentication](https://bankid.no/en/company/services/authentication)

---

## 7. Norway market evidence

### 7.1 Mobile and internet reach

Norway has the infrastructure and behavior required for a mobile-first product:

- The Norwegian Media Authority reported that approximately 97% of Norwegians had their own mobile phone and approximately 98% had internet access in 2024.
- Nkom reported more than 6.1 million mobile subscriptions by the first half of 2025.
- Nkom reported extremely broad 5G household coverage by the end of 2025.
- Mobile operating-system usage is approximately evenly divided between iOS and Android according to StatCounter estimates, making simultaneous platform support strategically important.

The StatCounter figure is a web-usage estimate rather than an official population survey and should be described as such.

Sources:

- [Norwegian Media Authority: Children and media habits 2024](https://www.medietilsynet.no/fakta/rapporter/barn-og-medier/barn-medievaner-2024/)
- [Nkom telecommunications statistics](https://nkom.no/statistikk/statiske-rapporter-og-analyser/)
- [StatCounter mobile OS market share, Norway](https://gs.statcounter.com/os-market-share/mobile/norway)

### 7.2 Digital payments and identity

Norges Bank reported that:

- Mobile payments accounted for approximately 30% of in-person point-of-sale payments in 2024.
- Cash represented only approximately 2% of respondents' most recent in-store payment.

These figures establish high mobile-payment familiarity but should not be presented as QR-payment statistics. Vipps increasingly supports NFC and other flows.

BankID reports approximately 4.7 million active users and extremely high national coverage. This creates both familiarity with digital identity and a valuable impersonation target for criminals.

Sources:

- [Norges Bank: Retail payment services 2024](https://www.norges-bank.no/en/news-events/publications/retail-payment-services/retail-payment-services-2024/)
- [BankID authentication](https://bankid.no/en/company/services/authentication)

### 7.3 Norwegian fraud and scam evidence

NorSIS reported that approximately 11%, or nearly 400,000 Norwegians, had been deceived out of money online during the preceding two years. This is broader online fraud and not QR-specific fraud.

Norwegian payment fraud losses were approximately NOK 962 million in 2025, down from approximately NOK 1.228 billion in 2024. Banks reportedly prevented substantially larger attempted losses. These totals cover multiple fraud mechanisms and must not be labeled QR losses.

NorSIS explicitly describes **quishing** as an increasing method and warns about:

- QR codes in cafes and shops.
- QR codes in letters and emails.
- Fake codes placed over legitimate physical codes.
- Credential and payment phishing.
- QR-led attempts to install applications.

Telenor documented Norwegian tax-authority impersonation messages and emails containing QR codes that directed users toward credential theft.

Sources:

- [NorSIS: One in ten deceived out of money online](https://norsis.no/1-av-10-har-blitt-lurt-for-penger-pa-nett-stadig-flere-unngar-enkelte-nettjenester/)
- [NorSIS: Quishing - an increasing trend](https://norsis.no/quishing-en-okende-trend/)
- [Finans Norge: Fraud losses](https://www.finansnorge.no/artikler/2026/05/svindeltapene-oker-igjen/)
- [Finanstilsynet fraud statistics](https://www.finanstilsynet.no/publikasjoner-og-analyser/svindel-og-svindelstatistikk/)
- [Telenor: QR-code fraud](https://www.telenor.no/privat/artikler/sikkerhet/qr-kode-svindel/)

### 7.4 Evidence limitations

No reliable primary national source was found for:

- Number of QR scans per year in Norway.
- Percentage of Norwegians who scan QR codes.
- QR-code payment share.
- Number of QR phishing incidents.
- QR-specific financial losses.
- Willingness to pay for QR protection.
- Current consumer willingness to install a dedicated QR safety application.

These gaps must remain explicit. General phishing, mobile-payment, and fraud figures cannot be transformed into QR-specific market-size estimates.

---

## 8. Global QR threat evidence

The following statistics use different datasets and methodologies. They should be presented independently and never combined into a single incidence rate.

### Proofpoint

Proofpoint reported detecting approximately **4.2 million QR-code phishing threats in the first half of 2025**. The figure comes from Proofpoint's own email and cloud-security telemetry.

Source:

- [Proofpoint Human Factor report discussion](https://www.proofpoint.com/us/blog/email-and-cloud-threats/human-factor-vol-2-offers-new-insights-phishing)

### Barracuda

Barracuda reported:

- More than 500,000 phishing emails with QR codes embedded in PDF attachments during a three-month sample from mid-June through mid-September 2024.
- Approximately one in 20 mailboxes targeted with QR-code attacks during the final quarter of 2023.
- Heavy use of Microsoft, DocuSign, Adobe, and internal-department impersonation.

Sources:

- [Barracuda: Evolving use of QR codes in phishing](https://blog.barracuda.com/2024/10/22/threat-spotlight-evolving-qr-codes-phishing-attacks)
- [Barracuda 2025 Email Threats Report](https://www.barracuda.com/reports/2025-email-threats-report)

### Cofense

Cofense reported substantial growth in QR-based active threat reporting and document-based credential phishing. Its telemetry reflects threats that reached protected organizations and should not be interpreted as general population prevalence.

Sources:

- [Cofense annual report discussion](https://cofense.com/blog/cofense-annual-report-indicates-105-increase-in-malicious-emails-bypassing-segs/)
- [Cofense Q3 2024 report](https://cofense.com/getmedia/725f6da5-65ea-4401-a8f0-b0172712b18d/Cofense-Q3-Report.pdf)

### Netskope

Netskope observed a very large campaign-specific increase in QR phishing traffic involving Microsoft Sway. This reflects one monitored campaign and should not be generalized into a worldwide QR growth rate.

Source:

- [Netskope: Microsoft Sway abused for quishing](https://www.netskope.com/blog/phishing-in-style-microsoft-sway-abused-to-deliver-quishing-attacks)

### Microsoft

Microsoft documents substantial innovation in QR phishing detection for Defender for Office 365 and describes QR images as a method for bypassing traditional email analysis and moving users onto less-managed mobile devices.

Source:

- [Microsoft: Defender innovation against QR phishing](https://www.microsoft.com/en-us/security/blog/2024/11/04/how-microsoft-defender-for-office-365-innovated-to-address-qr-code-phishing-attacks/)

### Government warnings

The US Federal Trade Commission warns about:

- Fraudulent QR stickers placed over legitimate parking-meter codes.
- Unexpected delivery and account messages.
- QR codes directing victims to spoofed websites or malware.

The FBI warned in 2025 about unsolicited packages containing QR codes used to obtain personal and financial information or deliver malware.

Sources:

- [FTC: Harmful links hidden in QR codes](https://consumer.ftc.gov/consumer-alerts/2023/12/scammers-hide-harmful-links-qr-codes-steal-your-information)
- [FBI: Unsolicited packages containing QR codes](https://www.fbi.gov/investigate/cyber/alerts/2025/unsolicited-packages-containing-qr-codes-used-to-initiate-fraud-schemes)

---

## 9. Target customer segments in Norway

### 9.1 Families supporting older relatives

Value proposition:

- Simple explanations.
- Large text.
- Clear recommended action.
- Ability to share a screenshot or result with a trusted person.
- No technical vocabulary required.

Example message:

> Ikke logg inn via denne lenken. Åpne banken eller BankID-appen direkte.

This segment may value trust and clarity more than a detailed technical report.

### 9.2 Younger mobile-payment and social-commerce users

Relevant contexts:

- Events and festivals.
- Restaurant menus.
- Second-hand marketplaces.
- Social-media promotions.
- Travel.
- Package and delivery messages.
- Cryptocurrency promotions.

The product should avoid portraying younger users as careless. Messaging should emphasize speed and control rather than fear.

### 9.3 Employees scanning work-related codes

QR phishing intentionally moves users from protected corporate email onto personal phones. Employers could promote the application as a bring-your-own-device safety tool.

Potential distribution:

- Employers.
- Managed-service providers.
- Trade unions.
- Cybersecurity awareness programs.
- Insurance providers.

### 9.4 Small businesses and merchants

Potential use cases:

- Verify that displayed payment/menu QR codes have not been covered by fraudulent stickers.
- Periodically rescan codes at opening and closing.
- Create an auditable history of expected destinations.
- Receive warnings when a physical code changes destination.

This could later become a paid business feature while consumer scanning remains free.

### 9.5 Tourists and public-space users

Norway receives international visitors who may scan:

- Parking codes.
- Transport information.
- Tourist maps.
- Menus.
- Event tickets.
- Accommodation instructions.

English should be supported even if Norwegian is the first marketing language.

---

## 10. Product positioning

### 10.1 Recommended category

Do not position the product as another QR reader.

Recommended category descriptions:

- QR destination inspector.
- QR safety checker.
- Safe link preview for QR codes.
- Quishing protection.

Possible Norwegian phrasing:

- **Trygg QR-sjekk**
- **Sjekk QR-koden før du åpner**
- **Se sluttadressen først**

Names require trademark and domain checks before selection.

### 10.2 Core message hierarchy

1. **See the destination before opening.**
2. **Short links are expanded safely.**
3. **Understand why a link is suspicious.**
4. **Your image stays on your device by default.**
5. **No scanner can detect every scam.**

### 10.3 Differentiation claims that can be substantiated

Potential claims:

- Decodes QR images locally.
- Does not automatically open links.
- Shows the final destination after redirects.
- Displays both Unicode and technical domain forms.
- Explains the evidence behind a warning.
- Offers Norwegian-language guidance.
- Stores no scan history unless the user enables it.

Avoid claims such as:

- Makes every QR code safe.
- Detects all scams.
- Guarantees protection.
- Prevents fraud.
- Uses AI to know whether every site is trustworthy.

---

## 11. Norway go-to-market strategy

### 11.1 Launch proposition

Launch a free, Norwegian-language application on iOS and Android with:

- No mandatory account.
- No advertisements.
- No automatic cloud upload.
- No stored history by default.
- Immediate camera opening.
- Screenshot and image sharing.
- Clear privacy controls.

### 11.2 Distribution channels

#### App Store optimization

Potential Norwegian search terms:

- QR-svindel
- quishing
- trygg QR-kode
- sjekk lenke
- sikker QR-skanner
- falsk QR-kode
- phishing QR

#### National Security Month

NorSIS coordinates **Nasjonal sikkerhetsmåned** with Norwegian security and preparedness organizations. This is a natural campaign period for a pilot, public education, media demonstrations, and employer distribution.

Source:

- [NorSIS National Security Month](https://norsis.no/nasjonal-sikkerhetsmaned-2025-digital-beredskap/)

#### Institutional partnerships

Priority discussions:

- NorSIS.
- Banks.
- BankID.
- Vipps MobilePay.
- Telenor and Telia.
- Municipalities.
- Universities and student organizations.
- Senior organizations.
- Insurance providers.
- Consumer organizations.
- Event and festival operators.

The application should be positioned as complementary:

- Vipps validates payment flows.
- BankID authenticates identity.
- Carrier services block known destinations.
- The QR application explains the destination before navigation.

### 11.3 Campaign themes

Use concrete Norwegian situations:

- Fake Skatteetaten QR message.
- Sticker placed over a restaurant or parking QR code.
- Fake BankID login.
- Package-delivery QR.
- Event-ticket or competition QR.
- Unexpected invoice or employer document.

Avoid campaigns that imply all QR codes are dangerous.

### 11.4 Pilot design

Recommended initial pilot:

- 500 to 1,000 participants.
- One bank, telco, university, municipality, or employer partner.
- Four to eight weeks.
- Both iOS and Android.
- Mix of age groups.

Measure:

- Successful scans.
- Scans per active user.
- Time from launch to result.
- Comprehension of warnings.
- Percentage choosing not to open suspicious destinations.
- False-positive reports.
- False-negative reports.
- Share-extension use.
- Cloud-check consent rate.
- Seven-day and thirty-day retention.
- Partner-distribution conversion.

Do not use **threats blocked** as the only success metric. It encourages inflated classifications.

---

## 12. Business model for a free consumer application

### 12.1 Recommended model

Keep core consumer protection free and fund it through:

- Bank sponsorship.
- Telco sponsorship.
- Insurance partnerships.
- Employer licensing.
- White-label versions.
- Business verification tools.
- Merchant QR monitoring.
- Aggregated, non-identifying threat reporting only where legally and ethically justified.

Avoid:

- Advertising SDKs.
- Selling scan history.
- Monetizing submitted URLs.
- Making essential safety checks subscription-only.

### 12.2 Potential paid business capabilities

- Organization-managed verified-domain lists.
- Merchant monitoring of expected QR destinations.
- Fleet deployment.
- Security-awareness reporting.
- API access.
- White-label branding.
- Incident-reporting integration.
- Aggregated campaign intelligence.

Consumer results must not be biased by commercial relationships. A sponsored organization should not receive an automatic trusted verdict.

---

## 13. Legal and regulatory considerations

### 13.1 GDPR and Norwegian Personal Data Act

A QR payload or URL may contain:

- Email addresses.
- Phone numbers.
- User identifiers.
- Session tokens.
- Document identifiers.
- Private file-sharing links.
- Payment information.
- Location or campaign identifiers.

IP addresses and device identifiers may also be personal data.

Recommended defaults:

- Decode locally.
- Do not retain QR images.
- Do not retain raw URLs by default.
- Ask before remote redirect expansion.
- Ask before submitting a URL to a reputation provider.
- Use short retention and purpose limitation.
- Provide deletion and export where history is enabled.
- Complete data-controller/processor assessments for each provider.

International providers may require transfer assessments and safeguards under GDPR Chapter V.

Sources:

- [Datatilsynet: Dynamic IP addresses](https://www.datatilsynet.no/rettigheter-og-plikter/personopplysninger/dynamiske-ip-adresser/)
- [Datatilsynet: Transfers outside the EEA](https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/overforing-av-personopplysninger-ut-av-eos/)
- [Datatilsynet: Data protection impact assessment](https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/vurdering-av-personvernkonsekvenser/)

### 13.2 Device access, analytics, and cookies

Norway's revised Electronic Communications Act requires GDPR-standard consent for non-essential cookies and similar access to device information. This can affect:

- Advertising SDKs.
- Attribution SDKs.
- Analytics identifiers.
- Cross-app tracking.
- Optional push-marketing behavior.

Avoiding advertising and non-essential SDKs materially simplifies the trust proposition.

Source:

- [Nkom: Cookies and device access](https://nkom.no/internett/informasjonskapsler-cookies)

### 13.3 Automated risk scoring

A consumer warning ordinarily advises the user rather than making a decision with legal or similarly significant effects. GDPR Article 22 is therefore unlikely to apply in the same way as credit, employment, or insurance automation.

Nevertheless:

- Keep the user in control.
- Explain the main reasons.
- Show uncertainty.
- Allow false-positive reporting.
- Provide an override where legally and technically appropriate.
- Do not silently block without explanation.

### 13.4 EU AI Act

The EU AI Act's broad application date is 2 August 2026. A consumer phishing-risk assistant is generally unlikely to fall into an Annex III high-risk category, but exact classification depends on implementation.

Important distinctions:

- Deterministic URL rules may not be an AI system.
- A small classifier or generative explanation model may be an AI system.
- General transparency, technical documentation, security, and consumer-law obligations still apply.
- Norway requires EEA incorporation and national implementation; actual Norwegian commencement and authority guidance should be confirmed before launch.

Sources:

- [EUR-Lex: Regulation (EU) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)
- [Digdir artificial-intelligence information](https://www.digdir.no/kunstig-intelligens)

### 13.5 Consumer and marketing law

Norwegian marketing law prohibits misleading actions and omissions. Claims such as **safe**, **detects malware**, or **prevents phishing** require evidence and qualification.

Recommended disclosure:

> Checks the QR content and known risk signals before opening. No scanner can detect every scam.

Maintain:

- Test evidence.
- Feed provenance.
- Feed update times.
- False-positive procedures.
- Known limitations.
- Incident-response process.

Source:

- [Lovdata: Marketing Control Act](https://lovdata.no/dokument/NLE/lov/2009-01-09-2)

---

## 14. SWOT analysis

### Strengths

- Clear consumer problem.
- Strong Norway mobile reach.
- Few Norway-focused direct competitors.
- Privacy-first differentiation.
- Useful before navigation, unlike many browser/network products.
- Potential for trusted-institution partnerships.
- Can combine deterministic evidence and understandable AI explanations.

### Weaknesses

- Native camera applications already scan QR codes with no installation.
- Consumers may not understand why a separate scanner is necessary.
- Reliable redirect expansion and threat intelligence require backend infrastructure.
- False positives can damage trust.
- Free operation requires sponsorship or careful cost controls.
- A newly launched security brand begins without reputation.

### Opportunities

- Increasing quishing awareness.
- Norwegian-language education.
- Bank, telco, insurer, and employer sponsorship.
- Merchant QR monitoring.
- Family safety positioning.
- Transparent evidence instead of black-box verdicts.
- Local Vipps, BankID, Skatteetaten, and public-service impersonation detection.

### Threats

- Apple or Google adding first-class QR safety analysis.
- Google Lens integrating automatic QR scam detection.
- Security vendors improving free scanners.
- Threat-intelligence licensing changes.
- Public API restrictions.
- App-store privacy scrutiny.
- Adversaries adapting specifically to the application's scoring rules.
- Liability or reputational damage following a missed malicious URL.

---

## 15. Research conclusions

1. The market is not empty, but it is fragmented.
2. Trend Micro and Sophos are the strongest established direct competitors.
3. Is This QR Safe? is the closest claimed functional match.
4. Norton Genie and Bitdefender Scamio are the strongest free AI substitutes.
5. Apple and Google provide browser-level protection but not the proposed complete pre-opening QR investigation.
6. Norway has excellent mobile readiness and meaningful fraud exposure.
7. There is no reliable Norway-specific QR usage or QR-loss dataset.
8. The strongest differentiation is local trust, privacy, full redirect visibility, and clear Norwegian explanations.
9. The consumer application should remain free and avoid advertising.
10. Generative AI should explain evidence, not decide the security verdict.

---

## 16. Source bibliography

### Apple and Google

- [Apple QR scanning](https://support.apple.com/en-us/102680)
- [Apple Safari and Privacy](https://www.apple.com/legal/privacy/data/en/safari/)
- [Apple phishing guidance](https://support.apple.com/en-us/102568)
- [Google Pixel QR scanning](https://support.google.com/pixelcamera/answer/16561572?hl=en-GB)
- [Google Chrome unsafe-site warnings](https://support.google.com/chrome/answer/99020?hl=en&co=GENIE.Platform%3DAndroid)
- [Google Lens scam detection](https://blog.google/products-and-platforms/products/search/scam-detection-circle-to-search-lens/)
- [Google ML Kit barcode scanning](https://developers.google.com/ml-kit/vision/barcode-scanning)
- [Google June 2026 scam advisory](https://blog.google/innovation-and-ai/technology/safety-security/fraud-scams-advisory-june-2026/)

### Competitors

- [Trend Micro QR Scanner information](https://trendlife.com/en-us/blog/2018/06/18/scan-qr-codes-safely-with-the-trend-micro-qr-scanner)
- [Trend Micro Mobile Security](https://www.trendmicro.com/en_us/forHome/products/mobile-security.html)
- [Sophos QR Code Scanner](https://docs.sophos.com/esg/sixm-ios/help/en-us/Features/QRCodeScanner/index.html)
- [Norton Genie FAQ](https://support.norton.com/sp/en/us/home/current/solutions/v20230717145233467)
- [Bitdefender Scamio](https://www.bitdefender.com/en-us/consumer/scamio)
- [F-Secure Link Checker](https://www.f-secure.com/en/link-checker)
- [Scanly Norway](https://apps.apple.com/no/app/qr-code-scanner-scanly/id6777284121)
- [Safe QR Scanner AI Norway](https://apps.apple.com/no/app/safe-qr-scanner-ai/id6761750661?l=nb)
- [Kaspersky standalone scanner end of support](https://support.kaspersky.co.uk/qrscanner-for-android/1.12)
- [Is This QR Safe?](https://www.isthisqrsafe.com/)
- [McAfee Norwegian App Store](https://apps.apple.com/no/app/mcafee-stay-secure-private/id724596345)

### Norway

- [Norwegian Media Authority](https://www.medietilsynet.no/fakta/rapporter/barn-og-medier/barn-medievaner-2024/)
- [Nkom statistics](https://nkom.no/statistikk/statiske-rapporter-og-analyser/)
- [Norges Bank retail payments](https://www.norges-bank.no/en/news-events/publications/retail-payment-services/retail-payment-services-2024/)
- [NorSIS quishing guidance](https://norsis.no/quishing-en-okende-trend/)
- [NorSIS online fraud research](https://norsis.no/1-av-10-har-blitt-lurt-for-penger-pa-nett-stadig-flere-unngar-enkelte-nettjenester/)
- [Finans Norge fraud losses](https://www.finansnorge.no/artikler/2026/05/svindeltapene-oker-igjen/)
- [Finanstilsynet fraud statistics](https://www.finanstilsynet.no/publikasjoner-og-analyser/svindel-og-svindelstatistikk/)
- [Telenor QR fraud](https://www.telenor.no/privat/artikler/sikkerhet/qr-kode-svindel/)
- [Vipps QR support](https://help.vippsmobilepay.com/en-NO/articles/where-can-i-find-my-qr-code-and-order-stickers)
- [Telenor Nettvern](https://www.telenor.no/kundeservice/sikkerhet/nettvern/)
- [Telia Nettvakt](https://www.telia.no/trygghet/tjenester/nettvakt/)
- [BankID authentication](https://bankid.no/en/company/services/authentication)

### Global threat evidence

- [Proofpoint Human Factor report discussion](https://www.proofpoint.com/us/blog/email-and-cloud-threats/human-factor-vol-2-offers-new-insights-phishing)
- [Barracuda QR phishing research](https://blog.barracuda.com/2024/10/22/threat-spotlight-evolving-qr-codes-phishing-attacks)
- [Barracuda 2025 Email Threats Report](https://www.barracuda.com/reports/2025-email-threats-report)
- [Cofense annual report discussion](https://cofense.com/blog/cofense-annual-report-indicates-105-increase-in-malicious-emails-bypassing-segs/)
- [Netskope quishing research](https://www.netskope.com/blog/phishing-in-style-microsoft-sway-abused-to-deliver-quishing-attacks)
- [Microsoft Defender QR phishing research](https://www.microsoft.com/en-us/security/blog/2024/11/04/how-microsoft-defender-for-office-365-innovated-to-address-qr-code-phishing-attacks/)
- [FTC QR scam warning](https://consumer.ftc.gov/consumer-alerts/2023/12/scammers-hide-harmful-links-qr-codes-steal-your-information)
- [FBI QR package warning](https://www.fbi.gov/investigate/cyber/alerts/2025/unsolicited-packages-containing-qr-codes-used-to-initiate-fraud-schemes)

### Legal

- [Datatilsynet: Dynamic IP addresses](https://www.datatilsynet.no/rettigheter-og-plikter/personopplysninger/dynamiske-ip-adresser/)
- [Datatilsynet: EEA transfers](https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/overforing-av-personopplysninger-ut-av-eos/)
- [Datatilsynet: DPIA](https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/vurdering-av-personvernkonsekvenser/)
- [Nkom cookie/device rules](https://nkom.no/internett/informasjonskapsler-cookies)
- [EU AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)
- [Norwegian Marketing Control Act](https://lovdata.no/dokument/NLE/lov/2009-01-09-2)

