// quality.ts - ONE KNOB for "how much beauty this device can carry".
//
// WHY. On Andrey's phone «звук иногда глючит», and he asked: «графику оценивать как
// устройство поддерживает и понижать/увеличивать, или дать пользователю выбирать».
// The game used to draw equally heavy everywhere: 4300 particles, bloom quality 4,
// resolution up to 2x (on a dpr 3 phone that is 2x of 1080p - four times more pixels
// than needed), ten fullscreen additive nebulae. On a desktop that is 60 fps, on a
// mid-range Android 25-35, and together with the dropped frame the sound starts to
// hiccup (the music scheduler used to live in the frame ticker).
//
// Here we ONLY decide "which level", hold the knob numbers and notify subscribers. How
// those knobs are applied is up to engine.ts and fx/* (every such place is marked with
// a `// quality` comment). This module knows nothing about Pixi or about sound.
//
// THREE LEVELS
//   high   - the original look, not a single knob touched
//   medium - particles x0.6, simpler bloom (quality 4->2, blur 7->5), resolution <=1.5
//   low    - particles x0.35, bloom OFF, resolution <=1, wings 3->2 feathers,
//            the far plane of the cosmos and the film grain removed
//
// THREE MODES (a pause-menu item, texts in his tone)
//   'auto' - «Качество: авто»    - measure fps and decide ourselves (default)
//   'high' - «Качество: красиво» - always high, whatever we measure
//   'low'  - «Качество: быстро»  - always low

export type QualityLevel = 'high' | 'medium' | 'low'
export type QualityMode = 'auto' | 'high' | 'low'

// ══ AUDIO GRAPH BUDGET ══════════════════════════════════════════════════════
//
// WHY. An earlier pass fixed the SCHEDULER (when to hand a note over) and it worked:
// late 23->0. But Andrey still heard glitches on the phone on a fresh build and added
// «чуть подтормаживает». The scheduler has nothing to do with that: if the audio thread
// CANNOT COMPUTE the graph it already owns within the buffer time, that is an underrun,
// and no lookahead can cure it in principle.
//
// And our graph is heavy (it was made rich on purpose, and you can hear it - the "rich"
// path must not be touched): a convolution reverb with a 1.9-4.2 s impulse (plus a
// second one, 0.9 s, for events), unison x3 on each of the three pad tones = nine
// WAVETABLE oscillators, each with its own resonant filter and its own panning, two
// WaveShapers with 2x oversampling, a chorus of two delays, a bell of five partials. On
// a desktop that is a few percent of a core. On a mid-range Android, where the same core
// is busy rendering Pixi, it is no longer a few percent.
//
// So the sound gets THE SAME budget as the graphics: three tiers that travel with the
// quality level (or are set by hand from the pause menu).
//   rich - BIT FOR BIT as it was before this budget existed. No node touched.
//   mid  - shorter hall, unison x2, one chorus tap, no oversampling.
//   lite - short hall (0.9 s), unison x1, no chorus, a bell of three partials, the event
//          room back on delays, a voice ceiling.
export type AudioTier = 'rich' | 'mid' | 'lite'
/** the player's knob: 'auto' follows the graphics quality, otherwise it is fixed */
export type AudioMode = 'auto' | 'rich' | 'lite'

export interface AudioBudget {
  tier: AudioTier
  /** ceiling of the hall tail, seconds (Infinity = as set by the world preset) */
  irSec: number
  /** unison voices per pad tone */
  unison: number
  /** pad chorus taps: 2 (the original), 1 or 0 */
  chorusTaps: number
  /** oversampling of the pad and bass saturators */
  oversample: OverSampleType
  /** partials in the melody bell (5 = the original) */
  bellParts: number
  /** pad shine as a pair at the sides (otherwise a single voice in the center) */
  shinePair: boolean
  /** Enigma choir voices per tone (2 = the original) */
  choirVoices: number
  /** sides of the noisy hall air in the menu */
  airSides: number
  /** convolution room for events (otherwise the older pair of delays) */
  sfxRoom: boolean
  /** ceiling of simultaneously sounding sources: above it ONLY optional layers stay
   *  silent (spark, shaker, shine, the second voice). The pad and the melody are never
   *  cut - they are the music itself, not decoration. */
  maxVoices: number
}

