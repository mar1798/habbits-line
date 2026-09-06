#!/usr/bin/env bash
#
# Prepares the simulator for the App Store screenshot set and takes one frame.
#
# It cannot walk the tabs by itself, and the reason is worth writing down: iOS 26 puts a
# system "Открыть в приложении?" alert over any custom-scheme URL, `simctl openurl`
# included. The URL is delivered and the app does navigate — the alert just sits on top of
# the frame, and there is no way to dismiss it (synthetic taps do not work in the
# simulator, and the alert ignores the hardware Escape key).
#
# So the tab is set from code instead, over Fast Refresh, the way AGENTS.md prescribes for
# any state a deep link cannot reach. That needs a Debug build — a Release build has no
# Metro connection to refresh from. A Debug build renders the screens identically; what it
# adds (the dev menu) is not on screen and not in the frame.
#
# The whole run, once per release:
#
#   npx expo run:ios --device "iPhone 17 Pro Max"     # Debug, with Metro up
#   ./scripts/screenshots.sh prepare                  # seed + plant + pin the status bar
#
#   # then, for each of the four tabs, in src/app/(tabs)/_layout.tsx:
#   #   1. add, inside TabsLayout:  useEffect(() => { router.replace('/stats') }, [])
#   #      (import { router } from 'expo-router' and { useEffect } from 'react')
#   #   2. save, wait for Fast Refresh
#   #   3. ./scripts/screenshots.sh shoot 03-stats
#   #   4. change the route, repeat: '/' -> 01-habits, '/expenses' -> 02-expenses,
#   #      '/stats' -> 03-stats, '/settings' -> 04-settings
#   # finally:  git checkout "src/app/(tabs)/_layout.tsx"
#
#   ./scripts/screenshots.sh finish                   # release the status bar override
#
# Usage: scripts/screenshots.sh <prepare|shoot <name>|finish> [device-name]
set -euo pipefail

MODE="${1:?usage: screenshots.sh <prepare|shoot <name>|finish> [device]}"
BUNDLE_ID="com.mar1798.habbits-line"
OUT_DIR="assets/store/screenshots"
# 6.9" is the only iPhone size the App Store requires; this device produces it natively.
EXPECTED_SIZE="1320x2868"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

case "$MODE" in
  shoot) NAME="${2:?usage: screenshots.sh shoot <name>}"; DEVICE="${3:-iPhone 17 Pro Max}" ;;
  *)     DEVICE="${2:-iPhone 17 Pro Max}" ;;
esac

log() { printf '  %s\n' "$*"; }

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
    log "device: $DEVICE ($UDID)"
    xcrun simctl boot "$UDID" 2>/dev/null || true
    xcrun simctl bootstatus "$UDID" -b >/dev/null

    # Seed first, then plant: the app must not be running while its database is replaced.
    xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
    node scripts/seed-demo-db.mjs .expo/demo/habits.db
    CONTAINER="$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data)"
    mkdir -p "$CONTAINER/Documents/SQLite"
    rm -f "$CONTAINER/Documents/SQLite/habits.db" \
          "$CONTAINER/Documents/SQLite/habits.db-wal" \
          "$CONTAINER/Documents/SQLite/habits.db-shm"
    cp .expo/demo/habits.db "$CONTAINER/Documents/SQLite/habits.db"
    log "demo database planted"

    # The status bar is in every frame, so it is pinned rather than left to show whatever
    # the host machine's clock and battery happen to be.
    xcrun simctl status_bar "$UDID" override \
      --time "09:41" --batteryState charged --batteryLevel 100 \
      --cellularMode active --cellularBars 4 --wifiMode active --wifiBars 3

    xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null
    mkdir -p "$OUT_DIR"
    log "ready — set the tab in (tabs)/_layout.tsx, then: $0 shoot <name>"
    ;;

  shoot)
    xcrun simctl io "$UDID" screenshot --type=png "$OUT_DIR/$NAME.png" >/dev/null
    width="$(sips -g pixelWidth "$OUT_DIR/$NAME.png" | awk '/pixelWidth/ {print $2}')"
    height="$(sips -g pixelHeight "$OUT_DIR/$NAME.png" | awk '/pixelHeight/ {print $2}')"
    if [ "${width}x${height}" != "$EXPECTED_SIZE" ]; then
      echo "  !! $NAME.png is ${width}x${height}, expected $EXPECTED_SIZE — wrong device?" >&2
      exit 1
    fi
    log "$NAME.png  ${width}x${height}"
    ;;

  finish)
    xcrun simctl status_bar "$UDID" clear
    log "status bar released — do not forget: git checkout \"src/app/(tabs)/_layout.tsx\""
    ;;

  *) echo "unknown mode: $MODE" >&2; exit 1 ;;
esac
