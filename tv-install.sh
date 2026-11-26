#!/usr/bin/env bash
# Finds the TV on your network (port 5555), connects, then builds + installs Navy Home.
# Usage: ./tv-install.sh            (build and install)
#        ./tv-install.sh --no-build (install the last build)
set -e
cd "$(dirname "$0")"

LAST_FILE="$HOME/.navy_tv_ip"
SUBNET=$(ipconfig getifaddr en0 2>/dev/null | cut -d. -f1-3)
[ -z "$SUBNET" ] && SUBNET=$(ipconfig getifaddr en1 2>/dev/null | cut -d. -f1-3)
[ -z "$SUBNET" ] && { echo "Could not read your Wi-Fi address. Are you on the same Wi-Fi as the TV?"; exit 1; }

try() { nc -z -G 1 "$1" 5555 >/dev/null 2>&1; }

TV=""
if [ -f "$LAST_FILE" ] && try "$(cat "$LAST_FILE")"; then TV=$(cat "$LAST_FILE"); fi

if [ -z "$TV" ]; then
  echo ">> Looking for the TV on $SUBNET.0/24 ..."
  TMP=$(mktemp)
  for i in $(seq 1 254); do
    ( try "$SUBNET.$i" && echo "$SUBNET.$i" >> "$TMP" ) &
  done
  wait
  TV=$(head -1 "$TMP"); rm -f "$TMP"
fi

[ -z "$TV" ] && { echo "TV not found. Check it is on, on Wi-Fi, and network debugging is enabled."; exit 1; }
echo "$TV" > "$LAST_FILE"
echo ">> TV at $TV"

adb disconnect >/dev/null 2>&1 || true
adb connect "$TV:5555"
D="$TV:5555"

if [ "$1" != "--no-build" ]; then ./build.sh; fi

adb -s "$D" install -r app/build/outputs/apk/debug/app-debug.apk
adb -s "$D" shell am force-stop nz.radwan.navylauncher
SVC=nz.radwan.navylauncher/nz.radwan.navylauncher.KeyService
enable_guide() {
  adb -s "$D" shell "settings put secure enabled_accessibility_services $SVC; settings put secure accessibility_enabled 1"
}
sleep 3
adb -s "$D" shell "settings delete secure enabled_accessibility_services" >/dev/null 2>&1
sleep 1
enable_guide
adb -s "$D" shell am start -n nz.radwan.navylauncher/.MainActivity >/dev/null 2>&1
sleep 4
enable_guide   # set again at the very end so the install can't switch it off
echo ">> Guide button service: $(adb -s "$D" shell settings get secure enabled_accessibility_services)"
echo ">> Done. TV is $D"
