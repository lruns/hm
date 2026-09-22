// Cosmos - the living background: the palette gradient, pressed down by darkness when
// it is quiet, breathing nebulae and twinkling stars. Interface: setPalette / resize /
// render. Dynamic range: in silence the background is almost black, the storm opens the
// color up.

import { Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js'
import {
  makeGradientSurface, makeIrisSurface, makeVignetteTexture, makeGrainTexture,
  makeStarGlintTexture, makePlanetSurface, type PaintSurface,
} from './textures'
import { hexNum, lerpColor } from '../color'
import { TAU } from '../util'
import { VIBE } from '../vibe'

export interface CosmosFrame {
  dt: number; t: number
  intensity: number; pulse: number; pulsePhase: number; hush: number
}

export class Cosmos {
  readonly layer = new Container()

  private grad: Sprite
  private gradS: PaintSurface<[string, string]>
  private irisS: PaintSurface<[string, string, string]>
  // the palette last BAKED into the textures: during a palette move setPalette is called
  // every frame, but we touch the canvases only when the color really shifted
  private baked: [number, number, number] = [-1, -1, -1]
  // DEPTH OF THE BACKGROUND: a flat vertical gradient turned into a layered frame.
  // iris - a diagonal three-tone shimmer over the base (breathing slowly),
  // grain - film grain (kills banding), vign - a vignette in the corners.
  private iris: Sprite
  private grain: TilingSprite
  private vign: Sprite
  private dim = new Graphics()
  // ci - index of the palette tone (0 deep, 1 mid, 2 accent);
  // far - the FAR class of nebulae (flag cosmosDepth): bigger, slower and dimmer than
  // the near ones - they give the frame its air and depth
  private nebula: { sprite: Sprite; x: number; y: number; dx: number; dy: number; ph: number; ci: number; far: boolean }[] = []
  private stars: { sprite: Sprite; x: number; y: number; ph: number }[] = []
  // large star glints (little crosses) over the ordinary star field
  private glints: { sprite: Sprite; x: number; y: number; ph: number; k: number }[] = []
  // the planet arc at the bottom edge (null when the cosmosDepth flag is off)
  private planet: Sprite | null = null
  private planetS: PaintSurface<[string, string, string]> | null = null
  private W = 1440; private H = 900

  constructor(glowTex: Texture) {
    this.gradS = makeGradientSurface('#05060d', '#141a3a')
    this.grad = new Sprite(this.gradS.texture)
    this.layer.addChild(this.grad)
    this.irisS = makeIrisSurface('#05060d', '#141a3a', '#38c0ff')
    this.iris = new Sprite(this.irisS.texture)
    this.iris.blendMode = 'screen'; this.iris.alpha = 0.10
    this.layer.addChild(this.iris)
    this.layer.addChild(this.dim)
    // ── THE PLANET ARC (flag cosmosDepth) ──────────────────────────────────
    // It sits BETWEEN the gradient and the nebulae - it is the farthest thing, and the
    // nebulae must drift in front of it. The center of the sphere is moved below the
    // screen (see resize), only the top edge with its rim is visible.
    if (VIBE.cosmosDepth) {
      this.planetS = makePlanetSurface('#05060d', '#141a3a', '#38c0ff')
      this.planet = new Sprite(this.planetS.texture)
      this.planet.anchor.set(0.5)
      this.planet.alpha = 0.5
      this.layer.addChild(this.planet)
    }
    // ── NEBULAE: 6 near ones + 4 far ones when cosmosDepth is on ───────────
    // The far ones are added FIRST so that they lie behind the near ones.
    if (VIBE.cosmosDepth) {
      for (let i = 0; i < 4; i++) {
        const sp = new Sprite(glowTex); sp.anchor.set(0.5); sp.blendMode = 'add'
        this.layer.addChild(sp)
        this.nebula.push({
          sprite: sp, x: Math.random(), y: Math.random(),
          dx: (Math.random() - 0.5) * 0.005, dy: (Math.random() - 0.5) * 0.005,
          ph: Math.random() * TAU, ci: i % 2, far: true,   // tints: deep / mid
        })
      }
    }
    for (let i = 0; i < 6; i++) {
      const sp = new Sprite(glowTex); sp.anchor.set(0.5); sp.blendMode = 'add'
      this.layer.addChild(sp)
      this.nebula.push({
        sprite: sp, x: Math.random(), y: Math.random(),
        dx: (Math.random() - 0.5) * 0.012, dy: (Math.random() - 0.5) * 0.012,
        ph: Math.random() * TAU, ci: 1 + (i % 2), far: false, // tints: mid / accent
      })
    }
    for (let i = 0; i < 110; i++) {
      const sp = new Sprite(glowTex); sp.anchor.set(0.5); sp.tint = 0xcfe8ff
      const r = 1 + Math.random() * 2.2; sp.width = sp.height = r * 3
      this.layer.addChild(sp)
      this.stars.push({ sprite: sp, x: Math.random(), y: Math.random(), ph: Math.random() * TAU })
    }
    // ── STAR GLINTS (flag cosmosDepth): 9 large ones with crosses ──────────
    if (VIBE.cosmosDepth) {
      const glintTex = makeStarGlintTexture()
      for (let i = 0; i < 9; i++) {
        const sp = new Sprite(glintTex); sp.anchor.set(0.5); sp.blendMode = 'add'
        this.layer.addChild(sp)
        this.glints.push({
          sprite: sp, x: Math.random(), y: Math.random(),
          ph: Math.random() * TAU, k: 0.7 + Math.random() * 0.8,
        })
      }
    }
    // grain and vignette go over the whole background (but under the game): texture and depth
    this.grain = new TilingSprite({ texture: makeGrainTexture(), width: 1440, height: 900 })
    this.grain.blendMode = 'overlay'; this.grain.alpha = 0.05
    this.layer.addChild(this.grain)
    this.vign = new Sprite(makeVignetteTexture())
    this.layer.addChild(this.vign)
  }

  /**
   * The world palette. Called EVERY FRAME while a palette move is running: the tints
   * (cheap) are always updated, while the gradient and shimmer canvases (expensive, they
   * need an upload) only when the color shifted visibly to the eye (>=3/255).
   */
  setPalette(deep: string, mid: string, accent: string) {
    const d = hexNum(deep), m = hexNum(mid), a = hexNum(accent)
    const far = (x: number, y: number) =>
      Math.abs(((x >> 16) & 255) - ((y >> 16) & 255)) >= 3 ||
      Math.abs(((x >> 8) & 255) - ((y >> 8) & 255)) >= 3 ||
      Math.abs((x & 255) - (y & 255)) >= 3
    if (far(d, this.baked[0]) || far(m, this.baked[1]) || far(a, this.baked[2])) {
      this.gradS.paint(deep, mid)
      // the shimmer: deep -> mid -> accent along the diagonal (three tones of one world)
      this.irisS.paint(deep, mid, accent)
      // the planet is re-baked RIGHT HERE: the move throttling is already ours
      this.planetS?.paint(deep, mid, accent)
      this.baked = [d, m, a]
    }
    // nebula tints: the near ones mid/accent, the far ones deep/mid (they are behind
    // the frame and glow in the color of the night)
    const tone = [d, m, a]
    for (const n of this.nebula) n.sprite.tint = tone[n.ci]
    // STARS: they used to be a fixed blue 0xcfe8ff with any palette. Now it is white
    // with a touch of the accent - the star field belongs to its world but stays almost
    // white (otherwise the feeling of stars is lost).
    const st = lerpColor(0xffffff, hexNum(accent), 0.35)
    for (const s of this.stars) s.sprite.tint = st
    // the glint crosses stay closer to white than the field: these are the BRIGHTEST stars
    const gt = lerpColor(0xffffff, a, 0.22)
    for (const g of this.glints) g.sprite.tint = gt
  }

  /** quality: we drop the most expensive things in the background - the FAR PLANE (4
   *  screen-sized additive nebulae, i.e. pure fill, plus 9 star glints) and the film
   *  grain (a fullscreen TilingSprite with overlay blend - another pass over every pixel
   *  each frame). The sprites are not destroyed, only hidden: the same line turns them
   *  back on if the device catches its breath. */
  setQuality(far: boolean, grain: boolean) {
    for (const n of this.nebula) if (n.far) n.sprite.visible = far
    for (const g of this.glints) g.sprite.visible = far
    if (this.planet) this.planet.visible = far
    this.grain.visible = grain
  }

  /** PROMO CAPTURE: remove the opaque backdrop (gradient, shimmer, dimming, vignette,
   *  grain, planet) and keep only the light - the nebulae and the stars. Needed for
   *  layers with alpha: a background rectangle has no place in a hologram. */
  setBackdrop(on: boolean) {
    this.grad.visible = on
    this.iris.visible = on
    this.dim.visible = on
    this.vign.visible = on
    this.grain.visible = on
    if (this.planet) this.planet.visible = on
  }

  resize(W: number, H: number) {
    this.W = W; this.H = H
    this.grad.width = W; this.grad.height = H
    this.iris.width = W; this.iris.height = H
    this.grain.width = W; this.grain.height = H
    this.vign.width = W; this.vign.height = H
    this.dim.clear(); this.dim.rect(0, 0, W, H).fill(0x000000)
    if (this.planet) {
      // the sphere is wider than the screen (1.7*W) and its center is moved BELOW the
      // edge, so only the top arc of ~9% of the screen height is in frame: a horizon,
      // not a little ball in the corner
      const d = Math.max(W * 1.7, H * 1.2)
      this.planet.width = this.planet.height = d
      this.planet.position.set(W * 0.5, H + d * 0.5 - H * 0.09)
    }
  }

  render(f: CosmosFrame) {
    const { dt, t, intensity: inten, pulse, pulsePhase, hush } = f
    // hush dims only the BRIGHTNESS (alpha) - the color of the world is kept:
    // black-and-white desaturation is reserved for the debuff effect
    const fade = 1 - hush * 0.6
    // Silence presses the gradient almost into blackness. At 0.55 at rest the whole
    // frame stood as a warm fill, while in Tetris Effect a calm frame is ALMOST BLACK;
    // widening the range fixed that. But at 0.74 the world palette drowned in the black
    // and read as dirt - Andrey asked for «фон тёмный, но ЦВЕТНОЙ и живой». So rest is
    // 0.62: the color is visible, the frame is still deeply dark, and the headroom up to
    // the storm is the same
    this.dim.alpha = Math.min(0.92, 0.62 - inten * 0.52 + hush * 0.15)
    // the tone shimmer breathes very slowly (period ~26s) and is mostly visible in the
    // storm: the palette of the moment is one, only the depth of the frame changes
    this.iris.alpha = (0.038 + 0.085 * inten) * (0.75 + 0.25 * Math.sin(t * 0.24)) * fade
    // the grain crawls diagonally very slightly: the frame is alive but the eye does not catch it
    this.grain.tilePosition.x = (t * 7) % 128
    this.grain.tilePosition.y = (t * 4.5) % 128
    this.grain.alpha = 0.055 - inten * 0.02   // in the storm the grain yields to the light
    // the vignette is deeper at rest (empty and quiet) and opens up in the storm;
    // it was loosened as well: 0.78 ate the color at the edges together with dim
    this.vign.alpha = 0.66 - inten * 0.28
    const minWH = Math.min(this.W, this.H)
    for (const n of this.nebula) {
      n.x += n.dx * dt; n.y += n.dy * dt
      if (n.x < -0.2 || n.x > 1.2) n.dx *= -1
      if (n.y < -0.2 || n.y > 1.2) n.dy *= -1
      const p = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(pulsePhase + n.ph))
      if (n.far) {
        // THE FAR ONES: twice as large, breathing slower and three times dimmer -
        // this is the atmosphere of the frame, it must not be noticed consciously
        const r = minWH * (0.62 + 0.10 * Math.sin(t * 0.22 + n.ph)) * p
        n.sprite.width = n.sprite.height = r * 2
        n.sprite.position.set(n.x * this.W, n.y * this.H)
        n.sprite.alpha = (0.030 + 0.055 * inten) * p * fade
        continue
      }
      const r = minWH * (0.3 + 0.15 * Math.sin(t * 0.6 + n.ph)) * p
      n.sprite.width = n.sprite.height = r * 2
      n.sprite.position.set(n.x * this.W, n.y * this.H)
      n.sprite.alpha = (0.055 + 0.21 * inten) * p * fade
    }
    for (const s of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(t * 1.6 + s.ph)
      s.sprite.position.set(s.x * this.W, s.y * this.H)
      s.sprite.alpha = tw * (0.25 + 0.5 * inten) * (0.6 + 0.4 * pulse) * fade + 0.05
    }
    // the glint crosses blink TWICE as slowly as the field and rotate a little, so the
    // eye reads them as large stars rather than a second identical field
    for (const g of this.glints) {
      const tw = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.75 + g.ph), 2)
      const s = minWH * 0.055 * g.k * (0.75 + 0.35 * tw)
      g.sprite.width = g.sprite.height = s
      g.sprite.rotation = 0.25 * Math.sin(t * 0.2 + g.ph)
      g.sprite.position.set(g.x * this.W, g.y * this.H)
      g.sprite.alpha = tw * (0.12 + 0.26 * inten) * (0.7 + 0.3 * pulse) * fade
    }
    // the planet does not move (it is a horizon) but breathes with the light of the world
    if (this.planet) this.planet.alpha = (0.34 + 0.26 * inten) * fade
  }
}
