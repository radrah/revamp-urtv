# Navy Home

A custom Android TV / Google TV launcher built as a WebView app, with a navy and
teal design, a rebuilt TV side menu that floats over any app, weather, a
screensaver and on-TV app editing.

Derived from [CleanFrame](https://github.com/nthnclrk/CleanFrame) (MIT). See
`LICENSE-CleanFrame-MIT`, `THIRD_PARTY_NOTICES.md` and `asset-sources.md` for licences and credits.

## Features
- Home row of apps with editing: hold OK to move, rename or remove; "Add app" tile
- Inputs row: auto-detected PS5 tile (hold OK to choose the port), HDMI inputs, AirPlay, Cast
- Side panel (Guide button) over any app: Picture, Bluetooth, Wi-Fi, Settings, grouped notifications
- Clock, date and weather (Open-Meteo, no key needed), rotating wallpapers and idle screensaver

## Build and install
Needs macOS with Homebrew; `build.sh` installs JDK 17, the Android SDK and Gradle locally.

```
./tv-install.sh              # find the TV on your Wi-Fi, build, install
./tv-install.sh --no-build   # install the last build
```

On the TV: Settings > System > About, tap Build 7 times, then enable network debugging.

## Making it the Home screen (optional, reversible)
Installing does not change Home. Doing so disables the stock launcher packages, which also
removes its native side menu and Home long-press. Read `docs/UNDO.md` first; it lists every
command to put things back.

## Configuration
In `app/src/main/assets/www/app.js`: location (`LAT`/`LON`), idle and wallpaper timings, default apps.

## Notes
- The side-menu button service is an accessibility service; enable it via the install script.
- Notification access is granted with `cmd notification allow_listener` (see the undo doc for how to remove it).
- Tested on a Google TV running Android 11. Other TVs may use different remote key codes.
