// StormSystem - all the particle mass of the world behind a narrow interface.
// From outside: two containers to mount (below - under the protector, above - over it),
// feed/quench (fuel of the vertical flow), burst (the halo of an event),
// update (one call per frame).
// Inside: a pool of ~4300 particles of four kinds, nobody outside knows about it.
//
// The kinds (from the Tetris Effect analysis + his 2017 game):
//   spark  - fast comet sparks in two diagonal rivers, stretched along their speed
//   bokeh  - big soft out-of-focus orbs, slow drift (depth of frame)
//   burst  - the explosion of LIGHT on a correct answer: a soft halo core + large star
//            glints + dust + a few thin rays. Not a hedgehog!
//   stream - a vertical river of DROPLETS through the disc (his signature): soft glow
//            droplets with cores, grows with answers, x2 - two channels, x3 - spectrum

import { ParticleContainer, Particle, Texture } from 'pixi.js'
import { lerpColor } from '../color'
import { TAU } from '../util'

const SPARK = 2400, BOKEH = 420, BURST = 480, STREAM = 900
const STREAM_MAX = 8

// ── THE STORM ON A LONG SCALE ──────────────────────────────────────────────
// The intensity axis comes from the long streak curve (COMBO_CURVE in engine.ts):
// 0.16 is a streak of 9, 0.45 is combo 25, 1.0 is combo 100. Two things that used to
// ride one formula had to be separated here:
//   HOW MANY particles (density) - honestly linear along the axis: at 100x it is the max;
//   HOW VISIBLE they are (brightness) - grows FASTER than the density.
// Without that the quiet zone would look not like modest sparks but like dirt: 380
// particles at alpha 0.13 are not sparks, they are dust on glass. Now an early streak
// means few sparks, but each one is VISIBLE; a late one means many and bright.
/** spark brightness: alpha = SPARK_A0 + SPARK_A1 x axis (not just the axis!) */
const SPARK_A0 = 0.34
const SPARK_A1 = 0.56
/** the spectrum flow (the rainbow gamut of x3) only turns on at the top of the scale:
 *  Andrey named the spectrum flow among what should be visible at combo 100 */
const STREAM_SPECTRUM_AT = 0.62 // ~ combo 40
/**
 * THE DROPLET RIVER IS ON THE SCALE TOO. Its density used to depend ONLY on the fuel
 * (power), and the fuel hits its ceiling around the ninth correct answer - so at a
 * streak of 9 the river was already at full blast. On a screenshot that was the first
 * thing to catch the eye: a mega effect where it was meant to be quiet. Now the fuel
 * decides WHETHER there is a river, and the axis decides HOW full it is: the share of
 * active droplets and their brightness follow the combo curve.
 */
const STREAM_K0 = 0.22   // river density at the very bottom of the scale (a thin trickle)
const STREAM_A0 = 0.55   // river brightness at the very bottom of the scale

/** the role of a particle inside the light burst */
type BurstRole = 'core' | 'glint' | 'dust' | 'ray' | 'star' | 'shard'

/** everything the storm needs to know about the world this frame */
export interface StormFrame {
  dt: number; t: number
  intensity: number   // 0..1 the storm axis (= the streak)
  pulse: number       // 0..1 the beat pulse
  pulsePhase: number
  hush: number        // 0..1 silence after a mistake
  multiplier: number  // 1 | 2 | 3
  accent: number      // accent of the level palette 0xrrggbb
  mid: number         // mid tone of the level palette 0xrrggbb
  deep: number        // deep tone of the level palette 0xrrggbb
}

interface P {
  pt: Particle
  kind: 'spark' | 'bokeh' | 'burst' | 'stream'
  x: number; y: number; vx: number; vy: number
  band: number; life: number; maxLife: number; size: number
  ph: number
  role: BurstRole
}

export class StormSystem {
  readonly below: ParticleContainer
  readonly above: ParticleContainer

  private pool: P[] = []
  private W = 1440; private H = 900
  private cx = 720; private cy = 450; private R = 150
  private power = 0 // flow fuel 0..STREAM_MAX
  private world = 0 // character of the ambient per world (see ДИЗАЙН-кампании.md)
  // SUCTION (the mystery of the transition): 0 - normal life, 1 - everything in the
  // frame drains towards the disc along its own little spiral and dies at the very edge
  private suck = 0
  private suckX = 0; private suckY = 0
  private glowTex: Texture
  private streakTex: Texture
  private sparkleTex: Texture

