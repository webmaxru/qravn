# QRavn — Microsoft Store listing

Product name: **QRavn – QR code scam check** · Package: the PWA in `apps/web/`

Listings: **English (United States) — en-US** and **Norwegian (Norway) — nb-NO**.

Partner Center → Store listings. Paste the blocks below verbatim.
`node tools/check-store-listings.mjs` measures every field against the limits in
this table, so nothing here is a number someone typed and stopped re-checking.

| Field | Limit | This listing |
|---|---|---|
| Product name | 256 | 26 / 28 characters |
| Short description | 1 000 | 331 / 325 characters |
| Description | 10 000 | 5 161 / 5 066 characters |
| Product features | 20 items × 200 | 20 items, longest 164 / 166 |
| Search terms | 7 × 30, 21 words total | 7 terms, 16 / 14 words |
| What's new in this version | 1 500 | **leave blank** — first submission |

Paired numbers are en-US / nb-NO.

## The claim, and why it is worded this way

The reasoning, the sourcing and the list of things this product deliberately
does **not** claim are in [`apps/android/play-listing.md`](../../apps/android/play-listing.md)
and are not repeated here. Two of those rules bind this file too:

- **The number is not a marketing figure.** It is
  `Object.keys(findings).length` in `contracts/v1/finding-codes.json`, and
  `tools/check-claimed-checks.mjs` fails the build if any surface quotes a
  different one. This file is on that guard's list of surfaces. The three-way
  split — 26 on the address, 16 on the payload, 7 on the redirect chain — is
  checked the same way.
- **Nothing here says a link is safe.** The app has four verdicts and none of
  them is "safe"; the copy has to match, or the listing is writing a cheque the
  product refuses to cash.

What is different from the Play listing is the platform argument. On Android the
answer to "aren't QR scanner apps the problem?" is that the app holds no
INTERNET permission, so the operating system enforces the promise. **That
sentence must never be copied into this listing** — this is a PWA, and it is not
true here. The Windows version earns the same point differently, and the copy
below says so exactly:

- the analyser is WebAssembly running locally, and the app never opens or visits
  the scanned link;
- short-link expansion is opt-in per check and runs on isolated infrastructure,
  so the machine in front of you never contacts the shortener or the destination
  behind it;
- switching that one feature off leaves an app that makes no network requests at
  all.

The Windows hook is also different. A QR code reaches a desktop user inside an
invoice, a parcel notice, an authenticator re-enrolment mail or a slide — it is
already on the screen, and the reflex is to reach for a phone, which is exactly
where the check disappears. The description leads with that.

---

## en-US

### Product name (256 max)

```
QRavn – QR code scam check
```

26 characters.

### Short description (1000 max)

```
A QR code arrives in your inbox and you reach for your phone, where the camera app opens the link. QRavn reads the code on the PC it is already on and runs 49 checks on it first: 26 on the web address, 16 on what the code actually contains, 7 on where it forwards you. It never tells you a link is safe. It tells you what it found.
```

331 characters.

### Description (10000 max)

