/**
 * music-loops.ts — MUSIC FROM PRERECORDED LOOPS.
 *
 * WHY. Measurements on the phone named the culprit: the WebView audio thread
 * cannot compute our graph in time (dozens of oscillators + a hall convolution
 * on every chord). Hence "звук прям плавает" (the sound is wobbling).
 * Andrey: «в вебе оставить авто-генерацию, а на телефоне предзаписи
 * использовать».
 *
 * This module is a second music engine with THE SAME public contract as
 * MusicEngine (ensureStarted / setWorld / update / stop / health), so the game
 * engine does not care which of them sits in the `music` field. SFX stay live
 * synthesis (sound.ts): they are short and cheap, they are not what wobbles.
 *
 * ── WHAT EXACTLY PLAYS ─────────────────────────────────────────────────────
 * Three files per world: `calm`, `mid`, `storm`. These are NOT stems, they are
 * THREE FULL MIXES of the same loop taken at three intensities. It works that
 * way because scripts/render-music-loops.mjs bakes them DETERMINISTICALLY (a
 * seed instead of Math.random), so the three files come out sample-aligned and
 * everything they share (pad, bass) is IDENTICAL in them. Therefore a LINEAR
 * crossfade between them behaves exactly like the layer gains of the live engine:
 *   · what is in both (the pad): a*x + (1-a)*x = x, it stays put;
 *   · what is only in one (melody, sparks) fades in honestly from zero.
 * Stems cannot do that: they do not know that the bass is louder in the storm
 * than at rest and that the pad's cutoff is brighter. Here it comes for free,
 * straight from the file.
 *
 * A crossfade between WORLDS is a different matter: different worlds have
 * different modes and halls, the signals do not correlate, and a linear fade
 * would dip by -3 dB in the middle. There we use an EQUAL-POWER one (cos/sin).
 *
 * ── THE GRAPH (all of it) ──────────────────────────────────────────────────
 *   calm  ─► tone(lowpass) ─► gCalm  ┐
 *   mid   ────────────────► gMid     ├─► deck ─► gameBus ┐
 *   storm ────────────────► gStorm   ┘                   ├─► musicGain ─► duck…
 *   menu  ────────────────► gMenu ─► menuDeck ─► menuBus ┘
 * Eight nodes instead of hundreds. `duck` is the same sound.musicBus() bus, so
 * slow-mo, the warp dip, mute and the master compressor come for free and work
 * exactly as before. There is no scheduler at all: the notes are already played,
 * so resyncs and late notes simply cannot happen here.
 */

import type { SoundEngine } from './sound'
import { MusicEngine, WORLD_KEYS } from './music'
import { VIBE } from './vibe'

type State = { intensity: number; multiplier: number; hush: number; playing: boolean }

/** ASSET FOLDER inside public/. The name is Cyrillic, like the whole "human"
 *  layer of the project; the FILE names inside are Latin (world1-calm.ogg).
 *
 *  WHY THERE ARE TWO. Cyrillic in the path lives inside the Android bundle
 *  (assets/) and is verified by `cap sync`, but we never checked it on a live
 *  WebView, and the cost of an error here is high and SILENT: if the files are
 *  not found the engine honestly falls back to live synthesis, i.e. into exactly
 *  the wobbling sound this was started for. Hence a list: if the manifest is not
 *  served at the first address, we try the second. Renaming the folder (in
 *  public/ and in the render's --out) will be enough, no code change needed. */
export const LOOPS_DIRS = ['музыка-лупы', 'music-loops']

/** storage level from the render (+14 dB: a signal peaking at -20 dBFS is bad
 *  for the codec). We divide it back out, and the music again sits UNDER the
 *  events, exactly where it was balanced. */
const STORE_DB = 14
const PLAY_GAIN = Math.pow(10, -STORE_DB / 20)

/** transition durations. Taken from music.ts:update, where layers move in
 *  0.5-0.9 s (and 0.05 under hush) and the menu theme enters over 1.4 s. */
