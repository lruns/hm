// Pure color helpers - one shared vocabulary for every fx module.

/** '#rrggbb' → 0xrrggbb */
export function hexNum(hex: string): number { return parseInt(hex.slice(1), 16) }

/** '#rrggbb' -> Float32Array [r,g,b] 0..1 (shader uniforms) */
export function hexRgb(hex: string): Float32Array {
  return new Float32Array([
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ])
}

/** linear interpolation between two 0xrrggbb */
export function lerpColor(a: number, b: number, t: number): number {
  t = Math.max(0, Math.min(1, t))
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255
  return ((ar + (br - ar) * t) << 16) | ((ag + (bg - ag) * t) << 8) | (ab + (bb - ab) * t)
}

/**
 * Hue in degrees 0..360. Needed by the "palette of the moment": every shimmer stays
 * AROUND the hue of the current world instead of running the whole color wheel.
 */
export function hueOf(c: number): number {
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  if (d < 1e-6) return 0
  let h: number
  if (mx === r) h = ((g - b) / d) % 6
  else if (mx === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return ((h * 60) % 360 + 360) % 360
}

/** mute saturation towards the color's own lightness: k=0 unchanged, k=1 gray */
export function desat(c: number, k: number): number {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  const m = (v: number) => Math.round(v + (y - v) * k)
  return (m(r) << 16) | (m(g) << 8) | m(b)
}

/** 0xrrggbb -> '#rrggbb' (the engine has its own copy; this one is for fx) */
export function numToHex(n: number): string {
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0')
}

/** 0xrrggbb → [h 0..360, s 0..1, l 0..1] */
export function hslOf(c: number): [number, number, number] {
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  const l = (mx + mn) / 2
  if (d < 1e-6) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  return [hueOf(c), s, l]
}

/**
 * Interpolation THROUGH HSL along the SHORT hue arc.
 * Why: a straight RGB lerp between two saturated colors (mint -> amber) passes
 * through GRAY - exactly the "mud" Andrey forbade. Around the hue circle the color
 * stays saturated the whole way: a palette move between worlds looks like a sunrise,
 * not like fading out.
 * Achromatic ends (s~0) borrow the neighbour's hue, otherwise the color drifts to red.
 */
export function lerpColorHsl(a: number, b: number, t: number): number {
  t = Math.max(0, Math.min(1, t))
  const [ha, sa, la] = hslOf(a)
  const [hb, sb, lb] = hslOf(b)
  const h0 = sa < 0.02 ? hb : ha
  const h1 = sb < 0.02 ? ha : hb
  let dh = ((h1 - h0 + 540) % 360) - 180   // short arc -180..180
  const h = h0 + dh * t
  return hsl(h, sa + (sb - sa) * t, la + (lb - la) * t)
}

/**
 * SMOOTH MOVE OF THE WORLD PALETTE. Andrey: «сначала один цвет, потом резко другой,
 * неприятно» - palettes must travel, not snap.
 *
 * Holds the LIVE array `live` - the very [deep, mid, accent] that `level.palette`
 * points at. The array is never recreated: whoever grabbed a reference to it travels
 * with the palette automatically (rings, particles, sparks, glows - everything that
 * reads the palette every frame).
 */
export class PaletteFade {
  /** live triple of '#rrggbb' - the REFERENCE handed to level.palette */
  readonly live: [string, string, string] = ['#000000', '#000000', '#000000']
  private from: [number, number, number] = [0, 0, 0]
  private dest: [number, number, number] = [0, 0, 0]
  private t = 1
  private dur = 1

  /** is it travelling right now */
  get moving() { return this.t < this.dur }

  /** set the palette instantly (game start, menu, endless-mode drift) */
  set(pal: readonly string[]) {
    this.dest = [hexNum(pal[0]), hexNum(pal[1]), hexNum(pal[2])]
    this.from = [...this.dest] as [number, number, number]
    this.t = this.dur = 1
    this.write(1)
  }

  /**
   * start moving to a new palette. sec<=0 means instantly.
   * Calling again with the same target resets nothing (the portal calls twice).
   */
  to(pal: readonly string[], sec = 1.4) {
    const d: [number, number, number] = [hexNum(pal[0]), hexNum(pal[1]), hexNum(pal[2])]
    if (d[0] === this.dest[0] && d[1] === this.dest[1] && d[2] === this.dest[2]) return
    if (sec <= 0) { this.set(pal); return }
    this.from = [hexNum(this.live[0]), hexNum(this.live[1]), hexNum(this.live[2])]
    this.dest = d
    this.t = 0; this.dur = sec
  }

  /** time step. true = the colors changed, consumers must re-apply them */
  tick(dt: number): boolean {
    if (!this.moving) return false
    this.t = Math.min(this.dur, this.t + dt)
    const x = this.t / this.dur
    this.write(x * x * (3 - 2 * x))  // smoothstep: soft start, soft landing
    return true
  }

  private write(e: number) {
    for (let i = 0; i < 3; i++) this.live[i] = numToHex(lerpColorHsl(this.from[i], this.dest[i], e))
  }
}

/** one live palette per game */
export const palFade = new PaletteFade()

/** HSL->RGB (default s/l = the juicy neon of the portal/spectrum bands) */
export function hsl(h: number, s = 0.95, l = 0.68): number {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0, g = 0, b = 0
  if (hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = l - c / 2
  return (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255)
}
