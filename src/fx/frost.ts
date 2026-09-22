// Frost - FULLSCREEN ice for the freeze and slowdown surprises. Andrey: «на заморозке
// не вижу айса — эффекты такие должны быть на весь экран».
// A frost vignette at the edges (soft white-blue gradients) + crystals that grow along
// the perimeter. The center of the screen stays clean so the number is readable.
// The strength comes from outside (the engine drives it from slowmoT): it grows and melts.

import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { TAU } from '../util'

/** the frost vignette: clean center, a white-blue haze at the edges */
function makeFrostTexture(): Texture {
  const c = document.createElement('canvas'); c.width = c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(256, 256, 165, 256, 256, 368)
  grad.addColorStop(0, 'rgba(185,225,255,0)')
  grad.addColorStop(0.5, 'rgba(185,225,255,0.18)')
  grad.addColorStop(0.8, 'rgba(205,236,255,0.5)')
  grad.addColorStop(1, 'rgba(232,246,255,0.82)')
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512)
  // reinforce the edges themselves: thin linear frost bands along each side
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    const lg = g.createLinearGradient(x0, y0, x1, y1)
    lg.addColorStop(0, 'rgba(215,240,255,0.55)')
    lg.addColorStop(1, 'rgba(215,240,255,0)')
    g.fillStyle = lg; g.fillRect(0, 0, 512, 512)
  }
  edge(0, 0, 90, 0); edge(512, 0, 422, 0); edge(0, 0, 0, 90); edge(0, 512, 0, 422)
  return Texture.from(c)
}

/** a snowflake crystal: 6 rays with twigs, drawn once */
function drawCrystal(g: Graphics, s: number, col: number) {
  const w = Math.max(1.2, s * 0.09)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU
    const dx = Math.cos(a), dy = Math.sin(a)
    g.moveTo(0, 0).lineTo(dx * s, dy * s)
    // twigs at 55% and 80% of the ray
    for (const f of [0.55, 0.8]) {
      const bx = dx * s * f, by = dy * s * f
      const bl = s * (f === 0.55 ? 0.3 : 0.18)
      for (const da of [0.6, -0.6]) {
        g.moveTo(bx, by).lineTo(bx + Math.cos(a + da) * bl, by + Math.sin(a + da) * bl)
      }
    }
  }
  g.stroke({ width: w, color: col, alpha: 0.9, cap: 'round' })
  g.circle(0, 0, s * 0.1).fill({ color: 0xffffff, alpha: 0.9 })
}

interface Crystal {
  g: Graphics
  edge: number   // 0 top, 1 bottom, 2 left, 3 right
  frac: number   // position along the edge 0..1
  inset: number  // inset from the edge, px
  rot: number
  ph: number
  thr: number    // appearance threshold: the crystals freeze on one by one
  size: number
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export class Frost {
  readonly layer = new Container()
  private vign: Sprite
  private crystals: Crystal[] = []
  private cur = 0
  private W = 1440; private H = 900

  constructor() {
    this.layer.visible = false
    this.vign = new Sprite(makeFrostTexture())
    this.vign.blendMode = 'screen'
    this.layer.addChild(this.vign)
    const cols = [0xffffff, 0xdff4ff, 0xbfe9ff]
    for (let i = 0; i < 34; i++) {
      const g = new Graphics()
      const size = i < 6 ? 26 + Math.random() * 16 : 9 + Math.random() * 14
      drawCrystal(g, size, cols[i % cols.length])
      g.blendMode = 'add'
      this.layer.addChild(g)
      this.crystals.push({
        g, edge: i % 4, frac: Math.random(),
        inset: 14 + Math.random() * (i < 6 ? 46 : 70),
        rot: Math.random() * TAU, ph: Math.random() * TAU,
        thr: Math.random() * 0.6, size,
      })
    }
    this.place()
  }

  resize(W: number, H: number) {
    this.W = W; this.H = H
    this.vign.width = W; this.vign.height = H
    this.place()
  }

  private place() {
    for (const c of this.crystals) {
      if (c.edge === 0) c.g.position.set(c.frac * this.W, c.inset)
      else if (c.edge === 1) c.g.position.set(c.frac * this.W, this.H - c.inset)
      else if (c.edge === 2) c.g.position.set(c.inset, c.frac * this.H)
      else c.g.position.set(this.W - c.inset, c.frac * this.H)
    }
  }

  /** target 0..1 comes from outside (the engine drives it from slowmoT: it freezes and melts) */
  render(dt: number, t: number, target: number) {
    this.cur += (target - this.cur) * Math.min(1, dt * 6)
    if (this.cur < 0.012 && target === 0) {
      this.cur = 0
      if (this.layer.visible) this.layer.visible = false
      return
    }
    this.layer.visible = true
    this.vign.alpha = this.cur * 0.85
    for (const c of this.crystals) {
      const k = smooth(c.thr, c.thr + 0.3, this.cur)
      c.g.alpha = k * (0.55 + 0.35 * Math.sin(t * 2 + c.ph)) * Math.min(1, this.cur * 2)
      c.g.scale.set(0.45 + 0.55 * k)
      c.g.rotation = c.rot + Math.sin(t * 0.5 + c.ph) * 0.06
    }
  }
}
