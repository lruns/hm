// Factories of procedural textures (canvas -> Texture). No assets from disk: all the
// art is born in code - a modern replacement for his 2017 gimp textures.

import { Texture, Rectangle } from 'pixi.js'
import { hexNum, lerpColor, numToHex } from '../color'

/** a soft round glow 128x128 (stars, sparks, nebulae, bokeh) */
export function makeGlowTexture(): Texture {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.65)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128)
  return Texture.from(c)
}

/** a dark radial halo 256x256 - the readability protector around the disc */
export function makeDarkTexture(): Texture {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  grad.addColorStop(0, 'rgba(4,5,12,0.95)')
  grad.addColorStop(0.55, 'rgba(4,5,12,0.75)')
  grad.addColorStop(1, 'rgba(4,5,12,0)')
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256)
  return Texture.from(c)
}

/** the vertical background gradient (deep -> mid color of the level) */
export function makeGradientTexture(deep: string, mid: string): Texture {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, deep)
  grad.addColorStop(1, mid)
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256)
  return Texture.from(c)
}

/**
 * A diagonal gradient of THREE tones - the shimmer of the world background.
 * A flat vertical gradient read as a plain fill; here the tones run diagonally and the
 * middle stop is shifted, so the frame stops being uniform.
 */
export function makeIrisTexture(a: string, b: string, c3: string): Texture {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 256, 256)
  grad.addColorStop(0, a)
  grad.addColorStop(0.42, b)
  grad.addColorStop(1, c3)
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256)
  return Texture.from(c)
}

/**
 * LIVE BACKGROUND SURFACES. The world palette no longer switches like a lever, it MOVES
 * over 1.4s - which means the gradient and the shimmer are redrawn many times in a row.
 * Texture.from() on every frame would create a new GPU texture (garbage + upload), so
 * the canvas and the texture live as ONE, and paint() only redraws the canvas and asks
 * Pixi to re-upload the source.
 */
export interface PaintSurface<A extends unknown[]> { texture: Texture; paint(...a: A): void }

export function makeGradientSurface(deep: string, mid: string): PaintSurface<[string, string]> {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256
  const g = c.getContext('2d')!
  const texture = Texture.from(c)
  const paint = (d: string, m: string) => {
    const grad = g.createLinearGradient(0, 0, 0, 256)
    // There used to be two stops (deep -> mid): the mid tone spread over HALF THE
    // SCREEN and in the warm world 1 it read as a sepia fill. Now there are three stops:
    // the top is night, the middle is still almost night, and only the bottom third
    // lights up - that is a HORIZON, as in the frames of Tetris Effect (the top always
    // goes to black). For the cold worlds (2/3/4, Andrey's reference) it only adds
    // depth and does not touch the hues.
    grad.addColorStop(0, d)
    grad.addColorStop(0.55, numToHex(lerpColor(hexNum(d), hexNum(m), 0.22)))
    grad.addColorStop(1, m)
    g.fillStyle = grad; g.fillRect(0, 0, 4, 256)
    texture.source.update()
  }
  paint(deep, mid)
  return { texture, paint }
}

export function makeIrisSurface(a: string, b: string, c3: string): PaintSurface<[string, string, string]> {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!
  const texture = Texture.from(c)
  const paint = (x: string, y: string, z: string) => {
    const grad = g.createLinearGradient(0, 0, 256, 256)
    grad.addColorStop(0, x); grad.addColorStop(0.42, y); grad.addColorStop(1, z)
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256)
    texture.source.update()
  }
  paint(a, b, c3)
  return { texture, paint }
}

/**
 * A VIGNETTE of depth: a transparent center -> soft darkness in the corners.
 * The frame stops being a flat sheet: the eye settles in the center by itself, as in the
 * frames of Tetris Effect (there the edges almost always go black).
 */
export function makeVignetteTexture(): Texture {
  const c = document.createElement('canvas'); c.width = c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(256, 256, 90, 256, 256, 362)
  grad.addColorStop(0, 'rgba(3,4,10,0)')
  grad.addColorStop(0.55, 'rgba(3,4,10,0.26)')
  grad.addColorStop(0.82, 'rgba(3,4,10,0.62)')
  grad.addColorStop(1, 'rgba(3,4,10,0.90)')
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512)
  return Texture.from(c)
}

