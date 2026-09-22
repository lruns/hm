/**
 * ICON AND SPLASH for Happy Math.
 *
 * WHY. Andrey about the earlier icon: «иконка отвратительная — в меню с крыльями
 * офигенная». So the icon is THE SAME SIGN as in the menu: a gem disc made of
 * mosaic, a golden rim, a neon triangle in outline and WINGS on the sides.
 *
 * WHERE THE GEOMETRY COMES FROM. It is not invented: it is carried over one to one
 * from the game code, so that the icon and the menu are one thing and not two
 * "similar pictures":
 *   - mosaic glass    — src/fx/neon.ts, drawMosaicGlass (3 rings, seams, light from
 *                       the upper left at -135 deg, accent in the outer ring);
 *   - neon triangle   — src/fx/neon.ts, drawNeonTriangle (3 layers: halo -> colour ->
 *                       white core, NO fill: a fill reads as a sticker);
 *   - feathered wings — src/fx/wings.ts, drawWings (3 feathers per side, two bezier
 *                       curves), frozen at t=0 and thickened into a silhouette;
 *   - palette         — src/levels.ts:119 P_DAWN ['#0d1038','#2f4bb0','#ffc247'],
 *                       glass — engine.ts glassTones (wall = deep->mid 0.46).
 *
 * WHY SVG AND NOT FONTS. Under WSL fontconfig is empty (`fc-list` = 0 fonts): any
 * <text> would render as nothing. There is no text and no digits in the icon on
 * purpose: the sign must read at 48 px.
 *
 * TWO LAYOUTS (the author asked "how do you fit it in"):
 *   A "wide wings"     — a large span, a smaller disc (0.20 of the canvas);
 *   B "wings hinted"   — a large disc (0.285), the wings peek out from behind it.
 * Both are always rendered into assets/варианты/ (512 / 192 / 48) for comparison by
 * eye; CHOSEN goes into the real assets.
 *
 * Run:     node scripts/gen-app-assets.mjs
 * Output:  assets/{icon-only,icon-foreground,icon-background,splash,splash-dark}.png
 *          assets/play/{play-icon-512,play-feature-1024x500}.png
 *          assets/варианты/*.png · public/icon.svg
 * Then:    npx capacitor-assets generate --android && node scripts/fix-adaptive-icon.mjs
 *          (all together: npm run assets)
 */

import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'assets')
const VARIANTS_DIR = join(OUT, 'варианты')

// ── colour: the same helpers as in src/color.ts, but working on strings ─────
const hexNum = (h) => parseInt(h.slice(1), 16)
const toHex = (n) => '#' + n.toString(16).padStart(6, '0')
function mix(a, b, t) {
  t = Math.max(0, Math.min(1, t))
  const A = hexNum(a), B = hexNum(b)
  const r = ((A >> 16) & 255) + (((B >> 16) & 255) - ((A >> 16) & 255)) * t
  const g = ((A >> 8) & 255) + (((B >> 8) & 255) - ((A >> 8) & 255)) * t
  const b2 = (A & 255) + ((B & 255) - (A & 255)) * t
  return toHex((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b2))
}
const f = (x) => Number(x.toFixed(2))

// ── the dawn palette (src/levels.ts:119 P_DAWN) ─────────────────────────────
const P = {
  deep: '#0d1038',  // the indigo depth of world 1
  mid: '#2f4bb0',   // blue-violet glass
  gold: '#ffc247',  // dawn gold: rim, neon, wings
}
const WALL = mix(P.deep, P.mid, 0.46)        // the gem wall (engine.glassTones)
const CORE = mix(WALL, '#ffffff', 0.17)      // the core is lighter than the wall
const SEAM = mix(WALL, '#05060d', 0.62)      // шов витража (не чёрный — иначе дыры)
const HOT = mix(P.gold, '#ffffff', 0.55)     // «горячее» ядро неона
const EDGE = '#070a24'                       // край фона — глубже индиго