const FADE_LAYER = 0.55
const FADE_HUSH = 0.06
const FADE_MENU_IN = 1.6
const FADE_MENU_OUT = 0.5
/** how long the menu theme stays silent before it breathes in (music.ts:428) */
const MENU_DELAY = 0.9
const ENIGMA_MENU_DELAY = 0.35
/** equal-power transition between worlds (the portal between worlds lasts ~4 s) */
const WORLD_FADE = 1.2
/** hush ("the cosmos exhaled"): the pad stays, but quieter and darker (music.ts:1522) */
const HUSH_GAIN = 0.45
const HUSH_CUT = 0.4
/** headroom of the live filter over the baked cutoff: in the file the pad is
 *  captured at intensity 0.26, i.e. at 0.9144 of padCut. We set the filter 1.6x
 *  higher, so at medium and high intensity it is transparent, while downwards it
 *  darkens honestly. */
const CUT_HEADROOM = 1.6

const MODES = ['calm', 'mid', 'storm'] as const

interface Manifest {
  version: number
  ext: string
  sampleRate: number
  loopSec: number
  loopSecEnigma?: number
  storeDb: number
  files: Record<string, { bytes: number; peakDb: number; rmsDb: number }>
}

/** one "deck": the set of sources of one world, started on the common grid phase */
interface Deck {
  id: number
  world: number
  out: GainNode
  tone: BiquadFilterNode | null
  layers: { src: AudioBufferSourceNode; g: GainNode }[]
  names: string[]
  dying: boolean
  /** the calm/menu layer actually started; before that moment the deck must not go on stage */
  ready: boolean
}

export class LoopMusicEngine {
  private sound: SoundEngine
  private ctx: AudioContext | null = null

  private musicGain!: GainNode
  private gameBus!: GainNode
  private menuBus!: GainNode

  private decks: Deck[] = []
  private menuDeck: Deck | null = null
  private menuWorld = -1
  private deckSeq = 0

  private buffers = new Map<string, AudioBuffer>()
  private pending = new Map<string, Promise<AudioBuffer | null>>()
  private raw = new Map<string, Promise<ArrayBuffer | null>>()

  private manifest: Manifest | null = null
  private manifestP: Promise<Manifest | null> | null = null
  /** folder address that actually served the manifest (see LOOPS_DIRS) */
  private dir = LOOPS_DIRS[0]

  private enigma = readEnigma()
  private started = false
  private failed = false
  /** the live engine as insurance: no assets means we play as on the web instead of going silent */
  private fallback: MusicEngine | null = null

  private world = -1
  private pendingWorld = 0
  private pendingLevel = 0
  /** common grid phase: every deck starts from it, so the bars of the worlds line up */
  private gridT0 = 0
  /** which intensity is open: 0 calm / 1 mid / 2 storm */
  private stage = -1
  private menu = false
  private menuT = 0
  private hushed = false
  /** how many times we silently survived a missing/broken file (telemetry) */
  private misses = 0

  // ── RAMPS WITH MEMORY ─────────────────────────────────────────────────────
  // Same trick as music.ts:glide: a parameter's schedule is left alone until the
  // target changes noticeably (2%). Otherwise update() at 60 Hz would bury every
  // gain in events. Plus we always know WHERE the parameter is now and never read
  // .value (different engines lie about it in different ways).
  private ramps: Record<string, { from: number; to: number; t0: number; t1: number; pow: boolean }> = {}

  constructor(sound: SoundEngine) {
    this.sound = sound
    // we pull the manifest and the first files IN ADVANCE, before the first
    // gesture: no ctx is needed for that (a plain fetch), decoding happens on the
    // ctx later. Otherwise the first second of the game would be silence where
    // the live engine already plays.
    this.prefetch(0)
  }

  // ── ramps ─────────────────────────────────────────────────────────────────

  private valueAt(key: string, t: number, fallback: number): number {
    const g = this.ramps[key]
    if (!g) return fallback
    if (t >= g.t1) return g.to
    if (t <= g.t0) return g.from
    const a = (t - g.t0) / (g.t1 - g.t0)
    return g.pow
      ? g.from * Math.cos((a * Math.PI) / 2) + g.to * Math.sin((a * Math.PI) / 2)
      : g.from + (g.to - g.from) * a
  }

