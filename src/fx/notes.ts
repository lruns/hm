// MusicViz - the audio-reactive visual layer (Canvas2D, visible everywhere, no WebGL).
// Subscribed to the shared note bus (notebus.ts): the engine knows every note BEFORE it
// sounds, so the visuals do not chase the sound, they MEET it - a droplet is born above
// the disc and reaches it exactly at the moment `when`.
//
// Three things from Andrey's own description of the vision:
//   1) THE NOTE FALL - a river through the disc: bass = a wide wave of the channel,
//      arp = a fast droplet with a core, spark = a splash. The pattern of droplets
//      follows the level pattern (the seed is deterministic), so different levels look
//      like visibly different flows.
//   2) WAVES OF MUSIC "somewhere else" - soft concentric circles from the disc across
//      the background on the beat; a bass note = a wide slow wave out to the edges.
//   3) THE BACKGROUND "painted with you" - every correct answer drops a persistent
//      brush of light at the place of the orbit; it lives until the end of the level and
//      the picture is lit up on the results screen.
//
// Restraint (the dynamic range of the original): in silence (streak 0 -> no bass/arp
// notes) the flow is empty and the waves are barely visible; the storm opens it up and
// thickens it. Everything lives UNDER the game - near the number the droplets fade (the
// readability protector).

import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { hexNum } from '../color'
import { clamp01, TAU } from '../util'
import { noteBus, type NoteLayer } from '../notebus'

interface Drop {
  layer: NoteLayer
  when: number // ctx time of the sound - the droplet is at the disc exactly then
  midi: number
  vel: number
  lane: number // lateral lane in the channel (from the pitch) - the drawing of the pattern
  seed: number
}

interface Wave {
  born: number // ctx time of birth
  maxR: number
  speed: number
  w: number // stroke width
  a0: number // starting alpha
  col: number
}

interface Brush {
  sprite: Sprite
  born: number
  baseA: number
}

/** the meeting horizon: a droplet is born this many seconds before `when` (= the music LOOKAHEAD) */
const LEAD = 0.4

export interface VizFrame {
  audioNow: number // ctx.currentTime (0 if the audio is not open yet)
  t: number // frame time (for the breathing of the brushes and of the results screen)
  cx: number; cy: number; R: number; W: number; H: number
  intensity: number // 0..1 the storm axis (= the streak)
  hush: number // 0..1 silence after a mistake
  multiplier: number
  resultsGlow: boolean // on the results screen we light the background picture up
}

export class MusicViz {
  // the layers are mounted by the engine at different places of the scene (see engine.buildScene)
  readonly paint = new Container() // persistent brushes - low, among the background nebulae
  readonly waves = new Graphics() // waves of music across the background
  readonly flow = new Graphics() // the note-fall river at the disc

  private drops: Drop[] = []
  private waveList: Wave[] = []
  private brushes: Brush[] = []
  private glowTex: Texture

  private accent = 0xffd54a
  private mid = 0x8850ff
  private off?: () => void

  constructor(glowTex: Texture) {
    this.glowTex = glowTex
    this.waves.blendMode = 'add'
    this.flow.blendMode = 'add'
    // subscribing to the note bus: notes are sorted into visual roles
    this.off = noteBus.on((e) => {
      if (this.drops.length < 120) {
        this.drops.push({
          layer: e.layer, when: e.when, midi: e.midi, vel: e.velocity,
          lane: ((e.midi % 12) / 12 - 0.5) * 2, seed: (e.midi * 2654435761) >>> 0,
        })
      }
      // a bass note = a wide slow wave out to the edges of the screen
      if (e.layer === 'bass' && this.waveList.length < 48) {
        this.waveList.push({ born: e.when, maxR: 1, speed: 1, w: 7, a0: 0.42, col: this.mid })
      }
    })
  }

  setPalette(_deep: string, mid: string, accent: string) {
    this.accent = hexNum(accent)
    this.mid = hexNum(mid)
  }

  /** a wave on a BEAT_HZ beat (a strong one is wider and brighter). Called by the engine on a beat boundary. */
  beatWave(strong: boolean, audioNow: number, intensity: number) {
    if (this.waveList.length >= 48) return
    this.waveList.push({
      born: audioNow, maxR: 1, speed: 1,
      w: strong ? 3.2 : 2, a0: (strong ? 0.3 : 0.16) * (0.35 + 0.65 * intensity), col: this.accent,
    })
  }

  /** a correct answer drops a persistent brush at the orbit point (the background is painted with you) */
  addBrush(x: number, y: number, col: number, audioNow: number) {
    const sp = new Sprite(this.glowTex)
    sp.anchor.set(0.5); sp.blendMode = 'add'; sp.tint = col
    const r = 26 + Math.random() * 22
    sp.width = sp.height = r
    sp.position.set(x, y)
    sp.alpha = 0
    this.paint.addChild(sp)
    this.brushes.push({ sprite: sp, born: audioNow, baseA: 0.16 + Math.random() * 0.1 })
    if (this.brushes.length > 90) { // a soft ceiling - the oldest brush dissolves
      const old = this.brushes.shift()!
      old.sprite.destroy()
    }
  }

  /** end of a level: the background picture is reset (the next level is painted anew) */
  clearPaint() {
    for (const b of this.brushes) b.sprite.destroy()
    this.brushes = []
  }

  render(f: VizFrame) {
    const now = f.audioNow
    this.renderFlow(f, now)
    this.renderWaves(f, now)
    this.renderPaint(f, now)
  }