/** deterministic hash 0..1, the same trick as in src/fx/neon.ts */
function hash(n) {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

// ── STAINED GLASS (a port of drawMosaicGlass) ───────────────────────────────
/**
 * Rings of shards around a calm core. For the icon the rings are COARSER than in
 * the game (12/18/24 -> 9/13/17): at 48 px fine cutting collapses into grey noise,
 * while coarse cutting reads as the facet of a gem. This is a hint of the mosaic,
 * not a copy of it.
 */
function mosaicSvg(c, R, rings, seed, T = {}) {
  // the tones are a parameter: the fan of variants paints the same glass light
  // (V4), dark for the inverted layout (V3) or in dawn colours (the default).
  const {
    wall = WALL, core = CORE, seam = SEAM, accent = P.gold,
    accentAmt = 1, litAmt = 1, spread = 1,
  } = T
  const LIGHT = -Math.PI * 0.75 // one light source for the whole interface
  let out = `<circle cx="${f(c)}" cy="${f(c)}" r="${f(R)}" fill="${seam}"/>`
  out += `<circle cx="${f(c)}" cy="${f(c)}" r="${f(R * 0.155)}" fill="${mix(core, '#ffffff', 0.10)}"/>`

  rings.forEach((ring, ri) => {
    const inner = R * ring.r0
    const outer = R * ring.r1
    const seam = Math.max(0.7, R * 0.022)
    const step = (Math.PI * 2) / ring.n
    for (let i = 0; i < ring.n; i++) {
      const h = hash(seed + ri * 71.3 + i * 13.7)
      const h2 = hash(seed + ri * 17.9 + i * 41.1)
      const gap = seam / Math.max(1, outer)
      const a0 = i * step + gap * 0.5 + (h - 0.5) * step * 0.10
      const a1 = (i + 1) * step - gap * 0.5 + (h2 - 0.5) * step * 0.10
      const rIn = inner + seam * 0.5
      const rOut = outer - seam * 0.5
      const aMid = (a0 + a1) / 2
      const rMid = (rIn + rOut) / 2

      // shard colour: depth -> light from the upper left -> gold in the outer ring
      const depth = 1 - rMid / R
      let col = mix(wall, core, Math.pow(depth, 0.75))
      const lit = Math.cos(aMid - LIGHT)
      col = lit > 0 ? mix(col, '#ffffff', 0.16 * litAmt * lit) : mix(col, '#000000', 0.20 * litAmt * -lit)
      if (ri === rings.length - 1) col = mix(col, accent, (0.10 + 0.16 * Math.max(0, lit)) * accentAmt)
      col = mix(col, '#ffffff', (h2 - 0.5) * 0.10 * spread) // разброс: осколки не одинаковые

      const SEG = 4
      const pt = (a, r) => `${f(c + Math.cos(a) * r)} ${f(c + Math.sin(a) * r)}`
      let d = `M${pt(a0, rIn)}`
      for (let s = 1; s <= SEG; s++) d += `L${pt(a0 + ((a1 - a0) * s) / SEG, rIn)}`
      for (let s = SEG; s >= 0; s--) d += `L${pt(a0 + ((a1 - a0) * s) / SEG, rOut)}`
      d += 'Z'
      out += `<path d="${d}" fill="${col}" fill-opacity="0.97"/>`

      // a thin light edge on the lit side: glass, not a tile
      if (lit > 0.25) {
        let e = `M${pt(a0, rOut)}`
        for (let s = 1; s <= SEG; s++) e += `L${pt(a0 + ((a1 - a0) * s) / SEG, rOut)}`
        out += `<path d="${e}" fill="none" stroke="#ffffff" stroke-opacity="${f(0.14 * lit)}"`
          + ` stroke-width="${f(Math.max(0.6, R * 0.012))}"/>`
      }
    }
  })
  return out
}

// ── NEON TRIANGLE (a port of drawNeonTriangle) ──────────────────────────────
/** Three layers: halo -> colour -> white core. There is no fill, on purpose. */
function neonTriangleSvg(c, s, o = {}) {
  // proportions and colours are parameters: the variants need the same triangle
  // either wider and thicker (V2, the neon sign) or filled in (V4, the casual one).
  const {
    back = 0.52, apex = 0.95, ox = 0,
    halo = P.gold, mid = mix(P.gold, HOT, 0.35), core = mix(HOT, '#ffffff', 0.6),
    w = [0.46, 0.21, 0.085], op = [0.20, 0.82, 0.98], fill = null, fillOp = 1,
  } = o
  const x = c + ox
  const d = `M${f(x - s * back)} ${f(c - s)}L${f(x - s * back)} ${f(c + s)}L${f(x + s * apex)} ${f(c)}Z`
  // for the icon the layers are a bit thicker than in the game: at 48 px a white core of s*0.07 vanished
  const layers = [[s * w[0], halo, op[0]], [s * w[1], mid, op[1]], [s * w[2], core, op[2]]]
  const body = fill ? `<path d="${d}" fill="${fill}" fill-opacity="${fillOp}"/>` : ''
  return body + layers.map(([lw, col, a]) =>
    `<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${a}"`
    + ` stroke-width="${f(lw)}" stroke-linejoin="round" stroke-linecap="round"/>`).join('')
}

// ── WINGS (a port of drawWings, frozen at t=0) ──────────────────────────────
/** Feather i of the given side: two bezier curves from the base to the tip and back. */
function wingPath(side, i, c, R, cfg) {
  const k = 1 - i * 0.24
  const reach = R * (cfg.reachBase + cfg.reachK * k)
  const rise = R * (cfg.riseBase + cfg.riseK * k)
  const baseX = c + side * R * (0.72 + 0.12 * i)
  const baseY = c + R * (0.78 - 0.16 * i)
  return `M${f(baseX)} ${f(baseY)}`
    + `C${f(c + side * reach * 1.06)} ${f(c + R * (0.42 - 0.1 * i))}`
    + ` ${f(c + side * reach * 1.02)} ${f(c - rise * 0.35)}`
    + ` ${f(c + side * reach)} ${f(c - rise)}`
    + `C${f(c + side * R * (0.95 + 0.5 * k))} ${f(c - rise * 0.55)}`
    + ` ${f(c + side * R * (0.8 + 0.1 * i))} ${f(c - R * 0.05)}`
    + ` ${f(baseX)} ${f(baseY)}Z`
}

function wingsSvg(c, R, cfg, mono = false) {
  let out = ''
  for (const side of [-1, 1]) {
    // from the outer feather to the inner one: the inner ones lie on top
    for (let i = 0; i < cfg.feathers; i++) {
      const d = wingPath(side, i, c, R, cfg)
      if (mono) { out += `<path d="${d}" fill="${cfg.monoColor || P.gold}" fill-opacity="0.55"/>`; continue }
      out += `<path d="${d}" fill="url(#${cfg.fillId || 'wingFill'})"`
        + ` stroke="url(#${cfg.edgeId || 'wingEdge'})" stroke-width="${f(Math.max(0.8, R * (0.045 - i * 0.008)))}"`
        + ` stroke-linejoin="round"/>`
    }
  }
  return out
}

// ── THE WHOLE SIGN ──────────────────────────────────────────────────────────
/**
 * @param {number} size  side of the canvas
 * @param {object} v     the layout variant (V.a / V.b)
 * @param {number} span  share of the canvas taken by the sign (0.66 for the adaptive foreground)
 * @param {boolean} mono a flat golden version meant to be blurred (the glow)
 */
function markSvg(size, v, span = 1, mono = false) {
  const c = size / 2
  const R = size * v.R * span
  const rings = v.rings.map((r) => r)
  const cfg = { ...v, feathers: v.feathers }
  const s = R * 0.46 // half-height of the triangle
  // OPTICAL CENTRING: the wings grow UPWARDS, so a sign placed at the geometric
  // centre hangs in the upper half with a gaping void below it. We shift everything
  // down by a fraction of the canvas; the offset scales with span, and the gradients
  // in userSpaceOnUse travel along with the group.
  const shift = `transform="translate(0 ${f(size * v.dy * span)})"`

  if (mono) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><g ${shift}>`
      + wingsSvg(c, R, cfg, true)
      + `<circle cx="${f(c)}" cy="${f(c)}" r="${f(R)}" fill="${P.gold}" fill-opacity="0.5"/>`
      + `<path d="M${f(c - s * 0.52)} ${f(c - s)}L${f(c - s * 0.52)} ${f(c + s)}L${f(c + s * 0.95)} ${f(c)}Z"`
      + ` fill="none" stroke="${P.gold}" stroke-width="${f(s * 0.3)}" stroke-linejoin="round"/>`
      + `</g></svg>`
  }

  // a crescent highlight along the upper edge (engine.glassCrescent): arc -2.55..-1.15 rad
  const cr = R * 0.86
  const a0 = -2.55, a1 = -1.15
  const crescent = `<path d="M${f(c + Math.cos(a0) * cr)} ${f(c + Math.sin(a0) * cr)}`
    + `A${f(cr)} ${f(cr)} 0 0 1 ${f(c + Math.cos(a1) * cr)} ${f(c + Math.sin(a1) * cr)}"`
    + ` fill="none" stroke="#ffffff" stroke-opacity="0.30"`
    + ` stroke-width="${f(Math.max(1, R * 0.075))}" stroke-linecap="round"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs>
      <radialGradient id="wingFill" gradientUnits="userSpaceOnUse"
                      cx="${f(c)}" cy="${f(c)}" r="${f(R * (v.reachBase + v.reachK))}">
        <!-- перо плотнее игрового (там 0.09..0.22): в 48 px бледное золото
             растворяется при уменьшении, и от крыла остаётся сухой штрих -->
        <stop offset="0"    stop-color="${mix(P.gold, '#ffffff', 0.35)}" stop-opacity="0.86"/>
        <stop offset="0.5"  stop-color="${P.gold}" stop-opacity="0.64"/>
        <stop offset="1"    stop-color="${mix(P.gold, '#ff8a1e', 0.35)}" stop-opacity="0.24"/>
      </radialGradient>
      <radialGradient id="wingEdge" gradientUnits="userSpaceOnUse"
                      cx="${f(c)}" cy="${f(c)}" r="${f(R * (v.reachBase + v.reachK))}">
        <stop offset="0"   stop-color="#fff3d0" stop-opacity="0.95"/>
        <stop offset="0.6" stop-color="${P.gold}" stop-opacity="0.85"/>
        <stop offset="1"   stop-color="${P.gold}" stop-opacity="0.25"/>
      </radialGradient>
      <radialGradient id="discHalo" gradientUnits="userSpaceOnUse"
                      cx="${f(c)}" cy="${f(c)}" r="${f(R * 1.55)}">
        <stop offset="0.62" stop-color="${P.gold}" stop-opacity="0.22"/>
        <stop offset="0.80" stop-color="${P.gold}" stop-opacity="0.09"/>
        <stop offset="1"    stop-color="${P.gold}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <g ${shift}>
      <circle cx="${f(c)}" cy="${f(c)}" r="${f(R * 1.55)}" fill="url(#discHalo)"/>
      ${wingsSvg(c, R, cfg)}
      ${mosaicSvg(c, R, rings, v.seed)}
      ${crescent}
      <circle cx="${f(c)}" cy="${f(c)}" r="${f(R * 1.03)}" fill="none"
              stroke="${P.gold}" stroke-opacity="0.20" stroke-width="${f(R * 0.10)}"/>
      <circle cx="${f(c)}" cy="${f(c)}" r="${f(R)}" fill="none"
              stroke="${P.gold}" stroke-opacity="0.96" stroke-width="${f(R * 0.055)}"/>
      ${neonTriangleSvg(c, s)}
    </g>
  </svg>`
}

// ── THE LAYOUT VARIANTS ─────────────────────────────────────────────────────
const RINGS_COARSE = [
  { n: 9, r0: 0.16, r1: 0.44 },
  { n: 13, r0: 0.44, r1: 0.74 },
  { n: 17, r0: 0.74, r1: 1.00 },
]
const V = {
  // A: wide wings, smaller disc
  a: {
    R: 0.195, feathers: 3, seed: 7.31, rings: RINGS_COARSE,
    reachBase: 0.88, reachK: 0.98, riseBase: 0.32, riseK: 1.45, dy: 0.060,
  },
  // B: wings hinted behind the disc, the disc is large.
  // The span had to be raised from 1.12R to 1.57R: the base of a feather sits INSIDE
  // the disc (0.72R), so with a short span what stuck out were not wings but thin
  // curls — a hint must still read as a wing, not as hairs.
  b: {
    R: 0.262, feathers: 3, seed: 7.31, rings: RINGS_COARSE,
    reachBase: 0.72, reachK: 0.85, riseBase: 0.30, riseK: 1.15, dy: 0.045,
  },
}

/**
 * THE AUTHOR'S CHOICE: variant B.
 * At 48 px variant A squeezes the disc down to ~19 px, the mosaic and the neon
 * collapse into a golden dot, and the sweeping wings eat half the area and get cut
 * by the launcher mask. In B the disc is ~27 px: the glass and the triangle still
 * read, and the wings work as a golden halo silhouette. Compare in assets/варианты/.
 */
const CHOSEN = V.b

// ── background ──────────────────────────────────────────────────────────────
/** Deep indigo with a soft gradient and a warm breath of gold in the centre. */
function bgSvg(size) {
  const c = size / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs>
      <radialGradient id="bg" cx="0.5" cy="0.42" r="0.82">
        <stop offset="0"    stop-color="${mix(P.deep, P.mid, 0.34)}"/>
        <stop offset="0.45" stop-color="${P.deep}"/>
        <stop offset="1"    stop-color="${EDGE}"/>
      </radialGradient>
      <radialGradient id="warm" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0"    stop-color="${P.gold}" stop-opacity="0.10"/>
        <stop offset="0.55" stop-color="${P.gold}" stop-opacity="0.04"/>
        <stop offset="1"    stop-color="${P.gold}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="${EDGE}"/>
    <rect width="${size}" height="${size}" fill="url(#bg)"/>
    <circle cx="${c}" cy="${c}" r="${size * 0.46}" fill="url(#warm)"/>
  </svg>`
}

const png = (svg) => sharp(Buffer.from(svg)).png().toBuffer()

/** The sign with its glow on a transparent background. */
async function markWithGlow(size, v, span = 1) {
  const glow = await sharp(Buffer.from(markSvg(size, v, span, true)))
    .blur(Math.max(1, size * v.R * span * 0.30))
    .png()
    .toBuffer()
  const crisp = await png(markSvg(size, v, span))
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: glow }, { input: crisp }])
    .png()
    .toBuffer()
}

/** The sign over the background: a finished square icon. */
async function iconPng(size, v, span = 1) {
  return sharp(await png(bgSvg(size)))
    .composite([{ input: await markWithGlow(size, v, span) }])
    .png()
    .toBuffer()
}

// ── favicon public/icon.svg ─────────────────────────────────────────────────
/** The same sign as vector, 128x128, on a rounded plate. No text, no digits. */
function faviconSvg() {
  const S = 128
  const inner = markSvg(S, { ...CHOSEN, rings: [
    { n: 8, r0: 0.16, r1: 0.46 },   // at 16 px three rings turn into mush
    { n: 12, r0: 0.46, r1: 1.00 },
  ] }, 0.98)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
  <!-- Happy Math: диск-самоцвет с золотой каймой, неон-треугольник и крылья.
       Генерируется scripts/gen-app-assets.mjs — руками не править. -->
  <defs>
    <radialGradient id="fbg" cx="0.5" cy="0.42" r="0.82">
      <stop offset="0"    stop-color="${mix(P.deep, P.mid, 0.34)}"/>
      <stop offset="0.45" stop-color="${P.deep}"/>
      <stop offset="1"    stop-color="${EDGE}"/>
    </radialGradient>
  </defs>
  <rect width="${S}" height="${S}" rx="26" fill="url(#fbg)"/>
  ${inner.trim()}
</svg>
`
}

// ═════════════════════════════════════════════════════════════════════════════
// A FAN OF ICON VARIANTS.  Run: node scripts/gen-app-assets.mjs --variants
//                                node scripts/gen-app-assets.mjs --variant=3
//
// WHY. The previous icon looks decent as a file, but on the author's REAL launcher
// it is «отвратительно» (his word). It is the context that lies, not the picture:
// a round mask, 48 dp, a dark theme, and neighbours that are solid juicy fills
// (purple, red, blue circles). Our dark icon next to them is a dark muddy blob: the
// wings merge into the background, the disc is small, the mosaic is dead at 48 px.
//
// HENCE THE RULES FOR THE FAN:
//   1. A LARGE SIMPLE SHAPE matters more than detail: the mosaic is cut down to 2-3
//      big rings, the silhouette must read at a glance;
//   2. the background is NOT black: either glowing (a bright middle of the gradient)
//      or richly coloured, otherwise the icon disappears on a dark theme;
//   3. to stand out among coloured neighbour circles you need a warm fill
//      (gold/amber, which nobody else has) or neon on a mid-bright background.
//
// IMPORTANT ABOUT THE GEOMETRY. Everything drawn here is the VISIBLE CIRCLE of the
// icon (what is left after the launcher mask). An Android adaptive icon shows the
// central 72 of 108 dp, so when it is later sliced the sign goes onto the foreground
// with span ~ 0.667 and the proportions inside the circle stay one to one.
// Nothing in android/res is touched: the author points at a variant first.
// ═════════════════════════════════════════════════════════════════════════════

const V2_DIR = join(OUT, 'варианты-2')

const svgDoc = (size, defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`
  + (defs ? `<defs>${defs}</defs>` : '') + body + '</svg>'

/** a crescent highlight along the upper edge (engine.glassCrescent) */
function crescent(c, R, { op = 0.30, rk = 0.86, wk = 0.075, col = '#ffffff' } = {}) {
  const cr = R * rk, a0 = -2.55, a1 = -1.15
  return `<path d="M${f(c + Math.cos(a0) * cr)} ${f(c + Math.sin(a0) * cr)}`
    + `A${f(cr)} ${f(cr)} 0 0 1 ${f(c + Math.cos(a1) * cr)} ${f(c + Math.sin(a1) * cr)}"`
    + ` fill="none" stroke="${col}" stroke-opacity="${op}"`
    + ` stroke-width="${f(Math.max(1, R * wk))}" stroke-linecap="round"/>`
}

/** the disc rim: a soft halo ring + a dense line + a dark inner outline */
function rimSvg(c, R, { col = P.gold, w = 0.062, halo = 0.11, haloOp = 0.20, inner = null } = {}) {
  return `<circle cx="${f(c)}" cy="${f(c)}" r="${f(R * 1.035)}" fill="none" stroke="${col}"`
    + ` stroke-opacity="${haloOp}" stroke-width="${f(R * halo)}"/>`
    + (inner ? `<circle cx="${f(c)}" cy="${f(c)}" r="${f(R * (1 - w * 0.9))}" fill="none"`
      + ` stroke="${inner}" stroke-opacity="0.55" stroke-width="${f(R * 0.022)}"/>` : '')
    + `<circle cx="${f(c)}" cy="${f(c)}" r="${f(R)}" fill="none" stroke="${col}"`
    + ` stroke-opacity="0.97" stroke-width="${f(R * w)}"/>`
}

// glass rings: at 48 px fine cutting is grey noise, so the rings are COARSE
const RINGS_BIG = [
  { n: 7, r0: 0.18, r1: 0.46 },
  { n: 11, r0: 0.46, r1: 0.74 },
  { n: 15, r0: 0.74, r1: 1.00 },
]
const RINGS_TINY = [
  { n: 6, r0: 0.20, r1: 0.55 },
  { n: 11, r0: 0.55, r1: 1.00 },
]

// WINGS UNDER A ROUND MASK. A feather tip sits at (reach*R, -rise*R), i.e. at a
// distance R*sqrt(reach^2+rise^2) from the centre. The mask cuts everything beyond
// 0.5 of the canvas, which is why on a phone the tips of the previous icon were
// simply CUT OFF (R*sqrt(1.57^2+1.45^2) = 2.14R = 1.11 of the visible radius) and
// only dark stumps were left at the sides. We keep it <= 0.47, leaving room for the glow.
const WING_FIT = { reachBase: 0.86, reachK: 0.56, riseBase: 0.40, riseK: 0.72 } // max 1.42 / 1.12
const WING_SPAN = Math.hypot(0.86 + 0.56, 0.40 + 0.72) // 1.81 R
const wingSafeR = (limit = 0.47) => limit / WING_SPAN   // => R <= 0.259 of the canvas

// ── V1 · THE GEM DISC FILLING THE FRAME ─────────────────────────────────────
// No wings. The gem takes up almost the whole visible circle: at 48 px what reaches
// a person is a big golden ring with a bright core, the most survivable shape.
const V1 = {
  key: 1, name: 'V1-самоцвет-во-весь-кадр',
  short: 'диск-самоцвет во весь кадр, золотая кайма, неон-треугольник',
  bg: (S) => svgDoc(S, `<radialGradient id="g" cx="0.5" cy="0.42" r="0.78">
      <stop offset="0" stop-color="#34379c"/><stop offset="0.55" stop-color="#1a1d5e"/>
      <stop offset="1" stop-color="#101235"/></radialGradient>`,
    `<rect width="${S}" height="${S}" fill="url(#g)"/>`),
  glow: (S) => svgDoc(S, '', `<circle cx="${S / 2}" cy="${S / 2}" r="${f(S * 0.47)}"`
    + ` fill="${P.gold}" fill-opacity="0.55"/>`),
  glowSigma: (S) => S * 0.035,
  mark: (S) => {
    const c = S / 2, R = S * 0.462, s = R * 0.46
    // two rings instead of three: at 48 px the third one rippled along the rim
    return svgDoc(S, '', mosaicSvg(c, R, RINGS_TINY, 7.31, {
      wall: '#2b3ea8', core: '#8098f2', seam: '#0b0e2e', accent: P.gold,
      accentAmt: 1.35, spread: 1.15,
    })
      + crescent(c, R, { op: 0.34 })
      + rimSvg(c, R, { w: 0.085, halo: 0.15, haloOp: 0.28, inner: '#0b0e2e' })
      + neonTriangleSvg(c, s, { w: [0.50, 0.24, 0.10], op: [0.26, 0.86, 1] }))
  },
}

// ── V2 · NEON TRIANGLE (minimalism, a neon sign) ────────────────────────────
// Nothing superfluous: a huge "play" sign on glowing indigo (NOT black, otherwise a
// hole on a dark launcher theme). The most readable silhouette of the five.
const V2 = {
  key: 2, name: 'V2-неон-треугольник',
  short: 'только неон-треугольник крупно на светящемся индиго',
  bg: (S) => svgDoc(S, `<radialGradient id="g" cx="0.5" cy="0.46" r="0.72">
      <stop offset="0" stop-color="#6a5cf0"/><stop offset="0.42" stop-color="#3a34a4"/>
      <stop offset="1" stop-color="#171a58"/></radialGradient>
    <radialGradient id="w" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${P.gold}" stop-opacity="0.30"/>
      <stop offset="0.55" stop-color="${P.gold}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="${P.gold}" stop-opacity="0"/></radialGradient>`,
    `<rect width="${S}" height="${S}" fill="url(#g)"/>`
    + `<circle cx="${S / 2}" cy="${S / 2}" r="${f(S * 0.5)}" fill="url(#w)"/>`),
  glow: (S) => {
    const c = S / 2, s = S * 0.285
    return svgDoc(S, '', neonTriangleSvg(c, s, {
      back: 0.62, apex: 1.18, ox: -s * 0.28,
      halo: P.gold, mid: P.gold, core: P.gold, w: [0.34, 0.34, 0.34], op: [0.9, 0.9, 0.9],
    }))
  },
  glowSigma: (S) => S * 0.030,
  mark: (S) => {
    const c = S / 2, s = S * 0.285
    return svgDoc(S, '', neonTriangleSvg(c, s, {
      back: 0.62, apex: 1.18, ox: -s * 0.28,
      w: [0.30, 0.145, 0.058], op: [0.34, 0.92, 1],
    }))
  },
}

// ── V3 · AMBER: a dark figure on a BRIGHT warm background (the inversion) ────
// The only warm tile in the row of neighbours: nobody else has amber.
// The disc and the wings are a dark silhouette, the triangle burns white gold.
const V3 = {
  key: 3, name: 'V3-янтарь-инверсия',
  short: 'золотисто-янтарный фон, тёмный диск с крыльями, горящий треугольник',
  bg: (S) => svgDoc(S, `<radialGradient id="g" cx="0.42" cy="0.32" r="0.92">
      <stop offset="0" stop-color="#ffe6a0"/><stop offset="0.42" stop-color="#ffb63f"/>
      <stop offset="0.78" stop-color="#f78c1c"/><stop offset="1" stop-color="#e26a10"/>
      </radialGradient>`,
    `<rect width="${S}" height="${S}" fill="url(#g)"/>`),
  glow: null,
  mark: (S) => {
    // R from the wingSafeR formula: the wings are entirely inside the mask, nothing
    // is cut off, and the free amber around the disc is exactly the warm patch that
    // no neighbour on the launcher has
    const c = S / 2, R = S * 0.255, s = R * 0.50
    // the wings are SPREAD SIDEWAYS rather than up: with a steep sweep the dark
    // silhouette on amber read at 48 px as a pair of horns, not wings.
    // hypot(1.55,0.95)=1.82, the same safe length as WING_FIT, just redistributed.
    const cfg = {
      feathers: 3, reachBase: 0.95, reachK: 0.60, riseBase: 0.35, riseK: 0.60,
      fillId: 'wf3', edgeId: 'we3',
    }
    const defs = `<radialGradient id="wf3" gradientUnits="userSpaceOnUse"
        cx="${f(c)}" cy="${f(c)}" r="${f(R * (cfg.reachBase + cfg.reachK))}">
        <stop offset="0" stop-color="#1b1f5e" stop-opacity="0.95"/>
        <stop offset="0.55" stop-color="#241d55" stop-opacity="0.88"/>
        <stop offset="1" stop-color="#3a2350" stop-opacity="0.62"/></radialGradient>
      <radialGradient id="we3" gradientUnits="userSpaceOnUse"
        cx="${f(c)}" cy="${f(c)}" r="${f(R * (cfg.reachBase + cfg.reachK))}">
        <stop offset="0" stop-color="#0e1138" stop-opacity="0.95"/>
        <stop offset="1" stop-color="#5a2f0c" stop-opacity="0.55"/></radialGradient>`
    return svgDoc(S, defs,
      wingsSvg(c, R, cfg)
      + mosaicSvg(c, R, RINGS_TINY, 7.31, {
        wall: '#1e2568', core: '#4351b4', seam: '#080a24', accent: '#8f9bf0', accentAmt: 0.45,
      })
      + crescent(c, R, { op: 0.26 })
      + rimSvg(c, R, { col: '#121538', w: 0.085, halo: 0.16, haloOp: 0.22 })
      // a warm edge light from the upper left: the disc sits IN the warm light instead of looking like a sticker
      + crescent(c, R * 1.02, { op: 0.55, rk: 1.0, wk: 0.05, col: '#ffdc93' })
      + neonTriangleSvg(c, s, {
        w: [0.52, 0.25, 0.11], op: [0.30, 0.92, 1],
        core: '#ffffff', mid: mix(P.gold, '#ffffff', 0.45),
      }))
  },
}

// ── V4 · CASUAL: a white gem on turquoise (a Bejeweled vibe) ────────────────
// Friendly and light. There is no mosaic on purpose: at 48 px it is dead, while a
// clean white disc plus a FILLED golden triangle read instantly and from afar.
const V4 = {
  key: 4, name: 'V4-казуальный-бирюза',
  short: 'светлая бирюза, белый диск, залитый золотой треугольник',
  bg: (S) => svgDoc(S, `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8fefff"/><stop offset="0.45" stop-color="#3fc0f0"/>
      <stop offset="1" stop-color="#1a72d6"/></linearGradient>
    <radialGradient id="s" cx="0.5" cy="0.16" r="0.6">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`,
    `<rect width="${S}" height="${S}" fill="url(#g)"/>`
    + `<rect width="${S}" height="${S}" fill="url(#s)"/>`),
  glow: (S) => svgDoc(S, '', `<circle cx="${S / 2}" cy="${f(S * 0.545)}" r="${f(S * 0.335)}"`
    + ` fill="#0b3f7a" fill-opacity="0.55"/>`),
  glowSigma: (S) => S * 0.030,
  mark: (S) => {
    const c = S / 2, R = S * 0.325, s = R * 0.52
    const defs = `<radialGradient id="disc" cx="0.38" cy="0.30" r="0.85">
        <stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#f2f8ff"/>
        <stop offset="1" stop-color="#c9defa"/></radialGradient>
      <linearGradient id="tri" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffd977"/><stop offset="1" stop-color="#f2a01c"/>
      </linearGradient>`
    // 8 barely visible facets instead of the mosaic: a hint of a cut, not a mush
    let facets = ''
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI * 0.75 + (i * Math.PI * 2) / 8
      facets += `<line x1="${f(c + Math.cos(a) * R * 0.30)}" y1="${f(c + Math.sin(a) * R * 0.30)}"`
        + ` x2="${f(c + Math.cos(a) * R * 0.97)}" y2="${f(c + Math.sin(a) * R * 0.97)}"`
        + ` stroke="#9db9dd" stroke-opacity="0.30" stroke-width="${f(Math.max(0.7, R * 0.014))}"/>`
    }
    return svgDoc(S, defs,
      `<circle cx="${f(c)}" cy="${f(c)}" r="${f(R)}" fill="url(#disc)"/>`
      + facets
      + crescent(c, R, { op: 0.85, rk: 0.83, wk: 0.085 })
      + rimSvg(c, R, { col: '#ffc247', w: 0.085, halo: 0.15, haloOp: 0.30, inner: '#e8a52b' })
      + neonTriangleSvg(c, s, {
        fill: 'url(#tri)', halo: '#b06d05', mid: '#c47c07', core: '#ffe9ae',
        w: [0.16, 0.10, 0.035], op: [0.20, 0.55, 0.75],
      }))
  },
}

