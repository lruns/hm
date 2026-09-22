// SoundEngine: all game sound SYNTHESIZED through WebAudio, not a single asset.
// Mix philosophy (audio design): one master bus, small peaks (gentle loudness,
// nothing cuts the ear), the compressor on the master is insurance against
// clipping, not a mixer. Slow-mo dims the world with a lowpass on the master
// (a sidechain duck without a sidechain: we just take the brightness down).
//
// The AudioContext is created/resumed ONLY after the first user gesture
// (autoplay policy): the engine calls unlock() from the input handlers.
// Every event logs console.debug('[hm-sound]', name), and the headless check
// (where the sound itself cannot be heard) goes by those logs.

import { audioLatencyHint, quality } from './quality'

const MUTE_KEY = 'hm2.mute'
const MASTER_VOL = 0.5

// ── SEPARATE VOLUME FOR MUSIC AND SOUNDS ────────────────────────────────────
// Andrey: «раздельные громкости ЗВУК/МУЗЫКА иконками, ступени как в играх».
// Before that the graph had a single knob: mute, all or nothing.
//
// We put TWO knobs BEFORE the duck chain, not after:
//     SFX    -> sfxBus  ┐
//                       ├-> duck(slow-mo lowpass) -> dip(warp duck) -> master(mute) -> comp
//     music  -> musicVol┘
// So slow-mo, the tunnel duck and the global mute work exactly as they did: they
// sit downstream and know nothing about the new knobs. The music's own submix
// (music.ts musicGain, which it drives by the shape of the track) is untouched
// too: our knob sits AFTER it.
const MUSIC_VOL_KEY = 'hm2.vol.music'
const SFX_VOL_KEY = 'hm2.vol.sfx'
/** volume steps "as in games": off -> half -> full (tap on the icon) */
export const VOL_STEPS = [0, 0.5, 1] as const

function readVol(key: string): number {
  try {
    const raw = localStorage.getItem(key)
    // A MISSING KEY IS NOT ZERO. `Number(localStorage.getItem(key))` returns 0
    // for null, and zero is a valid step, so EVERY new player started the game
    // muted. No key means full volume.
    if (raw === null || raw === '') return 1
    const v = Number(raw)
    if (!Number.isFinite(v)) return 1
    // take the nearest known step: a foreign/broken value means full volume
    const hit = VOL_STEPS.find((s) => Math.abs(s - v) < 0.01)
    return hit === undefined ? 1 : hit
  } catch { return 1 }
}

/** the pentatonic ladder of the reward, but IN SCALE DEGREES (I II III V VI)
 *  rather than semitones, so it belongs to each world. See tapGood/degSemi. */
const PENT_DEG = [0, 1, 2, 4, 5]