```
THE CODE IS ON YOUR SCREEN. THE SCAN HAPPENS ON YOUR PHONE.

A QR code arrives in an invoice, a parcel notice, a "re-enrol your authenticator" email, a slide in a meeting. You are sitting at a PC, so you pick up your phone, point it at the monitor, and the camera app hands you a shortened preview and a button.

That is the moment the check disappears. QRavn puts it back on the machine the code is already on.


SECURITY PROFESSIONALS DON'T SCAN QR CODES WITH THE CAMERA APP

Every official guide on QR codes gives the same advice: read the web address before you open it. If you cannot see the address, do not proceed.

But the advice stops there. And even once you can finally see the address — do you know what you are looking for?

That is the job QRavn does. It reads the code and runs 49 checks on it before anything opens. You are not just handed the link. You are handed the answer.


49 CHECKS, ACROSS THREE AREAS

26 checks on the address itself. Whether the real domain sits at the end instead of the start, so that bankid.no.verify-login.example is not BankID at all. Whether one letter has been swapped for one from another alphabet, so the name only looks right. Whether invisible characters are hidden inside the address. Whether a username and password have been placed in front of the domain. Whether the address is a raw number instead of a name.

16 checks on what the code actually contains. A QR code is not always a link. It can be a Wi-Fi network with no password, a pre-written SMS to a premium-rate number, a crypto wallet, or a key to your two-factor login.

7 checks on where the link forwards you. Shortened links that point at further shortened links. Chains that hop from domain to domain. Redirects that drop from encrypted to unencrypted along the way.

You do not need to know a single one of them. That is the entire point.


THIS IS ALREADY HAPPENING

In Kristiansand, Norway, more than 20 fake QR stickers were found on parking meters. They were stuck straight over the real ones, carrying the name of a parking company people trust.

In second-hand marketplaces, buyers are sent a QR code to "pay with", and the card is charged far more than the asking price. One person lost 90,000 kroner. Police and banks have warned about both.

A sticker costs a scammer almost nothing to print. An email costs less.


QRavn INVESTIGATES THE CODE INSTEAD OF OPENING IT

Scan it with the webcam, choose a photo or a screenshot, or paste the text straight in. Nothing opens.

The 49 checks run immediately, on your machine, and you get a verdict with the reasoning beside it: what was found, where in the address it sits, and what it means. Then you decide, holding what you should have had all along — and opening anything still takes a second, deliberate confirmation.


"AREN'T QR SCANNER APPS THE PROBLEM?"

Usually they are, and the warnings are fair. Most of them are advertising businesses, and what you scan is the product.

QRavn's analyser is WebAssembly running locally. The app reads the code and judges it on your machine, and it never opens or visits the scanned link — not to check it, not to preview it, never.

There is exactly one thing it can ask the network to do, and only if you press the button: follow a shortened link to see where it really lands. That runs on isolated infrastructure rather than on your machine, so your computer never contacts the shortener or the destination behind it. Turn "Look up short links" off in Settings and the app makes no network requests at all.

No account. No analytics. No ads. No scan history. Nothing to sign in to.


WHAT IT SAYS, AND WHAT IT WILL NOT SAY

QRavn never tells you a link is safe. No app can promise that, however confidently it is phrased. It tells you what it found, and what it could not determine:

• the address imitates a name you know
• characters from another alphabet are mixed in, so letters look alike
• the link is shortened, so the destination is hidden
• a bank or ID brand is used by an address that does not belong to it
• a username and password are hidden in front of the domain
• the address is not encrypted

When it finds nothing, that is exactly what it says: "none of the 49 checks found anything", not "safe". That difference is the whole point of the app.


BUILT FOR WINDOWS

• Installs from the Store and runs in its own window
• Works offline after the first launch — the whole engine ships with the app
• Scan with the webcam, choose a photo or screenshot, or paste the link text
• Follows the light or dark theme Windows is already using
• Keyboard-first: every control is reachable, and focus lands on the result
• Every screen is checked against WCAG 2.2 AA automatically, on every build
• Norwegian Bokmål, Norwegian Nynorsk and English, switchable mid-result


PRIVACY

We collect no personal data. There is no account, no analytics and no history of what you checked, and the check itself never leaves your machine. Full policy: https://qravn.isainative.dev/privacy


49 checks first. Then you decide.

QRavn is made in Norway, for people in Norway — and it reads an address the same way anywhere.

You don't open it alone.
```

5161 characters.

### Product features (200 max, up to 20 items)

```
The camera app opens the link. QRavn runs 49 checks on it first.
```
```
26 checks on the web address: the real name at the end instead of the start, one letter borrowed from another alphabet, characters you cannot see.
```
```
16 checks on what the code really is: a Wi-Fi network with no password, a pre-written SMS to a premium-rate number, a crypto wallet, a key to your two-factor login.
```
```
7 checks on where it sends you next: shorteners pointing at shorteners, chains hopping between domains, redirects dropping from encrypted to unencrypted.
```
```
Never says "safe". Four verdicts, each with the reasoning beside it and a plain list of what the check could not determine.
```
```
Every finding names itself: what was found, where in the address it sits, and what it actually means — no score, no colour-coded guess.
```
```
Lookalike domains, in words: bankid.no.verify-login.example is not BankID, and the app says which part of the address gave it away.
```
```
A name in front of the @ is not a destination. QRavn reads trusted.no@evil.example the way a browser does, and tells you where it really goes.
```
```
Reads codes that are not links at all, and explains what a Wi-Fi, SMS, calendar or wallet payload would do if you acted on it.
```
```
The analyser is WebAssembly running on your machine. QRavn never opens or visits the scanned link — not to check it, not to preview it.
```
```
Scan with the webcam, choose a photo or a screenshot, or paste the link text. Nothing opens until you say so.
```
```
Short-link expansion is opt-in per check and runs on isolated infrastructure, so your machine never contacts the shortener or the destination.
```
```
Turn "Look up short links" off in Settings and the app makes no network requests at all.
```
```
Opening anything takes a second, deliberate confirmation. There is never one click between a scam and your browser.
```
```
No account. No analytics. No ads. No history of what you checked. Nothing to sign in to.
```
```
Works offline after the first launch. The whole engine ships with the app, so a dropped connection changes nothing.
```
```
Installs from the Store, runs in its own window, and follows the light or dark theme Windows is already using.
```
```
Keyboard-first: every control is reachable, focus is always visible, and it lands on the result the moment a check finishes.
```
```
Every screen is scanned against WCAG 2.2 AA automatically on every build, including reduced-motion and screen-reader behaviour.
```
```
Norwegian Bokmål, Norwegian Nynorsk and English. Switch language mid-result and the finding you were reading is re-rendered, not lost.
```

