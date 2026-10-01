#!/usr/bin/env bash
#
# Prepares the simulator for the App Store screenshot set and takes one frame.
#
# It cannot walk the tabs by itself, and the reason is worth writing down: iOS 26 puts a
# system "Открыть в приложении?" alert over any custom-scheme URL, `simctl openurl`
# included. The URL is delivered and the app does navigate — the alert just sits on top of
# the frame, and there is no way to dismiss it (it ignores the hardware Escape key).
#
# So the tab is switched with a tap in the Simulator window. Taps synthesized through
# AppleScript or CGEvent do not reach the simulator, so where no one can tap, the tab is
# set from code instead, over Fast Refresh, the way AGENTS.md prescribes for any state a
# deep link cannot reach. That needs a Debug build — a Release build has no Metro
# connection to refresh from. A Debug build renders the screens identically; what it adds
# (the dev menu) is not on screen and not in the frame.
#
# The whole run, once per release:
#
#   npx expo run:ios --device "iPhone 17 Pro Max"     # Debug, with Metro up
#   ./scripts/screenshots.sh prepare ru               # seed + plant + pin the status bar
#
#   # then, for each of the four tabs: tap it, let it settle, and
#   #   ./scripts/screenshots.sh shoot 03-stats ru
#   # in this order: 01-habits, 02-expenses, 03-stats, 04-settings.
#   # Where no one can tap, in src/app/(tabs)/_layout.tsx instead:
#   #   1. add, inside TabsLayout:  useEffect(() => { router.replace('/stats') }, [])
#   #      (import { router } from 'expo-router' and { useEffect } from 'react')
#   #   2. save, wait for Fast Refresh, shoot
#   #   3. change the route, repeat: '/' -> 01-habits, '/expenses' -> 02-expenses,
#   #      '/stats' -> 03-stats, '/settings' -> 04-settings
#   #   finally:  git checkout "src/app/(tabs)/_layout.tsx"
#
#   ./scripts/screenshots.sh finish                   # release the status bar override
#
#   # then the same four frames again for the other language:
#   ./scripts/screenshots.sh prepare en
#   ...
#   ./scripts/screenshots.sh shoot 03-stats en
#
# The App Store wants a set per localization, so every run is for one language: `prepare`
# seeds the database in it and the frames land in `assets/store/screenshots/<language>/`.
# Doing the other language means running `prepare` again — the language is a row in the
# database, and it is read once at launch.
#
# Usage: scripts/screenshots.sh <prepare|shoot <name>|finish> [ru|en] [device-name]
set -euo pipefail

MODE="${1:?usage: screenshots.sh <prepare|shoot <name>|finish> [ru|en] [device]}"
BUNDLE_ID="com.dastan.habbitsline"
OUT_DIR="assets/store/screenshots"
# 6.9" is the size this device produces natively. App Store Connect's iPhone tab, though,
# takes only the 6.5" sizes (1242 × 2688 or 1284 × 2778) and refuses this one, so every
# frame also gets a 6.5" copy, scaled down from it, in `<language>-6.5/`.
EXPECTED_SIZE="1320x2868"
SIZE_65="1284x2778"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

case "$MODE" in
  shoot) NAME="${2:?usage: screenshots.sh shoot <name> [ru|en]}"
         LANGUAGE="${3:-ru}"; DEVICE="${4:-iPhone 17 Pro Max}" ;;
  *)     LANGUAGE="${2:-ru}"; DEVICE="${3:-iPhone 17 Pro Max}" ;;
esac

case "$LANGUAGE" in
  ru|en) ;;
  *) echo "unknown language: $LANGUAGE (expected ru or en)" >&2; exit 1 ;;
esac

OUT_DIR_65="$OUT_DIR/$LANGUAGE-6.5"
OUT_DIR="$OUT_DIR/$LANGUAGE"

log() { printf '  %s\n' "$*"; }

# Fails unless the file is exactly the given size and carries no alpha channel — the two
# things App Store Connect checks on upload.
check_frame() {
  local file="$1" expected="$2" width height
  width="$(sips -g pixelWidth "$file" | awk '/pixelWidth/ {print $2}')"
  height="$(sips -g pixelHeight "$file" | awk '/pixelHeight/ {print $2}')"
  if [ "${width}x${height}" != "$expected" ]; then
    echo "  !! $file is ${width}x${height}, expected $expected — wrong device?" >&2
    exit 1
  fi
  if [ "$(sips -g hasAlpha "$file" | awk '/hasAlpha/ {print $2}')" != "no" ]; then
    echo "  !! $file still has an alpha channel — App Store Connect will refuse it" >&2
    exit 1
  fi
}

