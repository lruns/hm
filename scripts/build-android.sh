#!/usr/bin/env bash
# Happy Math — build a release .aab/.apk for Google Play in one command.
#
#   ./scripts/build-android.sh              # release: signed .aab + .apk
#   ./scripts/build-android.sh --no-internet # the same, but WITHOUT the INTERNET permission
#   ./scripts/build-android.sh --check       # plus the bundletool checks
#   ./scripts/build-android.sh --clean       # with a full wipe of the gradle build cache
#
# What the machine needs (installed once, all inside the home folder, no sudo):
#   ~/tools/jdk-21 (Mac) or ~/tools/jdk-21.0.12+8 (WSL) — Temurin JDK 21 (api.adoptium.net)
#   ~/tools/android-sdk (Mac) or ~/Android/sdk (WSL) — cmdline-tools + platform-tools + platforms;android-36
#                                   + build-tools;36.0.0 (sdkmanager)
#   ~/tools/bundletool.jar        — for --check (github.com/google/bundletool)
#   ~/keys/happymath/keystore.properties — the signing key (OUTSIDE the repo!)
# Install order: JDK 21, Android cmdline-tools, then `sdkmanager "platform-tools" "build-tools;36.0.0" "platforms;android-36"`.
set -euo pipefail

HM_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRATCH="${TMPDIR:-/tmp}/hm-android-check"

NO_INTERNET=0
DO_CHECK=0
DO_CLEAN=0
for a in "$@"; do
  case "$a" in
    --no-internet) NO_INTERNET=1 ;;
    --check)       DO_CHECK=1 ;;
    --clean)       DO_CLEAN=1 ;;
    -h|--help)     sed -n '2,20p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "неизвестный аргумент: $a" >&2; exit 2 ;;
  esac
done

