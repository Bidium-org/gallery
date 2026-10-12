#!/bin/sh
# Installs or updates Gallery from the latest GitHub release. Run it again to update.
#
#   curl -fsSL https://raw.githubusercontent.com/Bidium-org/gallery/main/install.sh | sh
set -eu

dmg_url="https://github.com/Bidium-org/gallery/releases/latest/download/Gallery-darwin-arm64.dmg"
app_dir="/Applications"
app="$app_dir/Gallery.app"

fail() {
  printf 'gallery install: %s\n' "$1" >&2
  exit 1
}

[ "$(uname -s)" = Darwin ] || fail "macOS only."
[ "$(uname -m)" = arm64 ] || fail "Apple Silicon only, there is no Intel build yet."
[ -w "$app_dir" ] || fail "$app_dir is not writable by $(id -un)."
if pgrep -f "$app/Contents/MacOS/Gallery" >/dev/null; then
  fail "Gallery is running. Quit it, then run this again."
fi

tmp="$(mktemp -d)"
mount="$tmp/mount"
cleanup() {
  hdiutil detach "$mount" -quiet 2>/dev/null || true
  rm -rf "$tmp"
}
trap cleanup EXIT

printf 'Downloading Gallery...\n'
curl -fL --progress-bar "$dmg_url" -o "$tmp/Gallery.dmg" || fail "download failed."
hdiutil attach "$tmp/Gallery.dmg" -nobrowse -readonly -quiet -mountpoint "$mount" ||
  fail "could not open the DMG."

rm -rf "$app"
ditto "$mount/Gallery.app" "$app"

version="$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$app/Contents/Info.plist")"
printf 'Installed Gallery %s in %s.\n' "$version" "$app_dir"
command -v jq >/dev/null 2>&1 ||
  printf 'The agent CLI needs jq, which this macOS lacks: brew install jq\n'