export class SoundEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private duck!: BiquadFilterNode // lowpass on the master: always open except in slow-mo
  private dip!: GainNode // warp duck gain: "the tunnel is the quietest moment" (Bejeweled)
  /** SFX volume knob: all SFX gather here and go to duck from here */
  private sfxBus!: GainNode
  /** MUSIC volume knob: music.ts/strudel plug their submix in here */
  private musicVol!: GainNode
  private musicVolume = readVol(MUSIC_VOL_KEY)
  private sfxVolume = readVol(SFX_VOL_KEY)
  // oscilloscope: the analyser sits AFTER the compressor, so it sees exactly what
  // is heard, both the music (either engine) and the SFX, since they share the chain
  private analyser: AnalyserNode | null = null
  // Float32Array<ArrayBuffer> spelled out: since TS 5.7 typed arrays have a buffer
  // parameter, and getFloatTimeDomainData accepts only the non-shared one
  private waveBuf: Float32Array<ArrayBuffer> | null = null
  private noiseBuf: AudioBuffer | null = null
  /** AIR: a shared bus of a short "room" for the singing sounds.
   *  See buildAir() for what it is for. */
  private airIn: GainNode | null = null
  /** a real convolution instead of the pair of delays (see setRoom) */
  private airConv: ConvolverNode | null = null
  /** wet of the former "air": muted once the real room arrives */
  private airFallback: GainNode | null = null
  private muted = false
  private slow = false
  private pulseLayer: 'off' | 'tick' | 'sub' = 'off'
  // key of the current music (music.ts -> setMusicKey). Default is world 1, A
  // ionian: even if the music has not introduced itself yet, the skip sounds sane
  private keyRoot = 57
  private keyMode: number[] = [0, 2, 4, 5, 7, 9, 11]

  // ── AUDIO-THREAD TELEMETRY ────────────────────────────────────────────────
  // The author's phone is out of our reach, and "the sound glitches" is about what
  // happens INSIDE the audio thread. The only way to know is to ask the browser
  // itself and show it on screen (see audiohud.ts).
  /** what we actually asked the AudioContext for (the hint before creation) */
  private hintAsked: AudioContextLatencyCategory | number = 'interactive'
  /** AudioContext.renderCapacity: direct audio-thread load. Not available
   *  everywhere (an experimental Chromium API); without it only indirect numbers remain. */
  private rcLoad = -1
  private rcPeak = -1
  private rcUnder = -1
  /** how many times the browser itself said the context left the running state */
  private drops = 0

  /** one status line of the audio thread for the overlay and the automatic check */
  audioStats() {
    const c = this.ctx
    if (!c) return null
    const out = (c as AudioContext & { outputLatency?: number }).outputLatency ?? 0
    return {
      sr: c.sampleRate, state: c.state,
      base: c.baseLatency, out,
      hint: this.hintAsked,
      load: this.rcLoad, peak: this.rcPeak, under: this.rcUnder,
      drops: this.drops, room: !!this.airConv,
    }
  }

  constructor() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1' } catch { /* ok */ }
  }

  get isMuted() { return this.muted }

  /**
   * Access to the shared audio graph for music.ts (the generative engine): the
   * same ctx, the entry into the chain duck(slow-mo lowpass) -> dip(warp duck) ->
   * master(mute) -> compressor. That way the music inherits slow-mo/tunnel duck
   * and the global M-mute for free. Valid only AFTER unlock() (the first
   * gesture), otherwise null.
   */
  musicBus(): { ctx: AudioContext; dest: AudioNode } | null {
    if (!this.ctx) return null
    // the music enters through ITS OWN volume knob, which itself sits on duck:
    // nothing changed for music.ts/strudel, they simply connect one link upstream
    return { ctx: this.ctx, dest: this.musicVol }
  }

  // ── volume steps: public knobs for the pause menu ─────────────────────────

  get musicVolumeStep(): number { return this.musicVolume }
  get sfxVolumeStep(): number { return this.sfxVolume }

  /** move a gain to a new value smoothly (without a click) */
  private rampGain(node: GainNode | undefined, v: number) {
    if (!node || !this.ctx) return
    const t = this.ctx.currentTime
    node.gain.cancelScheduledValues(t)
    node.gain.setTargetAtTime(v, t, 0.03)
  }

  /** MUSIC volume 0..1 (survives a restart). Does not touch mute or the duck chain */
  setMusicVolume(v: number) {
    this.musicVolume = Math.max(0, Math.min(1, v))
    try { localStorage.setItem(MUSIC_VOL_KEY, String(this.musicVolume)) } catch { /* ok */ }
    this.rampGain(this.musicVol, this.musicVolume)
    this.log('music-vol', String(this.musicVolume))
  }

  /** SFX volume 0..1 (survives a restart). Does not touch mute or the duck chain */
  setSfxVolume(v: number) {
    this.sfxVolume = Math.max(0, Math.min(1, v))
    try { localStorage.setItem(SFX_VOL_KEY, String(this.sfxVolume)) } catch { /* ok */ }
    this.rampGain(this.sfxBus, this.sfxVolume)
    this.log('sfx-vol', String(this.sfxVolume))
  }

  /** next step, cycling: 100% -> 50% -> 0% -> 100% (tap on the icon) */
  cycleMusicVolume(): number {
    const i = VOL_STEPS.indexOf(this.musicVolume as typeof VOL_STEPS[number])
    this.setMusicVolume(VOL_STEPS[(i < 0 ? 0 : i + VOL_STEPS.length - 1) % VOL_STEPS.length])
    return this.musicVolume
  }

  cycleSfxVolume(): number {
    const i = VOL_STEPS.indexOf(this.sfxVolume as typeof VOL_STEPS[number])
    this.setSfxVolume(VOL_STEPS[(i < 0 ? 0 : i + VOL_STEPS.length - 1) % VOL_STEPS.length])
    return this.sfxVolume
  }

  /**
   * Oscilloscope: the raw waveform of the master output in the range -1..1.
   * Returns the buffer or null (audio not open yet / no analyser available).
   * The buffer is reused: do not keep the reference between frames, only read it.
   */
  waveform(): Float32Array | null {
    if (!this.analyser || !this.waveBuf) return null
    this.analyser.getFloatTimeDomainData(this.waveBuf)
    return this.waveBuf
  }

  /** PROMO CAPTURE: splice a recording stream into the END of the bus. The
   *  analyser is the last link before destination, so the stream hears the final
   *  mix. Called only from scripts/capture-layers.mjs, never from the game. */
  devTap(): MediaStream | null {
    const node: AudioNode | null = this.analyser ?? this.master
    if (!this.ctx || !node) return null
    const dest = this.ctx.createMediaStreamDestination()
    node.connect(dest)
    return dest.stream
  }

  /** only after a user gesture (autoplay policy) */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext
      if (!AC) return
      try {
        // ── AUDIO-THREAD BUFFER ────────────────────────────────────────────
        // WebAudio computes sound on ITS OWN thread, the game render does not slow
        // it down. But the buffer size is set here, once and for all: with the
        // default 'interactive' the thread gets a tiny window (~128-256 samples,
        // 3-5 ms) to compute the convolution reverb, the choir and a dozen
        // oscillators. On a weak phone, where the cores are busy rendering, it
        // sometimes misses that window, and that is a click. We ask quality.ts for
        // a suitable size: a powerful device gets 'interactive' as before (an SFX
        // on tap is instant), a weak one gets a 50 ms buffer (the clicks go away
        // and the finger hardly hears the difference).
        this.hintAsked = audioLatencyHint()
        const ctx: AudioContext = new AC({ latencyHint: this.hintAsked })
        // safety compressor: gently catches accidental sums, does not pump the mix
        const comp = ctx.createDynamicsCompressor()
        comp.threshold.value = -14; comp.ratio.value = 4
        comp.attack.value = 0.004; comp.release.value = 0.24
        // OSCILLOSCOPE: the analyser is spliced in as the last link before the
        // output: master -> comp -> analyser -> destination. That way the waveform
        // shows the FINAL mix (music from either engine + all SFX), not one layer.
        try {
          const an = ctx.createAnalyser()
          an.fftSize = 1024          // 512 waveform samples: enough for the ring
          an.smoothingTimeConstant = 0.55
          comp.connect(an)
          an.connect(ctx.destination)
          this.analyser = an
          // ArrayBuffer spelled out: TS 5.7 distinguishes Float32Array<ArrayBuffer>
          // from <ArrayBufferLike>, and getFloatTimeDomainData wants the former
          this.waveBuf = new Float32Array(new ArrayBuffer(an.fftSize * 4))
          this.log('analyser-on')
        } catch {
          comp.connect(ctx.destination) // without the analyser the sound still plays
        }
        this.master = ctx.createGain()
        this.master.gain.value = this.muted ? 0 : MASTER_VOL
        this.master.connect(comp)
        // events -> duck(lowpass) -> dip(warp duck) -> master
        this.dip = ctx.createGain(); this.dip.gain.value = 1
        this.dip.connect(this.master)
        this.duck = ctx.createBiquadFilter()
        this.duck.type = 'lowpass'; this.duck.frequency.value = 16000; this.duck.Q.value = 0.4
        this.duck.connect(this.dip)
        // two volume knobs BEFORE duck, see the comment at MUSIC_VOL_KEY.
        // Neither mute nor slow-mo nor the warp duck notice a thing.
        this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.sfxVolume
        this.sfxBus.connect(this.duck)
        this.musicVol = ctx.createGain(); this.musicVol.gain.value = this.musicVolume
        this.musicVol.connect(this.duck)
        this.ctx = ctx
        this.buildAir(ctx)
        // log what the browser actually gave: baseLatency IS the buffer size in
        // seconds, outputLatency (where available) is the whole path to the speaker
        this.log('ctx-created', `sr=${ctx.sampleRate}`,
          `hint=${String(this.hintAsked)}`,
          `base=${(ctx.baseLatency * 1000).toFixed(1)}ms`,
          `out=${(((ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0) * 1000).toFixed(1)}ms`)
        // ── DIRECT MEASUREMENT OF THE AUDIO-THREAD LOAD (where supported) ──
        // AudioContext.renderCapacity gives averageLoad / peakLoad (the fraction
        // of the allotted time, 1.0 = exactly at the limit) and underrunRatio, the
        // fraction of quanta that MISSED. That is exactly the diagnosis we came
        // for: if underrun > 0, the graph is to blame, not the scheduler.
        // The API is experimental: we take it defensively, its absence breaks nothing.
        try {
          const rc = (ctx as unknown as {
            renderCapacity?: {
              start: (o: { updateInterval: number }) => void
              addEventListener: (t: string, f: (e: Record<string, number>) => void) => void
            }
          }).renderCapacity
          if (rc && typeof rc.start === 'function') {
            rc.addEventListener('update', (e) => {
              this.rcLoad = e.averageLoad ?? -1
              this.rcPeak = e.peakLoad ?? -1
              this.rcUnder = e.underrunRatio ?? -1
            })
            rc.start({ updateInterval: 1 })
            this.log('render-capacity-on')
          }
        } catch { /* no such API: we live on the indirect numbers */ }
        // the context can drop on its own (audio focus, output device change):
        // on Android that is an extra suspect, and it must be seen, not guessed
        try {
          ctx.addEventListener('statechange', () => {
            if (ctx.state !== 'running') { this.drops++; this.log('ctx-state', ctx.state) }
          })
        } catch { /* ok */ }
      } catch { return }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => { /* ok */ })
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0') } catch { /* ok */ }
    if (this.ctx) {
      const t = this.ctx.currentTime
      this.master.gain.cancelScheduledValues(t)
      this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_VOL, t, 0.03)
    }
    this.log(this.muted ? 'mute-on' : 'mute-off')
    return this.muted
  }

  /** slow-mo: the world is heard "through ice": the lowpass closes, then lets go */
  setSlow(on: boolean) {
    if (on === this.slow) return
    this.slow = on
    this.log(on ? 'slow-filter-on' : 'slow-filter-off')
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.duck.frequency.cancelScheduledValues(t)
    this.duck.frequency.setTargetAtTime(on ? 750 : 16000, t, on ? 0.12 : 0.3)
  }

  // ---------- events ----------

  /**
   * THE CORRECT TAP: the most frequent sound of the game, hundreds per run.
   *
   * Three rules, all three from measurements:
   * 1) THE LADDER IS IN THE WORLD'S MODE. The degrees are taken from the current
   *    world's mode: I-II-III-V-VI, the same pentatonic but its own per world. A
   *    fixed pentatonic in Hz put two or three of its notes OUTSIDE the music's
   *    mode in worlds 2/3/4 (analysis in degSemi).
   * 2) NO MACHINE GUN. Every tap gets a micro-detune of +-7 cents and +-1 dB of
   *    level. The ear does not hear "a different note", but it stops hearing "the
   *    same recording again" (audio design: kill the machine gun repeat).
   * 3) NOT DRY. Half goes into the air bus: the reward sounds IN the same room as
   *    the music, not on top of it as a glassy click.
   */
  tapGood(streak: number) {
    this.log('tap-good')
    if (!this.on()) return
    const step = Math.max(0, Math.min(streak - 1, 14))
    // PENT here holds SCALE DEGREE indexes (0 I, 1 II, 2 III, 4 V, 5 VI), not
    // semitones: in major modes it gives the familiar major pentatonic, in
    // dorian/aeolian a minor one, and both always belong to their world
    const idx = PENT_DEG[step % 5] + 7 * Math.floor(step / 5)
    const f = this.keyHz(idx, 1)
    const t = this.now()
    const wob = (Math.random() * 2 - 1) // -1..1: the same note comes out slightly different each time
    const v = 0.10 * (1 + wob * 0.10)
    // THE LADDER MOVES ACROSS THE STAGE. The streak reward is a climb up the
    // pentatonic; it is also a climb LEFT TO RIGHT, round after round. The streak
    // is not "the same note higher" but a movement: on the fifth in a row you hear
    // that you reached the edge and the ladder starts a new pass.
    const pan = -0.34 + 0.17 * (step % 5)
    this.chime(f, t, 0.45 + wob * 0.04, v, 'triangle', 0.5, wob * 7, pan)
    // the octave glint, the "crystal"; 2.003 instead of 2.0 gives a slow beating.
    // The glint sits SLIGHTLY wider than the main tone, so the note gets thickness
    this.chime(f * 2.003, t + 0.012, 0.3, v * 0.35, 'triangle', 0.35, wob * 7, pan * 1.5)
  }

  /**
   * THE KEY OF THE CURRENT MUSIC, reported by music.ts on a world change
   * (applyPreset -> setMusicKey). The skip needs it: its whoosh slides along the
   * scale degrees and therefore does not argue with what plays underneath. The
   * value survives the absence of a ctx (it may be called before the first gesture).
   */
  setMusicKey(rootMidi: number, mode: number[]) {
    this.keyRoot = rootMidi
    this.keyMode = mode.slice()
  }

  /**
   * A SCALE DEGREE of the current music -> semitones from the tonic. The index may
   * exceed the mode length, then we go into upper octaves (degree 7 = the tonic an
   * octave up).
   *
   * This is the core of the musical pass. Before it EVERY melodic sound of the
   * game was nailed to fixed hertz (tap pentatonic from 660 Hz, fanfare in C
   * major, stars in E major), while the music lives in A ionian (world 1), C
   * lydian (2), D dorian (3), B aeolian (4). Score analysis:
   *
   *   the tap ladder (E F# G# B C#) against the world's mode
   *   world 1 A ionian  - all 5 belong
   *   world 2 C lydian  - G#, C# foreign (2 of 5 off)
   *   world 3 D dorian  - F#, G#, C# foreign (3 of 5 off!)
   *   world 4 B aeolian - G# foreign
   *
   * So THE MOST FREQUENT sound of the game (the correct answer) played against
   * the music in three worlds out of five. That is what "звуки как-то не идеальны"
   * was about: each sound is fine on its own, but together with the music it is an
   * out-of-tune the ear hears without being able to name it. Now everything that
   * sings is built FROM HERE, from the current world's mode.
   */
  private degSemi(i: number): number {
    const m = this.keyMode
    const len = m.length || 7
    const oct = Math.floor(i / len)
    return (m[((i % len) + len) % len] ?? 0) + 12 * oct
  }

  /** scale degree (i) in octave `oct` relative to the music's tonic -> Hz */
  private keyHz(i: number, oct = 1): number {
    return 440 * Math.pow(2, (this.keyRoot + 12 * oct + this.degSemi(i) - 69) / 12)
  }

  /**
   * AIR: a short "room" for the singing sounds.
   *
   * A measurement showed an oddity: the music's melody has a delay with dark
   * feedback (it sounds IN a space), while ALL SFX had nothing. Tap, fanfare and
   * stars hit the master directly, dry as a finger snap in cotton wool, and so
   * they seemed loud and small at the same time: the event happens "on glass"
   * while the music is "in a room". That is heard as "the sounds are not ideal".
   *
   * Not a reverb unit (a convolution costs CPU and needs an impulse asset, and we
   * have zero assets): two short delays with prime numbers (61 and 89 ms, not
   * multiples of each other, so no comb filtering) with dark feedback. Tail ~0.4 s.
   * The wet goes into the common duck, so the room honestly dims in slow-mo, dives
   * in the tunnel and goes silent under mute, like everything else.
   */
  private buildAir(ctx: AudioContext) {
    try {
      const inp = ctx.createGain(); inp.gain.value = 1
      const wet = ctx.createGain(); wet.gain.value = 0.5
      const fb = ctx.createGain(); fb.gain.value = 0.30
      const dark = ctx.createBiquadFilter()
      dark.type = 'lowpass'; dark.frequency.value = 2600; dark.Q.value = 0.4
      const d1 = ctx.createDelay(0.5); d1.delayTime.value = 0.061
      const d2 = ctx.createDelay(0.5); d2.delayTime.value = 0.089
      inp.connect(d1); inp.connect(d2)
      d1.connect(dark); d2.connect(dark)
      dark.connect(wet); wet.connect(this.sfxBus)
      dark.connect(fb); fb.connect(d1); fb.connect(d2)
      this.airIn = inp
      this.airFallback = wet // muted once the real room arrives
    } catch { this.airIn = null } // without air the sound still plays
  }

  /**
   * A REAL ROOM FOR THE EVENTS.
   *
   * Once the music got stereo width, top end and space, a fourth problem appeared:
   * the music now sounds IN A HALL while the events sit in a pair of short delays.
   * That is worse than everything being dry: the ear clearly hears that the tap and
   * the music stand in DIFFERENT rooms and reads it as being out of tune without
   * being able to name the cause.
   *
   * So music.ts, having assembled its graph, hands a synthesized impulse (`makeIR`)
   * over here: a short room, not its own big hall, because an event needs the walls
   * to answer, not a three-second tail. The call direction is one-way (music ->
   * sound, as already done for `setMusicKey`), no import back and no module cycle.
   *
   * Idempotent and safe: until the impulse arrives (or if ConvolverNode is
   * unavailable) the former pair of delays keeps working, so the sound never
   * disappears.
   */
  setRoom(ir: AudioBuffer) {
    if (!this.ctx || !this.airIn || this.airConv) return
    // on the economical tier we do not create a second convolution in the graph at
    // all (music.ts will not call here anyway, but the guard must stand on both
    // sides: the tier can change between graph assembly and this call)
    if (!quality.audio.sfxRoom) { this.log('room-skip'); return }
    try {
      const ctx = this.ctx
      const conv = ctx.createConvolver()
      conv.normalize = true
      conv.buffer = ir
      // trim the low end: event bass in the reverb gives rumble, not a room
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'; hp.frequency.value = 260; hp.Q.value = 0.5
      const wet = ctx.createGain(); wet.gain.value = 0.55
      this.airIn.connect(hp); hp.connect(conv); conv.connect(wet); wet.connect(this.sfxBus)
      this.airConv = conv
      // fade the old delay-based "air" to zero smoothly, in case something is
      // sounding through it at this very moment
      if (this.airFallback) {
        const t = this.ctx.currentTime
        this.airFallback.gain.cancelScheduledValues(t)
        this.airFallback.gain.setValueAtTime(this.airFallback.gain.value, t)
        this.airFallback.gain.linearRampToValueAtTime(0.0001, t + 0.25)
      }
      this.log('room-on')
    } catch { /* no convolution: we stay on the delays, the sound does not disappear */ }
  }

  /**
   * THE CORRECT SKIP ("не моё": X / right click / button / swipe left).
   *
   * A skip is a LEGAL action and often the correct answer, so the sound has no
   * right to scare or to sound like a refusal. It is meant as a soft short whoosh:
   * the voice slides down a fourth along the scale degrees of the current music and
   * lands on the FIFTH of the tonic, the calmest tone there is. A sweeping gesture
   * that agrees with the music, "skipped it, moving on", not "an error".
   *
   * Andrey: «на скипе сделать звук» — before that the skip was only band-passed
   * noise peaking at 0.055 (-25 dBFS), 5 dB below the tap and without a single
   * note: at that level under the music the rustle simply did not read. Now it is a
   * tone (triangle under a lowpass, glissando) plus the same noise in the BACKGROUND
   * as the air of the gesture. The resulting peak is ~0.085 (-21 dBFS), slightly
   * below the tap (0.10), because the tap is a reward and the skip is a work move.
   *
   * vol<1 is the quiet version for passive skips (the surprise floated away, time ran out).
   */
  skip(vol = 1) {
    this.log('skip')
    if (!this.on()) return
    const ctx = this.ctx!
    const t = this.now()
    // start an octave above the tonic, land on the fifth: a fourth downwards.
    // we convert midi->Hz ourselves so as not to pull a dependency from music.ts
    const m = (semi: number) => 440 * Math.pow(2, (this.keyRoot + 12 + semi - 69) / 12)
    const fifth = this.keyMode[4] ?? 7 // the 5th degree (= 7 in all of our modes)
    const f0 = m(12)
    const f1 = m(fifth)
    const dur = 0.19

    const o = ctx.createOscillator(); o.type = 'triangle'
    o.frequency.setValueAtTime(f0, t)
    // an exponential slide is even IN PITCH (ears hear ratios, not hertz): a linear
    // fall would read as a jerk at the end
    o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.72)
    // soft top: without the filter a triangle gets sandy on a fast glissando
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(3200, t)
    lp.frequency.exponentialRampToValueAtTime(1100, t + dur)
    lp.Q.value = 0.5
    // envelope: a 12 ms attack (no click), the tail longer than the fall: "it flew away"
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.062 * vol, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1)
    o.connect(lp); lp.connect(g); g.connect(this.sfxBus)
    o.start(t); o.stop(t + dur + 0.15)

    // the air of the gesture: the noise goes DOWN together with the tone (going up
    // read as "take-off", while a skip is "swept aside")
    this.sweepNoise(t, 0.15, 2400, 700, 1.6, 0.032 * vol)
  }

  /**
   * ERROR: a dull low hit, "обидно, но не пугает" (the canon).
   *
   * A measurement caught a skew invisible in the code: the engine calls bad() and
   * glitch() BACK TO BACK, and together they produced -16.4 dBFS, 9.5 dB louder
   * than the reward for a correct answer (-25.9) and louder than everything else
   * in the game except the portal hit. The game shouted at a mistake twice as hard
   * as it praised a correct answer. For a game that heals the school trauma of
   * "made a mistake, dropped out of the circle", that is exactly backwards. The hit
   * stays weighty (low end, body, you feel it) but no longer strikes: the peak of
   * the pair is lowered roughly to the level of the tap.
   */
  bad() {
    this.log('bad')
    if (!this.on()) return
    const t = this.now()
    const ctx = this.ctx!
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(130, t)
    o.frequency.exponentialRampToValueAtTime(48, t + 0.26)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420
    const g = this.env(t, 0.125, 0.008, 0.32) // was 0.22
    o.connect(lp); lp.connect(g)
    o.start(t); o.stop(t + 0.35)
    // the soft "thud" body of the hit
    this.sweepNoise(t, 0.1, 220, 120, 0.9, 0.03)
  }

  /**
   * the glitch "stumble" that goes with an error: a short OUT-OF-KEY semitone note
   * (<=0.3 s). Two pitches a semitone apart + a micro wobble of frequency: "hit the
   * wrong one", a stumble, not horror. Goes through duck (inherits slow-mo/mute/duck).
   */
  glitch() {
    this.log('glitch')
    if (!this.on()) return
    const t = this.now()
    const ctx = this.ctx!
    // OUT OF KEY RELATIVE TO THE MODE. Fixed 494/523 Hz in every world sometimes
    // landed on two notes that BELONG to the mode, and the "stumble" then sounded
    // like a chord. Instead we take a REAL scale degree (III) and next to it a note
    // a semitone above, which is never in the mode. That gives exactly "almost got
    // it, but off", equally recognisable in all five worlds.
    const ok = this.keyHz(2, 1)
    for (const f of [ok, ok * Math.pow(2, 1 / 12)]) {
      const o = ctx.createOscillator(); o.type = 'square'
      o.frequency.setValueAtTime(f, t)
      // a micro "jam": the frequency steps down and back (the stumble)
      o.frequency.setValueAtTime(f * 0.94, t + 0.06)
      o.frequency.setValueAtTime(f, t + 0.12)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400
      const g = this.env(t, 0.030, 0.002, 0.18) // was 0.06, see bad()
      o.connect(lp); lp.connect(g)
      o.start(t); o.stop(t + 0.24)
    }
  }

  /** surprise gift: a sparkling arpeggio upwards */
  gift() {
    this.log('gift')
    if (!this.on()) return
    const t = this.now()
    // a flourish along the world's scale degrees (was: semitones from a fixed 740 Hz)
    const steps = [0, 2, 4, 7, 9]
    steps.forEach((s, i) => this.chime(this.keyHz(s, 1), t + i * 0.055, 0.4, 0.06, 'triangle', 0.5))
    this.sweepNoise(t + 0.05, 0.35, 5200, 7800, 1.1, 0.02) // sparks on top
  }

  /** trap: a short dissonance (a tritone), without horror */
  trap() {
    this.log('trap')
    if (!this.on()) return
    const t = this.now()
    const ctx = this.ctx!
    for (const f of [320, 452]) { // a tritone
      const o = ctx.createOscillator(); o.type = 'square'
      o.frequency.setValueAtTime(f, t)
      o.frequency.exponentialRampToValueAtTime(f * 0.92, t + 0.24)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900
      const g = this.env(t, 0.05, 0.006, 0.26)
      o.connect(lp); lp.connect(g)
      o.start(t); o.stop(t + 0.3)
    }
  }

  /** number burst: 2-3 firework claps spread in time */
  salute() {
    this.log('salute')
    if (!this.on()) return
    const t = this.now()
    const delays = [0, 0.16, 0.36]
    for (const d of delays) {
      const jitter = d === 0 ? 0 : Math.random() * 0.04
      const tt = t + d + jitter
      // the clap: a noise flash whose frequency falls like a real firework
      this.sweepNoise(tt, 0.22, 1900 + Math.random() * 500, 380, 1.0, 0.13)
      // the low end of the clap
      const o = this.ctx!.createOscillator(); o.type = 'sine'
      o.frequency.setValueAtTime(180, tt)
      o.frequency.exponentialRampToValueAtTime(65, tt + 0.18)
      const g = this.env(tt, 0.09, 0.004, 0.2)
      o.connect(g); o.start(tt); o.stop(tt + 0.25)
    }
  }

  /** +life: a warm little bell */
  lifeBell() {
    this.log('life-bell')
    if (!this.on()) return
    const t = this.now()
    // a bell = a stack of partials with a long tail, on the world's TONIC
    const f = this.keyHz(0, 1)
    this.chime(f, t, 1.1, 0.11, 'sine', 0.6)
    this.chime(f * 2.0, t, 0.8, 0.045, 'sine', 0.45)
    this.chime(f * 3.01, t, 0.5, 0.02, 'sine', 0.35)
  }

  // ---------- PORTAL SECTION: the sound arc of the transition ----------
  // One arc for the whole end-of-level show, heard as a single movement:
  //   collapsing hum up -> an inhale of silence (a dip) -> the FLASH HIT ->
  //   flight noise (quiet, under the duck) -> the arrival chime down
  // Principle from audio design: dynamics are shaped by the DUCK on the master
  // (this.dip), not by the level of individual notes; then the music of either
  // engine breathes together with the effects, since they share the chain.

  /** soft master duck: one knob for the whole arc (v = multiplier, tc = time constant) */
  private dipTo(v: number, at: number, tc: number) {
    if (!this.ctx) return
    this.dip.gain.cancelScheduledValues(at)
    this.dip.gain.setTargetAtTime(v, at, tc)
  }

  /**
   * PHASE 1: the world collapses, a RISING HUM.
   * A low hum crawls upwards, joined by a noise riser and a barely audible
   * "sucking" whistle. The level grows and cuts off at the end (the inhale picks it up).
   */
  collapseHum(dur = 0.62) {
    this.log('collapse-hum')
    if (!this.on()) return
    const t = this.now()
    const ctx = this.ctx!
    // the hum: two detuned saws crawl upwards, "the world is being drawn in"
    for (const [f0, f1, pk] of [[46, 132, 0.075], [69, 196, 0.045]] as [number, number, number][]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'
      o.frequency.setValueAtTime(f0, t)
      o.frequency.exponentialRampToValueAtTime(f1, t + dur)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
      lp.frequency.setValueAtTime(320, t)
      lp.frequency.exponentialRampToValueAtTime(1400, t + dur)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(pk, t + dur * 0.86)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06)
      o.connect(lp); lp.connect(g); g.connect(this.sfxBus)
      o.start(t); o.stop(t + dur + 0.1)
    }
    // noise riser: the band moves up, the air is pulled towards the centre
    this.sweepNoise(t, dur, 420, 4200, 1.6, 0.055)
  }

  /**
   * PHASE 2: THE INHALE OF SILENCE, the master nearly drops to zero for ~0.15 s.
   * This is not mute: the music keeps going, the world just holds its breath.
   */
  breathIn(hold = 0.15) {
    this.log('breath-in')
    if (!this.ctx) return
    const t = this.now()
    this.dipTo(0.06, t, 0.035)          // a sharp dip
    this.dipTo(1, t + hold, 0.05)       // and an equally sharp return, right into the hit
  }

  /**
   * PHASE 3: THE FLASH HIT, the cut from "the world is swallowed" to hyperspace.
   * A sub boom + a wide white clap + a short metallic ring on top.
   */
  portalHit() {
    this.log('portal-hit')
    if (!this.on()) return
    const t = this.now()
    const ctx = this.ctx!
    // the sub boom
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(190, t)
    o.frequency.exponentialRampToValueAtTime(38, t + 0.4)
    const g = this.env(t, 0.20, 0.003, 0.42)
    o.connect(g); o.start(t); o.stop(t + 0.5)
    // the white clap: a wide band collapses downwards
    this.sweepNoise(t, 0.3, 7000, 500, 0.6, 0.15)
    // the metallic ring on top marking the cut (short, "the door slammed")
    this.chime(1976, t + 0.008, 0.35, 0.05)
    this.chime(2637, t + 0.02, 0.28, 0.03)
  }

  /** portal: a rising whoosh of ~1.5 s */
  portal() {
    this.log('portal')
    if (!this.on()) return
    const t = this.now()
    const ctx = this.ctx!
    // the noise whoosh: the band crawls up, the level rises and is cut off by the arrival
    const src = this.noiseSrc(1.6)
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1
    bp.frequency.setValueAtTime(260, t)
    bp.frequency.exponentialRampToValueAtTime(3600, t + 1.45)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.14, t + 1.25)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.55)
    src.connect(bp); bp.connect(g); g.connect(this.sfxBus)
    src.start(t); src.stop(t + 1.6)
    // a glissando hum under the whoosh
    const o = ctx.createOscillator(); o.type = 'sawtooth'
    o.frequency.setValueAtTime(70, t)
    o.frequency.exponentialRampToValueAtTime(520, t + 1.45)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.0001, t)
    og.gain.exponentialRampToValueAtTime(0.05, t + 1.2)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 1.55)
    o.connect(lp); lp.connect(og); og.connect(this.sfxBus)
    o.start(t); o.stop(t + 1.6)
  }

  /**
   * PHASE 4: the tunnel, the fly-away whoosh of the disc and FLIGHT NOISE under
   * the duck. The master drops (~-9 dB), the Bejeweled canon "the warp is the
   * quietest moment" (an RMS dip in the analysis). The music does NOT go deaf:
   * the pad runs as a thin thread through the duck, because the engine separately
   * keeps intensity low instead of switching the layer off.
   */
  tunnelFly() {
    this.log('tunnel-fly')
    if (!this.on()) return
    const t = this.now()
    // the departure whoosh: a noise band flies up and melts away
    this.sweepNoise(t, 0.5, 700, 3400, 1.2, 0.12)
    const o = this.ctx!.createOscillator(); o.type = 'sawtooth'
    o.frequency.setValueAtTime(180, t)
    o.frequency.exponentialRampToValueAtTime(720, t + 0.4)
    const lp = this.ctx!.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200
    const g = this.env(t, 0.05, 0.02, 0.45)
    o.connect(lp); lp.connect(g)
    o.start(t); o.stop(t + 0.55)
    // master duck: a quiet warp (a ~9 dB dip ~ x0.35), held for the WHOLE flight
    this.dipTo(0.35, t + 0.62, 0.22)
    // FLIGHT NOISE: a wide quiet band of "wind between the worlds" for the whole
    // of phase C, plus an oncoming Doppler whistle: a sense of speed without loudness
    this.sweepNoise(t + 0.68, 1.7, 260, 1150, 0.7, 0.042)
    const w = this.ctx!.createOscillator(); w.type = 'sine'
    w.frequency.setValueAtTime(1150, t + 0.7)
    w.frequency.exponentialRampToValueAtTime(300, t + 2.2)
    const wlp = this.ctx!.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 2200
    const wg = this.ctx!.createGain()
    wg.gain.setValueAtTime(0.0001, t + 0.7)
    wg.gain.exponentialRampToValueAtTime(0.022, t + 1.1)
    wg.gain.exponentialRampToValueAtTime(0.0001, t + 2.25)
    w.connect(wlp); wlp.connect(wg); wg.connect(this.sfxBus)
    w.start(t + 0.7); w.stop(t + 2.3)
  }

  /** PHASE 5: arrival, a warm chime of the new world + the master releases the duck */
  tunnelArrive() {
    this.log('tunnel-arrive')
    if (!this.on()) return
    const t = this.now()
    this.dipTo(1, t, 0.35)
    // the arrival chime is the triad of the NEW world (music.ts calls setMusicKey
    // at the eclipse, so the mode here is already the new one): the sound greets you
    // in the mode the music is about to play in.
    this.chime(this.keyHz(0, 1), t, 0.9, 0.10, 'triangle', 0.6)
    this.chime(this.keyHz(2, 1), t + 0.07, 0.8, 0.07, 'triangle', 0.6)
    this.chime(this.keyHz(4, 2), t + 0.14, 0.6, 0.035, 'triangle', 0.5)
    this.sweepNoise(t + 0.1, 0.4, 4500, 8000, 1.1, 0.018)
  }

  /** insurance: if the tunnel was cut short (destroy/restart/exit to menu), restore the level */
  tunnelRelease() {
    if (!this.ctx) return
    this.dipTo(1, this.ctx.currentTime, 0.2)
  }

  /** freeze: an icy ring (the dimming of the world itself is setSlow) */
  freeze() {
    this.log('freeze')
    if (!this.on()) return
    const t = this.now()
    // icy high bells with a slight detune, "the frost has rung".
    // The mode's triad two octaves up instead of a fixed G-C-E
    const fs = [this.keyHz(0, 2), this.keyHz(2, 2), this.keyHz(4, 2)]
    fs.forEach((f, i) => {
      this.chime(f, t + i * 0.06, 0.9, 0.05, 'sine', 0.6)
      this.chime(f * 1.006, t + i * 0.06 + 0.01, 0.7, 0.02, 'sine', 0.5)
    })
  }

  /** transfer: a whistling glissando, "the disc has left" (up and immediately down) */
  transfer() {
    this.log('transfer')
    if (!this.on()) return
    const t = this.now()
    const ctx = this.ctx!
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(680, t)
    o.frequency.exponentialRampToValueAtTime(1650, t + 0.26)
    o.frequency.exponentialRampToValueAtTime(520, t + 0.58)
    const g = this.env(t, 0.05, 0.02, 0.6)
    o.connect(g); o.start(t); o.stop(t + 0.7)
    // the air under the whistle
    this.sweepNoise(t, 0.5, 1200, 3000, 2.0, 0.028)
  }

  /** warp: the "wow", an oscillator with vibrato sags down, the shape floats away */
  warp() {
    this.log('warp')
    if (!this.on()) return
    const t = this.now()
    const ctx = this.ctx!
    const o = ctx.createOscillator(); o.type = 'sawtooth'
    o.frequency.setValueAtTime(330, t)
    o.frequency.exponentialRampToValueAtTime(170, t + 0.7)
    // the vibrato deepens: the floating feeling
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 6
    const lg = ctx.createGain()
    lg.gain.setValueAtTime(8, t); lg.gain.linearRampToValueAtTime(42, t + 0.6)
    lfo.connect(lg); lg.connect(o.frequency)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 950
    const g = this.env(t, 0.055, 0.03, 0.7)
    o.connect(lp); lp.connect(g)
    o.start(t); o.stop(t + 0.8); lfo.start(t); lfo.stop(t + 0.8)
  }

  /** colour music: quiet shimmering, a whole-tone ladder of soft bells */
  colorMusic() {
    this.log('color-music')
    if (!this.on()) return
    const t = this.now()
    // a whole-tone scale: "rainbow-like", no tonic, quiet (the debuff hinders, does not scare)
    const steps = [0, 2, 4, 6, 8, 10, 12]
    steps.forEach((s, i) => this.chime(587 * Math.pow(2, s / 12), t + i * 0.09, 0.55, 0.028, 'sine'))
    this.sweepNoise(t + 0.1, 0.55, 3000, 6800, 1.4, 0.012)
  }

  /** inversion: the negative sound, two detuned squares gliding down, metallic */
  inversion() {
    this.log('inversion')
    if (!this.on()) return
    const t = this.now()
    const ctx = this.ctx!
    for (const f of [880, 927]) { // detune beating: "the world turned inside out"
      const o = ctx.createOscillator(); o.type = 'square'
      o.frequency.setValueAtTime(f, t)
      o.frequency.exponentialRampToValueAtTime(f * 0.38, t + 0.5)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500
      const g = this.env(t, 0.04, 0.008, 0.5)
      o.connect(lp); lp.connect(g)
      o.start(t); o.stop(t + 0.6)
    }
    this.sweepNoise(t, 0.3, 3200, 320, 1.2, 0.035)
  }

  /**
   * pulse bass in the BEAT_HZ rhythm: layers by build-up,
   * silence -> tick -> tick+sub bass (at x2 and above). The level grows with
   * intensity. Only a layer change is logged (otherwise spam on every beat).
   */
  beat(intensity: number, multiplier: number) {
    const layer: typeof this.pulseLayer =
      intensity < 0.06 ? 'off' : multiplier >= 2 ? 'sub' : 'tick'
    if (layer !== this.pulseLayer) { this.pulseLayer = layer; this.log('pulse-' + layer) }
    if (layer === 'off' || !this.on()) return
    const t = this.now()
    const ctx = this.ctx!
    // the quiet tick: a short blip through a lowpass, barely audible on a small streak
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(240, t)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800
    const g = this.env(t, 0.012 + 0.05 * intensity, 0.003, 0.05)
    o.connect(lp); lp.connect(g)
    o.start(t); o.stop(t + 0.08)
    if (layer === 'sub') {
      // SUB BASS ON THE WORLD'S TONIC. A fixed 55 Hz (A) matched world 1, but in
      // «Иней» (C) and «Вихрь» (D) a foreign note hummed under the music all the
      // time. It is heard not as a note but as mud in the low end: the most
      // treacherous kind of out-of-tune, because the source is not identifiable.
      // keyRoot-24 = two octaves below the tonic (in world 1 that is the same 55 Hz).
      const s = ctx.createOscillator(); s.type = 'sine'
      s.frequency.setValueAtTime(this.keyHz(0, -2), t)
      const sg = this.env(t, 0.1 * intensity, 0.012, 0.16)
      s.connect(sg)
      s.start(t); s.stop(t + 0.2)
    }
  }

  /**
   * THE FANFARE of the level results: an arpeggio up + a glitter on top.
   *
   * The music KEEPS PLAYING on the results screen (the engine holds intensity at
   * 0.16), so a fanfare nailed to C major over the B minor «Разлом» was pure
   * out-of-tune at the most festive moment of the level. The triad is taken from
   * the world's mode: I-III-V-I. In minor worlds the fanfare comes out minor, and
   * that is right: it praises in THE SAME voice the world spoke to you with.
   */
  fanfare() {
    this.log('fanfare')
    if (!this.on()) return
    const t = this.now()
    const steps = [0, 2, 4, 7] // scale degrees: I III V I(oct)
    steps.forEach((s, i) => {
      const f = this.keyHz(s, 1)
      // the fanfare spreads across the stage too: four notes, four places
      const side = -0.36 + i * 0.24
      this.chime(f, t + i * 0.09, 0.7, 0.09, 'triangle', 0.55, 0, side)
      this.chime(f * 2.004, t + i * 0.09 + 0.015, 0.45, 0.028, 'triangle', 0.4, 0, side * 1.4)
    })
    this.sweepNoise(t + 0.25, 0.5, 4200, 8200, 1.1, 0.022) // sparks on top
  }

  /** the score-rolling tick on the results screen: a tiny blip; the ticks build the "casino" */
  scoreTick(step = 0) {
    // we do not log every tick (spam); see fanfare/star-land for logs
    if (!this.on()) return
    const t = this.now()
    // the pitch creeps up a little: the roll-up "fills"
    this.chime(1180 * Math.pow(2, Math.min(step, 24) / 48), t, 0.06, 0.02)
  }

  /** a star lands with a bounce: a soft hit "on the floor" + a ring higher with each star */
  starLand(i: number) {
    this.log('star-land')
    if (!this.on()) return
    const t = this.now()
    const ctx = this.ctx!
    // the landing hit
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(220, t)
    o.frequency.exponentialRampToValueAtTime(90, t + 0.12)
    // THE THREE STARS LAND IN DIFFERENT SPOTS: left, centre, right, exactly where
    // they lie on the screen. The floor hit stays closer to the centre (the low end
    // must not be panned), the ring goes to its own place.
    const side = [-0.42, 0, 0.42][Math.max(0, Math.min(2, i))]
    const g = this.env(t, 0.09, 0.004, 0.16, 0, side * 0.4)
    o.connect(g); o.start(t); o.stop(t + 0.2)
    // the star's ring: the 1st lower, the 3rd higher, a "one-two-three!" ladder.
    // I-III-V of the mode instead of a fixed E-G#-B in every world
    const f = this.keyHz([0, 2, 4][Math.max(0, Math.min(2, i))], 1)
    this.chime(f, t + 0.02, 0.5, 0.08, 'triangle', 0.55, 0, side)
    this.chime(f * 2.006, t + 0.035, 0.35, 0.03, 'triangle', 0.4, 0, side)
  }

  /** milestone gift: a festive bell + a sparkling flourish (the toast «N звёзд!») */
  milestone() {
    this.log('milestone')
    if (!this.on()) return
    const t = this.now()
    // a warm bell (like +life, but higher and more solemn) on the fifth of the mode
    const bell = this.keyHz(4, 1)
    this.chime(bell, t, 1.0, 0.1, 'sine', 0.6)
    this.chime(bell * 2.0, t, 0.7, 0.04, 'sine', 0.4)
    // a flourish up the scale degrees (was: semitones from a fixed 880 Hz)
    const steps = [0, 2, 4, 5, 7]
    // the flourish FLIES across the stage left to right: five notes in a quarter
    // of a second, each in its own place, a gesture rather than a chord
    steps.forEach((s, i) => this.chime(this.keyHz(s, 2), t + 0.12 + i * 0.05, 0.35, 0.045,
      'triangle', 0.5, 0, -0.55 + i * 0.275))
    this.sweepNoise(t + 0.1, 0.4, 5000, 8500, 1.1, 0.02)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMBO MILESTONES AND THE COMBO RECORD.
  // Andrey: «если был максимум комбо — как-то поздравить с новым рекордом, тем
  //          красивым бассом Bejeweled 2, говорить incredible»
  //          «показывать не всегда, а что уже 10х 50х 100х комбо».
  //
  // The analysis of the reference (Bejeweled 2) shows WHAT makes the celebration
  // there: an even cosy bed + short bright TRANSIENTS on the player's events, with
  // cascade peaks. The loudness comes not from music layers but from rare hits.
  // That is exactly what is built here: a milestone is a short transient that
  // grows with the tier, the record is the single weightiest hit of the run.
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * A COMBO MILESTONE. tier 0..3 = 10x / 25x / 50x / 100x.
   *
   * "Growing" is split into four independent knobs, and all four grow together,
   * otherwise the ear reads the difference as "the same thing, louder" instead of
   * "a higher stage":
   *   1) THE LADDER is longer and higher: 3 notes -> 6 notes, the top moves an octave;
   *   2) THE LOW END is heavier: the supporting hit on the world's tonic is deeper
   *      and longer;
   *   3) THE GLITTER is brighter: the noise flourish on top is wider and longer;
   *   4) at 50x and 100x a BELL on the tonic is added: "a big event".
   * Everything is in the current world's mode (keyHz), so the milestone does not
   * argue with the music in any of the five worlds, the same school as tapGood/fanfare.
   */
  comboMilestone(tier = 0) {
    const k = Math.max(0, Math.min(3, Math.round(tier)))
    this.log('combo-milestone', 'tier' + k)
    if (!this.on()) return
    const t = this.now()
    // scale degrees: the higher the milestone, the longer and higher the flourish
    const LADDER: number[][] = [
      [0, 2, 4],           // 10x  a short "oh"
      [0, 2, 4, 7],        // 25x  arriving at the octave
      [0, 2, 4, 7, 9],     // 50x  wider
      [0, 4, 7, 9, 11, 14] // 100x across two octaves, the widest sweep
    ]
    const steps = LADDER[k]
    const gap = 0.072 - 0.008 * k          // the higher the milestone, the faster the flourish
    // MEASURED (offline render): the reward for a correct tap peaks at -24 dBFS,
    // that is the ruler. A milestone must sit ABOVE it, with an acceptance ceiling
    // of -10 dBFS. Measured (offline render, world 1): 10x -21.1, 25x -18.2,
    // 50x -15.4, 100x -13.6 dBFS. The top tier is deliberately BELOW the record
    // (-12.0): the record must stay the loudest event of the run.
    const peak = 0.098 + 0.021 * k
    steps.forEach((s, i) => {
      // the flourish MOVES across the stage left to right: a gesture, not a chord
      const pan = -0.42 + (0.84 * i) / Math.max(1, steps.length - 1)
      const f = this.keyHz(s, 1)
      this.chime(f, t + i * gap, 0.42, peak, 'triangle', 0.55, 0, pan)
      // the octave glint, the "crystal" on top (as in the tap reward)
      this.chime(f * 2.003, t + i * gap + 0.012, 0.26, peak * 0.32, 'triangle', 0.4, 0, pan * 1.4)
    })
    // the low end of the milestone: a short warm hit on the world's tonic (two octaves down)
    const ctx = this.ctx!
    const lo = ctx.createOscillator(); lo.type = 'sine'
    lo.frequency.setValueAtTime(this.keyHz(0, -1) * 1.5, t)
    lo.frequency.exponentialRampToValueAtTime(this.keyHz(0, -1), t + 0.12)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320
    const lg = this.env(t, 0.105 + 0.037 * k, 0.006, 0.30 + 0.12 * k)
    lo.connect(lp); lp.connect(lg)
    lo.start(t); lo.stop(t + 0.6 + 0.2 * k)
    // the glitter on top
    this.sweepNoise(t + 0.04, 0.30 + 0.10 * k, 4400, 8600, 1.1, 0.018 + 0.009 * k)
    // 50x and 100x get a BELL: the weight of a big event
    if (k >= 2) {
      const b = this.keyHz(0, 1)
      this.chime(b, t + 0.02, 1.0 + 0.3 * k, 0.070 + 0.028 * k, 'sine', 0.6)
      this.chime(b * 2.0, t + 0.03, 0.7, 0.030 + 0.012 * k, 'sine', 0.45)
      this.chime(b * 3.01, t + 0.04, 0.45, 0.014, 'sine', 0.35)
    }
  }

  /**
   * A NEW STREAK RECORD: the rarest event of a run.
   *
   * Two layers, exactly as the author asked:
   *   BASS  - «тем красивым бассом Bejeweled 2»: a deep warm hit with a body, not a
   *           sub sine. The body comes from a triangle an octave above the root
   *           through a lowpass with an ENVELOPE (the filter opens on the hit and
   *           closes), the classic "bass with a click" trick that makes the hit feel
   *           bigger than its level.
   *   VOICE - a synthetic "wo-u" shout instead of an "incredible" sample. The trick
   *           is taken from the choir in music.ts (buildEnigma/choirChord): the
   *           larynx is detuned saws, the vowel is shaped by three formant
   *           band-passes. The difference is that a choir needs BLEND and a static
   *           vowel, while a shout needs MOVEMENT: our formants travel u -> a -> o
   *           in half a second, and the ear hears a syllable, not a chord.
   */
  comboRecord(delay = 0) {
    this.log('combo-record')
    if (!this.on()) return
    const ctx = this.ctx!
    // `delay` is for when the record lands on THE SAME answer as a milestone (a
    // combo of 100 from a player who never went past 40 before). The two loudest
    // events of the game must not add up into one peak: the milestone ladder
    // finishes speaking and only then the bass arrives. It sounds like "...and on
    // top of that, this".
    const t = this.now() + Math.max(0, delay)
    // ── THE BASS ────────────────────────────────────────────────────────────
    const root = this.keyHz(0, -1) // the world's tonic an octave below the voice
    const sub = ctx.createOscillator(); sub.type = 'sine'
    sub.frequency.setValueAtTime(root * 1.35, t) // a short "sag" into the tone
    sub.frequency.exponentialRampToValueAtTime(root, t + 0.10)
    const subG = this.env(t, 0.355, 0.010, 0.85) // measured: the whole event peaks at ~-12 dBFS
    sub.connect(subG); sub.start(t); sub.stop(t + 1.2)
    // the body of the bass: a triangle an octave up under a filter with an envelope
    const body = ctx.createOscillator(); body.type = 'triangle'
    body.frequency.setValueAtTime(root * 2, t)
    const bf = ctx.createBiquadFilter(); bf.type = 'lowpass'; bf.Q.value = 3
    bf.frequency.setValueAtTime(1400, t)
    bf.frequency.exponentialRampToValueAtTime(180, t + 0.55)
    const bodyG = this.env(t, 0.178, 0.008, 0.60, 0.25)
    body.connect(bf); bf.connect(bodyG)
    body.start(t); body.stop(t + 0.9)
    // ── THE "WO-U" VOICE ────────────────────────────────────────────────────
    // breathe in before the shout: a short air "consonant" (otherwise the syllable
    // starts out of nowhere and reads as a synthesizer, not a voice)
    this.sweepNoise(t + 0.02, 0.09, 900, 2600, 1.4, 0.030)
    this.voiceShout(t + 0.06, this.keyHz(0, 0), 0.70, 0.232)
    // ── the glitter on top: the record must also SHINE ──────────────────────
    this.sweepNoise(t + 0.30, 0.45, 5000, 9000, 1.1, 0.030)
    const bell = this.keyHz(4, 2) // the fifth two octaves up: "the summit"
    this.chime(bell, t + 0.34, 1.1, 0.080, 'sine', 0.6)
    this.chime(bell * 1.5, t + 0.40, 0.8, 0.034, 'sine', 0.5)
  }

  /**
   * A VOICE-LIKE SYLLABLE: "wo-u" made of formants, zero samples.
   *
   * The source is two detuned saws (a rich comb of overtones = the larynx) with a
   * slight vibrato and a pitch "scoop" at the start: a live voice never enters a
   * note exactly, it slides up from below, and without that the shout sounds
   * robotic. The vowel is shaped by three band-passes whose frequencies TRAVEL
   * through the table u -> a -> o.
   */
  private voiceShout(t: number, f0: number, dur: number, peak: number) {
    const ctx = this.ctx!
    // formants of three vowels (reference values, male/androgynous voice)
    const U = [325, 700, 2530]
    const A = [730, 1090, 2440]
    const O = [500, 900, 2400]
    const W = [1.0, 0.45, 0.16]   // band weights: body from the low one, presence from the high one
    const Q = [7, 9, 11]
    // the overall syllable envelope: a live shout = a fast attack and a long exhale
    const out = this.env(t, peak, 0.055, dur, 0.6)
    const bands: BiquadFilterNode[] = []
    for (let b = 0; b < 3; b++) {
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'; bp.Q.value = Q[b]
      bp.frequency.setValueAtTime(U[b], t)
      bp.frequency.linearRampToValueAtTime(A[b], t + dur * 0.26)
      bp.frequency.linearRampToValueAtTime(O[b], t + dur * 0.80)
      const w = ctx.createGain(); w.gain.value = W[b]
      bp.connect(w); w.connect(out)
      bands.push(bp)
    }
    // vibrato at 5.2 Hz: one LFO for both voices (like the shared vibrato of a choir)
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5.2
    const lfoG = ctx.createGain()
    lfoG.gain.setValueAtTime(2, t)                       // almost flat at the start
    lfoG.gain.linearRampToValueAtTime(14, t + dur * 0.7) // by the end the voice "trembles"
    lfo.connect(lfoG)
    lfo.start(t); lfo.stop(t + dur + 0.2)
    for (const cents of [-8, 9]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'
      // the entry "scoop": a slide up from below over 70 ms and a slight fall by the end of the exhale
      o.frequency.setValueAtTime(f0 * 0.84, t)
      o.frequency.exponentialRampToValueAtTime(f0 * 1.03, t + 0.07)
      o.frequency.exponentialRampToValueAtTime(f0 * 0.94, t + dur)
      o.detune.setValueAtTime(cents, t)
      lfoG.connect(o.detune)
      // break the edge from the live LFO when it ends, otherwise the node is never
      // collected (the same trap as with the choir voices, see music.ts choirChord)
      o.onended = () => { try { lfoG.disconnect(o.detune) } catch { /* already gone */ } }
      for (const bp of bands) o.connect(bp)
      o.start(t); o.stop(t + dur + 0.12)
    }
  }

  /** a soft UI blip: menu satellites, closing panels.
   *  The tonic + the fifth OF THE MODE: the menu theme now plays on the splash and
   *  the blip must fit it (a fixed 520/780 Hz argued with the pad in three worlds). */
  ui(vol = 1) {
    this.log('ui')
    if (!this.on()) return
    const t = this.now()
    this.chime(this.keyHz(0, 1), t, 0.14, 0.04 * vol, 'triangle', 0.5)
    this.chime(this.keyHz(4, 1), t + 0.012, 0.1, 0.018 * vol, 'triangle', 0.4)
  }

  // ---------- internal kitchen ----------

  private log(name: string, ...rest: string[]) { console.debug('[hm-sound]', name, ...rest) }
  private on() { return !!this.ctx && !this.muted }
  private now() { return this.ctx!.currentTime + 0.001 }

  /** a gain with a percussive envelope (attack -> exponential decay), already into
   *  the master. `air` is the send amount into the room bus (0 = dry). */
  private env(t: number, peak: number, attack: number, decay: number, air = 0, pan = 0): GainNode {
    const g = this.ctx!.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
    // an event can have a PLACE. The pan is set here, on the shared envelope, so
    // every sound that uses it gets it, and the dry signal and the room send travel
    // together (otherwise the sound would be on the left and its reflection in the
    // centre, which the ear reads as a mistake).
    let out: AudioNode = g
    if (pan !== 0) {
      const p = this.ctx!.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan))
      g.connect(p); out = p
    }
    out.connect(this.sfxBus)
    if (air > 0 && this.airIn) {
      const s = this.ctx!.createGain(); s.gain.value = air
      out.connect(s); s.connect(this.airIn)
    }
    return g
  }

  /** a crystal note: a triangle + a bit of sine, a percussive tail.
   *  `detune` in cents is the micro-detune against the "machine gun" repetition of
   *  the same sample (audio design: kill the machine gun repeat). */
  private chime(freq: number, t: number, decay: number, peak: number,
    type: OscillatorType = 'triangle', air = 0, detune = 0, pan = 0) {
    const ctx = this.ctx!
    const o = ctx.createOscillator(); o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (detune) o.detune.setValueAtTime(detune, t)
    const g = this.env(t, peak, 0.005, decay, air, pan)
    o.connect(g)
    o.start(t); o.stop(t + decay + 0.05)
  }

  /** a noise sweep: the band travels f0 -> f1, envelope peak/decay */
  private sweepNoise(t: number, dur: number, f0: number, f1: number, q: number, peak: number) {
    const ctx = this.ctx!
    const src = this.noiseSrc(dur + 0.05)
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q
    bp.frequency.setValueAtTime(f0, t)
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur)
    const g = this.env(t, peak, 0.008, dur)
    src.connect(bp); bp.connect(g)
    src.start(t); src.stop(t + dur + 0.1)
  }

  private noiseSrc(dur: number): AudioBufferSourceNode {
    const ctx = this.ctx!
    if (!this.noiseBuf) {
      const len = Math.ceil(ctx.sampleRate * 1.0)
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = this.noiseBuf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    }
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = dur > 1
    return src
  }
}
