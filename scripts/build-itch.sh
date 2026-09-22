#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Happy Math v2 -> an itch.io package, in one command.
#
#   bash scripts/build-itch.sh
#
# What it does:
#   1) vite build (base './' — all paths relative, a hard requirement of itch)
#   2) checks the package: index.html at the ROOT, no music previews, no absolute
#      paths and no localhost/CDN references in the entry bundle
#   3) writes релизы/happy-math-web-v2.zip — index.html sits AT THE ROOT of the
#      archive (otherwise itch says "Index file not found")
#
# House rule: no rm. The archive is built in a temp folder and moved into place
# with mv (overwrite in one move).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"
OUTDIR="$ROOT/релизы"
OUT="$OUTDIR/happy-math-web-v2.zip"

cd "$ROOT"

echo "▸ 1/4 сборка (vite build)"
npm run build

echo "▸ 2/4 проверки пакета"
fail() { echo "  ✗ $1"; exit 1; }

[ -f "$DIST/index.html" ] || fail "нет dist/index.html"
echo "  ✓ index.html на месте"

# the music previews (190 MB of WAVs in public/) are stripped by the hm-drop-music-previews plugin
if [ -d "$DIST/превью-музыки" ]; then fail "превью-музыки уехали в dist — плагин в vite.config.ts сломан"; fi
echo "  ✓ превью-музыки в пакет не попали"

# the production loops (15 MB of Opus) are needed ONLY by the mobile build: the web
# build plays live synthesis. Stripped by the hm-drop-music-loops plugin (they ship
# only with HM_LOOPS=1)
for d in "музыка-лупы" "music-loops"; do
  if [ -d "$DIST/$d" ]; then fail "$d уехали в dist — тут собирали с HM_LOOPS=1, для itch так нельзя"; fi
done
echo "  ✓ боевые лупы в веб-пакет не попали"

# site-root absolute paths kill the game inside itch (it is served from a subfolder)
if grep -qE '(src|href)="/[^/]' "$DIST/index.html"; then fail "в index.html есть абсолютные пути — проверь base в vite.config.ts"; fi
echo "  ✓ все пути относительные"

# the entry bundle is the one actually loaded by index.html. The separate
# @strudel/web chunk (the ?music=strudel experiment) does reference its own sample
# hosts, but it is NOT loaded without the flag, so a normal player never hits it.
ENTRY=$(grep -oE 'assets/[A-Za-z0-9_.-]+\.js' "$DIST/index.html" | head -1)
[ -n "$ENTRY" ] || fail "не нашёл стартовый бандл в index.html"
if grep -qE 'localhost:[0-9]|127\.0\.0\.1' "$DIST/$ENTRY"; then fail "в стартовом бандле $ENTRY есть localhost"; fi
echo "  ✓ стартовый бандл без localhost ($ENTRY)"

SIZE_KB=$(du -sk "$DIST" | cut -f1)
[ "$SIZE_KB" -lt 8192 ] || fail "dist раздулся до ${SIZE_KB}КБ (ждём ~2МБ) — что-то лишнее в public/"
echo "  ✓ размер dist: $(du -sh "$DIST" | cut -f1)"

echo "▸ 3/4 упаковка"
mkdir -p "$OUTDIR"
TMP="$(mktemp -d)"
( cd "$DIST" && zip -qr9 "$TMP/pack.zip" . -x '.*' )
mv -f "$TMP/pack.zip" "$OUT"
rmdir "$TMP"

echo "▸ 4/4 контроль архива"
FIRST=$(unzip -Z1 "$OUT" | grep -c '^index.html$' || true)
[ "$FIRST" = "1" ] || fail "index.html не в корне архива — itch такой пакет не примет"
echo "  ✓ index.html в корне архива"
echo "  ✓ файлов: $(unzip -Z1 "$OUT" | wc -l), размер: $(du -h "$OUT" | cut -f1)"
echo
echo "ГОТОВО: $OUT"
echo "Заливать по чеклисту: РЕЛИЗ-itch.md"
echo
echo "Посмотреть глазами перед заливкой (file:// НЕ подходит — ES-модули):"
echo "  python3 -m http.server 5202 --directory \"$DIST\"  →  http://localhost:5202/"