// ── V5 · THE CURRENT ONE IMPROVED: tighter brighter wings, a larger disc ────
// The same sign as in the menu (the author loves it), but cured for the launcher:
// the background is not black but blue-violet with a glow, the disc is +16 %, the
// wing span is 1.42R instead of 1.57R, so the feathers no longer melt into the dark
// background as thin hairs.
const V5 = {
  key: 5, name: 'V5-крылья-компактно-свечение',
  short: 'текущий знак вылеченный: светящийся сине-фиолетовый фон, крупнее диск, компактные яркие крылья',
  bg: (S) => svgDoc(S, `<radialGradient id="g" cx="0.5" cy="0.46" r="0.76">
      <stop offset="0" stop-color="#5f50d8"/><stop offset="0.45" stop-color="#332c8c"/>
      <stop offset="1" stop-color="#191446"/></radialGradient>`,
    `<rect width="${S}" height="${S}" fill="url(#g)"/>`),
  glow: (S) => svgDoc(S, '', `<circle cx="${S / 2}" cy="${S / 2}" r="${f(S * 0.34)}"`
    + ` fill="${P.gold}" fill-opacity="0.60"/>`),
  glowSigma: (S) => S * 0.055,
  mark: (S) => {
    // 0.258 is the wingSafeR limit: the disc cannot be made bigger or the launcher
    // mask will cut off the feather tips (exactly the mistake that spoiled the
    // previous icon)
    const c = S / 2, R = S * 0.258, s = R * 0.47
    const cfg = { feathers: 3, ...WING_FIT, fillId: 'wf5', edgeId: 'we5' }
    const rr = R * (cfg.reachBase + cfg.reachK)
    const defs = `<radialGradient id="wf5" gradientUnits="userSpaceOnUse"
        cx="${f(c)}" cy="${f(c)}" r="${f(rr)}">
        <stop offset="0" stop-color="#fff0c4" stop-opacity="0.98"/>
        <stop offset="0.5" stop-color="${P.gold}" stop-opacity="0.88"/>
        <stop offset="1" stop-color="#ff9f24" stop-opacity="0.60"/></radialGradient>
      <radialGradient id="we5" gradientUnits="userSpaceOnUse"
        cx="${f(c)}" cy="${f(c)}" r="${f(rr)}">
        <stop offset="0" stop-color="#fff6dd" stop-opacity="1"/>
        <stop offset="1" stop-color="#ffb43a" stop-opacity="0.75"/></radialGradient>`
    return svgDoc(S, defs,
      wingsSvg(c, R, cfg)
      + mosaicSvg(c, R, RINGS_TINY, 7.31, {
        wall: '#27389f', core: '#7b93ee', seam: '#0a0d2c', accent: P.gold, accentAmt: 1.2,
      })
      + crescent(c, R, { op: 0.32 })
      + rimSvg(c, R, { w: 0.075, halo: 0.13, haloOp: 0.24, inner: '#0a0d2c' })
      + neonTriangleSvg(c, s, { w: [0.50, 0.24, 0.10], op: [0.26, 0.88, 1] }))
  },
}