  constructor(glow: Texture, streak: Texture, sparkle: Texture) {
    this.glowTex = glow; this.streakTex = streak; this.sparkleTex = sparkle
    const dynamicProperties = { position: true, color: true, vertex: true, rotation: true, uvs: false }
    this.below = new ParticleContainer({ dynamicProperties })
    this.above = new ParticleContainer({ dynamicProperties })
    const add = (kind: P['kind'], n: number, tex: Texture, pc: ParticleContainer) => {
      for (let i = 0; i < n; i++) {
        const pt = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5, alpha: 0 })
        pc.addParticle(pt)
        const p: P = { pt, kind, x: 0, y: 0, vx: 0, vy: 0, band: i % 2, life: 0, maxLife: 1, size: 2, ph: Math.random() * TAU, role: 'dust' }
        if (kind === 'spark' || kind === 'bokeh') this.seedAmbient(p, true)
        if (kind === 'stream') this.seedStream(p, true)
        this.pool.push(p)
      }
    }
    add('bokeh', BOKEH, glow, this.below)
    add('spark', SPARK, streak, this.below)
    add('burst', BURST, glow, this.above)
    // river droplets are a glow with a core (not bare streaks!)
    add('stream', STREAM, glow, this.above)
    this.below.update(); this.above.update()
  }

  resize(W: number, H: number, cx: number, cy: number, R: number) {
    this.W = W; this.H = H; this.cx = cx; this.cy = cy; this.R = R
  }

  /**
   * character of the world particles: 0 - embers float up, 1 - snowflakes settle,
   * 2 - the wind swirls faster, 3 - shards jerk, 4 - everything sparse and slow
   * (clarity). We reseed the ambient for the new wind.
   */
  setWorld(w: number) {
    if (w === this.world) return
    this.world = w
    for (const p of this.pool) {
      if (p.kind === 'spark' || p.kind === 'bokeh') this.seedAmbient(p, true)
    }
  }

  /** quality: population multipliers for the frame (1 = full). The pool is NOT rebuilt:
   *  only how many of its particles light up changes, the rest stay at alpha 0 and never
   *  reach the draw. That way the quality level can change on the fly without recreating
   *  a single Particle. */
  setQuality(particles: number, stream: number) {
    this.qParticles = Math.max(0.05, particles)
    this.qStream = Math.max(0.05, stream)
  }
  private qParticles = 1
  private qStream = 1

  /** a correct answer pours in a jet - the flow accumulates */
  feed(amount = 1.6) { this.power = Math.min(STREAM_MAX, this.power + amount) }
  /** a mistake: the flow breaks off together with the world */
  quench() { this.power = 0 }
  get streamPower() { return this.power }

  /**
   * End of a level: the world FOLDS into the disc. k 0..1 is the suction strength.
   * Every particle takes ITS OWN micro path: a radial pull x(1/distance) plus a
   * tangential drift whose sign comes from its phase - the result is a funnel of little
   * spirals, not "all dots collapsed into one". Zero returns the world to normal life.
   */
  setImplode(k: number, x: number, y: number) {
    this.suck = Math.max(0, Math.min(1, k))
    this.suckX = x; this.suckY = y
  }

  /**
   * An explosion of LIGHT at the disc (the Bejeweled recipe): a white flash star AT THE
   * POINT of the event + a couple of soft halo cores + star glints + dust + glare rays +
   * GOLDEN SHARDS with gravity (they fall and fade).
   * x/y is the point of the event (the disc can travel: transfer); the center by default.
   */
  burst(scale: number, x = this.cx, y = this.cy) {
    const cx = x, cy = y
    // quality: the flash star, the halo cores and the glints ARE the response to a
    // correct answer, they are never cut at any level (otherwise the game stops
    // answering). Only the extras are cut: dust, rays, shards.
    const q = this.qParticles
    const want: [BurstRole, number][] = [
      ['star', 1],
      ['core', 2],
      ['glint', Math.round(5 + 3 * Math.min(1, scale))],
      ['dust', Math.round(22 * scale * q)],
      ['ray', Math.round(Math.min(8, 4 + 3 * scale) * q)],
      ['shard', Math.round(Math.min(16, 8 + 6 * scale) * q)],
    ]
    let wi = 0, left = want[0][1]
    for (const p of this.pool) {
      if (p.kind !== 'burst' || p.life > 0) continue
      while (left <= 0) { wi++; if (wi >= want.length) return; left = want[wi][1] }
      const role = want[wi][0]
      left--
      p.role = role
      const a = Math.random() * TAU
      if (role === 'star') {
        // a white additive flash star right at the point: born within a frame,
        // brightest at birth, gone in ~0.18s (the Bejeweled recipe)
        p.pt.texture = this.sparkleTex
        p.x = cx; p.y = cy
        p.vx = 0; p.vy = 0
        p.life = p.maxLife = 0.18 + Math.random() * 0.05
        p.size = this.R * (1.5 + 0.5 * Math.min(1, scale))
        p.ph = Math.random() * 0.6 - 0.3
      } else if (role === 'shard') {
        // a golden fleck shard: radial ejection -> gravity -> fade
        p.pt.texture = this.glowTex
        const rr = this.R * (0.2 + Math.random() * 0.5)
        p.x = cx + Math.cos(a) * rr; p.y = cy + Math.sin(a) * rr
        const sp = 120 + Math.random() * 260
        p.vx = Math.cos(a) * sp
        p.vy = Math.sin(a) * sp - 120 // slightly upwards first, then they fall
        p.life = p.maxLife = 0.5 + Math.random() * 0.3
        p.size = 2.5 + Math.random() * 4
      } else if (role === 'core') {
        // a large soft halo behind the disc - the flash core
        p.pt.texture = this.glowTex
        p.x = cx; p.y = cy
        p.vx = 0; p.vy = 0
        p.life = p.maxLife = 0.30 + Math.random() * 0.12
        p.size = this.R * (2.0 + Math.random() * 0.6)
      } else if (role === 'glint') {
        // a large 4-ray star: blooms and melts, drifting slowly
        p.pt.texture = this.sparkleTex
        const rr = this.R * (1.0 + Math.random() * 0.4)
        p.x = cx + Math.cos(a) * rr; p.y = cy + Math.sin(a) * rr
        const sp = 25 + Math.random() * 60
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 15
        p.life = p.maxLife = 0.55 + Math.random() * 0.35
        p.size = this.R * (0.30 + Math.random() * 0.35)
        p.ph = Math.random() * TAU
      } else if (role === 'dust') {
        // dust: small glow dots, a short scatter with drag
        p.pt.texture = this.glowTex
        const rr = this.R * (0.95 + Math.random() * 0.2)
        p.x = cx + Math.cos(a) * rr; p.y = cy + Math.sin(a) * rr
        const sp = 60 + Math.random() * 180
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp
        p.life = p.maxLife = 0.4 + Math.random() * 0.35
        p.size = 3 + Math.random() * 6
      } else {
        // a glare ray: thin, long, fades fast
        p.pt.texture = this.streakTex
        const rr = this.R * (1.0 + Math.random() * 0.15)
        p.x = cx + Math.cos(a) * rr; p.y = cy + Math.sin(a) * rr
        const sp = 240 + Math.random() * 260
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp
        p.life = p.maxLife = 0.30 + Math.random() * 0.15
        p.size = 2 + Math.random() * 2.5
      }
    }
  }

  update(f: StormFrame) {
    this.power = Math.max(0, this.power - f.dt * 0.35)
    const { dt, t, intensity: inten, pulse, hush, multiplier, accent, mid, deep } = f
    const hushK = 1 - hush * 0.85
    const hushed = hush > 0.3
    // hush: particles dim and darken, but the COLOR stays - a black-and-white
    // desaturation is a reserved DEBUFF effect, the ambient does not touch it.
    //
    // The particles used to be always amber: the flow warmed towards a hardcoded mint
    // 0x9affd0 and the shards were golden 0xffe9a0 - in a green or blue world that stuck
    // out as a foreign temperature. Now the WHOLE particle gamut derives from the world
    // palette: the body of the river goes from the mid tone to the accent, the energy
    // peak is the accent whitened to white-hot, the trough goes towards the deep tone.
    const riverTint = hushed
      ? lerpColor(mid, deep, 0.6)
      : lerpColor(mid, accent, 0.35 + inten * 0.55)
    const streamTint = lerpColor(accent, 0xffffff, 0.55)
    // the x3 gamut: two neighbouring tones of ONE world palette (mid+accent) and white
    const stream3Warm = lerpColor(mid, accent, 0.65)
    const stream3Hot = lerpColor(accent, 0xffffff, 0.82)
    // the golden Bejeweled shards in the light of the world: white-hot core -> accent
    const shardHot = lerpColor(accent, 0xffffff, 0.75)
    const speedK = 0.35 + inten * 1.3
    // during the suction the world must BE VISIBLE even if the streak has dropped,
    // otherwise there is nothing to drain into the disc. We keep a minimum population
    const visI = Math.max(inten, this.suck * 0.55)
    // quality: how many particles we light up. This is the MAIN performance knob - not
    // the CPU (the whole pool is walked anyway, that is fractions of a millisecond) but
    // the fill rate: every particle is an additive glow sprite, and on a phone their sum
    // hits the memory bandwidth of the GPU.
    const activeSpark = Math.round(visI * SPARK * 0.96 * this.qParticles)
    const activeBokeh = Math.round((6 + visI * (BOKEH - 6)) * this.qParticles)
    // fuel x position on the scale (see STREAM_K0)
    const streamK = STREAM_K0 + (1 - STREAM_K0) * inten
    const streamA = STREAM_A0 + (1 - STREAM_A0) * inten
    const activeStream = Math.round((this.power / STREAM_MAX) * STREAM * this.qStream * streamK)
    const laneOff = multiplier >= 2 ? this.R * 0.5 : 0
    const spectrum = multiplier >= 3 && inten >= STREAM_SPECTRUM_AT
    let si = 0, bi = 0, sti = 0

    for (const p of this.pool) {
      const pt = p.pt
      if (p.kind === 'spark' || p.kind === 'bokeh') {
        const slow = p.kind === 'bokeh' ? 0.5 : 1
        p.x += p.vx * speedK * slow * dt
        p.y += p.vy * speedK * slow * dt
        if (this.suck <= 0
          && (p.x < -60 || p.x > this.W + 60 || p.y < -60 || p.y > this.H + 60)) this.seedAmbient(p, false)
        const suckFade = this.pull(p, dt)
        const dc = Math.hypot(p.x - this.cx, p.y - this.cy)
        // normally particles avoid the disc (readability of the number); during the
        // suction it is the opposite, they FLY into it and die at the very edge
        const avoid = this.suck > 0
          ? suckFade
          : Math.min(1, Math.max(0, (dc - this.R * 1.45) / (this.R * 1.6)))
        // world character: embers and snowflakes wobble softly, the shards of the Rift jerk
        let wob = 0
        if (this.world === 3) wob = Math.sin(Math.floor(t * 9) * 2.7 + p.ph) * 7
        else if (this.world <= 1) wob = Math.sin(t * (this.world === 0 ? 1.2 : 0.8) + p.ph) * 10
        pt.x = p.x + wob; pt.y = p.y
        pt.tint = riverTint
        if (p.kind === 'spark') {
          const on = si < activeSpark; si++
          const tw = 0.6 + 0.4 * Math.sin(t * 3 + p.ph)
          // brightness on its own curve: few sparks, but they are visible (see SPARK_A0)
          pt.alpha = on ? Math.min(1, SPARK_A0 + SPARK_A1 * visI) * avoid * (0.5 + 0.5 * pulse) * tw * hushK : 0
          const spd = Math.hypot(p.vx, p.vy) * speedK
          pt.rotation = Math.atan2(p.vy, p.vx)
          pt.scaleX = (p.size * 3 + spd * 0.14) / 128
          pt.scaleY = (p.size * 1.1) / 48
        } else {
          const on = bi < activeBokeh; bi++
          // the bokeh is barely visible - depth of frame, not jelly
          pt.alpha = on ? (0.025 + visI * 0.085) * avoid * (0.6 + 0.4 * pulse) * hushK : 0
          pt.rotation = 0
          pt.scaleX = pt.scaleY = (p.size * (1 + inten * 0.5)) / 64
        }
      } else if (p.kind === 'burst') {
        if (p.life > 0) {
          p.life -= dt
          const k = Math.max(0, p.life / p.maxLife) // 1 -> 0
          const age = 1 - k
          if (p.role === 'shard') p.vy += 620 * dt // gravity of the golden shards
          p.x += p.vx * dt; p.y += p.vy * dt
          pt.x = p.x; pt.y = p.y
          if (p.role === 'star') {
            // the white flash star: maximum at birth, fast decay, slight growth
            pt.alpha = k * k
            pt.tint = 0xffffff
            pt.rotation = p.ph
            pt.scaleX = pt.scaleY = (p.size * (0.8 + age * 0.7)) / 128
          } else if (p.role === 'shard') {
            // a golden fleck: falls, flickers and fades (the Bejeweled confetti)
            p.vx *= 0.985
            pt.alpha = Math.min(1, k * 1.8) * (0.7 + 0.3 * Math.sin(t * 22 + p.ph))
            pt.tint = lerpColor(shardHot, accent, age)
            pt.rotation = 0
            pt.scaleX = pt.scaleY = (p.size * (1 - age * 0.35)) / 64
          } else if (p.role === 'core') {
            pt.alpha = k * k * 0.55
            pt.tint = lerpColor(0xffffff, accent, age * 0.6)
            pt.rotation = 0
            pt.scaleX = pt.scaleY = (p.size * (1 + age * 0.5) * 2) / 128
          } else if (p.role === 'glint') {
            // blooms instantly, grows while it melts
            pt.alpha = Math.min(1, age * 6) * k
            pt.tint = lerpColor(0xffffff, accent, age * 0.45)
            pt.rotation = p.ph + age * 0.6
            pt.scaleX = pt.scaleY = (p.size * (0.6 + age * 0.9)) / 128
          } else if (p.role === 'dust') {
            p.vx *= 0.93; p.vy *= 0.93
            pt.alpha = k * 0.7
            pt.tint = lerpColor(0xffffff, accent, age)
            pt.rotation = 0
            pt.scaleX = pt.scaleY = p.size / 64
          } else { // ray
            p.vx *= 0.96; p.vy *= 0.96
            const spd = Math.hypot(p.vx, p.vy)
            pt.alpha = k * 0.75
            pt.tint = lerpColor(0xffffff, accent, age * 0.7)
            pt.rotation = Math.atan2(p.vy, p.vx)
            pt.scaleX = (p.size * 9 + spd * 0.16) / 128
            pt.scaleY = (p.size * 0.55) / 48
          }
        } else if (pt.alpha !== 0) pt.alpha = 0
      } else { // stream - the river of soft droplets with cores
        const on = sti < activeStream; sti++
        const laneX = this.cx + (p.band ? 1 : -1) * laneOff
        p.x += ((laneX - p.x) * 2.2 + Math.sin(t * 1.4 + p.ph) * 22) * dt
        p.y += p.vy * (0.55 + inten * 0.35) * dt
        if (this.suck <= 0 && p.y < -60) this.seedStream(p, false)
        const sf = this.pull(p, dt)
        // born off-screen with a fade-in, dissolving towards the top
        const fade = Math.max(0, Math.min(1, (this.H + 60 - p.y) / 200, (p.y + 50) / 200)) * sf
        const tw = 0.75 + 0.25 * Math.sin(t * 2.3 + p.ph * 3)
        pt.alpha = on ? fade * (0.5 + 0.25 * pulse) * tw * Math.min(1, this.power / 2.5) * streamA * hushK : 0
        // x3: there used to be a RANDOM rainbow per droplet here - eye-stabbing. Now
        // one gamut of the world: accent -> its minty neighbour -> white, the droplets
        // breathing slowly between them ("palette of the moment").
        // The x3 rainbow gamut arrives not at a streak of 10 but at the top of the
        // scale, together with the rest of "everything there is"
        pt.tint = spectrum
          ? lerpColor(stream3Warm, stream3Hot, 0.5 + 0.5 * Math.sin(p.ph + t * 0.7))
          : streamTint
        pt.x = p.x; pt.y = p.y
        pt.rotation = -Math.PI / 2 + Math.sin(t * 1.4 + p.ph) * 0.06
        // a droplet: a round glow, slightly stretched along its motion.
        // The droplet caliber grows with the axis: at combo 100 the river is thicker
        const d = (p.size * (5.2 + 1.6 * inten)) / 128
        pt.scaleX = d * (1.25 + Math.abs(p.vy) * 0.0012)
        pt.scaleY = d
      }
    }
  }

  /**
   * The micro path of one particle towards the disc during the suction.
   * Returns a visibility multiplier (1 far away, 0 at the very edge of the disc) while
   * moving the particle itself: a pull to the center x(1 + closeness) plus a tangential
   * drift whose sign comes from the phase - each flies its own spiral, not a straight line.
   */
  private pull(p: P, dt: number): number {
    if (this.suck <= 0) return 1
    const dx = this.suckX - p.x, dy = this.suckY - p.y
    const d = Math.hypot(dx, dy) || 1
    const nx = dx / d, ny = dy / d
    // closer to the center is faster (a funnel accelerates), the far edge is pulled softly
    const near = Math.min(1, (this.R * 6) / (d + this.R))
    const rad = this.suck * (340 + 900 * near) * dt
    // the swirl: sign and amplitude are personal, taken from the particle phase
    const spin = Math.sin(p.ph * 3.1) >= 0 ? 1 : -1
    const tan = this.suck * spin * (150 + 420 * near) * dt * (0.6 + 0.4 * Math.sin(p.ph))
    p.x += nx * rad - ny * tan
    p.y += ny * rad + nx * tan
    // dies at the very edge of the disc - swallowed
    return Math.min(1, Math.max(0, (d - this.R * 0.45) / (this.R * 0.85)))
  }

  private seedAmbient(p: P, initial: boolean) {
    // by default: two diagonal rivers flowing PAST the center (not through it);
    // each world has its own wind (see setWorld)
    let dir = p.band === 0 ? { x: 0.9, y: -0.45 } : { x: -0.9, y: -0.4 }
    let spdK = 1
    if (this.world === 0) { // embers: float up slowly, wobbling a little
      dir = { x: (p.band ? 1 : -1) * 0.18, y: -1 }; spdK = 0.55
    } else if (this.world === 1) { // snowflakes: settle downwards
      dir = { x: (p.band ? 1 : -1) * 0.25, y: 1 }; spdK = 0.5
    } else if (this.world === 2) { // wind: the same rivers, but faster
      spdK = 1.4
    } else if (this.world === 4) { // clarity: everything sparse and slow
      dir = { x: (Math.random() - 0.5), y: -(0.4 + Math.random() * 0.6) }; spdK = 0.4
    }
    const spd = ((p.kind === 'bokeh' ? 18 : 45) + Math.random() * (p.kind === 'bokeh' ? 30 : 105)) * spdK
    p.vx = dir.x * spd; p.vy = dir.y * spd
    if (initial) {
      p.x = Math.random() * this.W
      p.y = Math.random() * this.H
    } else if (Math.abs(dir.y) > Math.abs(dir.x)) {
      // vertical wind: we are born beyond the bottom or top edge
      p.x = Math.random() * this.W
      p.y = dir.y < 0 ? this.H + 40 : -40
    } else if (dir.x > 0) { p.x = -40; p.y = Math.random() * this.H }
    else { p.x = this.W + 40; p.y = Math.random() * this.H }
    p.size = p.kind === 'bokeh' ? 5 + Math.random() * 10 : 1.1 + Math.random() * 2.6
    p.ph = Math.random() * TAU
  }

  private seedStream(p: P, initial: boolean) {
    p.band = Math.random() < 0.5 ? 0 : 1
    p.vx = 0
    // slower and of mixed caliber: a river of droplets, not a scratch
    p.vy = -(90 + Math.random() * 150)
    p.size = 1.6 + Math.pow(Math.random(), 1.6) * 4.6
    // triangular distribution: a dense bright core of the channel, loose edges; wider
    p.x = this.cx + (Math.random() + Math.random() - 1) * this.R * 0.42
    p.y = initial ? Math.random() * this.H : this.H + 30 + Math.random() * 180
    p.ph = Math.random() * TAU
  }
}
