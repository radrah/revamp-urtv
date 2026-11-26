> Replace `$TV` with your TV address, e.g. `TV=192.168.1.50`. Run `export TV=<ip>` first.

# Undo the Navy Home changes (Google TV)

The TV's IP changes sometimes. Find it first (TV: Settings > Network, or run `arp -a`).
The commands below try the likely addresses; edit the list if the TV has a new one.
Wake the TV and accept the "Allow USB debugging" prompt if it appears.

## 0. FIRST re-enable the original launcher (it was disabled so Home would reach Navy Home)
adb -s <ip>:5555 shell pm enable com.google.android.apps.tv.launcherx
adb -s <ip>:5555 shell pm enable com.google.android.tungsten.setupwraith
(then do step 1 below)

## 0b. If only the launcher HOME component was disabled (component-level approach)
adb -s <ip>:5555 shell pm enable com.google.android.apps.tv.launcherx/.home.HomeActivity
adb -s <ip>:5555 shell pm enable com.google.android.apps.tv.launcherx
(then do step 1 below)

## 1. Put the original Google TV home screen back
for ip in $TV; do nc -z -G 2 $ip 5555 && adb connect $ip:5555 && adb -s $ip:5555 shell cmd package set-home-activity com.google.android.apps.tv.launcherx/.home.HomeActivity && echo "Restored on $ip" && break; done

## 2. Remove the Navy Home app completely (do step 1 first)
for ip in $TV; do nc -z -G 2 $ip 5555 && adb connect $ip:5555 && adb -s $ip:5555 uninstall nz.radwan.navylauncher && break; done

## 3. If the TV is stuck on a broken screen
Press Home on the remote, or: adb -s <ip>:5555 shell am start -n com.google.android.apps.tv.launcherx/.home.HomeActivity

## 4. Remove the AirPlay receiver (free open-source app used by the AirPlay tile)
adb -s <ip>:5555 shell pm uninstall io.github.jqssun.airplay   # or: adb -s <ip>:5555 uninstall io.github.jqssun.airplay
(The AirPlay tile will then show "Install receiver". Source: f-droid.org/en/packages/io.github.jqssun.airplay/)

## Facts
- Original home app: com.google.android.apps.tv.launcherx/.home.HomeActivity
- AirPlay receiver app: io.github.jqssun.airplay (GPL-3.0, installed from F-Droid APK)
- Navy Home app: nz.radwan.navylauncher/.MainActivity
- Project: this repository (rebuild with ./build.sh)
- Keep your own backup of the TV settings before changing anything (see the installer)
- When finished, turn off USB/network debugging in the TV's Developer options.

## Notification access + original launcher shutdown (latest)
- Remove Navy Home notification access:
  adb -s $TV:5555 shell cmd notification disallow_listener nz.radwan.navylauncher/nz.radwan.navylauncher.NotifService
- Bring back the original Google launcher (do both):
  adb -s $TV:5555 shell pm enable com.google.android.apps.tv.launcherx
  adb -s $TV:5555 shell pm enable com.google.android.tungsten.setupwraith
  (then step 1 above to make it Home again; native side menu / Settings key return)

## MediaTek auto-pair disabled (side-menu button)
- Bring back the Bluetooth pairing screen on the button beside Home:
  adb -s $TV:5555 shell pm enable com.mediatek.autopair

## Side-menu button accessibility service
- Turn it off:
  adb -s $TV:5555 shell settings delete secure enabled_accessibility_services
  (or uninstall nz.radwan.navylauncher, step 2)
- Re-enable MediaTek auto-pair (was disabled while testing, not needed):
  adb -s $TV:5555 shell pm enable com.mediatek.autopair