const FAN = [V1, V2, V3, V4, V5]

/** a finished square picture of a variant: background -> blurred glow -> sharp sign */
async function renderVariant(v, size) {
  const layers = []
  if (v.glow) {
    layers.push({
      input: await sharp(Buffer.from(v.glow(size)))
        .blur(Math.max(1, v.glowSigma(size))).png().toBuffer(),
    })
  }
  layers.push({ input: await png(v.mark(size)) })
  return sharp(await png(v.bg(size))).composite(layers).png().toBuffer()
}

/** the round launcher mask plus downscaling: exactly what the phone will show */
async function masked(buf, size, px) {
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`
    + `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`)
  const cut = await sharp(buf).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
  return sharp(cut).resize(px, px, { kernel: 'lanczos3' }).png().toBuffer()
}

// launcher neighbours: solid juicy circles, that is how they look on his screen
const NEIGHBOURS = ['#8b3ff0', '#e63946', '#1f6fe0', '#21c25a', '#ff8a1e', '#e83fa0']
async function neighbourPng(i, px) {
  const col = NEIGHBOURS[i % NEIGHBOURS.length]
  const S = 256
  const svg = svgDoc(S, `<linearGradient id="n" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${mix(col, '#ffffff', 0.22)}"/>
      <stop offset="1" stop-color="${mix(col, '#000000', 0.18)}"/></linearGradient>`,
  `<circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="url(#n)"/>`)
  return sharp(Buffer.from(svg)).resize(px, px, { kernel: 'lanczos3' }).png().toBuffer()
}

/** a counter mark: N dots (there are no fonts under WSL, nothing to draw a digit with) */
function dotsPng(n, col) {
  const w = n * 18 + 6, h = 18
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
  for (let i = 0; i < n; i++) s += `<circle cx="${12 + i * 18}" cy="9" r="6" fill="${col}"/>`
  return sharp(Buffer.from(s + '</svg>')).png().toBuffer()
}

/** wallpaper: light / dark, with soft blobs, so the icon is not judged against emptiness */
function wallpaper(w, h, dark) {
  const A = dark ? '#22242c' : '#eef1f6'
  const B = dark ? '#0e0f14' : '#cfd8e6'
  const blobs = dark
    ? [['#3b4a7a', 0.35], ['#6a3b6e', 0.28]]
    : [['#ffffff', 0.75], ['#bcd2f0', 0.55]]
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="wp" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="${A}"/><stop offset="1" stop-color="${B}"/></linearGradient></defs>
    <rect width="${w}" height="${h}" rx="18" fill="url(#wp)"/>`
  blobs.forEach(([col, op], i) => {
    s += `<circle cx="${f(w * (0.2 + i * 0.55))}" cy="${f(h * (0.25 + i * 0.5))}"`
      + ` r="${f(h * 0.55)}" fill="${col}" fill-opacity="${op * 0.25}"/>`
  })
  return sharp(Buffer.from(s + '</svg>')).png().toBuffer()
}

