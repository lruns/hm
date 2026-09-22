// STAINED GLASS + NEON (the vibe of hm1, 2017).
//
// Why: in his old game the Play button was not smooth glass but a MOSAIC - honeycomb
// shards with dark seams - and a neon triangle burned on top of it as an outline, with
// no fill. Here the same thing is generated in code (none of his old gimp textures - his
// own condition), in the palette of the current world, and it lives entirely behind the
// `VIBE.mosaicPlay` flag.
//
// Everything is deterministic: the shard layout is computed from `seed`, so the stained
// glass does NOT jitter between frames (drawStaticUI is called 8 times a second during a
// palette move - a random spread would flicker).

import { Graphics } from 'pixi.js'
import { lerpColor } from '../color'
import { TAU } from '../util'

/** deterministic hash 0..1 (the same trick as in the shaders: sin x something big) */
function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

export interface MosaicTones {
  /** the wall - the world tone (deep+mid), like the rest of the menu glass */
  wall: number
  /** the heart - lighter than the wall: light gathers in the center of the lens */
  core: number
  /** the world accent - the light: the outer shards catch their highlight with it */
  accent: number
  /** the layout seed: one disc - one layout */
  seed: number
}

/**
 * The STAINED GLASS texture of the disc: 3 rings of shards (12 / 18 / 24 pieces).
 *
 * How it works:
 *  1. a DARK backing lies under the shards - it is what shows in the gaps, the seams;
 *  2. each shard is a ring sector shrunk inwards by `seam` (hence the seam);
 *  3. the shard color = wall -> heart by depth (the center is lighter) plus lighting
 *     from the UPPER LEFT (one light source for the whole interface: the same one as
 *     for the crescent highlight and the gem specular in GEM_FRAG) plus a slight
 *     deterministic spread - glass is never perfectly even.
 */
export function drawMosaicGlass(
  g: Graphics, cx: number, cy: number, rad: number, tones: MosaicTones,
) {
  const { wall, core, accent, seed } = tones
  // the seam backing: a dark tone of the world (not black, or the glass looks holey)
  const seamCol = lerpColor(wall, 0x05060d, 0.62)
  g.circle(cx, cy, rad).fill({ color: seamCol, alpha: 0.98 })

  const LIGHT = -Math.PI * 0.75          // from the upper left (-135 degrees)
  // The inner ring does NOT converge to a point: wedges running into the center look
  // like a steering wheel and get in the way of the neon triangle. We keep a calm core
  // of 0.16R - the triangle lies on it.
  const RINGS: { n: number; r0: number; r1: number }[] = [
    { n: 12, r0: 0.16, r1: 0.44 },
    { n: 18, r0: 0.44, r1: 0.74 },
    { n: 24, r0: 0.74, r1: 1.00 },
  ]
  // the core: clean glass, lighter than the wall (light gathers in the center of the lens)
  g.circle(cx, cy, rad * 0.155).fill({ color: lerpColor(core, 0xffffff, 0.10), alpha: 0.95 })

  RINGS.forEach((ring, ri) => {
    const inner = rad * ring.r0
    const outer = rad * ring.r1
    // the seam: thinner towards the center (the shards are smaller there) but never thinner than a hair
    const seam = Math.max(1, rad * 0.016)
    const step = TAU / ring.n
    for (let i = 0; i < ring.n; i++) {
      const h = hash(seed + ri * 71.3 + i * 13.7)
      const h2 = hash(seed + ri * 17.9 + i * 41.1)
      // the angular seam is converted to radians at the outer radius so all seams are equally wide
      const gap = seam / Math.max(1, outer)
      const a0 = i * step + gap * 0.5 + (h - 0.5) * step * 0.10
      const a1 = (i + 1) * step - gap * 0.5 + (h2 - 0.5) * step * 0.10
      const rIn = inner + seam * 0.5
      const rOut = outer - seam * 0.5
      const aMid = (a0 + a1) / 2
      const rMid = (rIn + rOut) / 2

      // ── shard color ─────────────────────────────────────────────────────
      const depth = 1 - rMid / rad                         // 1 in the center -> 0 at the edge
      let col = lerpColor(wall, core, Math.pow(depth, 0.75))
      // lighting from the upper left: -1..1 -> a highlight on the light side, shadow on the dark one
      const lit = Math.cos(aMid - LIGHT)
      col = lit > 0
        ? lerpColor(col, 0xffffff, 0.16 * lit)
        : lerpColor(col, 0x000000, 0.20 * -lit)
      // the outer ring catches the light of the world - the accent lives there (warmth in the LIGHT)
      if (ri === 2) col = lerpColor(col, accent, 0.10 + 0.14 * Math.max(0, lit))
      // spread: the shards are not identical
      col = lerpColor(col, 0xffffff, (h2 - 0.5) * 0.10)

      // ── the sector polygon ──────────────────────────────────────────────
      const SEG = 4
      g.moveTo(cx + Math.cos(a0) * rIn, cy + Math.sin(a0) * rIn)
      for (let s = 1; s <= SEG; s++) {
        const a = a0 + ((a1 - a0) * s) / SEG
        g.lineTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn)
      }
      for (let s = SEG; s >= 0; s--) {
        const a = a0 + ((a1 - a0) * s) / SEG
        g.lineTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut)
      }
      g.closePath()
      g.fill({ color: col, alpha: 0.97 })
      // a thin light edge on the lit side of the shard - glass, not a tile
      if (lit > 0.25) {
        g.moveTo(cx + Math.cos(a0) * rOut, cy + Math.sin(a0) * rOut)
        for (let s = 1; s <= SEG; s++) {
          const a = a0 + ((a1 - a0) * s) / SEG
          g.lineTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut)
        }
        g.stroke({ width: Math.max(0.8, rad * 0.008), color: 0xffffff, alpha: 0.10 * lit })
      }
    }
  })
}

export interface NeonTones {
  /** the neon color - the world accent (the light of the world, not an eternal violet) */
  neon: number
  /** the hot core - almost white (mixed into the neon) */
  hot: number
}

/**
 * THE NEON TRIANGLE: an OUTLINE only, three layers - halo -> color -> white core.
 * There is deliberately no fill: a filled white triangle (as it used to be) reads as a
 * flat sticker, while a neon tube glows and lives in the palette of the world.
 * The layers use `join: 'round'` - neon has no sharp corners.
 */
export function drawNeonTriangle(
  g: Graphics, cx: number, cy: number, size: number, tones: NeonTones,
) {
  const s = size
  // the same silhouette the filled version had: shifted slightly right (optical center)
  const pts: [number, number][] = [
    [cx - s * 0.52, cy - s],
    [cx - s * 0.52, cy + s],
    [cx + s * 0.95, cy],
  ]
  const path = () => {
    g.moveTo(pts[0][0], pts[0][1])
    g.lineTo(pts[1][0], pts[1][1])
    g.lineTo(pts[2][0], pts[2][1])
    g.closePath()
  }
  const layers: [number, number, number][] = [
    // width, color, alpha
    [Math.max(6, s * 0.42), tones.neon, 0.16],                     // halo
    [Math.max(3, s * 0.17), lerpColor(tones.neon, tones.hot, 0.35), 0.75], // color
    [Math.max(1.5, s * 0.07), lerpColor(tones.hot, 0xffffff, 0.6), 0.95],  // core
  ]
  for (const [width, color, alpha] of layers) {
    path()
    g.stroke({ width, color, alpha, join: 'round', cap: 'round' })
  }
}