  /** linear ramp (for layer gains: the signals correlate, the sum holds) */
  private fade(key: string, p: AudioParam, target: number, t: number, dur: number, floor = 0.0001) {
    const v = Math.max(floor, target)
    const g = this.ramps[key]
    if (g && Math.abs(v - g.to) <= Math.max(1e-5, Math.abs(g.to) * 0.02)) return
    const cur = this.valueAt(key, t, p.value)
    p.cancelScheduledValues(t)
    p.setValueAtTime(cur, t)
    p.linearRampToValueAtTime(v, t + dur)
    this.ramps[key] = { from: cur, to: v, t0: t, t1: t + dur, pow: false }
  }

  /** equal-power ramp (for worlds: the signals do NOT correlate). The curve is
   *  assembled from linearRamp segments rather than setValueCurveAtTime: a curve
   *  cannot be safely cancelled halfway, and a second portal within 1.2 s is a
   *  normal situation. */
  private fadePow(key: string, p: AudioParam, target: number, t: number, dur: number) {
    const v = Math.max(0.0001, target)
    const g = this.ramps[key]
    if (g && Math.abs(v - g.to) <= 1e-5) return
    const cur = this.valueAt(key, t, p.value)
    p.cancelScheduledValues(t)
    p.setValueAtTime(cur, t)
    const N = 12
    for (let i = 1; i <= N; i++) {
      const a = (i / N) * (Math.PI / 2)
      p.linearRampToValueAtTime(cur * Math.cos(a) + v * Math.sin(a), t + (i / N) * dur)
    }
    this.ramps[key] = { from: cur, to: v, t0: t, t1: t + dur, pow: true }
  }

  // ── assets ────────────────────────────────────────────────────────────────

  /** the build's base is './', so the loops folder sits next to index.html both
   *  on the web and inside Capacitor (there it is https://localhost/).
   *  encodeURIComponent is needed because of the Cyrillic folder name. */
  private url(name: string): string {
    return `./${encodeURIComponent(this.dir)}/${name}`
  }

  private loadManifest(): Promise<Manifest | null> {
    if (this.manifestP) return this.manifestP
    this.manifestP = (async () => {
      for (const dir of LOOPS_DIRS) {
        this.dir = dir
        try {
          const r = await fetch(this.url('manifest.json'))
          if (!r.ok) continue
          const m = (await r.json()) as Manifest
          this.manifest = m
          return m
        } catch { /* try the next address */ }
      }
      return null
    })()
    return this.manifestP
  }

  /** file name taking Enigma into account: its variants are not rendered for
   *  every world, and where there is none we honestly take the normal one (it
   *  sounds like ordinary music instead of going silent) */
  private fileOf(base: string): string {
    const m = this.manifest
    if (this.enigma && m && m.files[base + '-enigma']) return base + '-enigma'
    return base
  }