### What's new in this version

Leave blank. This is the first submission.

### Search terms (30 max per line, up to 7 lines, 21 words total)

```
quishing
phishing url checker
malware virus antivirus
fraud protection tool
smishing spoofing
typosquatting punycode
svindel nettfiske
```

---

## nb-NO

### Product name (256 max)

```
QRavn – sjekk QR-koden først
```

28 characters.

### Short description (1000 max)

```
QR-koden kommer i innboksen, og du tar opp telefonen – der kameraappen åpner lenken. QRavn leser koden på PC-en den allerede ligger på, og kjører 49 sjekker på den først: 26 på selve nettadressen, 16 på hva koden faktisk inneholder, 7 på hvor den sender deg videre. Den sier aldri at en lenke er trygg. Den sier hva den fant.
```

325 characters.

### Description (10000 max)

```
KODEN ER PÅ SKJERMEN. SKANNINGEN SKJER PÅ TELEFONEN.

En QR-kode kommer i en faktura, et pakkevarsel, en e-post om å «registrere autentikatoren på nytt», et lysbilde i et møte. Du sitter foran en PC, så du tar opp telefonen, retter den mot skjermen, og kameraappen gir deg en forkortet forhåndsvisning og en knapp.

Det er der sjekken forsvinner. QRavn legger den tilbake på maskinen koden allerede ligger på.


SIKKERHETSFOLK SKANNER IKKE QR-KODER MED KAMERAAPPEN

Alle offentlige råd om QR-koder sier det samme: les nettadressen før du åpner den. Ser du ikke adressen, skal du la være.

Men rådet stopper der. Og selv når du endelig får se adressen – vet du hva du skal se etter?

Det er den jobben QRavn gjør. Appen leser koden og kjører 49 sjekker på den før noe som helst åpnes. Du får ikke bare lenken utlevert. Du får svaret.


49 SJEKKER, PÅ TRE OMRÅDER

26 sjekker på selve adressen. Om det ekte domenet står til slutt i stedet for først, slik at bankid.no.verify-login.example ikke er BankID i det hele tatt. Om én bokstav er byttet ut med en fra et annet alfabet, så navnet bare ser riktig ut. Om det ligger usynlige tegn inne i adressen. Om det står brukernavn og passord foran domenet. Om adressen er et rått tall i stedet for et navn.

16 sjekker på hva koden faktisk inneholder. En QR-kode er ikke alltid en lenke. Den kan være et wifi-nettverk uten passord, en ferdigskrevet SMS til et overtakstnummer, en kryptolommebok, eller en nøkkel til tofaktorpålogging.

7 sjekker på hvor lenken sender deg videre. Forkortede lenker som peker på nye forkortede lenker. Kjeder som hopper fra domene til domene. Omdirigeringer som faller fra kryptert til ukryptert underveis.

Du trenger ikke kunne én eneste av dem. Det er hele poenget.


DETTE SKJER ALLEREDE I NORGE

I Kristiansand ble det funnet over 20 falske QR-klistremerker på parkeringsautomater. De var limt rett over de ekte, med navnet til et parkeringsselskap folk stoler på.

På bruktmarkedet får kjøpere tilsendt en QR-kode de skal «betale med», og kortet blir belastet langt mer enn prisen. Én person tapte 90 000 kroner. Politiet og bankene har advart mot begge deler.

Et klistremerke koster svindleren nesten ingenting å trykke. En e-post koster mindre.


QRavn UNDERSØKER KODEN I STEDET FOR Å ÅPNE DEN

Skann den med webkameraet, velg et bilde eller et skjermbilde, eller lim inn teksten direkte. Ingenting åpnes.

De 49 sjekkene kjører med én gang, på maskinen din, og du får en konklusjon med begrunnelsen ved siden av: hva som ble funnet, hvor i adressen det ligger, og hva det betyr. Så bestemmer du – med det du skulle hatt hele tiden. Og å åpne noe krever fortsatt en ekstra, bevisst bekreftelse.


«ER IKKE QR-SKANNERAPPER SELVE PROBLEMET?»

Som regel er de det, og advarslene er berettiget. De fleste av dem er annonsevirksomheter, og det du skanner er varen.

Analysemotoren i QRavn er WebAssembly som kjører lokalt. Appen leser koden og vurderer den på maskinen din, og den åpner eller besøker aldri den skannede lenken – ikke for å sjekke den, ikke for å forhåndsvise den, aldri.

Det finnes nøyaktig én ting den kan be nettet om, og bare hvis du trykker på knappen: følge en forkortet lenke for å se hvor den faktisk lander. Det skjer på isolert infrastruktur og ikke på maskinen din, så datamaskinen din kontakter aldri forkorteren eller målet bak den. Slå av «Slå opp korte lenker» i innstillingene, så gjør appen ingen nettkall i det hele tatt.

Ingen konto. Ingen analyse. Ingen annonser. Ingen skannehistorikk. Ingenting å logge inn på.


DET DEN SIER, OG DET DEN IKKE SIER

QRavn sier aldri at en lenke er trygg. Ingen app kan love det, uansett hvor skråsikkert det er formulert. Den forteller deg hva den fant, og hva den ikke kunne avgjøre:

• at adressen etterligner et kjent navn
• at det er blandet inn tegn fra et annet alfabet, så bokstaver ser like ut
• at lenken er forkortet, så målet er skjult
• at et bank- eller ID-navn brukes av en adresse som ikke tilhører det
• at det ligger brukernavn og passord skjult foran domenet
• at adressen ikke er kryptert

Finner den ingenting, sier den nettopp det: «ingen av de 49 sjekkene fant noe», ikke «trygg». Forskjellen er hele poenget med appen.


BYGD FOR WINDOWS

• Installeres fra Store og kjører i sitt eget vindu
• Virker uten nett etter første start – hele motoren følger med appen
• Skann med webkamera, velg et bilde eller skjermbilde, eller lim inn lenken
• Følger det lyse eller mørke temaet Windows allerede bruker
• Tastaturet først: alt kan nås, og fokus lander på resultatet
• Hver skjerm testes automatisk mot WCAG 2.2 AA, ved hver bygging
• Bokmål, nynorsk og engelsk, og du kan bytte midt i et resultat


PERSONVERN

Vi samler ikke inn personopplysninger. Det finnes ingen konto, ingen analyse og ingen historikk over hva du har sjekket, og selve sjekken forlater aldri maskinen din. Hele personvernerklæringen ligger på https://qravn.isainative.dev/privacy


49 sjekker først. Så bestemmer du.

QRavn er laget i Norge, for folk i Norge – og den leser en adresse likt overalt.

Du åpner den ikke alene.
```