const AUDIO: Record<AudioTier, AudioBudget> = {
  rich: {
    tier: 'rich',
    irSec: Infinity, unison: 3, chorusTaps: 2, oversample: '2x',
    bellParts: 5, shinePair: true, choirVoices: 2, airSides: 2,
    sfxRoom: true, maxVoices: Infinity,
  },
  mid: {
    tier: 'mid',
    // 1.6 s is still a hall, but four times cheaper than a cathedral: the cost of a
    // convolution grows directly with the impulse length, the biggest knob in the graph
    irSec: 1.6, unison: 2, chorusTaps: 1, oversample: 'none',
    bellParts: 4, shinePair: true, choirVoices: 2, airSides: 2,
    sfxRoom: true, maxVoices: 40,
  },
  lite: {
    tier: 'lite',
    // 0.9 s is a room, not a hall. The space is still audible (checked by an RT60
    // measurement) but costs four to five times less than a long tail.
    // ! unison 2, not 1. A single voice is not "economical", it is a stump: the detune
    // is exactly what makes a pad different from a beep, and there is no chorus at this
    // tier either. The sum of amplitudes per tone is the same at any unison (see
    // padChord), so the loudness of the layer does not move.
    // ! 4 partials, not 3. The first attempt cut to three and a measurement caught a
    // -8 dB dip in the 2-4 kHz band (melody intelligibility). The fourth partial is one
    // sine with a gain, pennies against the convolution; the savings must come from the
    // hall and the unison, not from what makes the note audible.
    irSec: 0.9, unison: 2, chorusTaps: 0, oversample: 'none',
    bellParts: 4, shinePair: false, choirVoices: 1, airSides: 1,
    sfxRoom: false, maxVoices: 24,
  },
}

/** graphics level -> audio tier when the player's knob is on auto */
const TIER_OF: Record<QualityLevel, AudioTier> = { high: 'rich', medium: 'mid', low: 'lite' }

// ── ANDROID AND WEBVIEW ─────────────────────────────────────────────────────
// Needed for exactly two decisions, both grounded in the platform, not superstition:
//  1) BUFFER SIZE. See audioLatencyHint().
//  2) THE STARTING LEVEL before the first fps measurement (see guess()).
export const IS_ANDROID = (() => {
  try { return /android/i.test(navigator.userAgent) } catch { return false }
})()
/** a Capacitor wrapper (or the system WebView) - not the same thing as Chrome */
export const IS_WEBVIEW = (() => {
  try {
    const cap = (globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (cap?.isNativePlatform?.() === true) return true
    return /;\s*wv\)/i.test(navigator.userAgent)
  } catch { return false }
})()

export interface QualityKnobs {
  level: QualityLevel
  /** multiplier for the active storm particles (sparks, bokeh) */
  particles: number
  /** multiplier for the active droplets of the vertical flow */
  stream: number
  /** keep bloom at all */
  bloom: boolean
  /** AdvancedBloomFilter parameters, when it is there */
  bloomBlur: number
  bloomQuality: number
  /** ceiling of the renderer resolution (Math.min with dpr, not a multiplier) */
  resCap: number
  /** flame-wing feathers per side */
  wings: number
  /** the far plane of the cosmos: 4 large additive nebulae + 9 star glints */
  cosmosFar: boolean
  /** film grain: a fullscreen TilingSprite with overlay blend */
  cosmosGrain: boolean
  /** what to ask the AudioContext for (see audioLatencyHint) */
  audioLatency: AudioContextLatencyCategory | number
}

const KNOBS: Record<QualityLevel, QualityKnobs> = {
  high: {
    level: 'high',
    particles: 1, stream: 1,
    bloom: true, bloomBlur: 7, bloomQuality: 4,
    resCap: 2, wings: 3, cosmosFar: true, cosmosGrain: true,
    audioLatency: 'interactive',
  },
  medium: {
    level: 'medium',
    particles: 0.6, stream: 0.7,
    bloom: true, bloomBlur: 5, bloomQuality: 2,
    resCap: 1.5, wings: 3, cosmosFar: true, cosmosGrain: true,
    audioLatency: 'interactive',
  },
  low: {
    level: 'low',
    particles: 0.35, stream: 0.45,
    bloom: false, bloomBlur: 4, bloomQuality: 1,
    resCap: 1, wings: 2, cosmosFar: false, cosmosGrain: false,
    // ! A TRADE-OFF: on a weak phone 'interactive' gives a tiny audio thread buffer
    // (~128-256 samples). When the CPU is busy rendering, the thread cannot fill it in
    // time - that is exactly the "sound glitches": clicks and dropouts. We ask for a
    // 50 ms buffer: the clicks go away, the tap response lags by half a frame to a frame
    // (the threshold where a finger notices is ~60-80 ms, we stay below it). We do NOT
    // take full 'playback': on Android it pushes the output past 200 ms, and that is
    // audible as "the sound is behind the tap".
    audioLatency: 0.05,
  },
}

