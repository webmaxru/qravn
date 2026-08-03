/**
 * Store screenshot captions.
 *
 * Norwegian first, because the product is made in Norway for people in Norway
 * and the Play listing already leads in Bokmål. English second, because the
 * Microsoft Store listing is offered worldwide.
 *
 * `{{checks}}` is substituted from contracts/v1/finding-codes.json at render
 * time, for the same reason tools/check-claimed-checks.mjs exists: the number
 * of checks is a claim about a security product, so it comes from the registry
 * rather than from memory and cannot go stale in a picture nobody re-reads.
 *
 * Rules the copy holds to, and the reason for each:
 *  - never the word "safe" as a verdict, in any language;
 *  - no detection rate, no prevention figure, no promise;
 *  - every claim visible in the frame is one the app on screen actually makes.
 */

export const LOCALES = [
  { code: 'nb', dir: 'nb-NO' },
  { code: 'en', dir: 'en-US' },
]

export const CAPTIONS = {
  nb: {
    scan: {
      kicker: 'Før du åpner',
      headline: 'Kameraappen åpner lenken.\nQRavn sjekker den først.',
      sub: '{{checks}} sjekker kjører i det koden er lest — på din maskin, før noe som helst åpnes.',
    },
    clear: {
      kicker: 'Konklusjonen',
      headline: 'Den sier aldri «trygg».\nDen sier hva den fant.',
      sub: '«Ingen kjent trussel funnet» er ikke et løfte. Du får funnene, adressen delt opp i sine deler, og hva sjekken ikke kunne avgjøre.',
    },
    lookalike: {
      kicker: 'Identitet',
      headline: 'Én bokstav fra et annet alfabet.',
      sub: 'Denne adressen begynner med en kyrillisk а. Øyet ditt ser forskjellen aldri. Sjekken gjør det, og sier hvilket tegn det gjelder.',
    },
    credentials: {
      kicker: 'Villeding',
      headline: 'Navnet foran @ er ikke der lenken går.',
      sub: 'Alt før krøllalfaet er brukernavn, ikke destinasjon. QRavn viser deg verten du faktisk havner på — og å åpne den koster fortsatt en bevisst handling til.',
    },
    blocked: {
      kicker: 'Ikke en lenke',
      headline: 'Noen koder er ikke adresser i det hele tatt.',
      sub: 'En javascript:-nyttelast er kjørbar tekst. QRavn tegner ingen lenke til den, så det finnes ingenting å trykke på ved et uhell.',
    },
    redirect: {
      kicker: 'Omdirigeringer',
      headline: 'Se hvor den forkortede lenken faktisk ender.',
      sub: 'Du ber om det, og vår egen tjeneste følger kjeden. Maskinen din kontakter aldri forkorteren, og aldri målet bak den.',
    },
    payload: {
      kicker: 'Innholdet',
      headline: 'En QR-kode er ikke alltid en lenke.',
      sub: 'Åpne wifi-nett, ferdigskrevet SMS til overtakstnummer, kryptolommebøker, nøkler til tofaktor. QRavn sier hva koden faktisk er.',
    },
    checks: {
      kicker: 'Motoren',
      headline: '{{checks}} navngitte sjekker.\nDu trenger ikke kunne én.',
      sub: 'På selve adressen, på hva koden inneholder, og på hvor lenken sender deg videre. Tallet er talt opp fra kontrakten motoren kjører — ikke skrevet inn i en setning.',
    },
    privacy: {
      kicker: 'Personvern',
      headline: 'Ingen konto. Ingen sporing.\nIngen skannehistorikk.',
      sub: 'Analysen er WebAssembly som kjører lokalt. Slå av lenkefølging, så rører appen aldri nettet i det hele tatt.',
    },
  },
  en: {
    scan: {
      kicker: 'Before you open',
      headline: 'The camera app opens the link.\nQRavn checks it first.',
      sub: '{{checks}} checks run the moment the code is read — on your machine, before anything opens.',
    },
    clear: {
      kicker: 'The verdict',
      headline: 'It never says “safe”.\nIt says what it found.',
      sub: '“No known threat found” is not a promise. You get the findings, the address broken into its parts, and what the check could not determine.',
    },
    lookalike: {
      kicker: 'Identity',
      headline: 'One letter from another alphabet.',
      sub: 'This address opens with a Cyrillic а. Your eye will never catch it. The check does, and names the character.',
    },
    credentials: {
      kicker: 'Deception',
      headline: 'The name in front of the @ is not where this goes.',
      sub: 'Everything before the at sign is a username, not a destination. QRavn shows the host you actually land on — and opening it still costs a deliberate second action.',
    },
    blocked: {
      kicker: 'Not a link',
      headline: 'Some codes are not addresses at all.',
      sub: 'A javascript: payload is executable text. QRavn renders no link to it, so there is nothing to click by mistake.',
    },
    redirect: {
      kicker: 'Redirects',
      headline: 'See where the short link really ends up.',
      sub: 'You ask, and our own service follows the chain. Your machine never contacts the shortener, and never the destination behind it.',
    },
    payload: {
      kicker: 'The contents',
      headline: 'A QR code is not always a link.',
      sub: 'Open Wi-Fi networks, pre-written SMS to premium-rate numbers, crypto wallets, two-factor keys. QRavn names what the code actually is.',
    },
    checks: {
      kicker: 'The engine',
      headline: '{{checks}} named checks.\nYou need to know none of them.',
      sub: 'On the address itself, on what the code contains, and on where the link forwards you. The number is counted from the contract the engine runs — not typed into a sentence.',
    },
    privacy: {
      kicker: 'Privacy',
      headline: 'No account. No tracking.\nNo scan history.',
      sub: 'The analyser is WebAssembly running locally. Turn link following off and the app never touches the network at all.',
    },
  },
}
