// Surprise icons - procedural neon line art (a rethink of his 2017 pictures: the heart,
// the gift, the broken heart of the old game, but drawn in code in the style of the
// world - thin glowing outlines, the bloom adds the halo). No emoji, no assets.
//
// ! THE CROSSED-OUT RULE: in his old game the broken heart was CROSSED OUT. So EVERY
// evil surprise gets an explicit diagonal "no" stroke plus a cold evil gamut; the good
// ones are warm / golden / green, WHOLE, without a stroke. Squint-readability comes from
// the silhouette and the stroke, not from the hue.

import { Graphics } from 'pixi.js'
import type { SurpriseKind } from '../levels'

// From a playtest: «мама: а нажимать этот эффект, а этот?». Andrey's rule: good is WARM
// GOLD with a glow and a "take me" pulse; evil is COLD VIOLET, a FAT crossing stroke and
// a slight tremble. Evil used to be crimson-pink (0xff3d6e) - on the warm background of
// world 1 it read almost like gold, and the stroke was thin. Now the evil gamut is
// BLUE-VIOLET (impossible to confuse), the stroke is three times thicker and it has a
// dark cut underneath.

// the good ones: warm gold, living green, ice (freeze is his canonical ICE)
const GOLD = 0xffd54a
const GREEN = 0x5ef0a0
const ICE = 0x9adfff
// the evil ones: a COLD violet gamut (it used to be red-pink)
const EVIL = 0xa66bff      // main outline of a nasty surprise (cold violet)
const EVIL_DEEP = 0x5a2fb0 // deep violet backing / fill
const SLASH = 0xc07dff     // the crossing stroke itself
const INK = 0x0a0616       // dark backing under the stroke and the crack (separates them from the outline)

/** a warm surprise (take it) or an evil catch (better skip it) */
export function isGoodSurprise(kind: SurpriseKind): boolean {
  // freeze = time fully frozen: mechanically a kind breather (his FullFreezing)
  return kind === 'life' || kind === 'score' || kind === 'slow' || kind === 'help'
    || kind === 'explosion' || kind === 'freeze'
}

/** surprise color - one vocabulary for the icon, the disc aura and the ring flash */
export function surpriseColor(kind: SurpriseKind): number {
  if (kind === 'slow') return GREEN
  if (kind === 'freeze') return ICE
  if (isGoodSurprise(kind)) return GOLD
  return EVIL
}

/**
 * Draws the icon into g (center 0,0, inscribed in a circle of ~0.55R).
 * t is the time that keeps the lines slightly alive (a shimmer of the stroke).
 */