const K_MODE = 'hm2.quality'      // the player's choice: auto | high | low
const K_SEEN = 'hm2.quality.seen' // what we measured last time (used at startup)
const K_AUDIO = 'hm2.audio'       // the sound knob: auto | rich | lite

/** ── MEASURING INSTRUMENTS (the same trick as `?perf=legacy` and `?vibe=`) ───
 *  `?audio=rich|mid|lite` - force the audio TIER without touching the player's setting
 *      (it stays as it was, the instrument only overrides the output); the same through
 *      `globalThis.HM_AUDIO` - a handshake with the offline preview renderer (it has
 *      neither an address bar nor localStorage), exactly like `HM_VIBE.enigmaMusic`
 *      for the Enigma flag;
 *  `?latency=0.08` - set the audio thread buffer by hand (or 'interactive').
 *  Both exist so that Andrey can check on HIS phone in a minute what the glitches
 *  actually come from: the graph budget or the buffer size. */
function urlArg(name: string): string | null {
  try { return new URLSearchParams(location.search).get(name) } catch { return null }
}
const FORCED_TIER = (() => {
  const pick = (v: unknown): AudioTier | null =>
    v === 'rich' || v === 'mid' || v === 'lite' ? v : null
  const u = pick(urlArg('audio'))
  if (u) return u
  try { return pick((globalThis as unknown as { HM_AUDIO?: unknown }).HM_AUDIO) } catch { return null }
})()
const URL_LATENCY = (() => {
  const v = urlArg('latency')
  if (v === null) return null
  if (v === 'interactive' || v === 'balanced' || v === 'playback') return v as AudioContextLatencyCategory
  const n = Number(v)
  return isFinite(n) && n >= 0 && n <= 0.5 ? n : null
})()

/** ── THRESHOLDS ─────────────────────────────────────────────────────────────
 *  Median, not average: one freeze on the portal must not decide the verdict. */
const FPS_LOW = 30   // below this -> low
const FPS_MID = 45   // below this -> medium
/** headroom for going up, so the level does not swing at the border */
const FPS_HYST = 4
/** a total collapse: nothing to wait for, we drop on the very first window */
const FPS_PANIC = 20
/** the first window is longer: game start means shaders, fonts, the first texture
 *  upload. 2.5s, not 1.2: a measurement under throttling showed that the first seconds
 *  are the compilation of five shaders, atlas uploads and font loading - 10 fps that
 *  have nothing to do with the real game, yet were enough to sentence a device to low. */
const WARMUP_S = 2.5
const FIRST_WINDOW_S = 5
const WINDOW_S = 3
/** after a level change we wait for the picture to settle (otherwise it swings) */
const COOLDOWN_S = 6
/** a longer frame is not a frame but an event (tab minimized, GC, a breakpoint) */
const OUTLIER_S = 0.25
const MIN_SAMPLES = 20
/** ── RATCHET (found by measurement) ─────────────────────────────────────────
 *  A level change is NOT free by itself: the canvas buffer is recreated, which is a
 *  hitch. If a device honestly hovers at the border, the cure starts to hurt more than
 *  the disease. So after four changes going up is forbidden forever: the auto mode can
 *  only save (go down), and the player can raise it from the menu. That way the level
 *  CONVERGES instead of swinging. */
const MAX_CHANGES = 4

const ORDER: QualityLevel[] = ['low', 'medium', 'high']

function readMode(): QualityMode {
  try {
    const v = localStorage.getItem(K_MODE)
    if (v === 'auto' || v === 'high' || v === 'low') return v
  } catch { /* ok */ }
  return 'auto'
}

function readAudioMode(): AudioMode {
  try {
    const v = localStorage.getItem(K_AUDIO)
    if (v === 'auto' || v === 'rich' || v === 'lite') return v
  } catch { /* ok */ }
  return 'auto'
}

function readSeen(): QualityLevel | null {
  try {
    const v = localStorage.getItem(K_SEEN)
    if (v === 'high' || v === 'medium' || v === 'low') return v
  } catch { /* ok */ }
  return null
}