# Resolved from simctl's JSON rather than parsed out of its table: the table's shape has
# changed between Xcode releases, the JSON has not.
UDID="$(xcrun simctl list devices -j | python3 -c '
import json, sys
name = sys.argv[1]
for devices in json.load(sys.stdin)["devices"].values():
    for device in devices:
        if device["name"] == name and device.get("isAvailable", True):
            print(device["udid"])
            raise SystemExit
raise SystemExit(f"no available simulator named {name!r}")
' "$DEVICE")"

case "$MODE" in
  prepare)
    log "device: $DEVICE ($UDID), language: $LANGUAGE"
    xcrun simctl boot "$UDID" 2>/dev/null || true
    xcrun simctl bootstatus "$UDID" -b >/dev/null

    # Seed first, then plant: the app must not be running while its database is replaced.
    xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
    node scripts/seed-demo-db.mjs ".expo/demo/habits-$LANGUAGE.db" "$LANGUAGE"
    CONTAINER="$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data)"
    mkdir -p "$CONTAINER/Documents/SQLite"
    rm -f "$CONTAINER/Documents/SQLite/habits.db" \
          "$CONTAINER/Documents/SQLite/habits.db-wal" \
          "$CONTAINER/Documents/SQLite/habits.db-shm"
    cp ".expo/demo/habits-$LANGUAGE.db" "$CONTAINER/Documents/SQLite/habits.db"
    log "demo database planted"

    # The status bar is in every frame, so it is pinned rather than left to show whatever
    # the host machine's clock and battery happen to be.
    xcrun simctl status_bar "$UDID" override \
      --time "09:41" --batteryState charged --batteryLevel 100 \
      --cellularMode active --cellularBars 4 --wifiMode active --wifiBars 3

    xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null
    mkdir -p "$OUT_DIR" "$OUT_DIR_65"
    log "ready — open a tab (tap it, or set it in (tabs)/_layout.tsx), then: $0 shoot <name> $LANGUAGE"
    ;;

  shoot)
    # Two detours on the way to the file, both forced:
    # - simctl hands the write to CoreSimulator, and macOS privacy protection does not let
    #   that service into a project under ~/Desktop or ~/Documents ("You don't have
    #   permission to save the file"), so the frame lands in a temporary folder first;
    # - the frame comes out RGBA, and App Store Connect refuses screenshots with an alpha
    #   channel. sips cannot drop the channel directly, but a round trip through JPEG at
    #   the best quality does, and the deviation (a few levels out of 255) is invisible.
    TMP_DIR="$(mktemp -d)"
    xcrun simctl io "$UDID" screenshot --type=png "$TMP_DIR/frame.png" >/dev/null
    sips -s format jpeg -s formatOptions best "$TMP_DIR/frame.png" --out "$TMP_DIR/frame.jpg" >/dev/null
    sips -s format png "$TMP_DIR/frame.jpg" --out "$OUT_DIR/$NAME.png" >/dev/null
    rm -rf "$TMP_DIR"
    check_frame "$OUT_DIR/$NAME.png" "$EXPECTED_SIZE"

    # The 6.5" copy: scaled evenly to 1284 wide, which comes out 2789 tall, then cut to
    # 2778 around the middle (sips centers the crop) — five or six rows of plain background
    # off each edge, nothing of the app. Stretching straight to 1284 × 2778 would squash
    # the frame instead, the two sizes are not quite the same shape.
    mkdir -p "$OUT_DIR_65"
    sips --resampleWidth 1284 "$OUT_DIR/$NAME.png" --out "$OUT_DIR_65/$NAME.png" >/dev/null
    sips --cropToHeightWidth 2778 1284 "$OUT_DIR_65/$NAME.png" --out "$OUT_DIR_65/$NAME.png" >/dev/null
    check_frame "$OUT_DIR_65/$NAME.png" "$SIZE_65"
    log "$NAME.png  $EXPECTED_SIZE, and $SIZE_65 in $OUT_DIR_65/"
    ;;

  finish)
    xcrun simctl status_bar "$UDID" clear
    log "status bar released — if the tab was set in code: git checkout \"src/app/(tabs)/_layout.tsx\""
    ;;

  *) echo "unknown mode: $MODE" >&2; exit 1 ;;
esac