export function drawSurpriseIcon(g: Graphics, kind: SurpriseKind, R: number, t: number) {
  g.clear()
  const s = R * 0.5
  const evil = !isGoodSurprise(kind)
  const col = surpriseColor(kind)
  const breathe = 0.8 + 0.2 * Math.sin(t * 3)
  const stroke = { width: Math.max(3, R * 0.045), color: col, alpha: breathe, cap: 'round' as const, join: 'round' as const }

  if (kind === 'life' || kind === 'lifeTrap') {
    if (kind === 'life') {
      // a WHOLE warm heart: golden outline + soft warm fill + a highlight
      heartPath(g, s)
      g.fill({ color: col, alpha: 0.16 })
      heartPath(g, s)
      g.stroke(stroke)
      g.circle(-s * 0.34, -s * 0.16, s * 0.11).fill({ color: 0xffffff, alpha: 0.55 * breathe })
    } else {
      // a BROKEN heart: violet-crimson, with a crack down the middle
      heartPath(g, s)
      g.fill({ color: EVIL_DEEP, alpha: 0.16 })
      heartPath(g, s)
      g.stroke(stroke)
      // the crack: first the dark split (the heart is really broken), then the bright line
      const crack: [number, number][] = [
        [0, -s * 0.30], [-s * 0.20, -s * 0.02], [s * 0.16, s * 0.14],
        [-s * 0.12, s * 0.38], [s * 0.04, s * 0.70],
      ]
      const path = () => {
        g.moveTo(crack[0][0], crack[0][1])
        for (let i = 1; i < crack.length; i++) g.lineTo(crack[i][0], crack[i][1])
      }
      path(); g.stroke({ ...stroke, color: INK, alpha: 1, width: stroke.width * 2.3 })
      path(); g.stroke({ ...stroke, color: EVIL, alpha: breathe, width: stroke.width * 0.85 })
    }
  } else if (kind === 'score' || kind === 'scoreTrap') {
    // a gift: a box + a ribbon + a bow of two loops
    const w = s * 1.15, h = s * 0.95
    g.roundRect(-w / 2, -h * 0.35, w, h, s * 0.12)
    g.fill({ color: evil ? EVIL_DEEP : col, alpha: evil ? 0.14 : 0.10 })
    g.roundRect(-w / 2, -h * 0.35, w, h, s * 0.12)
    g.stroke(stroke)
    if (kind === 'score') {
      // the lid sits straight, the bow is whole - a gift
      g.roundRect(-w * 0.58, -h * 0.35 - s * 0.22, w * 1.16, s * 0.24, s * 0.08)
      g.stroke(stroke)
      g.moveTo(0, -h * 0.35).lineTo(0, h * 0.6)
      g.stroke(stroke)
      g.ellipse(-s * 0.22, -h * 0.35 - s * 0.40, s * 0.22, s * 0.14)
      g.ellipse(s * 0.22, -h * 0.35 - s * 0.40, s * 0.22, s * 0.14)
      g.stroke(stroke)
    } else {
      // A TRAP: the lid is torn sideways and an arrow points DOWN out of the box (points leaking)
      g.moveTo(-w * 0.60, -h * 0.42).lineTo(w * 0.52, -h * 0.72)
      g.stroke({ ...stroke, width: stroke.width * 1.1 })
      g.moveTo(0, -h * 0.12).lineTo(0, h * 0.42)
      g.moveTo(-s * 0.24, h * 0.16).lineTo(0, h * 0.44).lineTo(s * 0.24, h * 0.16)
      g.stroke({ ...stroke, width: stroke.width * 0.85 })
    }
  } else if (kind === 'slow' || kind === 'fast') {
    // an hourglass
    const w = s * 0.8, h = s * 0.9
    g.moveTo(-w, -h).lineTo(w, -h).lineTo(-w, h).lineTo(w, h).closePath()
    g.stroke(stroke)
    g.circle(0, 0, s * 0.08).fill({ color: 0xffffff, alpha: 0.9 })
    if (kind === 'fast') {
      // speed lines - the catch "time started running"
      for (let i = 0; i < 3; i++) {
        const y = -s * 0.4 + i * s * 0.4
        g.moveTo(w * 1.5, y).lineTo(w * 2.1, y)
        g.stroke({ ...stroke, width: stroke.width * 0.7, alpha: breathe * 0.8 })
      }
    } else {
      // slowdown dots on an orbit
      for (let i = 0; i < 3; i++) {
        const a = t * 0.8 + (i / 3) * Math.PI * 2
        g.circle(Math.cos(a) * s * 1.15, Math.sin(a) * s * 1.15, s * 0.06)
        g.fill({ color: col, alpha: 0.75 })
      }
    }
  } else if (kind === 'help') {
    // a question mark: an arc + a stem + a dot
    g.arc(0, -s * 0.35, s * 0.4, Math.PI * 0.85, Math.PI * 2.15)
    g.stroke(stroke)
    const ex = Math.cos(Math.PI * 2.15) * s * 0.4, ey = -s * 0.35 + Math.sin(Math.PI * 2.15) * s * 0.4
    g.moveTo(ex, ey).quadraticCurveTo(ex * 0.3, s * 0.05, 0, s * 0.22)
    g.stroke(stroke)
    g.circle(0, s * 0.62, stroke.width * 0.75).fill({ color: col, alpha: breathe })
  } else if (kind === 'rotation') {
    // a circular arrow
    g.arc(0, 0, s * 0.72, -Math.PI * 0.4, Math.PI * 0.9)
    g.stroke(stroke)
    const aEnd = Math.PI * 0.9
    const hx = Math.cos(aEnd) * s * 0.72, hy = Math.sin(aEnd) * s * 0.72
    const dir = aEnd + Math.PI / 2
    const ah = s * 0.28
    g.moveTo(hx + Math.cos(dir - 0.5) * ah, hy + Math.sin(dir - 0.5) * ah)
      .lineTo(hx, hy)
      .lineTo(hx + Math.cos(dir - Math.PI + 0.5) * ah, hy + Math.sin(dir - Math.PI + 0.5) * ah)
    g.stroke(stroke)
  } else if (kind === 'freeze') {
    // a snowflake: 6 rays with twigs (ice = time fully frozen)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t * 0.15
      const dx = Math.cos(a), dy = Math.sin(a)
      g.moveTo(0, 0).lineTo(dx * s, dy * s)
      for (const f of [0.55, 0.8]) {
        const bx = dx * s * f, by = dy * s * f
        const bl = s * (f === 0.55 ? 0.3 : 0.18)
        for (const da of [0.6, -0.6]) {
          g.moveTo(bx, by).lineTo(bx + Math.cos(a + da) * bl, by + Math.sin(a + da) * bl)
        }
      }
    }
    g.stroke({ ...stroke, width: stroke.width * 0.8 })
    g.circle(0, 0, s * 0.12).fill({ color: 0xffffff, alpha: 0.9 })
  } else if (kind === 'transfer') {
    // a disc dot with arrows left and right: the disc is going to travel
    g.circle(0, 0, s * 0.34)
    g.stroke(stroke)
    for (const dir of [1, -1]) {
      const x0 = dir * s * 0.55, x1 = dir * s * 1.05
      g.moveTo(x0, 0).lineTo(x1, 0)
      g.moveTo(x1 - dir * s * 0.22, -s * 0.2).lineTo(x1, 0).lineTo(x1 - dir * s * 0.22, s * 0.2)
      g.stroke(stroke)
    }
  } else if (kind === 'warp') {
    // a wobbling outline: a circle with a wave along the radius - the shape will float
    const n = 40
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2
      const r = s * (0.72 + 0.16 * Math.sin(a * 5 + t * 3))
      const px = Math.cos(a) * r, py = Math.sin(a) * r
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py)
    }
    g.stroke(stroke)
    g.circle(0, 0, s * 0.1).fill({ color: 0xffffff, alpha: 0.8 })
  } else if (kind === 'colorMusic') {
    // a musical note (head + stem + flag) and shimmering arcs around it
    g.ellipse(-s * 0.22, s * 0.42, s * 0.26, s * 0.18)
    g.fill({ color: col, alpha: 0.85 })
    g.moveTo(s * 0.02, s * 0.4).lineTo(s * 0.02, -s * 0.5)
    g.stroke(stroke)
    g.moveTo(s * 0.02, -s * 0.5).quadraticCurveTo(s * 0.45, -s * 0.35, s * 0.34, s * 0.02)
    g.stroke({ ...stroke, width: stroke.width * 0.8 })
    for (let i = 0; i < 3; i++) {
      const rr = s * (0.85 + i * 0.16)
      g.arc(0, 0, rr, -0.9 + Math.sin(t * 2 + i) * 0.1, -0.2)
      g.stroke({ ...stroke, width: stroke.width * 0.55, alpha: breathe * (0.7 - i * 0.15) })
    }
  } else if (kind === 'inversion') {
    // a negative: a circle with the left half filled and antipodal dots left and right
    g.circle(0, 0, s * 0.8)
    g.stroke(stroke)
    g.moveTo(0, -s * 0.8).arc(0, 0, s * 0.8, -Math.PI / 2, Math.PI / 2, true).closePath()
    g.fill({ color: EVIL_DEEP, alpha: 0.6 })
    g.circle(s * 0.36, 0, s * 0.13).fill({ color: col, alpha: 0.9 })
    g.circle(-s * 0.36, 0, s * 0.13).fill({ color: INK, alpha: 0.95 })
  } else { // explosion - a flash star of 8 rays
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * 0.4
      const r0 = s * 0.25, r1 = s * (i % 2 === 0 ? 0.95 : 0.6)
      g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0).lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
      g.stroke(stroke)
    }
    g.circle(0, 0, s * 0.16).fill({ color: 0xffffff, alpha: 0.9 })
  }

  // The rule: evil is crossed out. The stroke is drawn LAST, over the whole silhouette
  if (evil) drawBan(g, s, stroke.width, breathe)
}

