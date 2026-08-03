# Microsoft Store listing assets

Everything the Partner Center listing for the QRavn PWA asks for, as PNG, at the
sizes it asks for. Nothing here is uploaded automatically; a human picks the
files in Partner Center.

The words that go with them are in [`store-listing.md`](store-listing.md) —
product name, description, the 20 product features, and search terms, in both
listing languages. `node tools/check-store-listings.mjs` proves every field is
inside its Partner Center limit before anyone starts filling in the form.

Every slot across all three stores, images and text together, is listed in
[`brand/STORE-ASSETS.md`](../STORE-ASSETS.md). Start there when regenerating a
set; this file is the Partner Center detail behind it.

Two generators produce this directory, and both are reproducible:

```
# Screenshots: drives the real app in a browser and composes the branded frames.
node tools/store-shots/capture.mjs

# Logo and hero art: writes the SVG sources, then rasterises them.
node tools/store-shots/write-store-art.mjs
npm --prefix tools/brand-render install   # first run only
npm --prefix tools/brand-render run render
```

The SVG files in this directory are sources, not deliverables. Edit
`tools/store-shots/write-store-art.mjs` rather than the SVGs, or the next run
will overwrite you.

## Screenshots

`screenshots/nb-NO/` and `screenshots/en-US/`, nine each, 1920x1080 PNG. The
Store allows thirty files at 1366x768 or larger; these are well inside both.

They are photographs of the running app, not mockups. `capture.mjs` starts the
dev server, drives the shipping `?url=` link channel with payloads taken from
`test-vectors/golden/`, and screenshots the result inside a window frame drawn
in the app's own palette. The captions sit on the branded backdrop beside it,
and every claim a caption makes is visible in the same frame.

| File | Shows |
| --- | --- |
| `01-scan` | The scan screen, before anything has been read. |
| `02-clear` | A verdict with no findings — the wording that is deliberately not "safe". |
| `03-lookalike` | A host spelled with a Cyrillic а, named as such. |
| `04-credentials` | `trusted.no@evil.example`, and why the part before the @ is not the destination. |
| `05-blocked` | A `javascript:` payload, refused. |
| `06-redirect` | An opted-in redirect expansion, ending on a lookalike bank subdomain. |
| `07-payload` | A Wi-Fi code: a QR code that is not a link at all. |
| `08-checks` | The tally of named checks, by group. |
| `09-privacy` | Settings, in dark mode: no account, no history, offline by default. |

Two product invariants shaped the capture rig, and both are enforced in code:

- The device never contacts a scanned destination. `capture.mjs` intercepts
  every request the page makes and aborts the ones bound for a host that
  appears in these frames, so even the screenshot run cannot reach one. The
  redirect frame is served by a stub that replays a golden vector.
- No screenshot shows an unqualified "Safe". The clear-verdict frame exists
  specifically to put the real wording in front of a customer before they
  install.

The caption on `08-checks` quotes how many checks the engine runs. That number
is read from `contracts/v1/finding-codes.json` at render time, never typed, so
**re-run `capture.mjs` after any change to the finding-code registry** or the
listing will understate the engine. `tools/check-claimed-checks.mjs` guards the
text surfaces; it cannot read a number baked into a PNG.

## Store display logos

`logos/`, PNG, all far under the 5 MB limit.

The three square tiles come from `store-logo.svg` — mark only, no name, because
at 71px a wordmark is a smudge:

| File | Slot |
| --- | --- |
| `app-tile-icon-300x300.png` | App tile icon, 1:1 |
| `store-logo-150x150.png` | Store display logo, 1:1 |
| `store-logo-71x71.png` | Store display logo, 1:1 |

Poster and box art are the other half of the same Store logos section, and they
are logos rather than banners: the Store uses poster art as the **main logo**
for Windows 10/11 customers and requires it for Xbox, falling back to box art
when poster art is absent. Both are large enough to carry the name, so they do:

| File | Slot | Source |
| --- | --- | --- |
| `poster-art-720x1080.png` | Poster art | `poster-art.svg` |
| `poster-art-1440x2160.png` | Poster art, 2x | `poster-art.svg` |
| `box-art-1080x1080.png` | Box art, 1:1 | `box-art.svg` |
| `box-art-2160x2160.png` | Box art, 1:1, 2x | `box-art.svg` |

Partner Center labels the poster slot **9:16**, but the two sizes it asks for —
720×1080 and 1440×2160 — are **2:3**. The pixel dimensions are what is validated
at upload, so these are drawn 2:3 and the ratio label is ignored.

`box-art-1080x1080.png` and `hero/xbox-featured-promotional-square-1080x1080.png`
are the same size and are not interchangeable: box art is a logo and carries the
name, while the featured promotional square is required to carry no title at
all.

Unlike `brand/app-icon.svg` none of these are rounded tiles. The Store draws
them on both light and dark listing surfaces and applies no mask of its own, so
transparent corners would sit on whatever colour the page happened to be.

Uploading the three square tiles is optional — the Store falls back to the logos
inside the package. They exist so the listing does not depend on which packaging
path a release took. Poster art is not optional if the product should display
correctly on Xbox.

## Hero art

`hero/`, 16:9 and the Xbox shapes, PNG, all far under the 50 MB limit.

| File | Slot | Title rule |
| --- | --- | --- |
| `super-hero-1920x1080.png` | Super hero art | Must not carry the title |
| `super-hero-3840x2160.png` | Super hero art, 4K | Must not carry the title |
| `xbox-branded-key-art-584x800.png` | Xbox branded key art | Title, in the top 3/4 |
| `xbox-titled-hero-art-1920x1080.png` | Xbox titled hero art | Title, in the top 3/4 |
| `xbox-featured-promotional-square-1080x1080.png` | Xbox featured promotional square art | Must not carry the title |

The two assets that must not carry the title carry only the mark and the
viewfinder. The two that must carry it hold the whole lockup above the
three-quarter line, leaving the bottom quarter empty for the Store's own text
overlay.

None of the five carries a tagline, which keeps them language-neutral: the
Norwegian and the English listing share one set. The super hero composition
sits right of centre because the Store lays the title, publisher and buttons
over the left of that band.

The viewfinder is drawn with three corners and never a fourth, for the reason
`apps/web/src/App.css` gives for drawing it that way in the app: a closed box
would say the loop completes, and this product never closes it by opening
anything for you.