/** THE FIRST GUESS, before a single measured frame. Needed by exactly two places that
 *  cannot be redone cheaply on the fly: the renderer resolution and the AudioContext
 *  latencyHint. The main source is what we measured on the PREVIOUS run; on a first run
 *  it is a rough guess from the hardware (deliberately soft: the measurement corrects it
 *  within 5 s). */
function guess(): QualityLevel {
  const seen = readSeen()
  if (seen) return seen
  try {
    const nav = navigator as Navigator & { deviceMemory?: number }
    const cores = nav.hardwareConcurrency || 4
    const mem = nav.deviceMemory || 4
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    if (cores <= 4 && mem <= 3) return 'low'
    if (coarse && cores <= 6) return 'medium'
  } catch { /* ok */ }
  // ! ON ANDROID THE FIRST RUN STARTS AT `medium`, NOT AT `high`.
  // The old guess gave a powerful-looking phone (8 cores, 6 GB) the full level - and
  // with it `latencyHint: 'interactive'` and the whole rich graph. But the context is
  // created ONCE on the first gesture: if the guess was wrong, the fps measurement fixes
  // the picture, yet the audio thread buffer stays small until the end of the session.
  // Guessing too low costs one tier of decoration for five seconds; guessing too high
  // costs clicks for the whole session. So on a phone we go carefully.
  return IS_ANDROID ? 'medium' : 'high'
}

class Quality {
  private _mode: QualityMode = readMode()
  private _level: QualityLevel
  private subs: ((k: QualityKnobs) => void)[] = []
  private _audioMode: AudioMode = readAudioMode()
  private audioSubs: ((b: AudioBudget) => void)[] = []
  /** the audio tier we already announced to the subscribers (see syncAudio) */
  private _firedTier: AudioTier | null = null

  // measurement
  private samples: number[] = []
  private winT = 0
  private warm = 0
  private first = true
  private cooldown = 0
  private goodWindows = 0
  private badWindows = 0
  private changes = 0
  private _fps = 0
  private _measured: QualityLevel | null = null

  constructor() {
    this._level = this._mode === 'auto' ? guess() : this._mode
  }

  get knobs(): QualityKnobs { return KNOBS[this._level] }
  get level(): QualityLevel { return this._level }
  get mode(): QualityMode { return this._mode }
  /** median of the last measured window (0 = not measured yet) */
  get fps(): number { return this._fps }

  /** ── SOUND BUDGET ────────────────────────────────────────────────────────
   *  In 'auto' it follows the graphics level (high->rich, medium->mid, low->lite),
   *  otherwise it stays where the player put it. A separate knob is needed because
   *  tastes differ: some prefer rich sound with a simple picture. */
  get audio(): AudioBudget { return AUDIO[this.audioTier] }
  get audioTier(): AudioTier {
    if (FORCED_TIER) return FORCED_TIER // the URL instrument overrides everything
    if (this._audioMode !== 'auto') return this._audioMode === 'rich' ? 'rich' : 'lite'
    const t = TIER_OF[this._level]
    // ! UNTIL FPS IS MEASURED, THE CEILING ON ANDROID IS 'mid'. The graphics level at
    // startup comes from a GUESS (what we measured last run / what the hardware says),
    // and that guess is about the PICTURE: a phone that gave 60 fps yesterday could well
    // have given them with already wheezing sound - nobody measured that. The audio
    // context, in turn, is created on the first gesture and lives for the whole session.
    // So before the first honest measurement window we do not hand out the rich graph on
    // a phone: guessing low costs a slightly narrower pad for five seconds, guessing high
    // costs clicks for the whole session.
    if (IS_ANDROID && this._measured === null && t === 'rich') return 'mid'
    return t
  }
  get audioMode(): AudioMode { return this._audioMode }

  /** warm Russian label of the pause-menu item (sound) */
  audioLabel(): string {
    if (this._audioMode === 'rich') return 'звук: богатый'
    if (this._audioMode === 'lite') return 'звук: экономный'
    return `звук: авто (${this.audioTier === 'rich' ? 'богатый' : this.audioTier === 'mid' ? 'средний' : 'экономный'})`
  }

  subscribeAudio(fn: (b: AudioBudget) => void): () => void {
    this.audioSubs.push(fn)
    return () => { this.audioSubs = this.audioSubs.filter((f) => f !== fn) }
  }

