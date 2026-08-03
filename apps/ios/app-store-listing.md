# QRavn — App Store listing

Default language: **Norwegian (Norway) — no**. Second listing: **English (U.S.) — en-US**.

Bundle ID: `no.qravn.ios` · Version 1.0.2 (build set by CI)

> Apple has no Nynorsk App Store localization. The **app** still ships nb, nn and
> en — see `CFBundleLocalizations` in `apps/ios/project.yml` — but the store page
> exists in Bokmål and English only. Do not read the missing nn listing as a
> missing nn app.

## The claim, and why it is worded this way

Identical to the Play listing, deliberately: the product is the **engine**, not
the address bar. The number 49 is `Object.keys(findings).length` in
`contracts/v1/finding-codes.json`, and `tools/check-claimed-checks.mjs` fails the
build if any surface quotes a different one. This file is in that list.

Field lengths are stated under each block below and are measured by the store
listing checker in `tools/`. Apple rejects an over-length field at upload, after
every other form has been filled in, so check before you paste.

## What differs from Play

| | Play | App Store |
| --- | --- | --- |
| Short line | Short description, 80 | Subtitle, 30 |
| Long copy | Full description, 4000 | Description, 4000 |
| Discovery | Indexed from the description | **Keywords field, 100 characters**, not indexed from the description |
| Above the fold | Short description | Subtitle + first 2–3 lines of the description |

The keywords field is the real difference. Apple does not index the description,
so every term a person might actually type has to be bought with part of that
100-character budget — and a word already in the app name or subtitle is indexed
anyway and must not be repeated.

---

## no

### App name (30 max)

```
QRavn – 49 svindelsjekker
```
25 characters.

### Subtitle (30 max)

```
Sjekker QR-koden før du åpner
```
29 characters.

### Keywords (100 max)

```
qr,skanner,svindel,phishing,falsk,lenke,nettfiske,bankid,vipps,trygg,offline,personvern,kode
```
92 characters.

### Promotional text (170 max)

```
Kamera-appen åpner lenken. QRavn leser koden og kjører 49 sjekker på den først – helt uten nett, uten konto, og uten å kontakte adressen.
```
137 characters.

### Description (4000 max)

```
SIKKERHETSFOLK SKANNER IKKE QR-KODER MED KAMERA-APPEN

Alle offisielle råd om QR-koder sier det samme: les nettadressen før du åpner
den. Ser du ikke adressen, skal du ikke gå videre.

Men rådet stopper der. Og selv når du endelig ser adressen – vet du hva du skal
se etter?

Det er jobben QRavn gjør. Appen leser koden og kjører 49 sjekker på den før noe
åpnes. Du får ikke bare lenken. Du får svaret.


49 SJEKKER, PÅ TRE OMRÅDER

26 sjekker på selve adressen. Om det virkelige domenet står til slutt i stedet
for først, slik at bankid.no.verifiser-innlogging.example ikke er BankID i det
hele tatt. Om én bokstav er byttet ut med en fra et annet alfabet, slik at
navnet bare ser riktig ut. Om det ligger usynlige tegn inne i adressen. Om et
brukernavn og passord er plassert foran domenet. Om adressen er et rått tall i
stedet for et navn.

16 sjekker på hva koden faktisk inneholder. En QR-kode er ikke alltid en lenke.
Den kan være et Wi-Fi-nett uten passord, en ferdigskrevet SMS til et dyrt
nummer, en kalenderoppføring, en kontakt, en kryptolommebok.

7 sjekker på omdirigeringer, når du selv ber om det.


DETTE SKJER PÅ TELEFONEN DIN

QRavn har ingen nettverkskode. Ikke «vi sender ingenting» – det finnes ingen
kode i appen som kan sende noe. Adressen du skanner blir aldri kontaktet, heller
ikke av oss. Det finnes ingen konto, ingen sporing, ingen annonser og ingen
analyse.

Appen ber om ett tillatelse: kameraet.


APPEN ÅPNER ALDRI LENKEN FOR DEG

Det er hele poenget. Du ser adressen, du ser hva som ble funnet, og du bestemmer.
Er funnene alvorlige nok, tilbyr ikke appen å åpne den i det hele tatt.

Og appen sier aldri bare «trygg». Den sier hva den fant og hva den ikke kunne
vite – for en skanner uten nett kan ikke vite om et helt vanlig domene ble
registrert i går.


NORSK FØRST

Bokmål, nynorsk og engelsk. Skrevet på norsk først, ikke oversatt til det.
```
1879 characters.

### What's New in This Version (4000 max)

```
Første versjon for iPhone.

Samme motor som Android-appen: 49 sjekker, ingen nettverkskode, ingen konto,
ingen sporing. Bokmål, nynorsk og engelsk.
```
147 characters.

---

## en-US

### App name (30 max)

```
QRavn – 49 scam checks
```
22 characters.

### Subtitle (30 max)

```
Check the QR code, then open
```
28 characters.

### Keywords (100 max)

```
qr,scanner,scam,phishing,fake,link,safety,malicious,offline,privacy,url,barcode,security,check
```
94 characters.

### Promotional text (170 max)

```
The camera app opens the link. QRavn reads the code and runs 49 checks on it first — with no network, no account, and without ever contacting the address.
```
154 characters.

### Description (4000 max)