/**
 * A FAT "no" diagonal across the whole icon (in hm1 the evil ones were crossed out; the
 * mother in the playtest did not read it, which means the stroke was too weak).
 * Four layers: a wide dark cut -> a violet band -> a light core.
 * The width grew from 2.6w to 4.4w - the stroke is now the FIRST thing the eye sees.
 */
function drawBan(g: Graphics, s: number, w: number, breathe: number) {
  const r = s * 1.34
  const x0 = -r * 0.76, y0 = -r * 0.76, x1 = r * 0.76, y1 = r * 0.76
  const line = () => g.moveTo(x0, y0).lineTo(x1, y1)
  // the stroke width is tied BOTH to the line width and to the icon size: at a small
  // scale (dev sheet, small disc) multipliers of w alone ate the whole silhouette
  const b = Math.max(w, s * 0.085)
  line(); g.stroke({ width: b * 3.4, color: INK, alpha: 0.95, cap: 'round' })
  line(); g.stroke({ width: b * 2.3, color: EVIL_DEEP, alpha: 0.95, cap: 'round' })
  line(); g.stroke({ width: b * 1.35, color: SLASH, alpha: 0.98 * breathe, cap: 'round' })
  line(); g.stroke({ width: b * 0.42, color: 0xe8d0ff, alpha: 0.9 * breathe, cap: 'round' })
}

function heartPath(g: Graphics, s: number) {
  g.moveTo(0, s * 0.7)
  g.bezierCurveTo(-s * 1.15, s * 0.05, -s * 0.75, -s * 0.75, 0, -s * 0.3)
  g.bezierCurveTo(s * 0.75, -s * 0.75, s * 1.15, s * 0.05, 0, s * 0.7)
  g.closePath()
}
