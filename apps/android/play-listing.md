# QRavn — Google Play store listing

Default language: **Norwegian (Norway) — nb-NO**. Second listing: **English (United States) — en-US**.

Package name: `no.qravn.android` · Version 1.0.1 (versionCode 2)

## The claim, and why it is worded this way

The product is the **engine**, not the address bar. QRavn runs 49 named checks
over the code and reports what it found. The listing leads with that number,
because "we show you the link" describes a text box and undersells what the app
actually does.

The number is not a marketing figure. It is `Object.keys(findings).length` in
`contracts/v1/finding-codes.json`, and `tools/check-claimed-checks.mjs` fails
the build if any surface quotes a different one. The three-way split quoted in
the copy — 26 on the address, 16 on the payload, 7 on the redirect chain — is
checked the same way.

The hook is still that **security professionals do not scan QR codes with the
camera app**. It is worded against the *camera app* and not against scanning,
because the broader version is not true and would not survive being checked:

- Official guidance says to **read the web address before opening it, and not to
  proceed if you cannot see it**. QRavn does that reading, and then does the
  part the guidance leaves to you: knowing what to look for.
- A camera app is built to *open* the link. It offers a shortened preview and a
  button, and the preview is exactly where a lookalike domain or a shortener
  hides.
- The same official guidance **warns against third-party QR scanner apps**,
  because most of them are advertising businesses. The listing meets that
  objection head on rather than ducking it: QRavn has no INTERNET permission at
  all, so Android refuses to let it phone home regardless of what we claim.