  // ---- the note fall: a river of droplets through the disc ----
  private renderFlow(f: VizFrame, now: number) {
    const g = this.flow
    g.clear()
    if (now <= 0) { this.drops = []; return }
    const speed = (f.cy + 60) / LEAD // the droplet is at the disc (y=0) exactly at `when`
    const halfCh = f.R * 1.55 // channel width - slightly wider than the disc
    const botLimit = (f.H - f.cy) + 70
    const topLimit = -(f.cy + 70)
    // the overall dynamic range: quiet at rest, thicker in the storm, almost mute in hush
    const vis = (0.32 + 0.68 * f.intensity) * (1 - f.hush * 0.7)
    if (vis <= 0.01) { this.drops = this.drops.filter((d) => now < d.when + botLimit / speed); return }

    const keep: Drop[] = []
    for (const d of this.drops) {
      const y = (now - d.when) * speed
      if (y > botLimit) continue // it went below - let it go
      if (y > topLimit) keep.push(d); else { keep.push(d); continue }
      const x = f.cx + d.lane * halfCh
      // near the number the droplets fade - readability beats beauty (the protector)
      const near = clamp01(Math.abs(y) / (f.R * 1.05))
      const av = vis * near
      if (av <= 0.01) continue

      if (d.layer === 'bass') {
        // a wide wave of the channel: a soft horizontal band + a light thread
        const bw = halfCh * (1.1 + 0.5 * d.vel)
        const bh = f.R * (0.16 + 0.12 * d.vel)
        g.ellipse(x, f.cy + y, bw, bh).fill({ color: this.mid, alpha: av * 0.16 })
        g.moveTo(x - bw, f.cy + y).lineTo(x + bw, f.cy + y)
          .stroke({ width: 2 + 2 * d.vel, color: this.accent, alpha: av * 0.32 })
      } else if (d.layer === 'arp') {
        // a fast droplet with a core + a vertical tail (river streak)
        const core = f.R * (0.06 + 0.07 * d.vel)
        const tail = f.R * (0.9 + 0.6 * d.vel)
        g.moveTo(x, f.cy + y).lineTo(x, f.cy + y - tail)
          .stroke({ width: core * 0.9, color: this.accent, alpha: av * 0.4 })
        g.circle(x, f.cy + y, core).fill({ color: 0xffffff, alpha: av * 0.85 })
        g.circle(x, f.cy + y, core * 2.1).fill({ color: this.accent, alpha: av * 0.3 })
      } else if (d.layer === 'spark') {
        // a splash spark: a white-hot core + short rays
        const rad = f.R * (0.04 + 0.05 * d.vel)
        g.circle(x, f.cy + y, rad).fill({ color: 0xffffff, alpha: av })
        g.circle(x, f.cy + y, rad * 3).fill({ color: this.accent, alpha: av * 0.28 })
        for (let i = 0; i < 4; i++) {
          const a = d.seed + i * (TAU / 4)
          const rr = rad * (3 + 2 * d.vel)
          g.moveTo(x, f.cy + y).lineTo(x + Math.cos(a) * rr, f.cy + y + Math.sin(a) * rr)
            .stroke({ width: 1.2, color: 0xffffff, alpha: av * 0.5 })
        }
      }
    }
    this.drops = keep
  }

  // ---- waves of music "somewhere else": concentric circles from the disc ----
  private renderWaves(f: VizFrame, now: number) {
    const g = this.waves
    g.clear()
    if (now <= 0) { this.waveList = []; return }
    const edge = Math.hypot(f.W, f.H) * 0.55
    const vis = 0.22 + 0.78 * f.intensity // more visible in the storm, but always a little alive
    const keep: Wave[] = []
    for (const w of this.waveList) {
      // lazy geometry is computed once (a bass wave arrives with maxR=1 as a placeholder)
      if (w.maxR === 1) {
        if (w.col === this.mid) { w.maxR = edge; w.speed = edge / 1.2 } // bass: out to the edges, slowly
        else { w.maxR = f.R * 3.6; w.speed = (f.R * 3.6) / 0.85 } // beat: a middle radius
      }
      const r = (now - w.born) * w.speed
      if (r < 0) { keep.push(w); continue }
      const frac = r / w.maxR
      if (frac >= 1) continue
      const a = w.a0 * Math.pow(1 - frac, 1.4) * vis
      if (a > 0.004) g.circle(f.cx, f.cy, r).stroke({ width: w.w, color: w.col, alpha: a })
      keep.push(w)
    }
    this.waveList = keep
  }

  // ---- the background "painted with you": persistent brushes, lit on the results ----
  private renderPaint(f: VizFrame, _now: number) {
    for (const b of this.brushes) {
      const age = f.t // frame breathing (born is on the ctx clock, the breathing is on the frame clock)
      const breathe = 0.85 + 0.15 * Math.sin(age * 1.3 + b.sprite.x * 0.01)
      // on the results screen the picture softly lights up - "look what you painted"
      const glow = f.resultsGlow ? 1.7 + 0.5 * Math.sin(age * 2.2 + b.sprite.y * 0.02) : 1
      // a soft alpha ramp-in (the first frames after birth)
      const inA = Math.min(1, b.sprite.alpha + 0.08)
      b.sprite.alpha = Math.min(inA, b.baseA * breathe * glow * (0.5 + 0.9 * f.intensity + (f.resultsGlow ? 0.6 : 0)))
    }
  }

  destroy() {
    if (this.off) this.off()
    this.clearPaint()
    this.waves.destroy(); this.flow.destroy(); this.paint.destroy({ children: true })
  }
}
