// One-off generator: produces apps/ios Localizable.strings from the Android
// string resources so the two clients cannot drift in wording.
import { readFileSync, writeFileSync } from "node:fs";

const KEYS = [
  "scan_title", "scan_hint", "scan_viewfinder_description", "scan_from_clipboard",
  "scan_analysing", "scan_again",
  "permission_title", "permission_body", "permission_grant", "permission_open_settings",
  "result_destination", "result_why", "result_limitations", "result_no_evidence",
  "result_subject_final", "result_copy", "result_copied", "result_share", "result_cancel",
  "result_open_browser", "result_open_anyway", "result_open_blocked",
  "result_confirm_title", "result_confirm_body", "result_confirm_open", "result_no_browser",
  "error_camera_unavailable", "error_engine_title", "error_engine_body",
  "error_clipboard_empty", "error_shared_unsupported",
  "settings_offline_notice", "settings_engine_version",
];

const SOURCES = {
  en: "apps/android/app/src/main/res/values/strings.xml",
  nb: "apps/android/app/src/main/res/values-nb/strings.xml",
  nn: "apps/android/app/src/main/res/values-nn/strings.xml",
};

// The manual-entry row has no Android counterpart: Android reads the clipboard
// behind a button, iOS gives the user a field. These are therefore authored
// here rather than derived, and Norwegian comes first for the same reason it
// does everywhere else in this product.
const IOS_ONLY = {
  scan_manual_entry_label: {
    nb: "Lenke som skal sjekkes",
    nn: "Lenkje som skal sjekkast",
    en: "Link to check",
  },
  scan_check: {
    nb: "Sjekk",
    nn: "Sjekk",
    en: "Check",
  },
};

function unescapeAndroid(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    // Android positional string args map to Foundation's object specifier.
    .replace(/%(\d+)\$s/g, "%$1$@")
    .replace(/(^|[^%])%s/g, "$1%@")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeStrings(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function parse(path) {
  const xml = readFileSync(path, "utf8");
  const found = new Map();
  const pattern = /<string\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/string>/g;
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    found.set(match[1], unescapeAndroid(match[2]));
  }
  return found;
}

const catalogs = Object.fromEntries(
  Object.entries(SOURCES).map(([locale, path]) => [locale, parse(path)]),
);

const missing = [];
for (const [locale, catalog] of Object.entries(catalogs)) {
  const lines = [
    "/* Generated from apps/android/app/src/main/res by tools/gen-ios-strings.mjs.",
    "   The two clients must say the same thing; edit the Android resource and",
    "   regenerate rather than editing this file. */",
    "",
  ];
  for (const key of KEYS) {
    const value = catalog.get(key);
    if (value === undefined) {
      missing.push(`${locale}:${key}`);
      continue;
    }
    lines.push(`"${key}" = "${escapeStrings(value)}";`);
  }
  lines.push("");
  lines.push("/* iOS-only surface; see IOS_ONLY in the generator. */");
  for (const [key, byLocale] of Object.entries(IOS_ONLY)) {
    lines.push(`"${key}" = "${escapeStrings(byLocale[locale])}";`);
  }
  writeFileSync(
    `apps/ios/Sources/QravnApp/Resources/${locale}.lproj/Localizable.strings`,
    lines.join("\n") + "\n",
    "utf8",
  );
  console.log(`${locale}: ${KEYS.length - missing.filter((m) => m.startsWith(locale + ":")).length} strings`);
}

if (missing.length > 0) {
  console.log("MISSING: " + missing.join(", "));
}