5066 characters.

### Product features (200 max, up to 20 items)

```
Kameraappen åpner lenken. QRavn kjører 49 sjekker på den først.
```
```
26 sjekker på nettadressen: om det ekte navnet står til slutt i stedet for først, om én bokstav er hentet fra et annet alfabet, om det ligger tegn der du ikke kan se.
```
```
16 sjekker på hva koden egentlig er: et wifi-nettverk uten passord, en ferdigskrevet SMS til et overtakstnummer, en kryptolommebok, en nøkkel til tofaktorpålogging.
```
```
7 sjekker på hvor den sender deg videre: forkortere som peker på forkortere, kjeder mellom domener, omdirigeringer som faller fra kryptert til ukryptert.
```
```
Sier aldri «trygg». Fire konklusjoner, hver med begrunnelsen ved siden av og en liste over det sjekken ikke kunne avgjøre.
```
```
Hvert funn sier hva det er: hva som ble funnet, hvor i adressen det ligger, og hva det faktisk betyr – ingen poengsum, ingen fargekode.
```
```
Etterligninger, med ord: bankid.no.verify-login.example er ikke BankID, og appen sier hvilken del av adressen som avslørte det.
```
```
Et navn foran @ er ikke et mål. QRavn leser trusted.no@evil.example slik en nettleser gjør, og sier hvor den faktisk går.
```
```
Leser koder som ikke er lenker i det hele tatt, og forklarer hva et wifi-, SMS-, kalender- eller lommebokinnhold ville gjort.
```
```
Analysemotoren er WebAssembly som kjører på maskinen din. QRavn åpner eller besøker aldri den skannede lenken – heller ikke for å sjekke den.
```
```
Skann med webkameraet, velg et bilde eller et skjermbilde, eller lim inn lenketeksten. Ingenting åpnes før du sier ja.
```
```
Oppslag av korte lenker er frivillig for hver sjekk og skjer på isolert infrastruktur, så maskinen din kontakter aldri forkorteren eller målet.
```
```
Slå av «Slå opp korte lenker» i innstillingene, så gjør appen ingen nettkall i det hele tatt.
```
```
Å åpne noe krever en ekstra, bevisst bekreftelse. Det er aldri ett klikk mellom en svindel og nettleseren din.
```
```
Ingen konto. Ingen analyse. Ingen annonser. Ingen historikk over hva du har sjekket. Ingenting å logge inn på.
```
```
Virker uten nett etter første start. Hele motoren følger med appen, så et brudd i forbindelsen endrer ingenting.
```
```
Installeres fra Store, kjører i sitt eget vindu, og følger det lyse eller mørke temaet Windows allerede bruker.
```
```
Tastaturet først: alt kan nås, fokus er alltid synlig, og det lander på resultatet i det en sjekk er ferdig.
```
```
Hver skjerm testes automatisk mot WCAG 2.2 AA ved hver bygging, inkludert redusert bevegelse og skjermleser.
```
```
Bokmål, nynorsk og engelsk. Bytt språk midt i et resultat, og funnet du leste blir tegnet på nytt – ikke borte.
```

