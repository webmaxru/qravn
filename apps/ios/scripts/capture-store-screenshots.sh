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

# A good run builds and tests a locale in about five minutes. Cut it off at
# twelve, which is generous enough that a slow-but-working runner is never
# mistaken for a wedged one, and short enough that two attempts at both locales
# still fit inside the workflow's step budget.
test_timeout=720
attempts_per_locale=2

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

# A simulator runtime newer than the selected Xcode's SDK is not a supported
# pairing, and it does not announce itself: the test target builds and then
# xcodebuild waits forever without ever starting the test. A hosted runner
# defaults to an older Xcode than its newest runtime, so this is the normal
# case rather than an exotic one. Say so in a second instead of hanging.
sdk_version="$(xcrun --sdk iphonesimulator --show-sdk-version 2>/dev/null || echo 0)"
device_runtime="$(xcrun simctl list devices --json 2>/dev/null \
  | /usr/bin/python3 -c 'import json, re, sys
udid = sys.argv[1]
for identifier, devices in json.load(sys.stdin)["devices"].items():
    if any(d.get("udid") == udid for d in devices):
        match = re.search(r"iOS-(\d+)-(\d+)$", identifier)
        print(f"{match.group(1)}.{match.group(2)}" if match else "")
        break
else:
    print("")' "$udid")"

if [ -n "$device_runtime" ] && [ "${device_runtime%%.*}" -gt "${sdk_version%%.*}" ]; then
  echo "error: the simulator runs iOS $device_runtime but the selected Xcode" >&2
  echo "       only has the iOS $sdk_version SDK. xcodebuild hangs on that" >&2
  echo "       pairing rather than refusing it." >&2
  echo "       Select a newer Xcode with xcode-select, or install a 6.9\"" >&2
  echo "       device on a runtime this Xcode supports." >&2
  xcodebuild -version >&2
  exit 1
fi
echo "    iOS $device_runtime against the iOS $sdk_version SDK"

# macOS ships no `timeout`, and anything that talks to CoreSimulator can wedge.
# Run it in the background and shoot it if it overruns. `set -m` puts the child
# in its own process group so the kill reaches what it spawned too: xcodebuild
# leaves simulator helpers behind, and a survivor would sabotage the retry.
run_with_timeout() {
  local limit="$1"
  shift
  set -m
  "$@" &
  local pid=$!
  set +m
  local waited=0
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$waited" -ge "$limit" ]; then
      kill -9 -"$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      return 124
    fi
    sleep 2
    waited=$((waited + 2))
  done
  wait "$pid"
}

device_state() {
  xcrun simctl list devices --json 2>/dev/null \
    | /usr/bin/python3 -c 'import json, sys
udid = sys.argv[1]
groups = json.load(sys.stdin)["devices"]
print(next((d.get("state", "Unknown") for g in groups.values() for d in g if d.get("udid") == udid), "Unknown"))' \
      "$udid"
}

# `simctl bootstatus -b` is the documented way to wait for this and it does not
# work on a hosted runner: when the device is already booted it waits on a
# transition that has finished and never returns. The first run of this workflow
# spent 59 minutes inside it while `simctl list` reported the device Booted the
# whole time. Poll the state instead, which is what that evidence showed to be
# both accurate and cheap.
boot_simulator() {
  echo "==> waiting for the simulator to boot"
  run_with_timeout 120 xcrun simctl boot "$udid" >/dev/null 2>&1 || true

  local boot_deadline=$((SECONDS + 300))
  while [ "$(device_state)" != "Booted" ]; do
    if [ "$SECONDS" -ge "$boot_deadline" ]; then
      echo "error: the simulator did not reach Booted within 300s." >&2
      xcrun simctl list devices 2>/dev/null | grep -F "$udid" >&2 || true
      return 1
    fi
    sleep 5
  done

  # Booted says the device is running, not that launchd inside it is answering.
  # Best effort only: xcodebuild waits for readiness too, so a slow probe is
  # worth a note and not a failed run.
  local ready_deadline=$((SECONDS + 180))
  until run_with_timeout 20 xcrun simctl spawn "$udid" launchctl print system >/dev/null 2>&1; do
    if [ "$SECONDS" -ge "$ready_deadline" ]; then
      echo "    booted, but launchd did not answer within 180s; continuing anyway"
      break
    fi
    sleep 5
  done
  echo "    booted"

  # The clock and the battery are the two things in a store screenshot that date
  # it. 9:41 is the time Apple has used in its own marketing since 2007. Set
  # here rather than once at the top so a recycled device is dressed again.
  xcrun simctl status_bar "$udid" override \
    --time "09:41" \
    --batteryState charged \
    --batteryLevel 100 \
    --cellularMode active \
    --cellularBars 4 \
    --wifiMode active \
    --wifiBars 3 \
    --dataNetwork wifi >/dev/null 2>&1 || true
}

# Throw the device away and bring up a clean one. Used between attempts, because
# the failure this recovers from leaves the simulator in the state that caused
# it.
recycle_simulator() {
  echo "    recycling the simulator"
  run_with_timeout 120 xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true
  run_with_timeout 120 xcrun simctl erase "$udid" >/dev/null 2>&1 || true
  boot_simulator
}

boot_simulator || exit 1

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
  #
  # Bounded and retried, because the interesting failure here is not a failing
  # test but a silent one: roughly one run in two, xcodebuild finishes building
  # and then never prints "Testing started", because installing or launching on
  # the simulator wedged. -maximum-test-execution-time-allowance does not cover
  # that, since no test has begun. A capture that hangs costs the whole job, and
  # the same commit succeeds on the next run, so retry on a clean device.
  attempt=1
  captured=0
  while [ "$attempt" -le "$attempts_per_locale" ]; do
    if [ "$attempt" -gt 1 ]; then
      echo "    attempt $attempt of $attempts_per_locale"
    fi

    set +e
    run_with_timeout "$test_timeout" \
      env TEST_RUNNER_QRAVN_SCREENSHOT_DIR="$out_dir" \
          TEST_RUNNER_QRAVN_SCREENSHOT_LANGUAGE="$language" \
          TEST_RUNNER_QRAVN_SCREENSHOT_LOCALE="$posix_locale" \
        xcodebuild test \
          -project "$ios_dir/QRavn.xcodeproj" \
          -scheme QravnScreenshots \
          -configuration Debug \
          -destination "id=$udid,arch=arm64" \
          -resultBundlePath "$result" \
          -derivedDataPath "$derived/DerivedData" \
          -test-timeouts-enabled YES \
          -maximum-test-execution-time-allowance 900 \
          CODE_SIGNING_ALLOWED=NO
    rc=$?
    set -e

    if [ "$rc" -eq 0 ]; then
      captured=1
      break
    fi

    if [ "$rc" -eq 124 ]; then
      echo "    no test output for ${test_timeout}s; the simulator wedged before the test ran" >&2
    else
      echo "    xcodebuild exited $rc" >&2
    fi

    attempt=$((attempt + 1))
    if [ "$attempt" -le "$attempts_per_locale" ]; then
      rm -rf "$out_dir" "$result"
      mkdir -p "$out_dir"
      recycle_simulator || true
    fi
  done

  if [ "$captured" -ne 1 ]; then
    echo "error: $store_locale did not capture after $attempts_per_locale attempts." >&2
    status=1
    continue
  fi

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
