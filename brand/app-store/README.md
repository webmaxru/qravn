# App Store assets

Everything App Store Connect asks for, where it comes from, and what this app
does not need. The listing copy lives in
[`apps/ios/app-store-listing.md`](../../apps/ios/app-store-listing.md); this
file is only about the images.

Every slot across all three stores, images and text together, is listed in
[`brand/STORE-ASSETS.md`](../STORE-ASSETS.md). Start there when regenerating a
set; this file is the App Store detail behind it.

Validate the whole set at any time:

```
node tools/check-store-images.mjs
```

It reads each PNG's header and checks the size, the weight and the alpha
channel against the slot it is uploaded into. It covers the Play and Microsoft
Store assets in the same run, so one command answers "is anything about to be
rejected".

## The slots

| App Store Connect slot | Required | File |
|---|---|---|
| App icon, 1024×1024 | Yes | `apps/ios/Sources/QravnApp/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png` |
| iPhone 6.9" screenshots, 1320×2868 | Yes | `screenshots/no/`, `screenshots/en-US/` |
| iPhone 6.5" / 6.1" / 5.5" screenshots | No | Apple scales the 6.9" set down |
| iPad screenshots | No | iPhone-only app, see below |
| App previews (video) | No | Not produced |
| Apple Watch, Mac, Vision, TV | No | No such target |

### The icon is not uploaded separately

Since Xcode 14 the 1024×1024 marketing icon ships inside the binary and App
Store Connect reads it from there. There is no upload field for it, and there
is no copy of it in this directory, because a second copy is a second thing to
keep in step.

It is generated, not exported by hand:

```
node tools/gen-ios-appicon.mjs
```

`tools/gen-ios-appicon.mjs` draws it from the same geometry as
[`brand/mark.svg`](../mark.svg) and writes the PNG itself, which is how it
guarantees the three properties Apple rejects submissions over: exactly
1024×1024, **no alpha channel**, and no baked rounded corners. iOS applies its
own corner mask; a transparent pixel inside it renders black, and a pre-rounded
corner shows as a dark seam.

### Only one screenshot size

`apps/ios/project.yml` sets `TARGETED_DEVICE_FAMILY: "1"`. The app is iPhone
only, so App Store Connect never asks for an iPad set. Of the iPhone sizes only
6.9" (1320×2868) is required; Apple derives every smaller display from it.

Up to 10 per language. The first three are visible without scrolling, so they
carry the argument on their own.

| # | File | What it shows |
|---|---|---|
| 1 | `1-lookalike.png` | A verdict on a domain with a Cyrillic а in `apple.com`, findings visible |
| 2 | `2-blocked.png` | A blocked verdict, scrolled to where an open button would have been — there is none |
| 3 | `3-address.png` | The address panel calling out the real host behind `trusted.no@evil.example` |
| 4 | `4-why.png` | The finding list for a raw IP over plain http |
| 5 | `5-clear.png` | The quiet verdict: no known threat found, which is not the same as "safe" |
| 6 | `6-scan.png` | The first screen, with the notice that the analysis stays on the device |

Languages are `no` and `en-US`, matching the listing languages.

## Capturing them

The screenshots come out of the shipping app, driven by a UI test:

```
apps/ios/scripts/capture-store-screenshots.sh
```

**This needs macOS.** Only Apple ships the simulator, so there is no Windows or
Linux path. The development machine for this project is Windows, so the usual
route is the **App Store screenshots** workflow in the Actions tab, which runs
the same script on a hosted Mac and uploads the result as an artifact.

The script builds the Rust core, generates the Xcode project, picks a 6.9"
device, freezes the status bar at 09:41 with a full battery, runs
`apps/ios/Tests/QravnScreenshots/StoreScreenshots.swift` once per language,
strips the alpha channel the simulator writes (`tools/strip-png-alpha.mjs` —
Apple rejects an image carrying one), and then verifies the output with
`tools/check-store-images.mjs`.

Two things worth knowing about the result:

* **Frame 6 shows a viewfinder placeholder.** A simulator has no camera, so the
  app honestly reports that instead of a live preview. Before upload, re-take
  that one on a real device with `xcrun devicectl` or the screenshot button, or
  drop it. Frames 1–5 are the result sheet and are exactly what a phone shows.
* **The payloads are golden test vectors.** Each address in the pictures comes
  from `test-vectors/golden/`, and they are the same ones
  `tools/store-shots/states.mjs` photographs for the Microsoft Store. A verdict
  in a screenshot is therefore one the engine is tested to produce, and the two
  listings cannot disagree about the same address.

None of the payloads is contacted. The engine has no network code, and that is
the product, not an implementation detail.

## What Apple does not have

Google Play wants a 1024×500 feature graphic and Partner Center wants hero art,
poster art and box art. The App Store has no equivalent slot: the listing is the
icon, the screenshots and the text. Promotional artwork for editorial featuring
is requested by Apple separately and is not part of a submission.
