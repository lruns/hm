// Flame wings at the sides of the disc - the spirit of his 2017 blue ornament, recreated
// procedurally: three petal feathers per side, swaying, flaring up with the streak,
// fading in hush. Drawn every frame into Graphics with additive blending (+bloom on top).

import { Graphics } from 'pixi.js'
import { lerpColor } from '../color'

// ── THE WINGS ON A LONG SCALE ──────────────────────────────────────────────
// Andrey: «слишком мега-эффекты, пик — это то, что я вижу на комбо 100».
// The wings used to be linear in intensity, and the intensity hit its ceiling on the
// twelfth answer - so EVERYONE saw full wings on the very first level. Now: below
// WINGS_START there are none at all (a streak under 10 gets only sparks), after that the
// growth is compressed by the WINGS_GAMMA power, and the full size is reached exactly at
// the top of the scale (combo 100).
//
// ! IMPORTANT: the geometry at vis = 1 is UNTOUCHED. The same wings are drawn around the
// Play button on the splash with intensity = 1 (Andrey's decision: the menu is a
// showcase, beauty right away) and its layout is computed for the current span (see wFit
// in renderSplash). Only the PATH to the maximum changes, not the maximum.
/** below this intensity there are no wings at all (~ a streak of 10 on COMBO_CURVE) */
const WINGS_START = 0.17
/** >1 compresses the lower half of the path: the growth is felt late and strongly */
const WINGS_GAMMA = 1.45

export interface WingsFrame {
  R: number; t: number
  intensity: number; hush: number; pulsePhase: number
  accent: number
  /** quality: how many feathers per side (3 = full, 2 = the economical mode).
   *  The INNER, smallest feather (i=2) is the one removed: the silhouette is held by the
   *  two outer ones, so the loss reads as "the wing is a bit thinner", not "the wing is
   *  broken". Each feather is two Bezier curves with a fill and a stroke, i.e. its own
   *  Graphics batch every frame. */
  detail?: number
}

export function drawWings(g: Graphics, f: WingsFrame) {
  g.clear()
  // the scale: 0 up to WINGS_START, then compressed growth, exactly 1 at intensity = 1
  const k = Math.max(0, (f.intensity - WINGS_START) / (1 - WINGS_START))
  const vis = Math.pow(Math.min(1, k), WINGS_GAMMA) * (1 - f.hush)
  if (vis < 0.004) return
  // A THRESHOLD WITHOUT A CLICK: at the very edge of the scale the wings do not switch
  // on, they emerge - otherwise at a streak of 10 they would appear at alpha 0.1 in one frame
  const entry = Math.min(1, vis / 0.12)
  const beat = 1 + 0.05 * Math.sin(f.pulsePhase)
  const R = f.R
  const feathers = f.detail ?? 3
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < feathers; i++) {
      const k = 1 - i * 0.24 // feather scale: from the large outer one to the small one
      const sw = Math.sin(f.t * (1.1 + i * 0.35) + i * 1.9 + (side > 0 ? 0 : 2.4))
      const reach = R * (1.1 + 1.15 * k * (0.55 + 0.45 * vis)) * beat
      const rise = R * (1.55 * k + 0.35 * vis) * beat
      const tipX = side * (reach + sw * R * 0.07)
      const tipY = -rise + sw * R * 0.05
      const baseX = side * R * (0.72 + 0.12 * i)
      const baseY = R * (0.78 - 0.16 * i)
      g.moveTo(baseX, baseY)
      g.bezierCurveTo(
        side * reach * 1.06, R * (0.42 - 0.1 * i),
        side * reach * 1.02, -rise * 0.35,
        tipX, tipY,
      )
      g.bezierCurveTo(
        side * R * (0.95 + 0.5 * k), -rise * 0.55,
        side * R * (0.8 + 0.1 * i), -R * 0.05,
        baseX, baseY,
      )
      g.closePath()
      // a fill of 0.045..0.12 read as a BARE WHITE SKELETON (especially on the light
      // frame of the results) - a feather must be softly filled with the light of the world
      g.fill({ color: lerpColor(f.accent, 0xffffff, 0.15 + i * 0.2), alpha: (0.09 + 0.13 * vis) * entry })
      g.stroke({
        width: 1.5 + (2 - i) * 0.8,
        color: lerpColor(f.accent, 0xffffff, 0.35 + i * 0.25),
        alpha: (0.16 + 0.42 * vis) * entry * (0.8 + 0.2 * Math.sin(f.pulsePhase + i)),
      })
    }
  }
}