# --- environment ---------------------------------------------------------------
if [ -f "$HOME/tools/android-env.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/tools/android-env.sh"
fi
# Mac (now) and WSL (as it used to be): take the first path that exists.
for d in "$HOME/tools/jdk-21/Contents/Home" "$HOME/tools/jdk-21" "$HOME/tools/jdk-21.0.12+8"; do
  [ -n "${JAVA_HOME:-}" ] && "${JAVA_HOME}/bin/javac" -version 2>&1 | grep -qE "javac (1[7-9]|2[0-9])" && break  # inherited JDK only if 17+ (the Mac shell exports Zulu 8)
  [ -x "$d/bin/javac" ] && JAVA_HOME="$d" || :
done
for d in "$HOME/tools/android-sdk" "$HOME/Android/sdk" "$HOME/Library/Android/sdk"; do
  [ -n "${ANDROID_HOME:-}" ] && break
  [ -d "$d/platform-tools" ] && ANDROID_HOME="$d" || :
done
export JAVA_HOME ANDROID_HOME
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
export PATH="${JAVA_HOME:-}/bin:$PATH"
: "${JAVA_HOME:?JAVA_HOME не задан — нет JDK 21. См. РЕЛИЗ-google-play.md §1}"
: "${ANDROID_HOME:?ANDROID_HOME не задан — нет Android SDK. См. РЕЛИЗ-google-play.md §1}"

KS_PROPS="${HM_KEYSTORE_PROPS:-$HOME/keys/happymath/keystore.properties}"
if [ ! -f "$KS_PROPS" ]; then
  echo "!! Нет $KS_PROPS — сборка выйдет БЕЗПОДПИСНОЙ, Play такую не примет." >&2
  echo "   Ключ и пароли: ~/keys/happymath/ (см. ПАРОЛИ.txt)." >&2
fi

echo "== версия из android/app/build.gradle:"
grep -E '^\s*version(Code|Name)' "$HM_ROOT/android/app/build.gradle"

# --- web build + sync --------------------------------------------------------------
echo "== 1/3 vite build (HM_RELEASE=1 HM_LOOPS=1) + cap sync android"
cd "$HM_ROOT"
npm run sync:release

# ── PRE-RENDERED MUSIC LOOPS ─────────────────────────────────────────────────
# On a phone the music is played from pre-rendered loops, not live synthesis
# (Andrey about live synthesis on a phone: «звук плавает»). They do NOT go into the
# web build: only HM_LOOPS=1 lets them into dist, and it is set by the sync:release
# npm script above. Here we just check they arrived: without them the game silently
# falls back to live synthesis.
LOOPS_DIST="$HM_ROOT/dist/музыка-лупы"
if [ -d "$LOOPS_DIST" ]; then
  echo "   лупы музыки: $(find "$LOOPS_DIST" -name '*.ogg' | wc -l | tr -d ' ') файлов, $(du -sh "$LOOPS_DIST" | cut -f1)"
else
  echo "!! В dist НЕТ папки музыка-лупы — на телефоне музыка уедет на живой синтез." >&2
  echo "   Испеки её один раз: npm run loops   (≈4 минуты, 15 МБ в public/музыка-лупы/)" >&2
fi

# --- gradle ------------------------------------------------------------------
GRADLE_ARGS=(--no-daemon "-Dorg.gradle.jvmargs=-Xmx2g")
[ "$NO_INTERNET" = 1 ] && GRADLE_ARGS+=("-PhmNoInternet")

cd "$HM_ROOT/android"
if [ "$DO_CLEAN" = 1 ]; then
  echo "== clean"
  ./gradlew clean "${GRADLE_ARGS[@]}"
fi
echo "== 2/3 gradlew bundleRelease assembleRelease"
./gradlew bundleRelease assembleRelease "${GRADLE_ARGS[@]}"

AAB="$HM_ROOT/android/app/build/outputs/bundle/release/app-release.aab"
APK="$HM_ROOT/android/app/build/outputs/apk/release/app-release.apk"

echo "== 3/3 готово"
ls -lh "$AAB" "$APK"
BT="$ANDROID_HOME/build-tools/36.0.0"
# NOTE: without an intermediate variable `| head` breaks the pipe, and with
# `set -o pipefail` that kills the whole script.
SIGN_OUT="$("$BT/apksigner" verify --print-certs "$APK")"
printf '%s\n' "$SIGN_OUT" | grep -E 'certificate DN|SHA-256 digest' || true
BADGING="$("$BT/aapt2" dump badging "$APK")"
printf '%s\n' "$BADGING" | grep -E "^package:|^minSdkVersion|^targetSdkVersion" || true

# --- optional checks of the artifact ---------------------------------------
if [ "$DO_CHECK" = 1 ]; then
  BUNDLETOOL="${BUNDLETOOL_JAR:-$HOME/tools/bundletool.jar}"
  if [ ! -f "$BUNDLETOOL" ]; then
    echo "!! нет $BUNDLETOOL — скачай bundletool-all-*.jar с github.com/google/bundletool/releases" >&2
    exit 1
  fi
  echo "== bundletool validate"
  java -jar "$BUNDLETOOL" validate --bundle="$AAB" > /dev/null && echo "   OK"
  echo "== bundletool build-apks --mode=universal"
  rm -rf "$SCRATCH"; mkdir -p "$SCRATCH"
  PW="$(grep '^storePassword=' "$KS_PROPS" | cut -d= -f2-)"
  java -jar "$BUNDLETOOL" build-apks --bundle="$AAB" \
    --output="$SCRATCH/universal.apks" --mode=universal \
    --ks="$(grep '^storeFile=' "$KS_PROPS" | cut -d= -f2-)" \
    --ks-key-alias="$(grep '^keyAlias=' "$KS_PROPS" | cut -d= -f2-)" \
    --ks-pass="pass:$PW" --key-pass="pass:$(grep '^keyPassword=' "$KS_PROPS" | cut -d= -f2-)"
  ( cd "$SCRATCH" && unzip -q universal.apks )
  # bundletool puts universal.apk at the archive root (older versions: in splits/)
  UNI="$(find "$SCRATCH" -name 'universal.apk' | head -1)"
  [ -n "$UNI" ] || { echo "!! universal.apk не найден в $SCRATCH" >&2; exit 1; }
  echo "   универсальный APK: $(du -h "$UNI" | cut -f1)"
  LIST="$(unzip -l "$UNI")"
  echo "   веб-ассетов внутри: $(printf '%s\n' "$LIST" | grep -c 'assets/public/')"
  printf '%s\n' "$LIST" | grep -E 'assets/public/index.html|assets/capacitor.config.json' || true
  "$BT/aapt2" dump permissions "$UNI"
fi

echo
echo "AAB для загрузки в Play Console:"
echo "  $AAB"

# copies with readable names for Andrey (Windows Explorer: \\wsl.localhost\...)
ROOT="$HM_ROOT"  # cwd is android/ here; the old dirname "$0" trick failed silently under set -e
mkdir -p "$ROOT/релизы/android"
SUFFIX=""
[ "${1:-}" = "--no-internet" ] && SUFFIX="-БЕЗ-INTERNET"
APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
AAB="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
[ -f "$APK" ] && cp "$APK" "$ROOT/релизы/android/happymath-2.0.1$SUFFIX.apk" && echo "копия: happymath-2.0.1$SUFFIX.apk"
[ -f "$AAB" ] && [ -z "$SUFFIX" ] && cp "$AAB" "$ROOT/релизы/android/happymath-2.0.1.aab" && echo "копия: happymath-2.0.1.aab"