  setAudioMode(m: AudioMode) {
    if (m === this._audioMode) return
    this._audioMode = m
    try { localStorage.setItem(K_AUDIO, m) } catch { /* ok */ }
    this.syncAudio('ручка')
  }

  /** the menu item cycles: auto -> rich -> lite -> auto */
  cycleAudioMode(): AudioMode {
    const next: AudioMode = this._audioMode === 'auto' ? 'rich' : this._audioMode === 'rich' ? 'lite' : 'auto'
    this.setAudioMode(next)
    return next
  }

  /** THE ONLY point from which the sound subscribers learn about a tier change.
   *  Idempotent: if the tier equals the one we announced last time, nothing happens. So
   *  it can be called from everywhere something changed (graphics level, the player's
   *  knob, the first honest fps measurement) without fearing a double or a missed call -
   *  and rebuilding the hall impulse costs tens of milliseconds of the main thread, it
   *  must not be triggered in vain. */
  private syncAudio(why: string) {
    const t = this.audioTier
    if (t === this._firedTier) return
    this._firedTier = t
    const b = this.audio
    console.debug('[hm-quality] звук', t, '·', why)
    for (const fn of this.audioSubs) {
      try { fn(b) } catch (e) { console.warn('[hm-quality] подписчик звука упал:', e) }
    }
  }

  /** for reports and automated tests: a one-line state */
  stats() {
    return {
      mode: this._mode, level: this._level, fps: Math.round(this._fps),
      measured: this._measured, changes: this.changes,
      audioMode: this._audioMode, audioTier: this.audioTier,
      android: IS_ANDROID, webview: IS_WEBVIEW,
    }
  }

  /** warm Russian label of the pause-menu item */
  label(): string {
    if (this._mode === 'high') return 'качество: красиво'
    if (this._mode === 'low') return 'качество: быстро'
    const s = this._level === 'high' ? 'красиво' : this._level === 'medium' ? 'средне' : 'быстро'
    return `качество: авто (${s})`
  }

  subscribe(fn: (k: QualityKnobs) => void): () => void {
    this.subs.push(fn)
    return () => { this.subs = this.subs.filter((f) => f !== fn) }
  }

  setMode(m: QualityMode) {
    if (m === this._mode) return
    this._mode = m
    try { localStorage.setItem(K_MODE, m) } catch { /* ok */ }
    // back to auto: take the last measurement if there is one and measure again
    const next = m === 'auto' ? (this._measured ?? guess()) : m
    this.reset()
    this.apply(next, 'режим')
  }

  /** the menu item cycles: auto -> beautiful -> fast -> auto */
  cycleMode(): QualityMode {
    const next: QualityMode = this._mode === 'auto' ? 'high' : this._mode === 'high' ? 'low' : 'auto'
    this.setMode(next)
    return next
  }

  /** called EVERY frame from engine.frame with the raw dt (before the engine clamp).
   *  We measure ALWAYS, even when the player set the quality by hand. The measurement
   *  itself costs one push into an array, and without it the dev overlay `?debug=audio`
   *  would show no fps in manual mode - exactly when we ask Andrey to compare
   *  «красиво» and «быстро» on his phone. The level decision is still taken only in
   *  'auto' (see verdict). */
  frame(dt: number) {
    if (!(dt > 0) || dt > OUTLIER_S) return
    if (this.warm < WARMUP_S) { this.warm += dt; return }
    if (this.cooldown > 0) { this.cooldown -= dt; return }
    this.samples.push(dt)
    this.winT += dt
    const need = this.first ? FIRST_WINDOW_S : WINDOW_S
    if (this.winT < need) return
    this.verdict()
  }