Every factual claim is sourced — see [Sources](#sources). A security app that
exaggerates has already lost the argument, so the listing promises no detection
rate, no prevention figure, and never says "safe". Note that 9 of the 49 codes
are informational rather than warnings, which is why the copy says "checks"
throughout and never "threats detected".

---

## nb-NO (default)

### App name (30 max)

```
QRavn – 49 sjekker mot svindel
```
30 characters.

### Short description (80 max)

```
Kameraappen åpner lenken. QRavn kjører 49 sjekker på den først.
```
63 characters.

### Full description (4000 max)

```
SIKKERHETSFOLK SKANNER IKKE QR-KODER MED KAMERAAPPEN

Alle offentlige råd om QR-koder sier det samme: les nettadressen før du åpner
den. Ser du ikke adressen, skal du la være.

Men rådet stopper der. Og selv når du endelig får se adressen – vet du hva du
skal se etter?

Det er den jobben QRavn gjør. Appen leser koden og kjører 49 sjekker på den før
noe som helst åpnes. Du får ikke bare lenken utlevert. Du får svaret.


49 SJEKKER, PÅ TRE OMRÅDER

26 sjekker på selve adressen. Om det ekte domenet står til slutt i stedet for
først, slik at bankid.no.verify-login.example ikke er BankID i det hele tatt.
Om én bokstav er byttet ut med en fra et annet alfabet, så navnet bare ser
riktig ut. Om det ligger usynlige tegn inne i adressen. Om det står brukernavn
og passord foran domenet. Om adressen er et rått tall i stedet for et navn.

16 sjekker på hva koden faktisk inneholder. En QR-kode er ikke alltid en lenke.
Den kan være et wifi-nettverk uten passord, en ferdigskrevet SMS til et
overtakstnummer, en kryptolommebok, eller en nøkkel til tofaktorpålogging.

7 sjekker på hvor lenken sender deg videre. Forkortede lenker som peker på nye
forkortede lenker. Kjeder som hopper fra domene til domene. Omdirigeringer som
faller fra kryptert til ukryptert underveis.

Du trenger ikke kunne én eneste av dem. Det er hele poenget.


DETTE SKJER ALLEREDE I NORGE

I Kristiansand ble det funnet over 20 falske QR-klistremerker på
parkeringsautomater. De var limt rett over de ekte, med navnet til et
parkeringsselskap folk stoler på.

På bruktmarkedet får kjøpere tilsendt en QR-kode de skal «betale med», og kortet
blir belastet langt mer enn prisen. Én person tapte 90 000 kroner. Politiet og
bankene har advart mot begge deler.

Et klistremerke koster svindleren nesten ingenting å trykke.


QRavn UNDERSØKER KODEN I STEDET FOR Å ÅPNE DEN

Rett kameraet mot koden. Ingenting åpnes. De 49 sjekkene kjører med én gang, på
telefonen din, og du får en konklusjon med begrunnelsen ved siden av: hva som
ble funnet, hvor i adressen det ligger, og hva det betyr.

Så bestemmer du – med det du skulle hatt hele tiden.


«ER IKKE QR-SKANNERAPPER SELVE PROBLEMET?»

Som regel er de det, og advarslene er berettiget. De fleste av dem er
annonsevirksomheter, og det du skanner er varen.

QRavn har ingen INTERNET-tillatelse i det hele tatt. Ikke «vi lover å la være»
– tillatelsen finnes rett og slett ikke, så det er Android selv som nekter
appen å kontakte nettet. Den kan ikke laste opp det du skannet, fordi den ikke
kan laste opp noe som helst.

Ingen konto. Ingen analyse. Ingen annonser. Ingen skannehistorikk. Den virker i
flymodus.


DET DEN SIER, OG DET DEN IKKE SIER

QRavn sier aldri at en lenke er trygg. Ingen app kan love det, uansett hvor
skråsikkert det er formulert. Den forteller deg hva den fant, og hva den ikke
kunne avgjøre:

• at adressen etterligner et kjent navn
• at det er blandet inn tegn fra et annet alfabet, så bokstaver ser like ut
• at lenken er forkortet, så målet er skjult
• at siden ber om innlogging eller BankID
• at adressen ikke er kryptert

Finner den ingenting, sier den nettopp det: «ingen av de 49 sjekkene fant noe»,
ikke «trygg». Forskjellen er hele poenget med appen.


BYGD FOR ANDROID

• Del en lenke til QRavn fra hvilken som helst app
• Hurtiginnstillinger: legg skanneren i menyen du drar ned ovenfra
• Snarvei: hold inne appikonet og gå rett til skanning
• Velg et bilde fra galleriet i stedet for å skanne
• Lommelykt for kode i dårlig lys
• Følger systemets lyse og mørke tema
• Bokmål, nynorsk og engelsk


PERSONVERN

Vi samler ikke inn personopplysninger. Vi kan ikke: appen har ingen mulighet til
å sende noe. Hele personvernerklæringen ligger på
https://qravn.isainative.dev/privacy


49 sjekker først. Så bestemmer du.

QRavn er laget i Norge, for folk i Norge.

Du åpner den ikke alene.
```

### Release notes (500 max)

```
Første versjon.

QRavn leser QR-koden og kjører 49 sjekker på den før noe åpnes: 26 på selve
adressen, 16 på hva koden faktisk inneholder, og 7 på hvor lenken sender deg
videre. Alt skjer på telefonen, og appen har ingen nettilgang.
```
232 characters.

### Notes for the listing form

- Category: **Tools**. Tags: security, utilities.
- Contains ads: **No**. In-app purchases: **No**.

---

## en-US

### App name (30 max)

```
QRavn – 49 scam checks
```
22 characters.

### Short description (80 max)

```
The camera app opens the link. QRavn runs 49 checks on it first.
```
64 characters.

### Full description (4000 max)

```
SECURITY PROFESSIONALS DON'T SCAN QR CODES WITH THE CAMERA APP

Every official guide on QR codes gives the same advice: read the web address
before you open it. If you cannot see the address, do not proceed.

But the advice stops there. And even once you can finally see the address — do
you know what you are looking for?

That is the job QRavn does. It reads the code and runs 49 checks on it before
anything opens. You are not just handed the link. You are handed the answer.


49 CHECKS, ACROSS THREE AREAS

26 checks on the address itself. Whether the real domain sits at the end
instead of the start, so that bankid.no.verify-login.example is not BankID at
all. Whether one letter has been swapped for one from another alphabet, so the
name only looks right. Whether invisible characters are hidden inside the
address. Whether a username and password have been placed in front of the
domain. Whether the address is a raw number instead of a name.

16 checks on what the code actually contains. A QR code is not always a link.
It can be a Wi-Fi network with no password, a pre-written SMS to a premium-rate
number, a crypto wallet, or a key to your two-factor login.

7 checks on where the link forwards you. Shortened links that point at further
shortened links. Chains that hop from domain to domain. Redirects that drop
from encrypted to unencrypted along the way.

You do not need to know a single one of them. That is the entire point.


THIS IS ALREADY HAPPENING

In Kristiansand, Norway, more than 20 fake QR stickers were found on parking
meters. They were stuck straight over the real ones, carrying the name of a
parking company people trust.

In second-hand marketplaces, buyers are sent a QR code to "pay with", and the
card is charged far more than the asking price. One person lost 90,000 kroner.
Police and banks have warned about both.

A sticker costs a scammer almost nothing to print.


QRavn INVESTIGATES THE CODE INSTEAD OF OPENING IT

Point the camera at the code. Nothing opens. The 49 checks run immediately, on
your phone, and you get a verdict with the reasoning beside it: what was found,
where in the address it sits, and what it means.

Then you decide, holding what you should have had all along.


"AREN'T QR SCANNER APPS THE PROBLEM?"

Usually they are, and the warnings are fair. Most of them are advertising
businesses, and what you scan is the product.

QRavn holds no INTERNET permission at all. Not "we promise not to" — the
permission simply is not there, so it is Android itself that refuses to let the
app reach the network. It cannot upload what you scanned, because it cannot
upload anything.

No account. No analytics. No ads. No scan history. It works in airplane mode.


WHAT IT SAYS, AND WHAT IT WILL NOT SAY

QRavn never tells you a link is safe. No app can promise that, however
confidently it is phrased. It tells you what it found, and what it could not
determine:

• the address imitates a name you know
• characters from another alphabet are mixed in, so letters look alike
• the link is shortened, so the destination is hidden
• the page asks for a login or for BankID
• the address is not encrypted

When it finds nothing, that is exactly what it says: "none of the 49 checks
found anything", not "safe". That difference is the whole point of the app.


BUILT FOR ANDROID

• Share a link to QRavn from any app
• Quick Settings tile: put the scanner in the panel you pull down
• Shortcut: long-press the icon and go straight to scanning
• Pick an image from your gallery instead of scanning
• Torch for codes in poor light
• Follows the system light and dark theme
• Norwegian Bokmål, Norwegian Nynorsk and English


PRIVACY

We collect no personal data. We cannot: the app has no way to send anything.
Full policy: https://qravn.isainative.dev/privacy


49 checks first. Then you decide.

QRavn is made in Norway, for people in Norway.

You don't open it alone.
```

### Release notes (500 max)

```
First release.

QRavn reads the QR code and runs 49 checks on it before anything opens: 26 on
the address itself, 16 on what the code actually contains, and 7 on where the
link forwards you. Everything runs on your phone, and the app has no network
access.
```
256 characters.

---

## Sources

Keep this list current if the copy changes. It exists so the claims can be
defended to Play review, to a journalist, or to a user who checks.

| Claim | Source |
|---|---|
| Official advice is to preview the web address before opening, and not to proceed if it is not shown | NCSC (UK), "QR Codes — what's the real risk?"; NCSC Ireland, "Quick Guide: QR Code Phishing & Scams" |
| Camera-app previews are truncated, hiding lookalike domains and shorteners | Apple Support Communities thread on QR URL previews; Samsung Community report that link preview was removed from Camera and Gallery on some devices |
| Guidance warns against third-party QR scanner apps | NCSC (UK), same blog post — the reason QRavn ships with no INTERNET permission |
| 20+ fake QR stickers on parking meters in Kristiansand, using a trusted parking brand | NRK Sørlandet, "Advarer mot parkeringssvindel med QR-kode" |
| Second-hand marketplace QR payment fraud; card charged far above the agreed price | TV 2, "Politiet og bank advarer: Flere lurt av ny svindelmetode" |
| A single victim losing NOK 90,000 | TV 2 / Sol, same case |
| Police and banks warning about both | NRK, "Politiet advarer mot svindel via QR-kode" |

Deliberately **not** claimed: that scanning is always unsafe, that the built-in
camera app is malicious, any detection rate, any figure for fraud prevented, and
any suggestion that a clear result means a destination is safe.

## Store settings

| Field | Value |
|---|---|
| App or game | App |
| Free or paid | Free |
| Category | Tools |
| Email | salnikov@gmail.com |
| Website | https://qravn.isainative.dev |
| Privacy policy | https://qravn.isainative.dev/privacy |
| Contains ads | No |
| In-app purchases | No |

## Data safety declaration

**Does your app collect or share any of the required user data types? → No.**

Everything follows from that: no data collected, no data shared, no data types
to declare, so the questionnaire is a single screen.

Supporting answers, if asked:

- Data is not encrypted in transit — **not applicable, no data is transmitted**.
- Users cannot request deletion — **not applicable, nothing is stored**.
- Committed to Play Families policy — not applicable, app is not for children.

The camera is a *permission*, not a collected data type. Play's Data safety form
asks about data leaving the device. Camera frames are read in memory to find a
code and are never stored or transmitted, so nothing is declared.

## Content rating questionnaire

Category: **Utility, Productivity, Communication, or Other**.

All content questions → **No** (no violence, sex, language, controlled
substances, gambling, user interaction, location sharing, personal information
sharing, digital purchases).

Expected result: **PEGI 3 / ESRB Everyone / IARC 3+**.

## App content declarations

| Question | Answer |
|---|---|
| Privacy policy | https://qravn.isainative.dev/privacy |
| Ads | No ads |
| App access | All functionality available without special access. No login. |
| Content rating | Utility; all No |
| Target audience | 18+ (or 13+); not appealing to children |
| News app | No |
| COVID-19 contact tracing | No |
| Data safety | No data collected or shared |
| Government app | No |
| Financial features | No |
| Health | No |
| Advertising ID | Not used — declare no advertising ID |

## Assets

| Asset | Path | Spec |
|---|---|---|
| App icon | `brand/play/icon-512.png` | 512×512 PNG, alpha allowed |
| Feature graphic | `brand/play/feature-graphic.png` | 1024×500 PNG, no alpha |
| Phone screenshots | `brand/play/screenshots/` | 1080×1920 PNG, no alpha, 2–8 required |

The app icon is the only Play upload that may carry a transparency channel.
Everything else must be 24-bit. See [`brand/STORE-ASSETS.md`](../../brand/STORE-ASSETS.md)
for every slot across all three stores.

## Release

- Track: **Production** (the account predates 13 Nov 2023, so the 12-tester
  closed-test requirement does not apply).
- Artifact: `apps/android/app/build/outputs/bundle/release/app-release.aab`
- Release name: `1.0.1 (2)`
- Countries: Norway first. Adding the rest of the world is fine — the app is
  usable anywhere, and the listing is offered in English too.
- Release notes are per-language copy, so they live in the language sections
  above alongside the other fields Play asks for in both listings.

## Signing

- Upload keystore: the path in the git-ignored `apps/android/keystore.properties`.
  Keep it outside the repository and back it up.
- Alias: `upload` · RSA 4096 · valid to 2053-12-15
- Upload certificate SHA-256:
  `6A:BC:7B:C4:43:B4:80:6E:A5:59:3B:73:80:94:85:A1:01:6C:98:06:B8:D5:AA:1E:31:39:8D:D1:FF:82:58:D5`
- Play App Signing: **enable it** and let Google generate the app signing key.
  The upload key then only ever signs uploads, and can be reset by support if it
  is lost.
