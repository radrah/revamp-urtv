#!/bin/bash
# Builds the Navy Home launcher APK on macOS. Installs missing tools via Homebrew.
set -e
cd "$(dirname "$0")"
command -v brew >/dev/null || { echo "Homebrew is required: https://brew.sh"; exit 1; }

# 1) JDK 17+
if ! JH=$(/usr/libexec/java_home -v 17+ 2>/dev/null); then
  echo ">> Installing JDK 17 (Temurin)"; brew install --cask temurin@17
  JH=$(/usr/libexec/java_home -v 17+)
fi
export JAVA_HOME="$JH"

# 2) Android SDK
if [ -z "$ANDROID_HOME" ]; then
  if [ -d "$HOME/Library/Android/sdk" ]; then ANDROID_HOME="$HOME/Library/Android/sdk"
  else ANDROID_HOME="$HOME/android-sdk"; fi
fi
export ANDROID_HOME
SDKM="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
if [ ! -x "$SDKM" ]; then
  echo ">> Installing Android command-line tools"
  brew list --cask android-commandlinetools >/dev/null 2>&1 || brew install --cask android-commandlinetools
  SRC="$(brew --prefix)/share/android-commandlinetools/cmdline-tools/latest"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  [ -e "$ANDROID_HOME/cmdline-tools/latest" ] || ln -s "$SRC" "$ANDROID_HOME/cmdline-tools/latest"
fi
if [ ! -d "$ANDROID_HOME/platforms/android-34" ] || [ ! -d "$ANDROID_HOME/build-tools/34.0.0" ]; then
  echo ">> Installing SDK platform 34 + build tools"
  yes | "$SDKM" --sdk_root="$ANDROID_HOME" --licenses >/dev/null || true
  "$SDKM" --sdk_root="$ANDROID_HOME" "platforms;android-34" "build-tools;34.0.0" "platform-tools"
fi
echo "sdk.dir=$ANDROID_HOME" > local.properties

# 3) Gradle 8.7 (downloaded locally, no global install)
GV=8.7
if [ ! -x ".gradle-dist/gradle-$GV/bin/gradle" ]; then
  echo ">> Downloading Gradle $GV"
  mkdir -p .gradle-dist
  curl -fsSL "https://services.gradle.org/distributions/gradle-$GV-bin.zip" -o .gradle-dist/g.zip
  unzip -q -o .gradle-dist/g.zip -d .gradle-dist && rm .gradle-dist/g.zip
fi

echo ">> Building"
".gradle-dist/gradle-$GV/bin/gradle" --no-daemon :app:assembleDebug
APK=app/build/outputs/apk/debug/app-debug.apk
echo; echo "Built: $(pwd)/$APK"; ls -lh "$APK"
