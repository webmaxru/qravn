#!/usr/bin/env bash
#
# Captures the App Store screenshots from the shipping app on a 6.9" simulator.
#
#   apps/ios/scripts/capture-store-screenshots.sh
#
# App Store Connect wants one 1320x2868 set per language and scales it down for
# every smaller iPhone, so this runs the QravnScreenshots UI test once per
# listing language and writes the PNGs into brand/app-store/screenshots/.
#
# Why a UI test and not a design file: a listing image that no build has ever
# produced is a Guideline 2.3.3 problem, and it stops being true the first time
# the UI changes. These come out of the same binary a reviewer installs.
#
# Requires macOS with Xcode and xcodegen. There is no Linux or Windows path;
# only Apple ships the simulator. See .github/workflows/store-screenshots.yml
# for the hosted runner that does this without a Mac on the desk.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ios_dir="$(cd "$script_dir/.." && pwd)"
repo_root="$(cd "$ios_dir/../.." && pwd)"
out_root="$repo_root/brand/app-store/screenshots"
derived="$ios_dir/.screenshots"

# App Store locale -> the language the app is launched in, and the POSIX locale
# that goes with it. The app declares nb, nn and en; the listing is published in
# Norwegian and English.
locales=("no:nb:nb_NO" "en-US:en:en_US")

# 6.9" is the only size App Store Connect requires, and these are the device
# types that render it. Preference order, newest first.
device_types=(
  "iPhone 17 Pro Max"
  "iPhone 16 Pro Max"
)
expected_width=1320
expected_height=2868

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "error: $1 is not installed." >&2
    exit 1
  }
}

require xcodebuild
require xcrun
require xcodegen

# The Rust core is the source of every verdict in these pictures, so the
# screenshots are taken against a real engine or not at all.
if [ ! -d "$ios_dir/Frameworks/QravnSafetyFFI.xcframework" ]; then
  echo "==> building the safety core"
  "$script_dir/build-core.sh"
fi

echo "==> generating the Xcode project"
(cd "$ios_dir" && xcodegen generate)