async function variantsMain(only) {
  await mkdir(V2_DIR, { recursive: true })
  const list = only ? FAN.filter((v) => v.key === only) : FAN
  if (!list.length) throw new Error(`нет варианта ${only} (есть 1..5)`)

  const big = {}
  for (const v of list) {
    big[v.key] = await renderVariant(v, 1024)
    for (const px of [512, 192, 48]) {
      await sharp(big[v.key]).resize(px, px, { kernel: 'lanczos3' })
        .toFile(join(V2_DIR, `${v.name}-${px}.png`))
    }
    // inside the round mask: what the phone really shows
    await sharp(await masked(big[v.key], 1024, 192)).toFile(join(V2_DIR, `${v.name}-маска192.png`))
    await sharp(await sharp(await masked(big[v.key], 1024, 48)).resize(288, 288, { kernel: 'nearest' })
      .png().toBuffer()).toFile(join(V2_DIR, `${v.name}-маска48-зум.png`))
    console.log('вариант', v.key, '·', v.name)
  }
  if (only) return

  // ── COMPARISON SHEET: as it looks on a phone ──────────────────────────────
  const W = 1240, PX = 20, PW = 1200, PH = 300
  const H = 20 + PH + 20 + PH + 20 + 192 + 40
  const parts = []
  const colX = (i) => 120 + 240 * i

  const dotLeft = (cx, n) => Math.round(cx - (n * 18 + 6) / 2)
  for (const [pi, dark] of [[0, false], [1, true]]) {
    const py = 20 + pi * (PH + 20)
    parts.push({ input: await wallpaper(PW, PH, dark), left: PX, top: py })
    const dotCol = dark ? '#f2f4fa' : '#22242a'
    for (const [i, v] of list.entries()) {
      const cx = PX + colX(i)
      const ic48 = await masked(big[v.key], 1024, 48)
      // row A: our variant between two neighbours, as in the launcher grid
      parts.push({ input: await neighbourPng(i * 2, 48), left: cx - 64 - 24, top: py + 28 })
      parts.push({ input: ic48, left: cx - 24, top: py + 28 })
      parts.push({ input: await neighbourPng(i * 2 + 1, 48), left: cx + 64 - 24, top: py + 28 })
      // row B: neighbours only, so the eye can compare brightness with the row above
      for (const [k, dx] of [-64, 0, 64].entries()) {
        parts.push({ input: await neighbourPng(i + k + 3, 48), left: cx + dx - 24, top: py + 100 })
      }
      // the same 48 px, scaled x2 without smoothing: every pixel is visible
      parts.push({
        input: await sharp(ic48).resize(96, 96, { kernel: 'nearest' }).png().toBuffer(),
        left: cx - 48, top: py + 170,
      })
      parts.push({ input: await dotsPng(v.key, dotCol), left: dotLeft(cx, v.key), top: py + 276 })
    }
  }

  // bottom row: the same circle large, 192 px, to see WHAT is inside
  const bigY = 20 + (PH + 20) * 2
  parts.push({
    input: await sharp({ create: { width: PW, height: 192 + 40, channels: 4, background: { r: 60, g: 62, b: 70, alpha: 1 } } }).png().toBuffer(),
    left: PX, top: bigY,
  })
  for (const [i, v] of list.entries()) {
    const cx = PX + colX(i)
    parts.push({ input: await masked(big[v.key], 1024, 192), left: cx - 96, top: bigY })
    parts.push({ input: await dotsPng(v.key, '#e8e8ee'), left: dotLeft(cx, v.key), top: bigY + 200 })
  }

  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 23, g: 24, b: 28, alpha: 1 } } })
    .composite(parts).toFile(join(V2_DIR, 'ВЫБОР-АНДРЕЯ.png'))
  console.log('лист →', join(V2_DIR, 'ВЫБОР-АНДРЕЯ.png'))
}

