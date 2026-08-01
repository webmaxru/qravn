#!/usr/bin/env bash
#
# Builds the Rust safety core for Apple platforms and packages it as an
# XCFramework the Xcode project links against.
#
# The Rust core is the single source of every verdict; the iOS client is not
# permitted to re-derive one. Building the real binding is therefore part of the
# product contract, not an optimisation, exactly as it is for Android.
#
# An XCFramework rather than a lipo'd archive: device and simulator both build
# arm64 slices, and a single static archive cannot hold two slices for the same
# architecture. XCFramework is the only packaging Apple provides for that.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ios_dir="$(cd "$script_dir/.." && pwd)"
repo_root="$(cd "$ios_dir/../.." && pwd)"
core_dir="$repo_root/core"
headers_dir="$core_dir/bindings/ios/include"
out_dir="$ios_dir/Frameworks"
xcframework="$out_dir/QravnSafetyFFI.xcframework"

package="qravn-safety-ffi"
lib_name="libqravn_safety_ffi.a"
profile="${QRAVN_CARGO_PROFILE:-release}"

device_target="aarch64-apple-ios"
simulator_targets=("aarch64-apple-ios-sim" "x86_64-apple-ios")

# Keep the core's minimum in step with the app target in project.yml. Without
# this the linker warns that the static archive was built for an older iOS than
# the app, on every single object file.
export IPHONEOS_DEPLOYMENT_TARGET="${IPHONEOS_DEPLOYMENT_TARGET:-16.0}"

if ! command -v cargo >/dev/null 2>&1; then
  echo "error: cargo is not installed. See https://rustup.rs" >&2
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "error: xcodebuild is not available. This script requires macOS with Xcode." >&2
  exit 1
fi

ensure_target() {
  local target="$1"
  if ! rustup target list --installed | grep -qx "$target"; then
    echo "Installing Rust target $target"
    rustup target add "$target"
  fi
}

profile_flag=()
if [ "$profile" = "release" ]; then
  profile_flag=(--release)
fi

for target in "$device_target" "${simulator_targets[@]}"; do
  ensure_target "$target"
  echo "Building $package for $target"
  (cd "$core_dir" && cargo build "${profile_flag[@]}" --target "$target" -p "$package")
done

# The two simulator slices differ in architecture, so they can and must be
# merged: Xcode picks one simulator library, not one per architecture.
simulator_lib="$core_dir/target/apple-simulator-$profile/$lib_name"
mkdir -p "$(dirname "$simulator_lib")"
simulator_inputs=()
for target in "${simulator_targets[@]}"; do
  simulator_inputs+=("$core_dir/target/$target/$profile/$lib_name")
done
lipo -create "${simulator_inputs[@]}" -output "$simulator_lib"

device_lib="$core_dir/target/$device_target/$profile/$lib_name"

# The XCFramework ships the C header only. The module map that makes the header
# importable from Swift stays in the repository and is reached through
# SWIFT_INCLUDE_PATHS, so there is exactly one definition of the module and no
# chance of clang finding it twice under two different paths.
staged_headers="$core_dir/target/apple-headers"
rm -rf "$staged_headers"
mkdir -p "$staged_headers"
cp "$headers_dir/qravn_safety.h" "$staged_headers/"

# xcodebuild refuses to overwrite an existing XCFramework.
rm -rf "$xcframework"
mkdir -p "$out_dir"

xcodebuild -create-xcframework \
  -library "$device_lib" -headers "$staged_headers" \
  -library "$simulator_lib" -headers "$staged_headers" \
  -output "$xcframework"

echo "Built $xcframework"