  private verdict() {
    const n = this.samples.length
    if (n < MIN_SAMPLES) { this.samples = []; this.winT = 0; return }
    const sorted = this.samples.slice().sort((a, b) => a - b)
    const med = sorted[n >> 1]
    this._fps = med > 0 ? 1 / med : 0
    this.samples = []
    this.winT = 0
    this.first = false
    // manual mode: the number is measured (the overlay shows it) but the level is kept
    if (this._mode !== 'auto') return

    // Where the device asks to go ACCORDING TO THE MEASUREMENT. Down - at once (the
    // player suffers right now); up - by one tier and only after TWO good windows in a
    // row, otherwise after a quiet splash we would raise the quality right before the
    // storm and drop it back. The FPS_HYST band keeps the swing from starting at the
    // border.
    const cur = ORDER.indexOf(this._level)
    const target = this._fps < FPS_LOW ? 0 : this._fps < FPS_MID ? 1 : 2
    const targetUp = this._fps < FPS_LOW + FPS_HYST ? 0 : this._fps < FPS_MID + FPS_HYST ? 1 : 2
    let want = cur
    if (target < cur) {
      // ! DOWN ALSO TAKES TWO WINDOWS (fixed after a measurement). At first we dropped
      // on the first bad window and got a swing: one heavy scene (intro, portal) lowered
      // the level and the next window raised it back. And a level change is not free by
      // itself (the canvas buffer is recreated), so the cure added a hitch. The
      // exception is a total collapse (<20 fps): there is nothing to wait for, the
      // player suffers right now.
      this.badWindows++
      this.goodWindows = 0
      if (this.badWindows >= 2 || this._fps < FPS_PANIC) want = target
    } else if (targetUp > cur) {
      // UP AS WELL - Andrey asked directly: «понижать/увеличивать»
      this.badWindows = 0
      this.goodWindows++
      if (this.goodWindows >= 2) want = cur + 1
    } else { this.goodWindows = 0; this.badWindows = 0 }
    if (this.changes >= MAX_CHANGES && want > cur) want = cur // ratchet

    if (want !== cur) {
      this.cooldown = COOLDOWN_S
      this.goodWindows = 0
      this.badWindows = 0
      this.changes++
      this.apply(ORDER[want], `замер ${Math.round(this._fps)} fps`)
    }
    this._measured = this._level
    try { localStorage.setItem(K_SEEN, this._level) } catch { /* ok */ }
    // the first honest measurement lifts the Android 'mid' ceiling (see audioTier)
    this.syncAudio(`замер ${Math.round(this._fps)} fps`)
  }

  private reset() {
    this.samples = []; this.winT = 0; this.warm = 0
    this.first = true; this.cooldown = 0
    this.goodWindows = 0; this.badWindows = 0; this.changes = 0
  }

  private apply(level: QualityLevel, why: string) {
    if (level === this._level) return
    this._level = level
    console.debug('[hm-quality]', level, '·', why)
    const k = this.knobs
    for (const fn of this.subs) {
      try { fn(k) } catch (e) { console.warn('[hm-quality] подписчик упал:', e) }
    }
    // in 'auto' the audio tier follows the graphics level
    this.syncAudio(why)
  }
}

export const quality = new Quality()

/** ── WHAT TO ASK THE AudioContext FOR AT CREATION TIME (sound.ts:unlock) ────
 *
 *  It cannot change on the fly - the context is created once on the first gesture, so
 *  the decision is taken from the GUESS (previous run / hardware), not from a fresh
 *  measurement.
 *
 *  THE KEY FIX HERE. Earlier the numeric hint was given ONLY at the `low` level. So a
 *  phone that honestly holds 45+ fps and gets `medium`/`high` also got
 *  `latencyHint: 'interactive'` - the smallest buffer the platform can do (measured:
 *  10 ms) - AND THE FULL RICH GRAPH at the same time. That was the hole left behind:
 *  the scheduler and the buffer were cured, but only for the weakest devices, while the
 *  heavy graph was everywhere.
 *
 *  On Android we always ask with a number:
 *   - 'interactive' in an Android WebView is a request for the low-latency path
 *     (AAudio/OpenSL ES). It gives a tiny window for rendering a whole quantum; with a
 *     4-second convolution in the graph, a missed deadline = underrun = a click.
 *   - 'playback' is NOT taken: on Android it pushes the output past 200 ms, and the game
 *     is about tapping exactly on time.
 *   - a numeric hint is the golden middle: the browser rounds it up to a multiple of the
 *     hardware buffer and gives us headroom while staying well below the threshold where
 *     a finger hears the delay (~60-80 ms).
 *  The numbers are tied to the audio tier: a rich graph asks for more headroom.
 *
 *  Desktop behaviour is UNTOUCHED: 'interactive' was and stays there. */
export function audioLatencyHint(): AudioContextLatencyCategory | number {
  if (URL_LATENCY !== null) return URL_LATENCY
  if (IS_ANDROID) {
    const t = quality.audioTier
    return t === 'rich' ? 0.045 : t === 'mid' ? 0.06 : 0.085
  }
  return quality.knobs.audioLatency
}