/**
 * GRAIN: a 128x128 tile of monochrome noise. Laid over the background as a TilingSprite
 * at a tiny alpha - the gradient stops banding and gains the texture of film. Small and
 * almost invisible: it is a spice, not an effect.
 */
export function makeGrainTexture(): Texture {
  const S = 128
  const c = document.createElement('canvas'); c.width = c.height = S
  const g = c.getContext('2d')!
  const img = g.createImageData(S, S)
  for (let i = 0; i < S * S; i++) {
    // soft noise around mid gray: the sum of two randoms is almost a gaussian
    const v = Math.round(((Math.random() + Math.random()) / 2) * 255)
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  return Texture.from(c)
}

/** '#rrggbb' + alpha -> 'rgba(r,g,b,a)' for canvas fills */
function rgba(hex: string, alpha: number): string {
  const n = hexNum(hex)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

/**
 * A STAR GLINT CROSS (flag `cosmosDepth`).
 * The same 4-ray sparkle that lives in the particle atlas, but as a separate texture: we
 * light 8-10 stars with it over the ordinary field, so the sky stops being a scatter of
 * identical dots and gains large stars with rays.
 */
export function makeStarGlintTexture(): Texture {
  const S = 128, c0 = S / 2
  const c = document.createElement('canvas'); c.width = c.height = S
  const g = c.getContext('2d')!
  const sg = g.createRadialGradient(c0, c0, 0, c0, c0, 60)
  sg.addColorStop(0, 'rgba(255,255,255,1)')
  sg.addColorStop(0.25, 'rgba(255,255,255,0.8)')
  sg.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = sg
  g.beginPath()
  // the horizontal and vertical rays - lens-like spindles
  g.moveTo(c0 - 60, c0); g.quadraticCurveTo(c0, c0 - 6, c0 + 60, c0); g.quadraticCurveTo(c0, c0 + 6, c0 - 60, c0)
  g.moveTo(c0, c0 - 60); g.quadraticCurveTo(c0 + 6, c0, c0, c0 + 60); g.quadraticCurveTo(c0 - 6, c0, c0, c0 - 60)
  g.fill()
  // a short diagonal pair - the glint plays instead of standing as a plain cross
  g.globalAlpha = 0.45
  g.beginPath()
  g.moveTo(c0 - 26, c0 - 26); g.quadraticCurveTo(c0, c0 - 3, c0 + 26, c0 + 26); g.quadraticCurveTo(c0, c0 + 3, c0 - 26, c0 - 26)
  g.moveTo(c0 + 26, c0 - 26); g.quadraticCurveTo(c0 + 3, c0, c0 - 26, c0 + 26); g.quadraticCurveTo(c0 - 3, c0, c0 + 26, c0 - 26)
  g.fill()
  g.globalAlpha = 1
  const cg = g.createRadialGradient(c0, c0, 0, c0, c0, 13)
  cg.addColorStop(0, 'rgba(255,255,255,1)')
  cg.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = cg; g.fillRect(c0 - 13, c0 - 13, 26, 26)
  return Texture.from(c)
}

/**
 * THE PLANET ARC at the bottom edge (flag `cosmosDepth`).
 * The texture is a whole sphere, but in the frame its center sits BELOW the screen, so
 * only the top segment is visible: the horizon of an alien world. The body is dark (it
 * is a silhouette, not a decoration), only the rim glows with the accent - the light of
 * the world falls from above, exactly as on the gem (GEM_FRAG) and on the menu glass.
 *
 * A live surface (paint) instead of Texture.from on every call: the palette MOVES and
 * setPalette is called on every frame of the move (the re-bake is throttled there).
 */
export function makePlanetSurface(deep: string, mid: string, accent: string): PaintSurface<[string, string, string]> {
  const S = 512
  const c = document.createElement('canvas'); c.width = c.height = S
  const g = c.getContext('2d')!
  const texture = Texture.from(c)
  const paint = (d: string, m: string, a: string) => {
    g.clearRect(0, 0, S, S)
    const cx = S / 2, cy = S / 2, R = S / 2 - 10
    // the body: slightly lighter at the top edge (the light falls there), darker below
    const body = g.createLinearGradient(0, cy - R, 0, cy + R)
    body.addColorStop(0, numToHex(lerpColor(hexNum(d), hexNum(m), 0.40)))
    body.addColorStop(0.30, numToHex(lerpColor(hexNum(d), hexNum(m), 0.13)))
    body.addColorStop(1, d)
    g.save()
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.closePath()
    g.fillStyle = body; g.fill()
    g.restore()
    // rim: a stepped glow along the TOP arc - from a wide halo to a thin thread
    g.lineCap = 'round'
    for (const [w, al] of [[30, 0.09], [14, 0.20], [6, 0.55], [2.2, 0.85]] as [number, number][]) {
      g.beginPath()
      g.arc(cx, cy, R - w * 0.25, Math.PI * 1.10, Math.PI * 1.90)
      g.strokeStyle = rgba(a, al); g.lineWidth = w; g.stroke()
    }
    texture.source.update()
  }
  paint(deep, mid, accent)
  return { texture, paint }
}

/**
 * A white vignette with a TRANSPARENT center - the carrier of the color music: it is
 * tinted by a running spectrum while the center stays clean, so the number remains
 * readable (the protector).
 */
export function makeSpectrumVignette(): Texture {
  const c = document.createElement('canvas'); c.width = c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(256, 256, 120, 256, 256, 380)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.30)')
  grad.addColorStop(1, 'rgba(255,255,255,0.95)')
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512)
  return Texture.from(c)
}