echo "==> choosing a 6.9\" simulator"
udid=""
for device_type in "${device_types[@]}"; do
  # `simctl list devices available` groups by runtime; the name is enough here
  # because every runtime that has this device renders the same pixel size.
  #
  # The `|| true` is load-bearing: under `set -o pipefail` a grep that matches
  # nothing fails the whole pipeline, and under `set -e` that would end the run
  # here instead of trying the next device in the list.
  udid="$(xcrun simctl list devices available \
    | grep -F "$device_type (" \
    | head -n 1 \
    | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/' || true)"
  if [ -n "$udid" ]; then
    echo "    $device_type ($udid)"
    break
  fi
done

if [ -z "$udid" ]; then
  # The device type may be installed without any device of it existing. That is
  # a one-command fix, and doing it here keeps a fresh CI runner working.
  echo "    none exists; creating one"
  runtime="$(xcrun simctl list runtimes --json \
    | /usr/bin/python3 -c 'import json,sys; rs=[r for r in json.load(sys.stdin)["runtimes"] if r.get("isAvailable") and r["identifier"].startswith("com.apple.CoreSimulator.SimRuntime.iOS")]; print(rs[-1]["identifier"] if rs else "")')"
  for identifier in \
    com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max \
    com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro-Max; do
    if [ -n "$runtime" ]; then
      udid="$(xcrun simctl create "QRavn store screenshots" "$identifier" "$runtime" 2>/dev/null || true)"
    fi
    if [ -n "$udid" ]; then
      echo "    created $identifier ($udid)"
      break
    fi
  done
fi

if [ -z "$udid" ]; then
  echo "error: no 6.9\" simulator is installed. Wanted one of:" >&2
  printf '  %s\n' "${device_types[@]}" >&2
  echo "Install one from Xcode > Settings > Components." >&2
  exit 1
fi

xcrun simctl boot "$udid" 2>/dev/null || true
xcrun simctl bootstatus "$udid" -b >/dev/null

# The clock and the battery are the two things in a store screenshot that date
# it. 9:41 is the time Apple has used in its own marketing since 2007.
xcrun simctl status_bar "$udid" override \
  --time "09:41" \
  --batteryState charged \
  --batteryLevel 100 \
  --cellularMode active \
  --cellularBars 4 \
  --wifiMode active \
  --wifiBars 3 \
  --dataNetwork wifi >/dev/null 2>&1 || true

status=0
for entry in "${locales[@]}"; do
  IFS=':' read -r store_locale language posix_locale <<<"$entry"
  out_dir="$out_root/$store_locale"
  result="$derived/$store_locale.xcresult"

  echo "==> capturing $store_locale (app language $language)"
  rm -rf "$out_dir" "$result"
  mkdir -p "$out_dir"

  # xcodebuild forwards a host variable named TEST_RUNNER_X into the test
  # process as X. It is the only supported way to parameterise a test run from
  # the command line without editing the scheme.
  TEST_RUNNER_QRAVN_SCREENSHOT_DIR="$out_dir" \
  TEST_RUNNER_QRAVN_SCREENSHOT_LANGUAGE="$language" \
  TEST_RUNNER_QRAVN_SCREENSHOT_LOCALE="$posix_locale" \
    xcodebuild test \
      -project "$ios_dir/QRavn.xcodeproj" \
      -scheme QravnScreenshots \
      -configuration Debug \
      -destination "id=$udid" \
      -resultBundlePath "$result" \
      -derivedDataPath "$derived/DerivedData" \
      CODE_SIGNING_ALLOWED=NO

  # The test writes straight to the host filesystem, which the simulator can
  # reach. When it cannot, every frame is still in the result bundle.
  if [ -z "$(ls -A "$out_dir" 2>/dev/null)" ]; then
    echo "    no files written directly; exporting from the result bundle"
    xcrun xcresulttool export attachments \
      --path "$result" \
      --output-path "$out_dir" >/dev/null
    if [ -f "$out_dir/manifest.json" ]; then
      # Attachments are exported under generated names; the manifest maps them
      # back to the name the test gave each frame.
      /usr/bin/python3 - "$out_dir" <<'PYTHON'
import json, os, re, sys

directory = sys.argv[1]
with open(os.path.join(directory, "manifest.json"), encoding="utf-8") as handle:
    manifest = json.load(handle)

# Xcode appends an index and a UUID to keep exported names unique. The frame
# name is everything before that, and it is what the listing order depends on.
suffix = re.compile(r"_\d+_[0-9A-Fa-f-]{36}$")

for test in manifest:
    for attachment in test.get("attachments", []):
        exported = attachment.get("exportedFileName")
        name = attachment.get("suggestedHumanReadableName") or ""
        if not exported or not name:
            continue
        stem, _ = os.path.splitext(name)
        stem = suffix.sub("", stem)
        os.replace(
            os.path.join(directory, exported),
            os.path.join(directory, stem + ".png"),
        )

os.remove(os.path.join(directory, "manifest.json"))
PYTHON
    fi
  fi

  shopt -s nullglob
  frames=("$out_dir"/*.png)
  shopt -u nullglob
  if [ ${#frames[@]} -eq 0 ]; then
    echo "error: $store_locale produced no screenshots." >&2
    status=1
    continue
  fi

  # The simulator hands back RGBA. App Store Connect rejects any screenshot
  # carrying an alpha channel, so convert before anything else looks at them.
  node "$repo_root/tools/strip-png-alpha.mjs" "${frames[@]}"

  for frame in "${frames[@]}"; do
    width="$(sips -g pixelWidth "$frame" | awk '/pixelWidth/{print $2}')"
    height="$(sips -g pixelHeight "$frame" | awk '/pixelHeight/{print $2}')"
    if [ "$width" != "$expected_width" ] || [ "$height" != "$expected_height" ]; then
      echo "error: $(basename "$frame") is ${width}x${height}, wanted ${expected_width}x${expected_height}." >&2
      echo "       The simulator is not a 6.9\" device." >&2
      status=1
    fi
  done

  echo "    ${#frames[@]} frames in ${out_dir#"$repo_root/"}"
done

xcrun simctl status_bar "$udid" clear >/dev/null 2>&1 || true

if [ "$status" -ne 0 ]; then
  exit "$status"
fi

echo
echo "==> verifying against the App Store slot rules"
node "$repo_root/tools/check-store-images.mjs"