```
SECURITY PROFESSIONALS DON'T SCAN QR CODES WITH THE CAMERA APP

Every official guide on QR codes gives the same advice: read the web address
before you open it. If you cannot see the address, do not proceed.

But the advice stops there. And even once you can finally see the address — do
you know what you are looking for?

That is the job QRavn does. It reads the code and runs 49 checks on it before
anything opens. You are not just handed the link. You are handed the answer.


49 CHECKS, ACROSS THREE AREAS

26 checks on the address itself. Whether the real domain sits at the end instead
of the start, so that bankid.no.verify-login.example is not BankID at all.
Whether one letter has been swapped for one from another alphabet, so the name
only looks right. Whether invisible characters are hidden inside the address.
Whether a username and password have been placed in front of the domain.
Whether the address is a raw number instead of a name.

16 checks on what the code actually contains. A QR code is not always a link. It
can be a Wi-Fi network with no password, a pre-written SMS to a premium-rate
number, a calendar entry, a contact, a crypto wallet.

7 checks on redirects, when you ask for them.


THIS HAPPENS ON YOUR PHONE

QRavn has no networking code. Not "we don't send anything" — there is no code in
the app that could send anything. The address you scan is never contacted, not
even by us. There is no account, no tracking, no ads and no analytics.

The app asks for one permission: the camera.


THE APP NEVER OPENS THE LINK FOR YOU

That is the whole point. You see the address, you see what was found, and you
decide. If the findings are serious enough, the app does not offer to open it at
all.

And it never just says "safe". It tells you what it found and what it could not
know — because a scanner with no network cannot know whether an ordinary-looking
domain was registered yesterday.


NORWEGIAN FIRST

Bokmål, Nynorsk and English. Written in Norwegian first, not translated into it.
```
2018 characters.

### What's New in This Version (4000 max)

```
First release for iPhone.

The same engine as the Android app: 49 checks, no networking code, no account,
no tracking. Bokmål, Nynorsk and English.
```
147 characters.

---

## App information

| Field | Value |
| --- | --- |
| Bundle ID | `no.qravn.ios` |
| SKU | `qravn-ios` |
| Primary category | Utilities |
| Secondary category | Productivity |
| Age rating | 4+ |
| Privacy policy | https://qravn.isainative.dev/privacy |
| Support URL | https://qravn.isainative.dev |
| Marketing URL | https://qravn.isainative.dev |
| Copyright | 2026 QRavn |
| Price | Free, no in-app purchases |

## App privacy answers

Answer **"No, we do not collect data from this app."** Every other question
disappears once that is selected, and it is literally true: the app has no
networking code, no analytics SDK, no identifiers and no accounts. The
machine-readable version of the same statement is
`apps/ios/Sources/QravnApp/Resources/PrivacyInfo.xcprivacy`.

Export compliance: **no**, the app does not use non-exempt encryption.
`ITSAppUsesNonExemptEncryption` is already `false` in the Info.plist, so the
question is answered before the build is uploaded.

## Screenshots

Required: **6.9" (1320 × 2868)**. Apple scales it down for every smaller iPhone,
so one set is enough, and `TARGETED_DEVICE_FAMILY: "1"` means no iPad set is
asked for at all. Up to 10 per locale, first three visible without scrolling.

They are captured from the shipping app rather than composed, by
`apps/ios/scripts/capture-store-screenshots.sh` — see
[`brand/app-store/README.md`](../../brand/app-store/README.md). Every address in
them is a golden test vector, and the same ones the Microsoft Store listing
photographs, so no two listings can show different verdicts for one address.

In this order, since the first three carry the argument:

1. A verdict on a lookalike domain, findings visible.
2. A blocked verdict, scrolled to where an open button would have been.
3. The address panel, showing the real domain called out.
4. The "why" panel with the finding list.
5. The quiet verdict: no known threat found, which is not "safe".
6. The first screen, with the notice that the analysis stays on the device.

Locales: `no` and `en-US`, mirroring the listing languages. Files land in
`brand/app-store/screenshots/{no,en-US}/`.

## Review notes

Paste this into App Store Connect → App Review Information → Notes. The first
paragraph exists because a reviewer with no QR code to point the camera at is
the single most likely cause of a rejection under Guideline 2.1.

```
HOW TO TEST WITHOUT PRINTING ANYTHING

The app also accepts a link typed or pasted into the field under the viewfinder,
so the whole product can be reviewed without a QR code. Try these:

  https://trusted.no@evil.example/login   hidden real domain, refuses to open
  http://192.0.2.1/pay                    raw IP over plain http
  https://example.no                      ordinary address, no findings

To test the camera path, display any QR code on a second screen and point the
device at it. There is no sign-in, no demo account and no paid content.

WHY THERE IS NO NETWORK ACTIVITY

The app contains no networking code at all. The analysis runs in a Rust engine
compiled into the binary, and the address that was scanned is never contacted —
by the app or by us. That is the product: a scanner that cannot leak what you
scanned. This is also why the privacy answers say no data is collected and why
PrivacyInfo.xcprivacy declares no collected data types and no required-reason
API use.

WHY THE APP NEVER OPENS A LINK AUTOMATICALLY

Opening is always a separate, deliberate action by the person holding the phone,
and when the engine judges a code malicious the app offers no way to open it at
all — not a disabled button, no control. This is intentional and is covered by
automated tests.

SOURCE

The app, the engine and this listing are open source:
https://github.com/webmaxru/qravn
```

## Before the first upload

1. Register the bundle ID `no.qravn.ios` in the developer portal. No capabilities
   are needed; the app uses the camera only, which is an Info.plist string.
2. Create the app record in App Store Connect with the SKU above.
3. Add the six secrets listed at the top of
   `.github/workflows/release-ios.yml`.
4. Run that workflow with **Upload** unticked once. It archives, signs and
   validates without consuming a build number on TestFlight.
5. Run it again with Upload ticked, then test through TestFlight before
   submitting for review.