/**
 * A 384x128 particle atlas on ONE base texture (a single ParticleContainer batch):
 * a round glow on the left; a comet in the middle - the bright head with a white-hot
 * core looks right (+x) and the tail melts to the left; a star glint on the right (the
 * 4-ray Bejeweled sparkle: two crossed lens rays + a bright core).
 */
export function makeParticleAtlas(): { glow: Texture; streak: Texture; sparkle: Texture } {
  const c = document.createElement('canvas'); c.width = 384; c.height = 128
  const g = c.getContext('2d')!
  const rad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  rad.addColorStop(0, 'rgba(255,255,255,1)')
  rad.addColorStop(0.35, 'rgba(255,255,255,0.65)')
  rad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = rad; g.fillRect(0, 0, 128, 128)
  // the comet droplet
  const lg = g.createLinearGradient(130, 0, 250, 0)
  lg.addColorStop(0, 'rgba(255,255,255,0)')
  lg.addColorStop(0.7, 'rgba(255,255,255,0.55)')
  lg.addColorStop(1, 'rgba(255,255,255,1)')
  g.fillStyle = lg
  g.beginPath()
  g.moveTo(130, 64)
  g.quadraticCurveTo(200, 50, 240, 55)
  g.arc(240, 64, 9, -Math.PI / 2, Math.PI / 2)
  g.quadraticCurveTo(200, 78, 130, 64)
  g.closePath(); g.fill()
  // the white-hot core of the head
  const hg = g.createRadialGradient(240, 64, 0, 240, 64, 14)
  hg.addColorStop(0, 'rgba(255,255,255,1)')
  hg.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = hg; g.fillRect(226, 50, 28, 28)
  // the star glint: the rays fade towards their tips via a radial gradient
  const sx = 320, sy = 64
  const sg = g.createRadialGradient(sx, sy, 0, sx, sy, 60)
  sg.addColorStop(0, 'rgba(255,255,255,1)')
  sg.addColorStop(0.25, 'rgba(255,255,255,0.85)')
  sg.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = sg
  g.beginPath()
  g.moveTo(sx - 58, sy); g.quadraticCurveTo(sx, sy - 7, sx + 58, sy); g.quadraticCurveTo(sx, sy + 7, sx - 58, sy)
  g.moveTo(sx, sy - 58); g.quadraticCurveTo(sx + 7, sy, sx, sy + 58); g.quadraticCurveTo(sx - 7, sy, sx, sy - 58)
  g.fill()
  const cg = g.createRadialGradient(sx, sy, 0, sx, sy, 13)
  cg.addColorStop(0, 'rgba(255,255,255,1)')
  cg.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = cg; g.fillRect(sx - 13, sy - 13, 26, 26)
  const atlas = Texture.from(c)
  return {
    glow: new Texture({ source: atlas.source, frame: new Rectangle(0, 0, 128, 128) }),
    streak: new Texture({ source: atlas.source, frame: new Rectangle(128, 40, 128, 48) }),
    sparkle: new Texture({ source: atlas.source, frame: new Rectangle(256, 0, 128, 128) }),
  }
}