  private fetchRaw(base: string): Promise<ArrayBuffer | null> {
    const got = this.raw.get(base)
    if (got) return got
    const p = this.loadManifest().then((m) => {
      if (!m) return null
      const name = this.fileOf(base)
      if (!m.files[name]) { this.misses++; return null }
      return fetch(this.url(`${name}.${m.ext || 'ogg'}`))
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null)
    })
    this.raw.set(base, p)
    return p
  }

  private load(base: string): Promise<AudioBuffer | null> {
    const done = this.buffers.get(base)
    if (done) return Promise.resolve(done)
    const busy = this.pending.get(base)
    if (busy) return busy
    const p = this.fetchRaw(base).then(async (ab) => {
      if (!ab || !this.ctx) return null
      try {
        // slice: decodeAudioData TAKES the buffer (detach), while we keep the
        // compressed copy, so re-entering the same world hits neither net nor disk
        const buf = await this.ctx.decodeAudioData(ab.slice(0))
        this.buffers.set(base, buf)
        return buf
      } catch (e) {
        console.warn('[loops] не декодировался', base, e)
        this.misses++
        return null
      }
    })
    this.pending.set(base, p)
    return p
  }

  /** we prefetch the compressed files (half a megabyte each) for the current
   *  world AND THE NEXT one: the portal between worlds lasts ~4 s, and by its end
   *  there would be nothing to decode if we started downloading at the moment of
   *  the transition. Keeping a compressed copy is cheap (~0.5 MB per file against
   *  14.7 MB per decoded loop). */
  private prefetch(worldIdx: number) {
    for (const w of [worldIdx, worldIdx + 1]) {
      if (w < 0 || w >= WORLD_KEYS.length) continue
      for (const m of MODES) void this.fetchRaw(`world${w + 1}-${m}`)
      void this.fetchRaw(`menu${w + 1}`)
    }
  }

  /** drop everything no live deck holds. A decoded loop is
   *  38.4 s x 48 kHz x 2 channels x 4 bytes ~ 14.7 MB, and five worlds at once is
   *  too much for a phone. We keep the CURRENT world (3) + the menu theme (1)
   *  ~ 59 MB; during a move between worlds twice that, but only for 1.2 s. */
  private evict() {
    const live = new Set<string>()
    for (const d of this.decks) for (const n of d.names) live.add(n)
    if (this.menuDeck) for (const n of this.menuDeck.names) live.add(n)
    for (const k of Array.from(this.buffers.keys())) {
      if (!live.has(k)) { this.buffers.delete(k); this.pending.delete(k) }
    }
  }

  // ── lifecycle (the MusicEngine contract) ──────────────────────────────────

  ensureStarted() {
    if (this.fallback) { this.fallback.ensureStarted(); return }
    if (this.started) return
    const bus = this.sound.musicBus()
    if (!bus) return // no ctx yet (no gesture happened): wait quietly
    const ctx = (this.ctx = bus.ctx)

    this.musicGain = ctx.createGain()
    this.musicGain.gain.value = PLAY_GAIN
    this.musicGain.connect(bus.dest)
    this.gameBus = ctx.createGain(); this.gameBus.gain.value = 1
    this.gameBus.connect(this.musicGain)
    this.menuBus = ctx.createGain(); this.menuBus.gain.value = 0.0001
    this.menuBus.connect(this.musicGain)

    this.gridT0 = ctx.currentTime
    this.started = true
    this.applyWorld(this.pendingWorld, true)

    // the assets may be missing entirely (a web build without loops, a broken
    // unpack): then we do not go silent but honestly raise the live engine
    void this.loadManifest().then((m) => { if (!m) this.goLive('нет manifest.json') })
  }

  setWorld(worldIdx: number, levelIdx: number) {
    this.pendingWorld = worldIdx
    this.pendingLevel = levelIdx
    if (this.fallback) { this.fallback.setWorld(worldIdx, levelIdx); return }
    // key as in the live engine (music.ts:1329): the skip whoosh needs the
    // world's mode, otherwise it slides out of the harmony
    const k = WORLD_KEYS[Math.max(0, Math.min(WORLD_KEYS.length - 1, worldIdx))]
    if (k) this.sound.setMusicKey(k.root, k.mode)
    if (!this.started || worldIdx === this.world) return
    this.applyWorld(worldIdx, false)
  }

  update(dt: number, s: State) {
    if (this.fallback) { this.fallback.update(dt, s); return }
    if (!this.started || !this.ctx) return
    const t = this.ctx.currentTime

    // ── MENU THEME. The engine sends playing:false on splash, game over and finale.
    const menu = !s.playing
    this.menuT = menu ? this.menuT + dt : 0
    this.menu = menu
    if (menu) {
      if (!this.menuDeck || this.menuWorld !== this.world) {
        if (this.menuDeck) this.killDeck(this.menuDeck, t)
        this.menuDeck = this.makeDeck(this.world, this.menuBus, 1, true)
        this.menuWorld = this.world
      }
      // SAME TRAP AS WITH THE PORTAL (the test harness caught this one too):
      // until the theme file is decoded we must not mute the game bus, or the
      // game-over screen falls silent. We wait until the menu deck really sounds.
      const open = this.menuDeck.ready
        && this.menuT > (this.enigma ? ENIGMA_MENU_DELAY : MENU_DELAY)
      this.fade('menuBus', this.menuBus.gain, open ? 1 : 0.0001, t, FADE_MENU_IN)
      this.fade('gameBus', this.gameBus.gain, open ? 0.0001 : 1, t, FADE_MENU_OUT)
      this.fade('music', this.musicGain.gain, PLAY_GAIN, t, 0.4)
      return
    }
    if (this.menuDeck) {
      this.fade('menuBus', this.menuBus.gain, 0.0001, t, FADE_MENU_OUT)
      const dead = this.menuDeck
      this.menuDeck = null
      this.menuWorld = -1
      // keep the menu deck for another second (the fade is running), then release the memory
      setTimeout(() => { this.killDeck(dead, this.ctx ? this.ctx.currentTime : 0); this.evict() },
        (FADE_MENU_OUT + 0.6) * 1000)
    }
    this.fade('gameBus', this.gameBus.gain, 1, t, FADE_MENU_OUT)

    // ── INTENSITY. The thresholds are THE SAME as in the live engine
    //    (music.ts:1512): the melody arrives at streak x2, the sparks at x3. No
    //    hysteresis is needed: the streak is an integer, nothing can chatter.
    const hushed = s.hush > 0.2
    const stage = hushed ? 0 : s.multiplier >= 3 ? 2 : s.multiplier >= 2 ? 1 : 0
    if (stage !== this.stage || hushed !== this.hushed) {
      this.stage = stage
      this.hushed = hushed
      const dur = hushed ? FADE_HUSH : FADE_LAYER
      for (const d of this.decks) this.applyStage(d, t, dur)
    }

    // hush = EVERYTHING DOWN gracefully (the pad stays, but quieter), as in the live engine
    this.fade('music', this.musicGain.gain, PLAY_GAIN * (hushed ? HUSH_GAIN : 1), t,
      hushed ? 0.12 : 0.4)

    // ── BRIGHTNESS. The live pad breathes with a cutoff driven by intensity
    //    (music.ts:1565); in the file the cutoff is baked in, so the live filter
    //    can only TAKE IT DOWN, see CUT_HEADROOM.
    const key = WORLD_KEYS[Math.max(0, Math.min(WORLD_KEYS.length - 1, this.world))]
    const base = key ? key.padCut : 1200
    const want = hushed
      ? base * HUSH_CUT
      : Math.min(20000, base * Math.max(0.9144, 0.82 + 0.36 * s.intensity) * CUT_HEADROOM)
    for (const d of this.decks) {
      if (d.tone) this.fade(`d${d.id}.cut`, d.tone.frequency, want, t, 0.45, 60)
    }
  }

  stop() {
    if (this.fallback) { this.fallback.stop(); return }
    this.teardown()
    this.started = false
  }

  /** take everything of ours off the stage: decks, buses, buffer memory. Nodes
   *  are disconnected with a delay: the sources got stop(t+0.03), let them finish. */
  private teardown() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    for (const d of this.decks) this.killDeck(d, t)
    this.decks = []
    if (this.menuDeck) { this.killDeck(this.menuDeck, t); this.menuDeck = null; this.menuWorld = -1 }
    this.evict()
    this.ramps = {}
    this.stage = -1
    const nodes = [this.musicGain, this.gameBus, this.menuBus]
    setTimeout(() => { for (const n of nodes) { try { n.disconnect() } catch { /* ok */ } } }, 250)
  }

  // ── decks ─────────────────────────────────────────────────────────────────

  private get loopSec(): number {
    const m = this.manifest
    if (!m) return 38.4
    return this.enigma && m.loopSecEnigma ? m.loopSecEnigma : m.loopSec
  }

  /** phase on the common grid: how many seconds have passed since the loop start */
  private phase(t: number): number {
    const L = this.loopSec
    const x = (t - this.gridT0) % L
    return x < 0 ? x + L : x
  }

  private applyStage(d: Deck, t: number, dur: number) {
    if (d.dying || d.layers.length < 3) return
    d.layers.forEach((l, i) =>
      this.fade(`d${d.id}.l${i}`, l.g.gain, i === this.stage ? 1 : 0.0001, t, dur))
  }

  private killDeck(d: Deck, t: number) {
    if (d.dying) return
    d.dying = true
    for (const l of d.layers) {
      l.src.onended = () => { try { l.src.disconnect() } catch { /* ok */ } }
      try { l.src.stop(t + 0.03) } catch { /* not started yet: just drop it */ }
    }
    setTimeout(() => { try { d.out.disconnect() } catch { /* ok */ } }, 200)
    for (const k of Object.keys(this.ramps)) if (k.startsWith(`d${d.id}.`)) delete this.ramps[k]
  }

  /** build a deck and start it on the COMMON phase. Buffers may still be
   *  loading: a layer joins as soon as it arrives, straight into the right phase,
   *  because the offset is computed at start time, not at request time. */
  private makeDeck(worldIdx: number, bus: GainNode, gain: number, forMenu: boolean,
    onPlaying?: (d: Deck) => void): Deck {
    const ctx = this.ctx!
    const out = ctx.createGain()
    out.gain.value = gain
    out.connect(bus)
    const w = Math.max(0, worldIdx)
    const names = forMenu ? [`menu${w + 1}`] : MODES.map((m) => `world${w + 1}-${m}`)
    const deck: Deck = { id: ++this.deckSeq, world: w, out, tone: null, layers: [], names, dying: false, ready: false }

    if (!forMenu) {
      // the "breathing brightness" sits on the calm layer, where the pad is the
      // main voice; melody and sparks must not be filtered, they are the high ones
      const tone = ctx.createBiquadFilter()
      tone.type = 'lowpass'
      tone.Q.value = 0.5
      tone.frequency.value = 20000
      deck.tone = tone
    }

    names.forEach((base, i) => {
      const g = ctx.createGain()
      g.gain.value = i === 0 ? 1 : 0.0001
      g.connect(out)
      // the calm layer goes through the brightness filter: src -> tone -> g -> out
      if (i === 0 && deck.tone) deck.tone.connect(g)
      const src = ctx.createBufferSource()
      deck.layers.push({ src, g })
      void this.load(base).then((buf) => {
        if (deck.dying || !this.ctx) return
        if (!buf) {
          // without the calm file the deck has nothing to play: that is an asset failure
          if (i === 0) this.goLive('нет ' + base)
          return
        }
        src.buffer = buf
        // we leave loopStart/loopEnd alone: the loop is the WHOLE buffer, and it
        // is exactly 38.4 s (verified: Chromium decodes our Opus sample-exact)
        src.loop = true
        src.connect(i === 0 && deck.tone ? deck.tone : g)
        const t = this.ctx.currentTime + 0.03
        const off = Math.min(this.phase(t), Math.max(0, buf.duration - 0.001))
        try { src.start(t, off) } catch { /* already started */ }
        // "the deck has sounded" is the moment the calm layer starts (it is
        // always open) or the single layer of the menu theme. Only now may the
        // deck go on stage: before that the crossfade would have a hole of silence.
        if (i === 0) { deck.ready = true; if (onPlaying) onPlaying(deck) }
      })
    })
    return deck
  }

  private applyWorld(worldIdx: number, first: boolean) {
    if (!this.ctx) return
    this.world = worldIdx
    this.prefetch(worldIdx)
    // MEMORY CEILING. Each deck holds three loops of 14.7 MB. Cleanup of old
    // decks sits on a timer (the crossfade is still sounding), and in the stress
    // test "three portals in 2 s" that gave 12 buffers = 169 MB, which on a weak
    // phone is a killed tab. So we keep no more than ONE outgoing deck: anything
    // older is cut immediately and without a fade (nobody can hear it anyway, two
    // other worlds are already playing on top).
    while (this.decks.length > 1) {
      const old = this.decks.shift()!
      this.killDeck(old, this.ctx.currentTime)
    }
    this.evict()
    // THE CROSSFADE DOES NOT START HERE. The test harness caught exactly this:
    // the old world was muted at once while the new one was still downloading and
    // decoding, and the transition had a hole of silence (7 "seconds" in the
    // measurement). Now the fade is started BY the new calm layer itself, at the
    // moment it actually starts; until then the old world plays as if nothing
    // happened.
    const deck = this.makeDeck(worldIdx, this.gameBus, first ? 1 : 0.0001, false,
      first ? undefined : (d) => this.beginWorldFade(d))
    this.decks.push(deck)
    // reopen the intensity stage on the new deck
    if (this.stage >= 0) this.applyStage(deck, this.ctx.currentTime, 0.05)
  }

  /** the new world has sounded: equal-power out the old ones and release their memory */
  private beginWorldFade(deck: Deck) {
    if (!this.ctx || deck.dying) return
    const t = this.ctx.currentTime
    this.fadePow(`d${deck.id}.out`, deck.out.gain, 1, t, WORLD_FADE)
    for (const old of this.decks) {
      if (old === deck || old.dying) continue
      this.fadePow(`d${old.id}.out`, old.out.gain, 0.0001, t, WORLD_FADE)
      setTimeout(() => {
        this.killDeck(old, this.ctx ? this.ctx.currentTime : 0)
        this.decks = this.decks.filter((d) => d !== old)
        this.evict()
      }, (WORLD_FADE + 0.3) * 1000)
    }
  }

  /** insurance: hand all music to the live engine and never touch it again */
  private goLive(why: string) {
    if (this.fallback) return
    console.warn('[loops] переходим на живой синтез:', why)
    this.failed = true
    this.teardown()
    this.buffers.clear()
    this.raw.clear()
    this.pending.clear()
    this.fallback = new MusicEngine(this.sound)
    this.fallback.ensureStarted()
    this.fallback.setWorld(this.pendingWorld, this.pendingLevel)
  }

  // ── telemetry ─────────────────────────────────────────────────────────────

  /** the same duck-typed field set as MusicEngine.health, so the audiohud panel
   *  reads both engines with one piece of code. The `engine` field says who is on stage. */
  get health() {
    if (this.fallback) return this.fallback.health
    const mb = (this.buffers.size * this.loopSec * 48000 * 2 * 4) / 1048576
    const live = this.decks.length * 3 + (this.menuDeck ? 1 : 0)
    return {
      engine: 'loops' as const,
      resyncs: 0, late: 0, ticks: 0, clock: 'buffer',
      lookahead: 0, legacy: false, started: this.started,
      tier: 'loops', voices: live, peak: live, cap: 8, dropped: this.misses,
      enigma: this.enigma, irSec: 0,
      loops: {
        ready: this.buffers.size,
        mb: +mb.toFixed(1),
        world: this.world + 1,
        stage: this.stage < 0 ? '—' : MODES[this.stage],
        menu: this.menu,
        loopSec: this.loopSec,
        failed: this.failed,
      },
    }
  }
}