### What's new in this version

La stå tom. Dette er første innsending.

### Search terms (30 max per line, up to 7 lines, 21 words total)

```
nettfiske smishing
nettsvindel bedrageri
svindelsjekk lenkesjekk
skadevare virus
sikkerhet trygghet
quishing phishing
falsk nettadresse
```

---

## Search terms, and how they were chosen

Partner Center allows **7 terms, 30 characters each, and 21 individual words in
total**. The terms are never shown to a customer; they only widen what the
product matches on.

The rule that decides the set: **the Store already indexes the product name and
the description, so a term made of words that appear there buys nothing.** Every
slot is therefore spent on vocabulary the visible copy does *not* use. The
English description already contains "scanner", "link", "security", "shortener",
"lookalike", "invoice" and "inbox"; the Norwegian one already contains
"svindel", "lenke", "skanner", "faktura", "bank" and "politiet". None of those
appear below.

`node tools/check-store-listings.mjs` enforces this: it fails if a term is built
only from words already in that language's own listing, and it counts the words
against the 21-word cap. A first draft of this set had two English and three
Norwegian terms that were entirely redundant; the check is what found them.

| en-US term | Why |
|---|---|
| `quishing` | The industry term for QR phishing. Someone who knows the word is exactly the customer, and it appears nowhere in the visible copy. |
| `phishing url checker` | The description says "web address" and "scam"; it never says "phishing", "url" or "checker", which is what people type. |
| `malware virus antivirus` | What a non-technical customer searches when they mean "is this dangerous". The listing uses none of the three. |
| `fraud protection tool` | Outcome vocabulary. The copy says "scam" throughout and never "fraud". |
| `smishing spoofing` | The SMS-payload checks and the lookalike-address checks, under the names the security press uses for them. |
| `typosquatting punycode` | The two named techniques behind the address checks. Low volume, very high intent. |
| `svindel nettfiske` | Norwegian, deliberately placed in the *English* listing so a Norwegian browsing the Store in English still matches. |

| nb-NO term | Why |
|---|---|
| `nettfiske smishing` | "Nettfiske" is the Norwegian word for phishing and is absent from the copy, which says "svindel" throughout. |
| `nettsvindel bedrageri` | Compounds and the legal term, neither of which the description uses. |
| `svindelsjekk lenkesjekk` | How a Norwegian actually types the thing they want: a compound noun, not a phrase. |
| `skadevare virus` | The same "is this dangerous" search as the English set. |
| `sikkerhet trygghet` | The two ordinary words for what a customer is looking for; the copy avoids both because it will not promise either. |
| `quishing phishing` | The English jargon is used in Norwegian security coverage too and is worth matching in both listings. |
| `falsk nettadresse` | "Falsk" is how the parking-meter and marketplace cases are described in Norwegian news, which is where a reader will have met the problem. |