async function main() {
  // fan mode: NOTHING of the normal assets is touched
  const arg = process.argv.find((a) => a.startsWith('--variant'))
  if (arg) {
    const m = arg.match(/=(\d+)/)
    return variantsMain(m ? Number(m[1]) : 0)
  }

  await mkdir(OUT, { recursive: true })
  await mkdir(VARIANTS_DIR, { recursive: true })

  // ── the layout variants: to be judged BY EYE, especially at 48 ──
  const sheet = []
  const NAMES = [['a', 'вариант-А-крылья-широкие'], ['b', 'вариант-Б-крылья-намёком']]
  for (const [row, [key, name]] of NAMES.entries()) {
    const big = await iconPng(1024, V[key])
    for (const px of [512, 192, 48]) {
      await sharp(big).resize(px, px, { kernel: 'lanczos3' })
        .toFile(join(VARIANTS_DIR, `${name}-${px}.png`))
    }
    // comparison sheet: 512 · 192 · 48 · 48 scaled up to 192 (every pixel visible)
    const y = 24 + row * 560
    sheet.push({ input: await sharp(big).resize(512, 512, { kernel: 'lanczos3' }).png().toBuffer(), left: 24, top: y })
    sheet.push({ input: await sharp(big).resize(192, 192, { kernel: 'lanczos3' }).png().toBuffer(), left: 560, top: y })
    sheet.push({ input: await sharp(big).resize(48, 48, { kernel: 'lanczos3' }).png().toBuffer(), left: 560, top: y + 216 })
    const px48 = await sharp(big).resize(48, 48, { kernel: 'lanczos3' }).png().toBuffer()
    sheet.push({ input: await sharp(px48).resize(288, 288, { kernel: 'nearest' }).png().toBuffer(), left: 776, top: y })
  }
  await sharp({ create: { width: 1096, height: 1144, channels: 4, background: { r: 26, g: 26, b: 30, alpha: 1 } } })
    .composite(sheet).toFile(join(VARIANTS_DIR, 'СРАВНЕНИЕ.png'))

  // ── the 1024x1024 icon ──
  // foreground: the content stays within the central 66 %, Android masks cut the edges
  await sharp(await markWithGlow(1024, CHOSEN, 0.66)).toFile(join(OUT, 'icon-foreground.png'))

  const bg1024 = await png(bgSvg(1024))
  await sharp(bg1024).toFile(join(OUT, 'icon-background.png'))

  // icon-only goes into the legacy mipmaps, including ic_launcher_round, and a
  // CIRCLE cuts the corners. At span 0.92 a wing tip ends up at 0.488R from the
  // centre (touching the edge of the circle and losing its glow); 0.86 keeps it at
  // 0.456R, with room to spare.
  const only = await iconPng(1024, CHOSEN, 0.86)
  await sharp(only).toFile(join(OUT, 'icon-only.png'))

  // a check by eye: the same sizes a person actually looks at
  for (const px of [512, 192, 48]) {
    await sharp(only).resize(px, px, { kernel: 'lanczos3' })
      .toFile(join(VARIANTS_DIR, `итог-icon-only-${px}.png`))
  }

  // ── splash 2732x2732: a small sign in the centre, croppable to any screen ──
  const S = 2732
  const splash = await sharp(await png(bgSvg(S)))
    .composite([{ input: await markWithGlow(S, CHOSEN, 0.30) }])
    .png()
    .toBuffer()
  await sharp(splash).toFile(join(OUT, 'splash.png'))
  await sharp(splash).toFile(join(OUT, 'splash-dark.png')) // игра всегда тёмная

  // ── Play store listing graphics (uploaded by hand, not part of the build) ──
  const play = join(OUT, 'play')
  await mkdir(play, { recursive: true })

  // the listing icon: strictly a 512x512 PNG without transparency
  await sharp(only).resize(512, 512, { kernel: 'lanczos3' })
    .flatten({ background: EDGE })
    .toFile(join(play, 'play-icon-512.png'))

  // feature graphic 1024x500: the sign on the left, Google puts the game title on the right
  const FW = 1024, FH = 500
  const fbg = await sharp(await png(bgSvg(1400)))
    .resize(FW, FH, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer()
  const fmark = await markWithGlow(FH, CHOSEN, 0.86)
  await sharp(fbg)
    .composite([{ input: fmark, left: Math.round(FW * 0.10), top: 0 }])
    .flatten({ background: EDGE })
    .toFile(join(play, 'play-feature-1024x500.png'))

  // ── favicon ──
  await writeFile(join(ROOT, 'public', 'icon.svg'), faviconSvg(), 'utf8')

  // ── CHECK: the adaptive icon under launcher masks ──
  // A launcher shows the central 72dp of 108dp (1.5x zoom) and cuts with its own
  // mask: a circle, a squircle or a rounded square. The wing tips must survive the
  // circle, which is the cruellest mask. To be judged BY EYE, at 48 px too.
  const FULL = 1024
  const zoom = Math.round(FULL * 1.5)
  const zoomed = await sharp(await sharp(bg1024)
    .composite([{ input: await markWithGlow(1024, CHOSEN, 0.66) }]).png().toBuffer())
    .resize(zoom, zoom)
    .extract({ left: (zoom - FULL) >> 1, top: (zoom - FULL) >> 1, width: FULL, height: FULL })
    .png().toBuffer()
  const proof = []
  let px0 = 16
  for (const [name, r] of [['круг', FULL / 2], ['сквиркл', FULL * 0.28], ['квадрат', FULL * 0.14]]) {
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${FULL}" height="${FULL}">`
      + `<rect width="${FULL}" height="${FULL}" rx="${r}" ry="${r}" fill="#fff"/></svg>`)
    const cut = await sharp(zoomed).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
    proof.push({ input: await sharp(cut).resize(192, 192, { kernel: 'lanczos3' }).png().toBuffer(), left: px0, top: 16 })
    const small = await sharp(cut).resize(48, 48, { kernel: 'lanczos3' }).png().toBuffer()
    proof.push({ input: await sharp(small).resize(192, 192, { kernel: 'nearest' }).png().toBuffer(), left: px0, top: 224 })
    px0 += 208
  }
  await sharp({ create: { width: px0, height: 432, channels: 4, background: { r: 236, g: 236, b: 240, alpha: 1 } } })
    .composite(proof).toFile(join(VARIANTS_DIR, 'ПРОВЕРКА-маски-лаунчера.png'))

  console.log('готово →', OUT, '· варианты →', VARIANTS_DIR, '· public/icon.svg')
}

main().catch((e) => { console.error(e); process.exit(1) })