// ── FLAGS AND ENGINE CHOICE ─────────────────────────────────────────────────

/** the same ladder as music.ts:readEnigmaFlag: the short form `?music=enigma`,
 *  the offline render's global, then VIBE */
function readEnigma(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('music') === 'enigma') return true
  } catch { /* no window */ }
  return VIBE.enigmaMusic === true
}

/** running as a Capacitor native app? We look at the global instead of importing
 *  @capacitor/core, the same trick as quality.ts:IS_WEBVIEW. That keeps the module
 *  honest on the web too, where the plugin does not exist at all. */
export function isCapacitorNative(): boolean {
  try {
    const cap = (globalThis as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean }
    }).Capacitor
    return cap?.isNativePlatform?.() === true
  } catch { return false }
}

/** THE CHOICE RULE (the author's decision): phone -> prerecorded loops, web ->
 *  live synthesis. Instruments: `?music=loops` and `?music=live` override the rule
 *  both ways, so the loops can be heard in a browser and the live engine can be
 *  checked on a phone. `?music=strudel` and `?music=enigma` are branches of the
 *  live engine and do not touch the loops (enigma variants of the loops are
 *  switched on by the vibe flag, not by this). */
export function useLoopMusic(): boolean {
  let forced = ''
  try { forced = new URLSearchParams(window.location.search).get('music') || '' } catch { /* ok */ }
  if (forced === 'loops') return true
  if (forced === 'live' || forced === 'strudel') return false
  return isCapacitorNative()
}