Not used, deliberately: any term about parking, invoices or banks. Those words
describe where fraud happens, not what this product is, and a customer who
searches them wants a different app.

## Sources

Keep this list current if the copy changes. It exists so the claims can be
defended to Store certification, to a journalist, or to a user who checks.

| Claim | Source |
|---|---|
| Official advice is to preview the web address before opening, and not to proceed if it is not shown | NCSC (UK), "QR Codes — what's the real risk?"; NCSC Ireland, "Quick Guide: QR Code Phishing & Scams" |
| Camera-app previews are truncated, hiding lookalike domains and shorteners | Apple Support Communities thread on QR URL previews; Samsung Community report that link preview was removed from Camera and Gallery on some devices |
| Guidance warns against third-party QR scanner apps | NCSC (UK), same blog post — the reason the copy spends a paragraph answering it rather than ignoring it |
| 20+ fake QR stickers on parking meters in Kristiansand, using a trusted parking brand | NRK Sørlandet, "Advarer mot parkeringssvindel med QR-kode" |
| Second-hand marketplace QR payment fraud; card charged far above the agreed price | TV 2, "Politiet og bank advarer: Flere lurt av ny svindelmetode" |
| A single victim losing NOK 90,000 | TV 2 / Sol, same case |
| Police and banks warning about both | NRK, "Politiet advarer mot svindel via QR-kode" |
| The analyser runs locally and the app never visits the scanned link | `core/` is a no-I/O crate compiled to WebAssembly; the only network call in `apps/web/` is the opt-in resolver in `src/lib/resolverClient.ts` |
| WCAG 2.2 AA on every screen | `apps/web/e2e/a11y.spec.ts` runs axe-core with `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` across every UI state, on every build |

Deliberately **not** claimed: that scanning is always unsafe, that the built-in
camera app is malicious, any detection rate, any figure for fraud prevented, and
any suggestion that a clear result means a destination is safe.

Also deliberately not claimed **on this platform**: the Play listing's strongest
line is that the Android app holds no INTERNET permission, so the operating
system itself enforces the promise. A PWA has no equivalent, so that sentence
appears nowhere above.

## Privacy declaration

**Does this product collect any personal information? → No.**

Everything follows from that. The camera is a *permission*, not a collected data
type: frames are read in memory to find a code and are never stored or
transmitted. The one optional network feature sends a URL a user explicitly
asked to expand to our own resolver, which is disclosed in the app at the moment
of the request and can be switched off permanently in Settings.

## Properties and Store settings

| Field | Value |
|---|---|
| Category | Utilities & tools (sub-category: Security) |
| Price | Free |
| Free trial | No |
| Contains ads | No |
| In-app purchases | No |
| Website | https://qravn.isainative.dev |
| Privacy policy | https://qravn.isainative.dev/privacy |
| Support contact | salnikov@gmail.com |
| Copyright | © QRavn |
| Developed by | QRavn |
| Markets | All, Norway first |
| Age rating | Expected 3+ / Everyone — no user-generated content, no ads, no purchases |
| Accessibility | Declared accessible; see the WCAG 2.2 AA scans in `apps/web/e2e/a11y.spec.ts` |

The device family is Windows 10 version 1607 and later, which is also the floor
for super hero art to appear at the top of the listing.

## Assets

| Asset | Path |
|---|---|
| Screenshots, English | `screenshots/en-US/` — 9 × 1920×1080 |
| Screenshots, Norwegian | `screenshots/nb-NO/` — 9 × 1920×1080 |
| Store display logos | `logos/` — 300×300, 150×150, 71×71 |
| Poster art (main logo) | `logos/poster-art-720x1080.png`, `logos/poster-art-1440x2160.png` |
| Box art | `logos/box-art-1080x1080.png`, `logos/box-art-2160x2160.png` |
| Super hero art | `hero/super-hero-1920x1080.png`, `hero/super-hero-3840x2160.png` |
| Xbox branded key art | `hero/xbox-branded-key-art-584x800.png` |
| Xbox titled hero art | `hero/xbox-titled-hero-art-1920x1080.png` |
| Xbox featured promotional square | `hero/xbox-featured-promotional-square-1080x1080.png` |

30 PNGs in total. See [`README.md`](README.md) for how each is generated and
which Store rule it satisfies — including why box art and the featured
promotional square are both 1080×1080 and still not interchangeable.
