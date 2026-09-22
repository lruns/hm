// MusicEngine — the generative music engine of HM2 (the Switch Angel school:
// "music from code, living with the game"). A WebAudio sequencer ON TOP of the
// sound.ts graph: the same AudioContext, its own submix (musicGain) going into
// the common chain duck(lowpass slow-mo) -> dip(warp duck) -> master(mute) ->
// compressor. So the music inherits for free: dimming on slow-mo/freeze, the dip
// in the tunnel and the global M-mute; no separate toggle is needed.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ THE CANON OF THIS FILE (the rules below are not to be broken lightly)     ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// 1. HARMONY COMES FIRST. A world has not just a "mode" but a MODE + PROGRESSION:
//    4 chords of 2 bars each (a cycle of 8 bars = 19.2 s at 100 BPM). All voices
//    take notes of the CURRENT CHORD, not of the whole mode; that is what removes
//    the mush. The pad leads its voices the shortest way (voiceChord: every tone
//    to the nearest octave around the register centre), so chords do not jump,
//    they shimmer into each other.
// 2. MELODY = A MOTIF + VARIATIONS, not randomness. The seed (the level number)
//    gives birth to a motif of 3-5 notes over 2 bars; then it repeats over the
//    chords with small changes (v0 theme -> v1 question -> v2 breath/silence ->
//    v3 answer on the tonic). That is the AABA form in miniature, and the ear
//    recognises it.
// 3. SILENCE IS AN INSTRUMENT (the Tetris Effect school). The motif has 3-5 notes
//    over 16 steps, the rest are rests. In calm the bass is silent for the whole
//    3rd chord: 2 bars of pad only.
// 4. WARM TIMBRES. The pad is triangle/sine in pairs +-5 cents through a lowpass,
//    with a 1.4 s attack. The melody is a "little bell": a sine + a quiet overtone,
//    a delay with dark feedback. There are no saws or squares in the melody at all.
// 5. «РАЗЛОМ» WITHOUT DISSONANCE. Phrygian is replaced with natural minor: the
//    chaos now comes from RHYTHM and TIMBRE (a dull hit + a rustle in a separate
//    perc layer), not from a crooked melody. The tritone accent is gone: it
//    sounded like a bug.
// 6. MIXING IN DECIBELS (audio design): pad -18, bass -16, melody -20, sparks -26,
//    percussion -24 dBFS at the input of the common duck. The sum of all peaks is
//    ~0.43 with a master of 0.5, so clipping is far away and the master compressor
//    does not work.
// 7. THE MELODY LIVES IN THE MODE, NOT IN THE CHORD. The motif is a line along the
//    SCALE DEGREES (65% of moves are seconds, a leap must resolve by a step in the
//    opposite direction), and the harmony is applied by snapping: on a strong beat
//    the degree is pulled to the nearest tone of the current chord, on a weak beat
//    it stays a passing/auxiliary note. That textbook rule IS "singability":
//    anchors on the beats, steps between them. (Before it every melody note was a
//    chord tone, so every move was a leap and there were exactly zero seconds.)
// 8. THE PHRASE BREATHES. The level follows an arc (quiet-louder-quieter) instead
//    of two values; a note's duration is the distance to the next one (short in
//    motion, long at the cadence); a micro shift of +-8 ms from the seed removes
//    the machine grid. The phrase MUST end no later than step 12 of 16: the last
//    beats are the inhale.
// 9. THE CHORD CHANGE IS EQUAL POWER. The pad's ramps are sin/cos curves
//    (equal power): for uncorrelated voices the sum of SQUARES is constant, so the
//    linear -3 dB dip disappears entirely. Plus on the last 1/8 of a chord the
//    bass takes a leading note to the root of the next one, so the change does not
//    arrive abruptly, it approaches.
// 10. WORLDS DIFFER BY SPECTRUM. A centroid measurement showed «Иней» and
//    «Ясность» were the DARKEST worlds (215 and 193 Hz against 291 for «Тёплый
//    Счёт»), exactly the opposite of the intent: a sine pad has no overtones and
//    the filter cutoff does not affect it. Hence `shine`, a quiet upper partial of
//    the pad (TWO octaves above the top chord tone: one octave sits in the same
//    thicket and does not move the centroid, verified) and `melOct`, the melody's
//    register. The measured centroid order in the storm became: Разлом 305 <
//    Ясность 316 < Тёплый Счёт 358 < Вихрь 417 < Иней 471 Hz, exactly as intended
//    by mood. At rest the order differs (there is no melody, only the pad), and
//    that is how it should be.
//
// Layer philosophy (audio design -> adaptive music): VERTICAL layering. The layers
// (pad / bass / melody / sparks / percussion) are never restarted, they run on one
// timeline; only their levels crossfade with intensity/streak (like calm/mid/storm
// in the music brief). The scheduler is a lookahead over ctx.currentTime (not
// setInterval jitter): we top up notes on a ~550 ms horizon. The scheduler is woken
// by WORKER CLOCKS (60 ms), and the frame remains only the third safety net, see
// startClock() and the resync threshold analysis in pump().
//
// A world = mode + progression + timbre (5 presets by campaign mood).
// A world change = a preset change at the moment of the tunnel's "eclipse".
//
// Headless check: the console.debug('[hm-music]', ...) logs, layer-on/off,
// world-preset, bar, chord. The author listens to the timbres WITH HIS EARS, and
// for that there is an offline render of the same formulas:
// scripts/render-music-preview.mjs -> hm2/превью-музыки/*.wav.

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ THE ENIGMA LAYER BEHIND A FLAG.                                          ║
// ║ Andrey: «ориентировать на стилистику the omega point enigma, но пока не   ║
// ║ надо прям всё менять, хотя бы озвучь — интересно послушать, с             ║
// ║ возможностью легко откатить или встроить».                               ║
// ║                                                                          ║
// ║ So this is NOT a rework but a SECOND SUIT over the same harmony: with the ║
// ║ `enigmaMusic` flag off nothing below is created and nothing sounds, the   ║
// ║ engine works EXACTLY as before. With the flag on it adds a breathing      ║
// ║ choir (formant bands), whispering breath and a ritual tempo.              ║
// ║ Nothing is sampled, only synthesis, a "vibe copy" by ear.                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ MEASUREMENT INSTEAD OF GUESSES: the three findings that shaped the mix.   ║
// ║                                                                          ║
// ║  1. THE MUSIC WAS MONO. Channel correlation of EXACTLY 1.000, the side    ║
// ║     signal at -inf dB: both channels bit for bit. There was not a single  ║
// ║     StereoPanner in the file. The ear hears that first, like a phone      ║
// ║     ringtone, before any of the notes.                                    ║
// ║  2. THERE WAS NO AIR AT ALL. The 4-8 kHz band sat at -63..-78 dB below    ║
// ║     the loudest, 8-16 kHz at -78..-85 dB. Live music has -25..-40 there.  ║
// ║     The reason is simple: sines and triangles under a lowpass have        ║
// ║     NOTHING to sound with up top.                                        ║
// ║  3. THERE WAS NO SPACE. Not a single ConvolverNode: the only "effect" was ║
// ║     a mono delay on the melody. Dry synthesis = synthesis from a phone.   ║
// ║                                                                          ║
// ║ Hence four builds, all in this file:                                      ║
// ║  A. A REVERB ON A SYNTHESIZED IMPULSE (makeIR): early reflections +       ║
// ║     decaying noise, the channels INDEPENDENT (that is where the width     ║
// ║     comes from), damping of the top over time. Its own hall preset per    ║
// ║     world (1.9-3.6 s).                                                    ║
// ║  B. LAYERED TIMBRES: PeriodicWave instead of bare oscillators, a unison   ║
// ║     of +-11 cents, a filter WITH AN ENVELOPE and resonance, chorus, a     ║
// ║     soft saturator.                                                       ║
// ║  C. ARRANGEMENT: counterpoint (a second voice in contrary motion), a bass ║
// ║     with movement, a shaker pulse, and a real form for the menu instead   ║
// ║     of two phrases.                                                       ║
// ║  D. MIXING: panning by role, EQ by buses, a sidechain duck of the pad     ║
// ║     under the melody, HF "air" and a low cut on the common music bus.     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import type { SoundEngine } from './sound'
import { noteBus, type NoteLayer } from './notebus'
import { VIBE } from './vibe'
import { quality, type AudioBudget } from './quality'

const BPM = 100 // strictly the world's BEAT_HZ: the sound.ts pulse is the same
const SEC_PER_8 = 60 / BPM / 2 // duration of an eighth (0.3 s at 100 BPM)
const STEPS_PER_BAR = 8 // a 4/4 bar, the step is an eighth
const BARS_PER_CHORD = 2 // a chord holds for 2 bars: "slow harmony"
const STEPS_PER_CHORD = STEPS_PER_BAR * BARS_PER_CHORD // 16
const CHORDS = 4 // a progression of 4 chords
const STEPS_PER_CYCLE = STEPS_PER_CHORD * CHORDS // 64 steps = 8 bars = 19.2 s
const CHORD_SEC = STEPS_PER_CHORD * SEC_PER_8 // 4.8 s
// ── SCHEDULER CLOCKS (for "the sound glitches sometimes" on the phone) ──────
// The planning horizon, in seconds. We keep it wider than an eighth so the visuals
// can MEET the note (a stream drop is born above the disc ~0.4 s ahead and reaches
// the disc exactly at `when`).
//
// It used to be 0.42. WHY IT WAS STRETCHED. The scheduler was fed ONLY by the Pixi
// frame ticker (engine.frame -> music.update -> pump). While frames come every
// 16 ms, a 0.42 s horizon is an eternity. But on the author's phone a frame
// sometimes stalls (portal, palette change, GC, a Capacitor tab minimised and
// brought back): one stall longer than the horizon and there is NOTHING left to
// schedule, the music breaks off mid-word. 0.55 s is almost two eighth steps of
// reserve on top of such a stall, and it is still less than the delay at which the
// ear starts hearing "the music lags behind the picture" (a stream drop lives
// 0.4 s, see above, so it still makes it).
//
// `?perf=legacy` IN THE URL IS A MEASURING INSTRUMENT, not a game setting (the
// same trick as `?vibe=` in vibe.ts): it brings back the old clocks and thresholds
// so that "before/after" is measured on ONE build, in one browser, in one minute.
// In the normal game there is no flag and the new path works.
const LEGACY = (() => {
  try { return new URLSearchParams(location.search).get('perf') === 'legacy' } catch { return false }
})()
const LOOKAHEAD = LEGACY ? 0.42 : 0.55
/** resync threshold: how far we may fall behind before jumping along the grid.
 *  It used to be a whole bar; why that WAS the glitch is analysed in pump(). */
const RESYNC_AFTER = LEGACY ? STEPS_PER_BAR * SEC_PER_8 : SEC_PER_8
/** worker clock tick period, ms. Eight ticks per horizon is a huge reserve, and
 *  it costs one postMessage (hundredths of a millisecond). */
const CLOCK_MS = 60
/** WORKER CLOCKS. A tiny script: "tick every ms and stay quiet if ms=0".
 *  It lives on a separate thread, so its setInterval depends neither on the frame
 *  nor on what the main thread is busy with this second, and it is not throttled
 *  like a main-thread timer on a sleeping tab. It schedules nothing itself, it
 *  only wakes the main thread, where the single ctx lives (we do not share the
 *  audio graph). */
const CLOCK_SRC = 'var h=0;onmessage=function(e){if(h){clearInterval(h);h=0}'
  + 'var ms=e.data&&e.data.ms;if(ms>0){h=setInterval(function(){postMessage(1)},ms)}}'

/** a frequency (Web Audio) -> the nearest MIDI number (for the note bus) */
const hzMidi = (hz: number) => Math.round(69 + 12 * Math.log2(hz / 440))
const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
/** decibels -> linear amplitude (audio design: we think of loudness in dB) */
const db = (x: number) => Math.pow(10, x / 20)

// ── THE ENIGMA FLAG ─────────────────────────────────────────────────────────
/** Is the Enigma layer on? Sources by priority:
 *
 *  1. **URL `?music=enigma`**: the short form next to the existing
 *     `?music=strudel`. The instant A/B the canon asked the flag for.
 *  2. **`globalThis.HM_VIBE.enigmaMusic`**: the handshake for the OFFLINE RENDER
 *     of the previews (`scripts/render-music-preview.mjs --enigma`), where there
 *     is neither window nor address bar, but the flag is needed before the engine
 *     is created.
 *  3. **`VIBE.enigmaMusic` from `src/vibe.ts`**: the single vibe config (the
 *     enigmaMusic field and the `?vibe=enigma:on` aliases were added there so all
 *     flags live in ONE place). Read defensively: if the file is ever rebuilt
 *     without this field, the music simply returns to the default instead of
 *     breaking the build.
 *  4. **Default `false`**: the sound without the second suit.
 */
function readEnigmaFlag(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('music') === 'enigma') return true
  } catch { /* no window (offline render): move on */ }
  try {
    const hm = (globalThis as unknown as { HM_VIBE?: Record<string, unknown> }).HM_VIBE
    if (hm && typeof hm.enigmaMusic === 'boolean') return hm.enigmaMusic
  } catch { /* ok */ }
  const v = VIBE as unknown as Record<string, boolean | undefined>
  return v.enigmaMusic === true
}

// ── MIXING ──────────────────────────────────────────────────────────────────
// Absolute layer peaks at the input of the common duck (the master then applies
// x0.5). SFX events in sound.ts peak at 0.10-0.22, so the music lives UNDER them
// and never sticks out.
const MUSIC_VOL = 1.0 // overall submix trim (the layers are already in absolute dB)
// The pad and the bass are 2.5 and 1.5 dB higher, not "to make it louder" but to
// COMPENSATE for the new processing: the pad's dry signal went to 0.72 (otherwise
// the chorus simply added loudness instead of width), the 300 Hz bell took off
// -2.5 dB, and the bass saturation bends the peaks by ~1.7 dB. A solo measurement
// before and after showed the same layer levels as before: the mix did not drift.
const PAD_VOL = db(-15.5) // the bed, the most even layer
const BASS_VOL = db(-14.5) // the low end, perceived quieter than its peak
const ARP_VOL = db(-17) // 0.1413, the little-bell melody. With 3-5 notes per
// 2 bars instead of a picket fence of eighths it can and MUST lead: in solo
// measurements its peak lands at ~-24 dBFS, slightly above the pad's bed (-26.4),
// while its RMS is 9 dB lower.
const SPARK_VOL = db(-23) // 0.0708, storm sparks, almost a whisper (peak ~-36 dBFS)
const PERC_VOL = db(-24) // 0.0631, the dull hits/rustles of the «Разлом» world
/** COUNTERPOINT: a second voice that lives in the melody's rests and moves
 *  TOWARDS it. It is a support, not a rival: 5 dB under the melody. */
const CTR_VOL = db(-22)

// ── SPACE, COLOUR, PANNING ─────────────────────────────────────────────────
/** reverb sends by role (a fraction of the dry signal). The pad and the choir live
 *  IN the hall, the bass hardly goes there at all (low end in reverb = mush), the
 *  melody and the sparks get a long tail, and it is that tail that reads as
 *  "beautiful". */
const SEND = { pad: 0.42, arp: 0.34, spark: 0.62, bass: 0.06, perc: 0.22, ctr: 0.30,
  choir: 0.70, breath: 0.55 }
/** depth of the pad's sidechain duck under a melody note (audio design: "duck
 *  competing sources"). -2.6 dB over 30 ms with a 0.3 s release: the melody comes
 *  forward and no pumping is heard, because both depth and release are small. */
const PAD_DUCK = db(-2.6)
const PAD_DUCK_ATK = 0.03
const PAD_DUCK_REL = 0.30
/** panning by role (StereoPanner, -1 left ... +1 right). The low end strictly in
 *  the centre (mono compatibility), mids and highs spread apart: that is how the
 *  stage is born. */
const PAN = { arp: 0.16, ctr: -0.34, echo: -0.5, shaker: 0.42 }
/** pad unison layouts per budget. They are MODULE CONSTANTS rather than literals
 *  inside padChord: a chord is scheduled from the ticker path, and four extra
 *  arrays per chord are garbage for the collector exactly where, on Android, we
 *  would rather not create any. */
const UNI3_CENTS = [-11, 0, 11]
const UNI3_PAN = [-0.55, 0, 0.55]
const UNI2_CENTS = [-11, 11]
const UNI2_PAN = [-0.55, 0.55]
const UNI1_CENTS = [0]
const UNI1_PAN = [0]
/** the pad's dry level by the number of chorus taps (index = taps). The chorus
 *  adds energy, the dry signal gives it back: the sum holds and only the width
 *  changes. Without this table the economical tier came out 2.3-2.9 dB quieter
 *  than the rich one (measured). */
const PAD_DRY = [1, 0.85, 0.72]
const SHINE_PAIR = [-0.72, 0.72]
const SHINE_ONE = [0.72]
const AIR_SIDES = [-0.7, 0.7]
const AIR_ONE = [-0.7]
const CHOIR_DET = [-9, 9]
const CHOIR_DET1 = [-9]

/** ── SYNTHESIZING THE HALL IMPULSE (no assets: we generate it in code) ─────
 *  The three parts of a real reverb:
 *   1) PRE-DELAY: the silence before the first reflection. It tells the ear the
 *      size of the room (12 ms = a room, 40 ms = a cathedral) and it SEPARATES the
 *      direct sound from the tail so the attack stays readable.
 *   2) EARLY REFLECTIONS: a handful of sparse spikes (walls and ceiling). Without
 *      them the tail sounds like a "noise envelope", not like a hall. The taps
 *      DIFFER between the left and right channels, and that is where the width
 *      comes from.
 *   3) THE DIFFUSE TAIL: noise decaying exponentially to -60 dB over `sec`, and
 *      INDEPENDENT per channel: correlation near zero = maximum width. Plus
 *      damping: a one-pole lowpass whose cutoff falls over time, because in a real
 *      hall the top dies before the bottom and without that the tail hisses.
 *  The 4 ms ramp-in of the diffuse part keeps the tail from starting with a click. */
export interface SpaceSpec {
  /** RT60, s: how long the tail takes to fall by 60 dB */
  sec: number
  /** pre-delay, s */
  pre: number
  /** damping: the tail's lowpass cutoff at the start (Hz) and how many times it falls by the end */
  damp: number
  dampFall: number
  /** level of the early reflections relative to the tail */
  early: number
}
export function makeIR(ctx: BaseAudioContext, sp: SpaceSpec): AudioBuffer {
  const sr = ctx.sampleRate
  const n = Math.max(1, Math.floor(sr * (sp.sec + sp.pre)))
  const buf = ctx.createBuffer(2, n, sr)
  const preN = Math.floor(sr * sp.pre)
  // early reflections: prime (non-multiple) delays so no comb filter builds up
  const taps = [7, 11, 17, 23, 31, 41, 53, 67, 83, 101]
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    // the diffuse tail
    let lp = 0
    const rise = Math.max(1, Math.floor(sr * 0.004))
    for (let i = 0; i < n - preN; i++) {
      const x = i / (n - preN)
      // exactly -60 dB by the end
      const env = Math.pow(10, (-60 * x) / 20) * Math.min(1, i / rise)
      // damping: the one-pole lowpass coefficient moves down over time
      const cut = sp.damp * (1 - x) + (sp.damp / sp.dampFall) * x
      const a = 1 - Math.exp((-2 * Math.PI * cut) / sr)
      lp += a * ((Math.random() * 2 - 1) - lp)
      d[preN + i] = lp * env
    }
    // early reflections on top (different per channel, that is the width)
    for (let k = 0; k < taps.length; k++) {
      const ms = taps[k] * (c === 0 ? 1 : 1.31) // the right channel hears different walls
      const idx = preN + Math.floor((sr * ms) / 1000)
      if (idx >= n) break
      const amp = sp.early * Math.pow(0.72, k) * (c === 0 ? 1 : -0.86)
      d[idx] += amp
      d[Math.min(n - 1, idx + 3)] += amp * 0.4
    }
  }
  return buf
}

/** RT60 by Schroeder (backwards energy integration): an honest check that the
 *  synthesized hall rings for exactly as long as we asked. */
export function rt60Of(buf: AudioBuffer): number {
  const d = buf.getChannelData(0)
  const n = d.length
  const cum = new Float64Array(n + 1)
  for (let i = n - 1; i >= 0; i--) cum[i] = cum[i + 1] + d[i] * d[i]
  const e0 = cum[0]
  if (e0 <= 0) return 0
  const at = (db2: number) => {
    for (let i = 0; i < n; i++) if (10 * Math.log10(cum[i] / e0) <= db2) return i / buf.sampleRate
    return NaN
  }
  const t5 = at(-5), t25 = at(-25)
  return isFinite(t5) && isFinite(t25) ? (t25 - t5) * 3 : 0 // T20 -> RT60
}

/** ── A SOFT SATURATOR ─────────────────────────────────────────────────────
 *  A tanh curve for WaveShaper. It adds even and odd harmonics, exactly the
 *  "warmth" people chase with tubes and tape in hardware. We keep it GENTLE
 *  (drive ~1.5): the pad sounds three pitches at once, and heavy saturation on a
 *  chord gives intermodulation, i.e. dirt rather than warmth. */
function satCurve(drive: number, n = 2048): Float32Array<ArrayBuffer> {
  // ArrayBuffer spelled out: since TS 5.7 typed arrays have a buffer parameter,
  // and WaveShaper.curve accepts only the non-shared one (like waveBuf in sound.ts)
  const c = new Float32Array(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    // we normalise by DRIVE, not by tanh(drive). The difference is not cosmetic:
    // dividing by tanh(drive) makes the slope at zero drive/tanh(drive), i.e. a
    // quiet signal is amplified A LOT (a measurement caught +5.3 dB on the bass
    // and clipping in the preview that way). Dividing by drive makes the slope at
    // zero exactly 1: quiet passes through as it was, loud is gently bent. That is
    // saturation, not "make it louder".
    c[i] = Math.tanh(drive * x) / drive
  }
  return c
}

/** ── A WAVE TABLE ─────────────────────────────────────────────────────────
 *  A PeriodicWave from a given harmonic spectrum. A bare sine/triangle gives no
 *  TOP END (measured: 4-16 kHz at -70 dB), and a "glint" one octave up is a patch,
 *  not a timbre. Here the spectrum is stated honestly: the amplitude of each
 *  harmonic is a number in the array. The phase is sine (real = 0): for hearing,
 *  phases inside one voice do not matter, the set of overtones does. */
function makeWave(ctx: BaseAudioContext, harm: number[]): PeriodicWave {
  const real = new Float32Array(harm.length + 1)
  const imag = new Float32Array(harm.length + 1)
  for (let i = 0; i < harm.length; i++) imag[i + 1] = harm[i]
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false })
}

// ── ENIGMA: VOICES AND BREATH ───────────────────────────────────────────────
// The reference is hm1 `assets/sound_music/music0.mp3` (measured twice): -17.7
// LUFS, LRA 13.7, a pulse of ~83 BPM, an envelope WITHOUT attacks (a rise of
// 2.86 dB/20 ms, swells only), an 8 s fade-in of the intro, a spectral centre of
// 250-500 Hz, a -6 dB/oct roll-off above 1 kHz. All the numbers below come from it.
const CHOIR_VOL = db(-8) // the choir is the second layer of the bed, next to the pad
const BREATH_VOL = db(-21) // whispering breath: audible only when you listen for it
/** THE "A-O" FORMANTS. Detuned saws on their own are a buzz; what makes them a
 *  voice is a TRIO of band-passes: 520 Hz (the first formant, the body), 1150 Hz
 *  (the second, the "vowel"), 2500 Hz (the singer's formant, presence). Q grows
 *  with frequency, so the top band is narrow, otherwise the saw comes through as
 *  hiss. The weights are chosen so the layer's spectral centre lands in the
 *  reference 250-500 Hz and not above. */
const CHOIR_FORMANTS = [
  { hz: 520, q: 4, w: 1.0 },
  { hz: 1150, q: 6, w: 0.42 },
  { hz: 2500, q: 8, w: 0.15 },
]
/** a shared 4.6 Hz vibrato on ALL voices at once (one LFO into detune): the choir
 *  breathes as one body. Per voice it would give a chorus, not a choir. */
const CHOIR_VIB_HZ = 4.6
const CHOIR_VIB_CENTS = 7
/** a 2.4 s attack and a long tail: the reference has NO attacks at all, only swells */
const CHOIR_ATTACK = 2.4
const CHOIR_RELEASE = 3.4
/** the "dark warm centre": in Enigma the pad's cutoff is lower, the top is given to the choir and the shine */
const ENIGMA_PAD_CUT = 0.72
/** the pad gives a little room to the choir so the overall level does not grow */
const ENIGMA_PAD_TRIM = 0.82
/** the lowest point of the whole submix's breathing over a cycle (0.5 = -6 dB on
 *  the inhale). It was lowered from 0.6: going deeper used to be dangerous (the dip
 *  became EMPTINESS), but now the hall's tail fills the dip, so the music does not
 *  disappear, it steps back into the depth. That is the mechanism behind the
 *  reference's LRA of 13.7. */
const ENIGMA_MIX_FLOOR = 0.45
/** THE ENIGMA HALL is a cathedral, not a room: a 4.2 s tail, a 55 ms pre-delay
 *  (the ear reads it as "a very big space here"), the top damped slowly. */
const ENIGMA_SPACE: SpaceSpec = { sec: 4.2, pre: 0.055, damp: 7500, dampFall: 3, early: 0.22 }
/** THE RITUAL TEMPO: a chord holds twice as long (4 bars instead of 2 -> 9.6 s).
 *  We do NOT touch the overall BPM: the bass, the visuals and sound.ts hang on it.
 *  It is the HARMONY that becomes slow, and that is exactly what makes Enigma
 *  sound like a rite. */
const ENIGMA_CHORD_MUL = 2

// ── THE MENU THEME ──────────────────────────────────────────────────────────
// "A quiet warm splash theme, not a combat one" (the canon). It is NOT the game
// theme: the pad is 5 dB quieter, there is no bass pulse, and instead of a melody
// there is a rare CALL (6 notes over 19.2 s). The levels are taken relative to the
// in-game ones so that the "menu is quieter than the game" difference is the same
// in every world and does not depend on their presets.
const MENU_PAD_VOL = PAD_VOL * 0.55 // -23.2 dBFS (the in-game pad is -18)
const MENU_CALL_VOL = ARP_VOL * 0.55 // -22.2 dBFS: a call, not a melody
const MENU_SUB_VOL = BASS_VOL * 0.40 // -24 dBFS: a warm floor under the pad
/** how long the theme WAITS before entering, s. The pause is not technical: after
 *  a loss ("the life is over") a second of silence is needed, otherwise the theme
 *  sounds like mockery. On the first splash it is simply a soft fade-in after the
 *  first touch. */
/** It used to be 1.6 s, and that is exactly the second and a half in which a
 *  showcase loses a person. The pause for a breath is needed (silence after a loss
 *  is appropriate), but a second is enough: right after it comes the curtain
 *  flourish (menuBloom), which by itself reads as "it has begun". */
const MENU_DELAY = 0.9
/** ...and with the Enigma flag the beauty must be there IMMEDIATELY. Andrey:
 *  «в главном меню уже хочется видеть красоту и музыку крутую». A second and a
 *  half of silence on the splash is exactly what he does not want to wait through.
 *  We keep 0.35 s: the breath pause is there, the waiting is not. The fade-in
 *  itself is still slow (the choir enters over 2.4 s, the layer opens over 1.4 s),
 *  following the reference, where the intro lasts 8 seconds. */
const ENIGMA_MENU_DELAY = 0.35
/** THE CALL: two phrases per cycle of 4 chords (19.2 s). On the 1st chord a
 *  descent to the tonic ("home"), on the 3rd a rise ("a question calling back").
 *  Chords 2 and 4 are entirely silent: 9.6 seconds of pure pad out of 19.2. Scale
 *  degrees; the outer notes snap to the current chord (see phrase), so the call
 *  agrees with any preset. The figure is the same every cycle, so the loop is
 *  seamless by construction. */
const MENU_CALL: Record<number, { step: number; deg: number; hold: number }[]> = {
  0: [{ step: 0, deg: 4, hold: 1.0 }, { step: 5, deg: 2, hold: 1.1 }, { step: 10, deg: 0, hold: 1.8 }],
  2: [{ step: 2, deg: 2, hold: 1.0 }, { step: 7, deg: 4, hold: 1.1 }, { step: 12, deg: 5, hold: 1.9 }],
}
/** THE ANSWER: on chords 1 and 3 a SECOND VOICE answers, lower, quieter, longer.
 *  These two chords used to be entirely silent, so half of the theme was emptiness;
 *  now the call has an interlocutor, and the silence stayed inside the phrases
 *  rather than between them. The voice comes from the left, the call from the
 *  right: the theme spreads itself apart. */
const MENU_ANSWER: Record<number, { step: number; deg: number; hold: number }[]> = {
  1: [{ step: 3, deg: 2, hold: 2.6 }, { step: 10, deg: 0, hold: 3.0 }],
  3: [{ step: 1, deg: 4, hold: 2.4 }, { step: 8, deg: 2, hold: 3.4 }],
}
/** a rare glint on top: twice per cycle (19.2 s), "a luxury, not a filler" */
const MENU_SPARKS: { chord: number; step: number; deg: number }[] = [
  { chord: 1, step: 13, deg: 4 },
  { chord: 3, step: 6, deg: 2 },
]

// The pad envelope is LINEAR and symmetric (attack = tail = 1.5 s). This is not
// nitpicking: the first version used exponential ramps from 0.0001, and EVERY
// chord change left a hole of -8..-15 dB (the leaving chord was almost dead while
// the arriving one had barely climbed, because an exponential from zero crawls
// near the bottom for a long time). A per-second RMS in ffmpeg showed that comb
// immediately. Linear opposing ramps of equal length give a dip of exactly -3 dB
// (uncorrelated voices), and that is breathing rather than a hole.
const PAD_ATTACK = 1.5
const PAD_RELEASE = 1.5
/** An EQUAL-POWER fade made of PIECEWISE-LINEAR ramps: sin(pi*x/2) up,
 *  cos(pi*x/2) down, assembled from FADE_SEG linearRampToValueAtTime segments.
 *
 *  WHY NOT setValueCurveAtTime. It expresses the curve honestly and in one line,
 *  but it is the ONLY Web Audio automation method that THROWS NotSupportedError
 *  when another curve already lies on the same parameter. MusicEngine.update is
 *  called from the PixiJS ticker, and an exception from there kills the whole
 *  frame loop and freezes the game dead (caught in a live Chrome on several quick
 *  devGoLevel calls in a row). No note is worth a stopped game.
 *
 *  linearRampToValueAtTime never throws: writing again simply redefines the
 *  schedule. 12 segments give a shape error below 0.9% (-41 dB), two orders of
 *  magnitude below anything the ear can tell, and the measured dip at a chord
 *  change did not change after the replacement (0.66 dB). */
const FADE_SEG = 12
function equalPowerFade(param: AudioParam, amp: number, t0: number, dur: number, up: boolean) {
  for (let i = 1; i <= FADE_SEG; i++) {
    const x = i / FADE_SEG
    const v = amp * (up ? Math.sin((Math.PI / 2) * x) : Math.cos((Math.PI / 2) * x))
    // 1e-6 rather than 0: zero is allowed for a linear ramp, but this way the
    // tail definitely does not stick on a microscopic positive value
    param.linearRampToValueAtTime(Math.max(1e-6, v), t0 + dur * x)
  }
}

/** modes as semitone degrees from the tonic. All of them are 7-note: triads are
 *  built on them by thirds [0,2,4]. The pentatonic remains only in the SFX ladder. */
const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
}

interface Preset {
  name: string
  mode: number[]
  root: number // MIDI note of the tonic
  /** progression: scale degrees, the roots of 4 chords of 2 bars each */
  prog: number[]
  padType: OscillatorType
  bassType: OscillatorType
  padCut: number // base cutoff of the pad filter, Hz
  bellRatio: number // overtone of the melody's bell (2 = octave, 3 = twelfth)
  arpRelease: number // base tail of a melody note, s (multiplied by the note's hold)
  gritty: boolean // the «Разлом» world: a percussion layer (hit + rustle), a dark delay
  sparse: boolean // the «Ясность» world: a sparser motif, more transparent chords
  /** the "shine": the amount of a quiet pad partial TWO octaves above the top
   *  tone. It is the ONLY brightness lever for sine pads: they have no overtones
   *  and a lowpass cutoff gives them nothing (verified by the spectral centroid). */
  shine: number
  /** the melody's register in semitones relative to root+12: «Иней» rings higher,
   *  «Разлом» growls lower, so the worlds differ by voice pitch as well */
  melOct: number
  /** melody step width: 1 = normal, 1.3 = «Вихрь» (motion), 0.8 = rest */
  melMotion: number
  // ── space, timbre and colour ────────────────────────────────────────────
  /** the world's HALL: every world has its own room (see makeIR) */
  space: SpaceSpec
  /** the pad's wave-table spectrum (amplitudes of harmonics 1,2,3...). This IS
   *  the world's TIMBRE, something no filter cutoff over a sine could give. */
  padHarm: number[]
  /** resonance of the pad filter: a slightly emphasised cutoff = character, not
   *  an itch. We keep 0.9-2.0; above that a chord of three pitches starts whistling. */
  padQ: number
  /** depth of the pad chorus (0 = off) */
  chorus: number
  /** reverb send amount: «Ясность» has the biggest hall, «Разлом» the smallest */
  wet: number
}

// 5 presets, one per campaign mood.
// The progressions are chosen so that the 4th chord LEADS back into the 1st (a
// loop without a seam).
const PRESETS: Preset[] = [
  // dawn, friendliness: the most "homely" harmony, I-vi-IV-V.
  // Middle register, moderate shine: a warm centre you come back to
  { name: 'Тёплый Счёт', mode: MODES.ionian, root: 57, prog: [0, 5, 3, 4],
    padType: 'triangle', bassType: 'triangle', padCut: 1150, bellRatio: 2,
    arpRelease: 0.95, gritty: false, sparse: false,
    shine: 0.08, melOct: 0, melMotion: 1,
    // a wooden room: a short pre-delay, a warm fast tail
    space: { sec: 2.1, pre: 0.018, damp: 5200, dampFall: 5, early: 0.30 },
    padHarm: [1, 0.46, 0.26, 0.15, 0.09, 0.055, 0.032, 0.02, 0.012],
    padQ: 1.2, chorus: 0.85, wet: 1.0 },
  // cold, crystals: the lydian #4 gives the frost, I-II-vi-V, all in the upper light.
  // THE BRIGHTEST world: maximum pad shine + a melody an octave up = glass
  { name: 'Иней', mode: MODES.lydian, root: 60, prog: [0, 1, 5, 4],
    padType: 'sine', bassType: 'sine', padCut: 2400, bellRatio: 3,
    arpRelease: 1.5, gritty: false, sparse: false,
    shine: 0.26, melOct: 12, melMotion: 0.9,
    // an icy grotto: a long clear tail, the top is hardly damped
    space: { sec: 3.1, pre: 0.028, damp: 8000, dampFall: 3, early: 0.34 },
    // a glassy spectrum: odd harmonics above even ones, a ring rather than a hum
    padHarm: [1, 0.18, 0.34, 0.10, 0.22, 0.07, 0.15, 0.05, 0.10, 0.035, 0.06],
    padQ: 1.6, chorus: 0.7, wet: 1.15 },
  // motion, wind: the dorian major IV, i-IV-VII-v, it sways and never stands still.
  // It differs not by brightness but by MOVEMENT: the widest melody steps, a short tail
  { name: 'Вихрь', mode: MODES.dorian, root: 62, prog: [0, 3, 6, 4],
    padType: 'triangle', bassType: 'triangle', padCut: 1350, bellRatio: 2,
    arpRelease: 0.7, gritty: false, sparse: false,
    shine: 0.11, melOct: 0, melMotion: 1.15,
    // open space: a medium tail, strong early reflections (wind in a field)
    space: { sec: 2.4, pre: 0.022, damp: 6400, dampFall: 4, early: 0.40 },
    padHarm: [1, 0.40, 0.30, 0.19, 0.13, 0.085, 0.055, 0.035, 0.022, 0.014],
    padQ: 1.4, chorus: 1.15, wet: 1.0 },
  // chaos, glitch: NO phrygian, the natural minor i-VI-III-VII sounds big, and the
  // "brokenness" comes from the hits and rustles of the perc layer + a dark filter.
  // THE DARKEST world: the shine is near zero, the melody an octave down growls
  { name: 'Разлом', mode: MODES.aeolian, root: 59, prog: [0, 5, 2, 6],
    padType: 'triangle', bassType: 'sine', padCut: 620, bellRatio: 2,
    arpRelease: 0.6, gritty: true, sparse: false,
    shine: 0.02, melOct: -12, melMotion: 1.1,
    // a concrete basement: a short pre-delay, a dull tail that darkens fast
    space: { sec: 1.9, pre: 0.012, damp: 3200, dampFall: 7, early: 0.44 },
    // the growl: strong low even harmonics, almost no top end
    padHarm: [1, 0.60, 0.22, 0.30, 0.11, 0.15, 0.06, 0.07, 0.03],
    padQ: 1.9, chorus: 0.55, wet: 0.75 },
  // clarity after the storm: ionian I-IV-vi-V, everything sparse and spacious.
  // Bright but not ringing: there is shine, the register is middle, the moves are calmest
  { name: 'Ясность', mode: MODES.ionian, root: 57, prog: [0, 3, 5, 4],
    padType: 'sine', bassType: 'sine', padCut: 2000, bellRatio: 3,
    arpRelease: 1.7, gritty: false, sparse: true,
    shine: 0.30, melOct: 0, melMotion: 0.85,
    // THE BIGGEST HALL: a long pre-delay + a 3.6 s tail = the spaciousness the
    // world is named after
    space: { sec: 3.6, pre: 0.038, damp: 7000, dampFall: 3.5, early: 0.26 },
    padHarm: [1, 0.22, 0.30, 0.09, 0.17, 0.055, 0.10, 0.03, 0.06, 0.02],
    padQ: 1.1, chorus: 0.95, wet: 1.3 },
]

/** ── WHAT THE LOOP ENGINE NEEDS TO KNOW ────────────────────────────────────
 *  On a phone the music is played not by this sequencer but by prerecorded loops
 *  (src/music-loops.ts). It builds no notes, but it needs two things from the
 *  preset, and copying them by hand into another file is not an option, they would
 *  drift apart on the first preset edit:
 *   · root/mode: the engine must report them to sound.ts (setMusicKey), otherwise
 *     the skip whoosh slides out of the world's mode;
 *   · padCut: the base for the "breathing brightness", since in a loop the cutoff
 *     is baked at medium intensity, while at low intensity and in hush the live
 *     filter takes it down. */
export const WORLD_KEYS = PRESETS.map((p) => ({ root: p.root, mode: p.mode, padCut: p.padCut }))

/** mulberry32: a deterministic PRNG from a seed (the level number) */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** a scale degree (may exceed len: we go into upper octaves) -> a semitone */
function degToSemi(mode: number[], idx: number): number {
  const len = mode.length
  const oct = Math.floor(idx / len)
  return mode[((idx % len) + len) % len] + 12 * oct
}

/** a pitch class folded to the nearest zero (-5..+6): "how far the chord root is
 *  from the tonic", so the melody does not drift in register after the chord */
function near0(semi: number): number {
  const x = ((semi % 12) + 12) % 12
  return x > 6 ? x - 12 : x
}

/** the degree's triad as INTERVALS FROM THE CHORD ROOT: [0, third, fifth] */
function chordRel(mode: number[], deg: number): number[] {
  const r = degToSemi(mode, deg)
  return [0, degToSemi(mode, deg + 2) - r, degToSemi(mode, deg + 4) - r]
}

/** VOICE LEADING of the pad: every chord tone goes to the nearest octave around
 *  the register centre. The chords come out in inversions and shimmer into each
 *  other with minimal movement (A-C#-E -> C#-F#-A -> D-F#-A -> B-E-G#) instead of
 *  jumping by roots. */
function voiceChord(mode: number[], deg: number, base: number): number[] {
  const r = degToSemi(mode, deg)
  const center = base + 7
  const out = chordRel(mode, deg).map((iv) => {
    let p = base + (((r + iv) % 12) + 12) % 12
    while (p < center - 6) p += 12
    while (p > center + 6) p -= 12
    return p
  })
  return out.sort((a, b) => a - b)
}

/** SNAP TO THE CHORD: a scale degree is pulled to the nearest chord tone.
 *  The chord tones are degrees deg0, deg0+2, deg0+4 by CLASS (mod 7), so the snap
 *  works in any octave. We look for the nearest suitable degree, moving away from
 *  the original by no more than 2 (usually 0 or 1): the line does not break, yet on
 *  a strong beat we are guaranteed to stand on the chord. That is "the melody sings
 *  in the mode while the harmony is heard": anchors on the beats, passing notes
 *  between them. */
function snapToChord(deg: number, deg0: number, len: number, avoid = NaN): number {
  const cls = new Set([
    ((deg0 % len) + len) % len,
    (((deg0 + 2) % len) + len) % len,
    (((deg0 + 4) % len) + len) % len,
  ])
  const ok = (d: number) => cls.has(((d % len) + len) % len) && d !== avoid
  // search outwards from the original: 0, -1, +1, -2, +2, ...
  // so breaking up a repeat picks the nearest note instead of leaping a third.
  for (const off of [0, -1, 1, -2, 2, -3, 3]) if (ok(deg + off)) return deg + off
  return deg
}

/** a motif: an onset on the 16-step (2 bar) grid + a scale degree + how to play
 *  it. `hold` is the tail multiplier (a long note at the cadence), `vel` is a point
 *  on the phrase's loudness arc, `offs` is a micro time shift (it removes the
 *  machine grid). */
interface MotifNote {
  step: number; deg: number; hold: number; vel: number; offs: number
  /** the final note of the "answer": lands strictly on a chord tone, even on a weak beat */
  cadence?: boolean
}

export class MusicEngine {
  private sound: SoundEngine
  private ctx: AudioContext | null = null

  private musicGain!: GainNode
  private padGain!: GainNode
  private bassGain!: GainNode
  private arpGain!: GainNode
  private sparkGain!: GainNode
  private percGain!: GainNode
  private padFilter!: BiquadFilterNode
  private padLfo!: OscillatorNode
  private padBreathDepth!: GainNode
  private padCutBreath!: GainNode
  private noise: AudioBuffer | null = null

  // ── space, colour, panning ────────────────────────────────────────────────
  /** the input of the shared hall (a send bus) and its return into the submix */
  private revIn: GainNode | null = null
  private revConv: ConvolverNode | null = null
  private revReturn: GainNode | null = null
  /** sends by role: each layer has its own knob (audio design: mixing on buses) */
  private sends: Record<string, GainNode> = {}
  /** the pad's sidechain duck under the melody (see duckPad) */
  private padDuck!: GainNode
  /** counterpoint: the second melodic voice */
  private ctrGain!: GainNode
  private ctrPan!: StereoPannerNode
  /** the pad chorus: two modulated delays spread to the edges */
  private chorusLfo: OscillatorNode[] = []
  private chorusMix!: GainNode
  /** the pad wave table of the current world (PeriodicWave) */
  private padWave: PeriodicWave | null = null
  /** one saturator curve shared by all saturating nodes */
  private satWarm: Float32Array<ArrayBuffer> | null = null
  /** the menu intro already played (a one-off flourish) */
  private menuBloomed = false

  // ── The Enigma layer. All of it exists ONLY when enigma === true: with the
  //    flag off the nodes are not even created and the graph is the plain one.
  private enigma = readEnigmaFlag()
  private choirGain: GainNode | null = null
  private breathGain: GainNode | null = null
  /** three band-pass formants, each with its own weight -> the common choirGain */
  private choirBands: BiquadFilterNode[] = []
  private choirVibDepth: GainNode | null = null
  private choirLfo: OscillatorNode | null = null
  /** vibrato detachers for finished choir voices (a leak guard, see choirChord) */
  private choirVoices: (() => void)[] = []
  /** the ritual tempo: the chord length in steps/seconds is computed FROM THE
   *  FLAG rather than from the constants, so the normal mode notices nothing */
  private stepsPerChord = STEPS_PER_CHORD
  private stepsPerCycle = STEPS_PER_CYCLE
  private chordSec = CHORD_SEC
  private menuDelay = MENU_DELAY

  private preset: Preset = PRESETS[0]
  private pendingWorld = 0
  private pendingLevel = 0
  private started = false

  // the scheduler
  private nextNoteTime = 0
  private step8 = 0
  private barN = -1
  private chordN = -1
  private curIntensity = 0
  private curHushed = false
  /** MENU MODE: the engine calls update with playing:false on the splash, on a
   *  loss and on the finale, i.e. exactly where there used to be silence. The flag
   *  is read by scheduleStep: the pad keeps going, the game layers stay silent and
   *  the call sounds. */
  private menu = false
  private menuT = 0 // how many seconds we have been in the menu (for the theme's entry delay)
  /** a step failure is printed EXACTLY ONCE: update() runs in the ticker, otherwise 60 lines/s */
  private warned = false
  // ── scheduler clocks, see CLOCK_SRC ──
  private clock: Worker | null = null
  private clockUrl = ''
  private clockTimer: number | null = null
  /** how many times we had to jump along the grid (a sound-health counter: 0-1 per
   *  run is normal, only on entering the game. If it grows, the stream is tearing). */
  private resyncs = 0
  /** notes scheduled with a time in the past = an audible burst (see pump) */
  private lateSteps = 0
  /** which clock actually ticks: 'worker' | 'timer' | 'frame' (the frame only) */
  private clockKind: 'worker' | 'timer' | 'frame' = 'frame'
  /** how many times the worker woke the scheduler (stays 0 in frame mode) */
  private ticks = 0

  // ── AUDIO GRAPH BUDGET ────────────────────────────────────────────────────
  /** how much richness we are allowed (see quality.ts, AudioBudget) */
  private ab: AudioBudget = quality.audio
  private unsubAudio: (() => void) | null = null
  /** nodes the budget can change ON THE FLY (without rebuilding the graph) */
  private padShaper: WaveShaperNode | null = null
  private bassShaper: WaveShaperNode | null = null
  /** chorus taps: each one's gain is an on/off knob without rewiring edges */
  private chorusTaps: GainNode[] = []
  /** the pad's dry level: compensates the chorus energy, see PAD_DRY */
  private padDry: GainNode | null = null
  /** how many OPTIONAL voices had to be skipped because of the cap (telemetry) */
  private dropped = 0
  /** ── VOICE ACCOUNTING ───────────────────────────────────────────────────
   *  A ring of source stop times. Two things need it: the voice cap (see room())
   *  and the telemetry overlay, without which we cannot tell "the audio thread
   *  choked on the graph" from "the main thread is not producing frames".
   *  A ring rather than an array: zero allocations on the hot path, hence zero
   *  extra garbage for the collector. */
  private stops = new Float64Array(192)
  private stopI = 0
  private peakVoices = 0

  /** record the fact that a source sounds until `until` */
  private mark(until: number) {
    this.stops[this.stopI] = until
    this.stopI = (this.stopI + 1) % this.stops.length
  }

  /** how many sources sound at time t */
  voicesAt(t: number): number {
    let n = 0
    for (let i = 0; i < this.stops.length; i++) if (this.stops[i] > t) n++
    if (n > this.peakVoices) this.peakVoices = n
    return n
  }

  /** is there budget room for an OPTIONAL voice (spark, shaker, shine, second
   *  voice, air). We never cut the pad or the melody: that is the music itself. */
  private room(time: number, need = 1): boolean {
    const cap = this.ab.maxVoices
    if (!isFinite(cap)) return true
    if (this.voicesAt(time) + need <= cap) return true
    this.dropped++
    return false
  }

  /** the hall length under the budget: a preset asks for 1.9-4.2 s, the economical
   *  mode trims it. A ConvolverNode's cost grows directly with the impulse length,
   *  which makes it THE BIGGEST knob in the whole graph, bigger than all the
   *  oscillators together. */
  private space(sp: SpaceSpec): SpaceSpec {
    const cap = this.ab.irSec
    return sp.sec <= cap ? sp : { ...sp, sec: cap }
  }

  /** for reports, the automatic check and the overlay: window.__hm.music.health */
  get health() {
    const t = this.ctx ? this.ctx.currentTime : 0
    return {
      // which music engine is on stage (there are two: this live synthesis and the
      // prerecorded loops in src/music-loops.ts). The audiohud panel reads this
      // field so that a phone screenshot shows what is playing
      engine: 'live' as const,
      resyncs: this.resyncs, late: this.lateSteps, ticks: this.ticks,
      clock: this.clockKind, lookahead: LOOKAHEAD, legacy: LEGACY, started: this.started,
      tier: this.ab.tier, voices: this.ctx ? this.voicesAt(t) : 0, peak: this.peakVoices,
      cap: this.ab.maxVoices, dropped: this.dropped, enigma: this.enigma,
      irSec: this.ctx && this.revConv?.buffer ? +(this.revConv.buffer.duration).toFixed(2) : 0,
    }
  }

  // generative material (seed from the level): play again and you recognise the melody
  private motif: MotifNote[] = []
  /** a cache of built phrases (see phrase()), cleared when the motif/preset changes */
  private phraseCache = new Map<string, MotifNote[]>()
  private sparkSlots: { chord: number; step: number; tone: number }[] = []
  private bassLift = 0 // on which bar of the chord the bass takes the fifth (0/1)

  // layers (vertical layering: the gains crossfade, the notes are not restarted)
  private on: Record<string, boolean> = {
    pad: false, bass: false, arp: false, spark: false, perc: false,
    choir: false, breath: false, ctr: false,
  }

  constructor(sound: SoundEngine) {
    this.sound = sound
    if (this.enigma) {
      this.stepsPerChord = STEPS_PER_CHORD * ENIGMA_CHORD_MUL
      this.stepsPerCycle = this.stepsPerChord * CHORDS
      this.chordSec = this.stepsPerChord * SEC_PER_8
      this.menuDelay = ENIGMA_MENU_DELAY
      this.log('enigma-on')
    }
    this.regenerate(0)
  }

  /** ── THE CHOIR SWELL OVER A WHOLE CYCLE ─────────────────────────────────
   *  Reference measurement: LRA 13.7 LU, i.e. the track LIVES BY LOUDNESS, it has
   *  a huge range between quiet and loud, and yet there are no "attacks" at all
   *  (a rise of 2.86 dB/20 ms, swells only). Our music had LRA 1.9: the layers
   *  switch on in steps with the streak, and inside it is an even wall. That is
   *  the main AUDIBLE difference of the genre, and it is cured not by timbre but
   *  by breathing.
   *
   *  So the choir and the whisper swing over a whole harmonic cycle (38.4 s in
   *  Enigma): a cosine of the position in the cycle, a range of x0.5..x1.0
   *  (-6 dB). The phase comes from the STEP COUNTER rather than from the clock, so
   *  the swell is tied to the music, not to real time, and survives a pause/resync
   *  without a jolt. */
  private enigmaSwell(): number {
    const n = ((this.step8 % this.stepsPerCycle) + this.stepsPerCycle) % this.stepsPerCycle
    return 0.5 + 0.5 * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / this.stepsPerCycle))
  }

  /** ── A FORM OVER TWO CYCLES ─────────────────────────────────────────────
   *  The measurement said it plainly: LRA 1.7 LU, the music stands as an even
   *  wall. The Enigma flag cured that only under the flag (with the choir swell),
   *  while in the normal mode every harmonic cycle was an exact copy of the
   *  previous one: 19.2 seconds and the same thing again. The ear recognises that
   *  after two passes and stops listening.
   *
   *  So the music got a SECOND FLOOR of form, a cycle of two cycles (38.4 s):
   *   · the first cycle is SIMPLER: the counterpoint takes one note, the bass does
   *     not bounce, the shaker hits less often ("we have stated the theme");
   *   · the second is FULLER: the second voice answers twice, the bass moves, the
   *     shaker is denser ("and now the same, but someone is with us already").
   *  Plus a soft loudness arc over the whole submix (-1.9 dB at the bottom). This
   *  is exactly the "horizontal re-sequencing" of adaptive music: the same
   *  material, a different set of voices at a musical boundary, the cycle boundary.
   *
   *  The phase comes from the STEP COUNTER rather than from the clock: it survives
   *  a pause and a resync without a jolt (the same trick as the Enigma swell). */
  private formPhase(): number {
    const per = this.stepsPerCycle * 2
    const n = ((this.step8 % per) + per) % per
    return 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / per)
  }

  /** which of the two cycles is running now: 0 = simpler, 1 = fuller */
  private round(step: number): number {
    return Math.floor(step / this.stepsPerCycle) & 1
  }

  /** PAD BRIGHTNESS. In Enigma the centre is dark and warm: the top is given to
   *  the choir and the shine and the pad goes down. One entry point for every
   *  place that needs the filter cutoff. */
  private padCut(): number {
    return this.preset.padCut * (this.enigma ? ENIGMA_PAD_CUT : 1)
  }

  /** idempotent: as soon as sound.ts has opened the ctx (first gesture), build the graph */
  ensureStarted() {
    if (this.started) return
    const bus = this.sound.musicBus()
    if (!bus) return // no ctx yet (no gesture happened): wait quietly
    this.ctx = bus.ctx
    // the budget may have changed between creating the engine and the first
    // gesture (an fps measurement, the menu knob): take a fresh one, the graph is
    // assembled from it
    this.ab = quality.audio
    this.build(bus.dest)
    this.applyPreset(this.pendingWorld, true)
    this.regenerate(this.pendingLevel)
    const t = this.ctx.currentTime
    this.nextNoteTime = t + 0.12
    this.step8 = 0
    this.barN = -1
    this.chordN = -1
    this.started = true
    this.startClock()
    // the budget can change on the fly: the automatic fps measurement dropped the
    // quality, or the player switched the sound knob in the pause menu
    this.unsubAudio = quality.subscribeAudio((b) => this.applyBudget(b))
    this.log('engine-start', this.ab.tier)
  }

  /** ── CHANGING THE BUDGET ON THE FLY ─────────────────────────────────────
   *  We change ONLY what can be changed by assignment: the hall impulse length,
   *  the level of the chorus taps, the saturators' oversampling. Everything else
   *  (unison, bell partials, choir voices) is read from this.ab at the moment a
   *  note is born, so it arrives by itself with the next note, without a single
   *  break in the sound. No switch ever rebuilds the graph. */
  private applyBudget(b: AudioBudget) {
    const was = this.ab.tier
    this.ab = b
    // the same tier (the first announcement to the subscriber, or the quality
    // wobbled within one tier): nothing to rebuild, and the hall impulse is expensive
    if (b.tier === was || !this.ctx) return
    const t = this.ctx.currentTime
    try {
      if (this.revConv) {
        const sp = this.space(this.enigma ? ENIGMA_SPACE : this.preset.space)
        // there is no way to cut off a tail that is ALREADY sounding, but replacing
        // a convolver's buffer is allowed in Web Audio and is heard as a change of
        // room rather than a click (its input is trimmed top and bottom by filters)
        this.revConv.buffer = makeIR(this.ctx, sp)
      }
      for (let i = 0; i < this.chorusTaps.length; i++) {
        const on = i < b.chorusTaps ? 1 : 0
        this.chorusTaps[i].gain.cancelScheduledValues(t)
        this.chorusTaps[i].gain.setValueAtTime(this.chorusTaps[i].gain.value, t)
        this.chorusTaps[i].gain.linearRampToValueAtTime(on, t + 0.25)
      }
      if (this.padDry) {
        // the dry level moves with the chorus, otherwise a tier change is heard as "it got quieter"
        const v = PAD_DRY[Math.min(2, b.chorusTaps)]
        this.padDry.gain.cancelScheduledValues(t)
        this.padDry.gain.setValueAtTime(this.padDry.gain.value, t)
        this.padDry.gain.linearRampToValueAtTime(v, t + 0.25)
      }
      if (this.padShaper) this.padShaper.oversample = b.oversample
      if (this.bassShaper) this.bassShaper.oversample = b.oversample
    } catch (e) { console.warn('[hm-music] бюджет звука применён не весь:', e) }
    this.log('budget', `${was}→${b.tier}`)
  }

  /** ── SCHEDULER CLOCKS: a worker, or our own setInterval if impossible ────
   *  A tick simply calls pump(ctx.currentTime). The frame pump from update() is
   *  KEPT as the third, cheapest safety net: if the horizon is already full, the
   *  loop inside pump does not run a single iteration, so double feeding costs
   *  nothing and cannot "schedule a note twice", since only nextNoteTime moves
   *  forward.
   *
   *  Why the WHOLE scheduler was not moved into the worker: the audio graph (ctx,
   *  nodes, gains) lives on the main thread and cannot be passed to a worker. The
   *  worker here is exactly a CLOCK, as in "A Tale of Two Clocks": WebAudio
   *  computes the precise schedule from ctx.currentTime, the worker only wakes it
   *  up regularly. */
  private startClock() {
    if (LEGACY) { this.log('clock', 'frame (perf=legacy)'); return } // the "before" instrument
    if (this.clock || this.clockTimer !== null) return
    const tick = () => {
      this.ticks++
      if (!this.started || !this.ctx) return
      // the same shield as in pump: the clock has no right to crash the game
      try { this.pump(this.ctx.currentTime) } catch { /* pump keeps quiet itself */ }
    }
    try {
      this.clockUrl = URL.createObjectURL(new Blob([CLOCK_SRC], { type: 'text/javascript' }))
      const w = new Worker(this.clockUrl)
      w.onmessage = tick
      w.onerror = (e) => {
        this.log('clock-worker-error')
        console.warn('[hm-music] воркер-часы не поднялись, идём на таймер:', e.message)
        this.stopClock()
        this.clockTimer = setInterval(tick, CLOCK_MS) as unknown as number
        this.clockKind = 'timer'
      }
      w.postMessage({ ms: CLOCK_MS })
      this.clock = w
      this.clockKind = 'worker'
    } catch {
      // file:// without workers, a CSP ban, an exotic WebView: never mind, a
      // main-thread timer is still INDEPENDENT OF THE FRAME, and that is the point
      this.clockTimer = setInterval(tick, CLOCK_MS) as unknown as number
      this.clockKind = 'timer'
    }
    this.log('clock', this.clockKind)
  }

  private stopClock() {
    if (this.clock) { try { this.clock.postMessage({ ms: 0 }); this.clock.terminate() } catch { /* ok */ } }
    this.clock = null
    if (this.clockUrl) { try { URL.revokeObjectURL(this.clockUrl) } catch { /* ok */ } this.clockUrl = '' }
    if (this.clockTimer !== null) { clearInterval(this.clockTimer); this.clockTimer = null }
    this.clockKind = 'frame'
  }

  /** ── THE COLOUR OF A ROLE ───────────────────────────────────────────────
   *  A layer does not go straight into the submix but through its own small
   *  chain: pan -> (EQ) -> out, plus a SEND into the shared hall. This is the
   *  "mixing on buses" of audio design, except our buses are by ROLE rather than
   *  by source: turn one knob and the whole layer changes at once.
   *  Returns the node the layer should play into. */
  private colour(name: keyof typeof SEND, src: AudioNode, pan: number, eq?: BiquadFilterNode): AudioNode {
    const ctx = this.ctx!
    let node: AudioNode = src
    if (eq) { node.connect(eq); node = eq }
    if (pan !== 0) {
      const p = ctx.createStereoPanner(); p.pan.value = pan
      node.connect(p); node = p
    }
    node.connect(this.musicGain)
    if (this.revIn) {
      const s = ctx.createGain()
      s.gain.value = SEND[name] * this.preset.wet
      node.connect(s); s.connect(this.revIn)
      this.sends[name] = s
    }
    return node
  }

  /** the submix graph: musicGain -> the common duck (slow-mo/warp/mute for free) */
  private build(dest: AudioNode) {
    const ctx = this.ctx!
    this.satWarm = satCurve(1.5)

    // ── THE COMMON MUSIC BUS. Two filters sit AT THE OUTPUT of the submix:
    //    · a highpass at 32 Hz for the basement nobody hears but which eats
    //      headroom and muddies the low end on a phone speaker;
    //    · a +2 dB highshelf from 9 kHz, the "air". Measured: the 8-16 kHz band
    //      was at -78..-85 dB below the loudest. A shelf alone cannot cure that
    //      (there is nothing to lift), but together with the new timbres and the
    //      hall it works.
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = MUSIC_VOL
    const sub = ctx.createBiquadFilter()
    sub.type = 'highpass'; sub.frequency.value = 32; sub.Q.value = 0.6
    const air = ctx.createBiquadFilter()
    air.type = 'highshelf'; air.frequency.value = 9000; air.gain.value = 2
    this.musicGain.connect(sub); sub.connect(air); air.connect(dest)

    // ── THE HALL. One reverb for all the music, with per-role sends.
    //    Its input is trimmed from below (200 Hz): bass in a reverb is mush that
    //    turns "space" into rumble. From above a 12 kHz limit keeps the noise
    //    impulse from hissing in the quiet places.
    try {
      this.revIn = ctx.createGain(); this.revIn.gain.value = 1
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'; hp.frequency.value = 200; hp.Q.value = 0.5
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'; lp.frequency.value = 12000; lp.Q.value = 0.4
      this.revConv = ctx.createConvolver()
      this.revConv.normalize = true
      this.revConv.buffer = makeIR(ctx, this.space(this.enigma ? ENIGMA_SPACE : this.preset.space))
      this.revReturn = ctx.createGain(); this.revReturn.gain.value = this.enigma ? 1.15 : 0.85
      this.revIn.connect(hp); hp.connect(lp); lp.connect(this.revConv)
      this.revConv.connect(this.revReturn); this.revReturn.connect(this.musicGain)
    } catch {
      // no ConvolverNode (an exotic environment): the music must play dry as well
      this.revIn = null; this.revConv = null; this.revReturn = null
    }

    // ── the pad: chord voices -> the common lowpass -> the layer gain ->
    //    chorus+saturator -> the sidechain duck -> pan/send. The order is not
    //    accidental: saturation AFTER the filter (otherwise it brings back the top
    //    that was cut), the duck AFTER the saturation (otherwise the timbre would
    //    breathe together with the level).
    this.padFilter = ctx.createBiquadFilter()
    this.padFilter.type = 'lowpass'
    this.padFilter.frequency.value = this.padCut()
    this.padFilter.Q.value = 0.5 // the world's common cutoff; the character comes from the VOICE filter
    this.padGain = ctx.createGain(); this.padGain.gain.value = 0.0001
    this.padFilter.connect(this.padGain)

    // CHORUS: two delays of 12 and 19 ms, each with its own slow LFO, spread to
    // the edges. A live ensemble is when voices differ slightly both in pitch and
    // in time; the unison detune gives the first, the chorus the second.
    this.chorusMix = ctx.createGain(); this.chorusMix.gain.value = 0.5
    // every tap has its own gain key. It is not there to save on the delay
    // itself (a delay is cheap) but so the audio tier can be switched WITHOUT
    // rebuilding the graph: the economical mode simply takes a tap to zero over
    // 0.25 s. The rich path stays bit for bit the same: both keys at 1.
    const mkChorus = (ms: number, hz: number, depth: number, side: number, idx: number) => {
      const d = ctx.createDelay(0.05); d.delayTime.value = ms / 1000
      const l = ctx.createOscillator(); l.type = 'sine'; l.frequency.value = hz
      const dep = ctx.createGain(); dep.gain.value = depth / 1000
      l.connect(dep); dep.connect(d.delayTime); l.start()
      this.chorusLfo.push(l)
      const pn = ctx.createStereoPanner(); pn.pan.value = side
      const key = ctx.createGain(); key.gain.value = idx < this.ab.chorusTaps ? 1 : 0
      this.chorusTaps.push(key)
      this.padGain.connect(d); d.connect(pn); pn.connect(key); key.connect(this.chorusMix)
    }
    mkChorus(12, 0.13, 3.4, -0.8, 0)
    mkChorus(19, 0.21, 2.6, 0.8, 1)

    // soft warmth: first a boost (otherwise tanh at an amplitude of 0.1 is linear
    // and does nothing), then the curve, then back down: the level does not change,
    // the SPECTRUM does, gaining even harmonics a sine does not have
    const preSat = ctx.createGain(); preSat.gain.value = 3
    const shaper = ctx.createWaveShaper()
    shaper.curve = this.satWarm
    // OVERSAMPLING IS AN EXPENSIVE KNOB. '2x' means a pair of band-limited
    // resamplers before and after the curve: on a chord of nine voices that is a
    // noticeable share of the audio-thread budget. It is needed against aliasing
    // (saturation creates harmonics above Nyquist), but with a gentle curve
    // (drive 1.5) there are few of them, so 'none' on the economical tier is an
    // honest trade.
    shaper.oversample = this.ab.oversample
    this.padShaper = shaper
    const postSat = ctx.createGain(); postSat.gain.value = 1 / 3
    // mud at 200-400 Hz: with a rich wave table the midrange fills up fast.
    // A soft -2.5 dB bell is just enough to keep the pad from masking the bass
    const mud = ctx.createBiquadFilter()
    mud.type = 'peaking'; mud.frequency.value = 300; mud.Q.value = 1.1; mud.gain.value = -2.5
    this.padDuck = ctx.createGain(); this.padDuck.gain.value = 1
    // the dry level is slightly below one: the chorus ADDS energy, and without
    // this the pad would simply get louder rather than wider (level measured).
    //
    // A FIX FROM A MEASUREMENT: the 0.72 compensation is worth exactly the energy
    // TWO chorus taps add. When the economical tier switched them off, the
    // compensation stayed, and the very first offline render caught it: the
    // economical path came out 2.3-2.9 dB quieter than the rich one. That is not
    // "economical", that is quieter, and quieter reads as "worse" in a mix. Now
    // the dry level follows the number of taps.
    const dry = ctx.createGain(); dry.gain.value = PAD_DRY[Math.min(2, this.ab.chorusTaps)]
    this.padDry = dry
    this.padGain.connect(dry)
    dry.connect(preSat); this.chorusMix.connect(preSat)
    preSat.connect(shaper); shaper.connect(postSat); postSat.connect(mud)
    mud.connect(this.padDuck)
    this.colour('pad', this.padDuck, 0)

    // the pad's breathing: BARELY noticeable (+-6% of level), one breath per bar + a touch of filter
    this.padLfo = ctx.createOscillator(); this.padLfo.type = 'sine'
    this.padLfo.frequency.value = BPM / 60 / 4 // 0.4167 Hz: one breath per bar
    // the breath depth starts at ZERO: the LFO is added straight to padGain.gain,
    // so while the layer is closed a non-zero depth makes the silence breathe. In
    // the game that went unnoticed (the pad opened immediately), but the menu theme
    // enters with a delay, and a measurement showed -38 dBFS before the first note.
    // The depth opens together with the layer in update.
    this.padBreathDepth = ctx.createGain(); this.padBreathDepth.gain.value = 0
    this.padLfo.connect(this.padBreathDepth); this.padBreathDepth.connect(this.padGain.gain)
    this.padCutBreath = ctx.createGain(); this.padCutBreath.gain.value = this.padCut() * 0.1
    this.padLfo.connect(this.padCutBreath); this.padCutBreath.connect(this.padFilter.frequency)
    this.padLfo.start()

    // ── THE BASS. Strictly IN THE CENTRE (mono compatibility of the low end is a
    //    rule of any mix: a panned bass sounds different on a phone and in
    //    headphones and partially disappears on a mono speaker). But with its own
    //    saturation: even harmonics lift the note into the range a small speaker
    //    CAN reproduce, because on a phone the bass is heard through its overtones.
    this.bassGain = ctx.createGain(); this.bassGain.gain.value = 0.0001
    const bPre = ctx.createGain(); bPre.gain.value = 2.4
    const bSat = ctx.createWaveShaper()
    bSat.curve = satCurve(2.2)
    bSat.oversample = this.ab.oversample
    this.bassShaper = bSat
    const bPost = ctx.createGain(); bPost.gain.value = 1 / 2.4
    this.bassGain.connect(bPre); bPre.connect(bSat); bSat.connect(bPost)
    this.colour('bass', bPost, 0)

    // ── THE MELODY. The echo is PING-PONG: the dry note slightly right of
    //    centre, its repeats go left. That way one note gives a stage, not a
    //    point. Plus an HF shelf of +3.5 dB from 7.5 kHz: the little bell is the
    //    only layer with anything up top at all, and it deserves to be heard.
    this.arpGain = ctx.createGain(); this.arpGain.gain.value = 0.0001
    const arpAir = ctx.createBiquadFilter()
    arpAir.type = 'highshelf'; arpAir.frequency.value = 7500; arpAir.gain.value = 3.5
    const arpOut = this.colour('arp', this.arpGain, PAN.arp, arpAir)
    const delay = ctx.createDelay(1.5); delay.delayTime.value = SEC_PER_8 * 3
    const fbCut = ctx.createBiquadFilter()
    fbCut.type = 'lowpass'; fbCut.frequency.value = 1800; fbCut.Q.value = 0.4
    const fb = ctx.createGain(); fb.gain.value = 0.26
    const wet = ctx.createGain(); wet.gain.value = 0.3
    const echoPan = ctx.createStereoPanner(); echoPan.pan.value = PAN.echo
    arpOut.connect(delay)
    delay.connect(fbCut); fbCut.connect(fb); fb.connect(delay)
    delay.connect(wet); wet.connect(echoPan); echoPan.connect(this.musicGain)
    if (this.revIn) { const s = ctx.createGain(); s.gain.value = 0.4; echoPan.connect(s); s.connect(this.revIn) }

    // ── SPARKS. Each spark has its own pan (see scheduleStep), so the shared
    //    node here has no panner, but it has the biggest send into the hall: a
    //    spark is a glint, and a glint must ring in a room.
    this.sparkGain = ctx.createGain(); this.sparkGain.gain.value = 0.0001
    const sparkAir = ctx.createBiquadFilter()
    sparkAir.type = 'highshelf'; sparkAir.frequency.value = 6000; sparkAir.gain.value = 3
    this.colour('spark', this.sparkGain, 0, sparkAir)

    // ── PERCUSSION. The layer used to live only in «Разлом». Now it is
    //    everywhere: in «Разлом» it is a hit and a rustle, in the other worlds a
    //    shaker on the weak beats. The shaker solves two problems at once: it
    //    gives the PULSE the arrangement lacked and it fills the 4-12 kHz band,
    //    where we had a -70 dB hole.
    this.percGain = ctx.createGain(); this.percGain.gain.value = 0.0001
    this.colour('perc', this.percGain, 0)

    // ── COUNTERPOINT. A second voice: long notes in contrary motion to the
    //    motif, in the tenor register, on the left. Melody right, counterpoint
    //    left: a dialogue heard as WIDTH rather than as "more notes".
    this.ctrGain = ctx.createGain(); this.ctrGain.gain.value = 0.0001
    this.ctrPan = ctx.createStereoPanner(); this.ctrPan.pan.value = PAN.ctr
    this.ctrGain.connect(this.ctrPan)
    this.colour('ctr', this.ctrPan, 0)

    // noise for the rustles of the «Разлом» world (1 s, looped via playbackRate)
    const n = Math.floor(ctx.sampleRate)
    const buf = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    this.noise = buf

    this.padWave = makeWave(ctx, this.preset.padHarm)

    // ── ONE ROOM FOR THE WHOLE GAME ─────────────────────────────────────────
    // As soon as the music got a real hall, the EVENTS turned out to have their
    // own problem: they stayed in a pair of short delays, i.e. in a different
    // room. The ear hears that at once and reads it as being out of tune. So we
    // hand sound.ts a synthesized impulse: a SHORT room (0.9 s), not our big hall,
    // because a tap needs the walls to answer, not a tail in which the next tap
    // would be lost. The direction is one-way (music -> sound), as with
    // setMusicKey, so no module cycle appears. If ConvolverNode is unavailable,
    // sound.ts simply stays on its delays, everything there is under try/catch.
    //
    // On the economical tier we do NOT create the second convolution at all. It is
    // a second ConvolverNode in the graph and it is computed by the same audio
    // thread as the music hall. The events have an honest fallback (the pair of
    // delays, a ~0.4 s tail), so the tap keeps its "somewhere" while the cost
    // drops to zero.
    try {
      if (this.ab.sfxRoom) {
        const room = makeIR(ctx, { sec: 0.9, pre: 0.009, damp: 6000, dampFall: 6, early: 0.5 })
        const s = this.sound as unknown as { setRoom?: (b: AudioBuffer) => void }
        s.setRoom?.(room)
      } else this.log('sfx-room-skip', this.ab.tier)
    } catch (e) { console.warn('[hm-music] комната для событий не собрана:', e) }

    if (this.enigma) this.buildEnigma(ctx)
  }

  /** ── CHOIR AND BREATH (only behind the flag) ─────────────────────────────
   *  A voice is made not by an oscillator but by FILTERS: a detuned saw is the
   *  larynx (a rich comb of overtones), and the vowel is shaped from it by a trio
   *  of band-passes (formants). The bands are built ONCE and shared by all voices,
   *  so the choir has one "face mask"; otherwise every voice would sing with its
   *  own mouth and the blend (the main thing in Enigma) would be gone. The vibrato
   *  is also ONE for all: a 4.6 Hz LFO is connected to the `detune` of each new
   *  voice. */
  private buildEnigma(ctx: AudioContext) {
    this.choirGain = ctx.createGain(); this.choirGain.gain.value = 0.0001
    this.colour('choir', this.choirGain, 0) // the choir goes into the submix AND the hall
    // ── THE CHOIR STANDS IN TWO HALVES.
    //    ONE formant mask for everyone was right: separate masks would give a
    //    chorus, not a choir. But one mask = one source = a point in the centre,
    //    and the measurement showed a channel correlation of 1.000. The compromise
    //    real choirs sing: TWO groups, left and right, with slightly different
    //    vowels (formants x0.97 and x1.03). Inside a group the blend is fully
    //    preserved, and between the groups that very width appears. Voices are
    //    handed out to the halves.
    this.choirBands = []
    for (const side of [-0.62, 0.62]) {
      const pn = ctx.createStereoPanner(); pn.pan.value = side
      pn.connect(this.choirGain)
      const k = side < 0 ? 0.97 : 1.03
      for (const f of CHOIR_FORMANTS) {
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'; bp.frequency.value = f.hz * k; bp.Q.value = f.q
        const w = ctx.createGain(); w.gain.value = f.w
        bp.connect(w); w.connect(pn)
        this.choirBands.push(bp)
      }
    }
    this.choirLfo = ctx.createOscillator(); this.choirLfo.type = 'sine'
    this.choirLfo.frequency.value = CHOIR_VIB_HZ
    this.choirVibDepth = ctx.createGain(); this.choirVibDepth.gain.value = CHOIR_VIB_CENTS
    this.choirLfo.connect(this.choirVibDepth)
    this.choirLfo.start()

    this.breathGain = ctx.createGain(); this.breathGain.gain.value = 0.0001
    this.colour('breath', this.breathGain, 0)
  }

  /** world change: a preset (mode + progression + timbre) + a motif regenerated
   *  from the level. Called from the engine at the tunnel's "eclipse" (and in
   *  setLevel). */
  setWorld(worldIdx: number, levelIdx: number) {
    this.pendingWorld = Math.max(0, Math.min(PRESETS.length - 1, worldIdx))
    this.pendingLevel = levelIdx
    if (!this.started) return
    this.applyPreset(this.pendingWorld, false)
    this.regenerate(levelIdx)
  }

  private applyPreset(worldIdx: number, force: boolean): boolean {
    const p = PRESETS[Math.max(0, Math.min(PRESETS.length - 1, worldIdx))]
    if (!force && p === this.preset) return false
    this.preset = p
    if (this.ctx) {
      const t = this.ctx.currentTime
      this.padFilter.frequency.cancelScheduledValues(t)
      this.padFilter.frequency.setTargetAtTime(this.padCut(), t, 0.3)
      // ── A WORLD CHANGE = A CHANGE OF HALL AND TIMBRE.
      //    Everything done here is property assignment: not a single primitive
      //    that can throw. The method is called from setWorld, i.e. from the
      //    ticker path, where an exception would kill the frame loop.
      try {
        this.padWave = makeWave(this.ctx, p.padHarm)
        if (this.revConv) this.revConv.buffer = makeIR(this.ctx, this.space(this.enigma ? ENIGMA_SPACE : p.space))
        for (const [name, node] of Object.entries(this.sends)) {
          node.gain.cancelScheduledValues(t)
          node.gain.setTargetAtTime(SEND[name as keyof typeof SEND] * p.wet * (this.enigma ? 1.25 : 1), t, 0.25)
        }
      } catch (e) { console.warn('[hm-music] зал/тембр мира не пересобран:', e) }
    }
    // THE SKIP SOUNDS IN KEY: we hand the tonic and the mode to sound.ts so the
    // whoosh on the X key slides along the degrees of the current music, not past them.
    this.phraseCache.clear() // phrases depend on the mode and the progression: recompute
    this.sound.setMusicKey(p.root, p.mode)
    this.log('world-preset', p.name)
    return true
  }

  /** generating the MOTIF from a seed (the level number): deterministic, yet
   *  different for every level. The motif is 3-5 notes over 2 bars in "breathing"
   *  positions of the grid; the tones are triad degrees (0 root, 1 third, 2 fifth,
   *  3 octave, 4 ninth), the moves are small and the last note reaches for an
   *  anchor (root/fifth). */
  private regenerate(levelIdx: number) {
    const p = this.preset
    const rng = mulberry32((levelIdx + 1) * 2654435761)
    const sparse = p.sparse
    const len = p.mode.length

    // ── THE RHYTHM OF THE PHRASE ──────────────────────────────────────────────
    // The strong beats (0,4,8,12) are anchors where chord tones land. The weak ones
    // are the place for passing notes. THE HARD RULE OF BREATHING: the last onset
    // no later than step 12, i.e. at least one beat (0.6 s) of clean rest before
    // the phrase repeats. Without it the motif runs into itself and is heard as an
    // endless tape.
    const strongSlots = [0, 4, 8, 12]
    const weakSlots = [2, 3, 6, 7, 10, 11]
    const count = sparse ? 3 + Math.floor(rng() * 2) : 4 + Math.floor(rng() * 2) // 4..5 (3..4 in «Ясность»)
    // we take about half as anchors (the first beat always), the rest are passing notes
    const nStrong = Math.max(2, Math.round(count * 0.55))
    const picked = new Set<number>([0])
    const sPool = strongSlots.slice(1)
    while (picked.size < nStrong && sPool.length) {
      picked.add(sPool.splice(Math.floor(rng() * sPool.length), 1)[0])
    }
    const wPool = weakSlots.slice()
    while (picked.size < count && wPool.length) {
      picked.add(wPool.splice(Math.floor(rng() * wPool.length), 1)[0])
    }
    const steps = [...picked].filter((s) => s <= 12).sort((a, b) => a - b)

    // ── A LINE ALONG THE SCALE DEGREES ────────────────────────────────────────
    // 65% of the moves are seconds (that IS singing), 23% thirds, 12% leaps. After
    // a leap the next move MUST be a step in the opposite direction: the rule of
    // "resolving a leap", without which the line falls apart into chord shards.
    const degs: number[] = []
    let deg = 2 + Math.floor(rng() * 3) // 2..4, the middle of the ambitus, room to move
    let leap = 0
    const lo = 0, hi = 8 // an ambitus of ~1.5 octaves: a voice, not a whistle
    for (let i = 0; i < steps.length; i++) {
      if (i > 0) {
        let mv: number
        if (leap !== 0) {
          mv = -Math.sign(leap) // resolving the leap with a step towards it
        } else {
          const r = rng()
          const dir = rng() < 0.5 ? 1 : -1
          const wide = p.melMotion
          mv = (r < 0.65 ? 1 : r < 0.88 ? 2 : 3) * dir
          if (wide > 1 && mv === 1 && rng() < (wide - 1)) mv = 2 * dir // «Вихрь» is wider
          if (wide < 1 && Math.abs(mv) > 1 && rng() < (1 - wide) * 2) mv = dir // calm is narrower
        }
        deg += mv
        if (deg < lo) { deg = lo + 1; mv = 1 }
        if (deg > hi) { deg = hi - 1; mv = -1 }
        leap = Math.abs(mv) >= 2 ? mv : 0
      }
      degs.push(deg)
    }
    // THE PEAK OF THE PHRASE. Singing has a top point; random walking does not
    // give one: with small steps and resolved leaps the line can fit into 2-3
    // degrees and sounds like muttering (that is what happened in «Ясность»: a
    // range of 3 semitones for the whole world). If the span is less than a fourth,
    // we lift a note around 2/3 of the phrase.
    if (degs.length >= 3 && Math.max(...degs) - Math.min(...degs) < 3) {
      const top = Math.min(degs.length - 2, Math.max(1, Math.round((degs.length - 1) * 0.6)))
      degs[top] = Math.min(hi, degs[top] + 2)
    }

    // the end of the phrase reaches for the nearest anchor of the mode (I / III / V): it "sits down"
    const lastDeg = degs[degs.length - 1]
    const rest = [0, 2, 4, 7].reduce((a, b) =>
      Math.abs(b - lastDeg) < Math.abs(a - lastDeg) ? b : a, 0)
    degs[degs.length - 1] = rest

    // ── BREATHING: duration and loudness ─────────────────────────────────────
    // hold = how many steps until the next note -> short in motion, long at the
    // cadence. vel = an arc (quieter - brighter - quieter): the phrase gets a peak.
    this.motif = steps.map((step, i) => {
      const nextStep = i + 1 < steps.length ? steps[i + 1] : 16
      const gap = nextStep - step
      const last = i === steps.length - 1
      const hold = last ? 1.9 : gap >= 4 ? 1.35 : gap >= 2 ? 0.95 : 0.65
      // the phrase arc: the peak at ~60% of the length, softer edges. Plus an accent on the first beat
      const pos = steps.length > 1 ? i / (steps.length - 1) : 0
      const arc = Math.sin(Math.PI * Math.pow(pos, 0.78))
      let vel = 0.46 + 0.30 * arc
      if (step === 0) vel = Math.max(vel, 0.72) // the motif is recognised from the first note
      if (last) vel *= 0.86 // the exhale: the last note is softer than the peak
      return {
        step, deg: degs[i], hold, vel: Math.min(0.92, vel),
        offs: (rng() - 0.5) * 0.016, // +-8 ms: a living hand instead of a sequencer grid
      }
    })

    // sparks: 1-2 per cycle (8 bars), only on the 2nd and 4th chords, outside the motif
    this.sparkSlots = []
    const sparkCount = sparse ? 1 : 1 + (rng() < 0.55 ? 1 : 0)
    const free = weakSlots.filter((s) => !picked.has(s))
    for (let i = 0; i < sparkCount; i++) {
      const chord = i === 0 ? 1 : 3
      const st = free.length ? free[Math.floor(rng() * free.length)] : 7
      this.sparkSlots.push({ chord, step: st, tone: rng() < 0.5 ? 0 : 2 })
    }
    void len

    this.bassLift = rng() < 0.6 ? 1 : 0
    this.phraseCache.clear()
  }

  /** called every frame from engine.update: drives the scheduler by ctx.currentTime */
  update(dt: number, s: { intensity: number; multiplier: number; hush: number; playing: boolean }) {
    if (!this.started || !this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const hushed = s.hush > 0.2
    this.curIntensity = s.intensity
    this.curHushed = hushed

    // ── THE MENU THEME ──────────────────────────────────────────────────────
    // The engine sends playing:false in exactly three phases: splash, gameover,
    // finale (engine.ts:2667: playing = intro|play|portal|results). ALL layers used
    // to fall in those phases and absolute silence set in (measured: -96 dBFS RMS).
    // Now the quiet splash theme lives there. No change in the engine was needed.
    const menu = !s.playing
    this.menuT = menu ? this.menuT + dt : 0
    if (menu !== this.menu) {
      this.menu = menu
      if (!menu) this.menuBloomed = false // back in the game: the flourish is armed again
      this.log(menu ? 'menu-on' : 'menu-off')
    }
    if (menu) {
      // the entry is not instant: menuDelay seconds of silence, then a slow inhale (tc 1.4 s)
      const open = this.menuT > this.menuDelay ? 1 : 0
      // ── THE CURTAIN FLOURISH. Andrey: «в главном меню уже хочется видеть
      //    красоту и музыку крутую». A smooth fade-in of the pad is beautiful, but
      //    it is not yet "hooked from the first seconds": there is still nothing to
      //    listen to for the first second and a half. So at the exact moment the
      //    theme opens, ONE ascending flourish of bells over the tonic's tones
      //    plays, going into the hall. One-off: while we are in the menu it will
      //    not repeat.
      if (open && !this.menuBloomed) { this.menuBloomed = true; this.menuBloom(t + 0.18) }
      this.setLayer('pad', true, this.padGain, MENU_PAD_VOL * open, 1.4)
      this.setLayer('bass', false, this.bassGain, MENU_SUB_VOL * open, 1.4)
      // the call layer opens THREE TIMES faster than the pad (0.9 s against 2.5):
      // the flourish must be audible from its very first note, otherwise it fades
      // in into nowhere. The long bell tails still grow together with the gain, so
      // the gesture reads as "it floated in", not as "it was switched on".
      this.setLayer('arp', false, this.arpGain, MENU_CALL_VOL * open, 0.5)
      // SPARKS AND COUNTERPOINT IN THE MENU: two chords out of four used to be
      // entirely silent, and "silence as an instrument" read in a showcase as
      // plain emptiness. Now the second voice answers in them and a glint rings
      // above from time to time: the silence stayed, but it became THREE-DIMENSIONAL.
      this.setLayer('spark', false, this.sparkGain, SPARK_VOL * 0.8 * open, 1.4)
      this.setLayer('ctr', false, this.ctrGain, CTR_VOL * 0.85 * open, 1.6)
      this.setLayer('perc', false, this.percGain, 0, 0.5)
      // ENIGMA IN THE MENU: the choir and the breath ARE the "beauty right away".
      // In the menu the choir is slightly quieter than in game (x0.8): the splash
      // theme is not a combat one.
      if (this.choirGain) {
        const sw = this.enigmaSwell()
        this.setLayer('choir', true, this.choirGain, CHOIR_VOL * 0.8 * sw * open, 1.6)
        if (this.breathGain) {
          this.setLayer('breath', true, this.breathGain, BREATH_VOL * (1.5 - sw) * open, 1.6)
        }
      }
      // the menu timbre is warmer than the in-game one: a lower cutoff, a slightly deeper and slower breath
      this.ramp('cut', this.padFilter.frequency, this.padCut() * 0.58, t, 0.6)
      this.ramp('breath', this.padBreathDepth.gain, MENU_PAD_VOL * 0.09 * open, t, 0.8)
      this.ramp('cutBreath', this.padCutBreath.gain, this.padCut() * 0.06, t, 0.8)
      // THE SHOWCASE BREATHES TOO. The submix swell used to live only in the game
      // branch, while the menu returns from update earlier, so the splash theme
      // stood as an even wall exactly where it is listened to the longest.
      this.glide('mix', this.musicGain.gain, MUSIC_VOL * (this.enigma
        ? ENIGMA_MIX_FLOOR + (1 - ENIGMA_MIX_FLOOR) * this.enigmaSwell()
        : 0.78 + 0.22 * this.formPhase()), t, 1.2)
      this.pump(t)
      return
    }

    // layers with hysteresis so they do not flicker at the boundary (the
    // thresholds are unchanged: the engine and its logs noticed nothing, only HOW
    // it sounds changed)
    const padWant = s.playing
    const bassWant = s.playing && !hushed && (this.on.bass ? s.intensity > 0.15 : s.intensity > 0.22)
    const arpWant = s.playing && !hushed && s.multiplier >= 2
    const sparkWant = s.playing && !hushed && s.multiplier >= 3
    // percussion now exists in ALL worlds (hits in «Разлом», a shaker elsewhere),
    // and the counterpoint arrives together with the melody, only slightly later,
    // on the same streak threshold: first you hear the motif, then it is answered.
    const percWant = bassWant
    const ctrWant = arpWant && s.intensity > 0.42

    // hush = EVERYTHING DOWN gracefully: the pad stays, quieter and darker, "the cosmos exhaled"
    const padVol = PAD_VOL * (this.enigma ? ENIGMA_PAD_TRIM : 1)
    this.setLayer('pad', padWant, this.padGain, padWant ? padVol * (hushed ? 0.45 : 1) : 0, 0.9)
    this.setLayer('bass', bassWant, this.bassGain, bassWant ? BASS_VOL * (0.6 + 0.4 * s.intensity) : 0, hushed ? 0.05 : 0.5)
    this.setLayer('arp', arpWant, this.arpGain, arpWant ? ARP_VOL : 0, hushed ? 0.05 : 0.5)
    this.setLayer('spark', sparkWant, this.sparkGain, sparkWant ? SPARK_VOL : 0, hushed ? 0.05 : 0.6)
    // in the "soft" worlds the shaker is quieter than the hits of «Разлом»: there it is a pulse, here a colour
    const percVol = PERC_VOL * (this.preset.gritty ? 1 : 0.62)
    this.setLayer('perc', percWant, this.percGain, percWant ? percVol : 0, hushed ? 0.05 : 0.5)
    this.setLayer('ctr', ctrWant, this.ctrGain, ctrWant ? CTR_VOL : 0, hushed ? 0.05 : 0.7)

    // ── ENIGMA: choir and whisper. The choir lives together with the pad (it is
    //    the BED, not a reward for a streak) and opens slightly with intensity:
    //    -2.5 dB from full at rest, full in the storm. The breath does not depend
    //    on intensity at all, it is even, like the metronome of a rite. Under hush
    //    both go down with everything else.
    if (this.choirGain) {
      const sw = this.enigmaSwell()
      const cv = padWant ? CHOIR_VOL * sw * (hushed ? 0.4 : 0.75 + 0.25 * s.intensity) : 0
      this.setLayer('choir', padWant, this.choirGain, cv, 1.2)
      if (this.breathGain) {
        // the whisper swings in ANTIPHASE to the choir: when the voices recede, the breath is heard
        this.setLayer('breath', padWant, this.breathGain,
          padWant ? BREATH_VOL * (1.5 - sw) * (hushed ? 0.35 : 1) : 0, 1.2)
      }
    }

    // BREATHING OF THE WHOLE SUBMIX (Enigma only): one harmonic cycle, one
    // breath. ONLY musicGain swings, i.e. our own submix: the common chain
    // duck -> dip -> master and the SFX levels are not touched at all, the music
    // still lives UNDER the events. This is what the reference differs from us in
    // the most (LRA 13.7 against 1.9): it does not stand still for a second.
    if (this.enigma) {
      this.glide('mix', this.musicGain.gain,
        MUSIC_VOL * (ENIGMA_MIX_FLOOR + (1 - ENIGMA_MIX_FLOOR) * this.enigmaSwell()), t, 0.9)
    } else {
      // THE ARC OF THE FORM in the normal mode: shallower than in Enigma (-1.9 dB
      // against -6), because the in-game music has no right to disappear under the
      // events. But the "wall" is gone: over 38.4 s the music inhales and exhales once.
      this.glide('mix', this.musicGain.gain, MUSIC_VOL * (0.80 + 0.20 * this.formPhase()), t, 0.9)
    }

    // the pad's brightness breathes with intensity: calm is darker and duller, the storm brighter
    const cut = this.padCut() * (hushed ? 0.4 : 0.82 + 0.36 * s.intensity)
    this.ramp('cut', this.padFilter.frequency, cut, t, 0.25)
    // the breath depth in level follows the layer (the LFO is ADDED to
    // padGain.gain, so with the pad off the depth must honestly be zeroed,
    // otherwise the silence breathes)
    this.ramp('breath', this.padBreathDepth.gain,
      padWant ? padVol * (hushed ? 0.02 : 0.06) : 0, t, 0.4)
    this.ramp('cutBreath', this.padCutBreath.gain,
      this.padCut() * (hushed ? 0.03 : 0.1), t, 0.4)

    void dt
    this.pump(t)
  }

  /** ── THE LOOKAHEAD SCHEDULER: top up notes on the horizon ────────────────
   *  Split out of update because the menu branch returns earlier while the
   *  scheduler must keep running there too, otherwise the theme's pad dies as soon
   *  as the horizon runs out. The ticker guard and the resync live HERE, so both
   *  branches get them and the menu cannot crash the game. */
  private pump(t: number) {
    // RESYNC AFTER A STALL. If the game stood still (pause, a minimised tab, a
    // breakpoint, a long frame), ctx.currentTime moved ahead while nextNoteTime
    // stayed in the past, and the loop below would "catch up" 0.3 s per iteration,
    // scheduling hundreds of notes at once: first a frame freeze, then a burst of
    // everything missed. We jump into the present along the grid, preserving the
    // step phase (the music continues from the same beat of the bar).
    //
    // THE THRESHOLD USED TO BE A WHOLE BAR (2.4 s), AND THAT WAS "THE SOUND
    // GLITCHES". In the gap between the horizon (0.42 s) and the threshold (2.4 s)
    // the resync did not fire, and the loop below honestly scheduled up to eight
    // notes at times IN THE PAST. WebAudio knows no past times: it plays such a
    // note IMMEDIATELY, so the whole missed chunk of the phrase fell into one
    // blotted burst on top of the current one. Exactly what the author heard as
    // interruptions and glitches. Now the threshold is ONE STEP and the jump is
    // rounded up (ceil), so a note is never scheduled into the past: if we are
    // late, we silently skip instead of firing a salvo.
    const behind = t - this.nextNoteTime
    if (behind > RESYNC_AFTER) {
      // ceil jumps INTO THE FUTURE; floor (as it was) left a tail in the past
      const skipped = LEGACY ? Math.floor(behind / SEC_PER_8) : Math.ceil(behind / SEC_PER_8)
      this.nextNoteTime += skipped * SEC_PER_8
      this.step8 += skipped
      this.resyncs++
      this.log('resync', String(skipped))
    }
    // THE DIAGNOSIS IN ONE NUMBER: how many steps went into the scheduler with a
    // time IN THE PAST. WebAudio plays every such step immediately, i.e. those are
    // exactly the notes that fall into the blot. In a healthy game this is always 0.
    if (this.nextNoteTime < t - 0.001) this.lateSteps += Math.ceil((t - this.nextNoteTime) / SEC_PER_8)
    // THE TICKER GUARD. update() is called from the PixiJS ticker: any exception
    // from here stops the WHOLE frame loop and the game freezes dead. The music may
    // hiccup, the game must not fall. We always move the scheduler forward, even if
    // a step threw, otherwise the next frame would repeat the same error.
    let guard = 0
    while (this.nextNoteTime < t + LOOKAHEAD && guard++ < 64) {
      try {
        this.scheduleStep(this.step8, this.nextNoteTime)
      } catch (e) {
        if (!this.warned) {
          this.warned = true // exactly once: in the ticker it would otherwise spam at 60 Hz
          console.warn('[hm-music] шаг секвенсора не сыгран (игра продолжается):', e)
        }
      }
      this.nextNoteTime += SEC_PER_8
      this.step8++
    }
  }

  /** layer level. `want` says whether the layer plays LOGICALLY (it gates the
   *  scheduler and is written to the log), `target` says where to take the gain.
   *  They are deliberately SEPARATE: in the menu the melody's gain is open while
   *  want=false, because the in-game notes are not needed there.
   *
   *  WE WRITE ONLY ON A CHANGE. setTargetAtTime used to be called on 5 gains EVERY
   *  frame: 300 automation events per second on a parameter that stands still in
   *  99% of frames. That is not only garbage in the schedule: in an offline render
   *  such a queue caused an audible leak of closed layers (measured: a closed pad
   *  sounded at -25 dBFS instead of -80). A 2% threshold keeps it smooth (the bass
   *  follows intensity in dozens of steps) while removing thousands of pointless
   *  events. */
  /** the state of the layer envelopes: from where, to where and in which window
   *  each parameter moves. We keep it in JS instead of asking param.value, so the
   *  value is known EXACTLY at any moment and intercepting a moving ramp causes no
   *  jump. */
  private glides: Record<string, { from: number; to: number; t0: number; t1: number }> = {}

  /** A SMOOTH PARAMETER MOVE: one honest linear ramp per change.
   *
   *  WHY NOT setTargetAtTime (analysed by measurement). It was here from the start
   *  and sounded fine in game, but it has two properties that surfaced on the quiet
   *  menu theme:
   *   1) it is an ASYMPTOTE, it never reaches the target value. A "closed" layer
   *      crawls towards zero forever and stays slightly above it;
   *   2) it was called EVERY FRAME on 8 parameters (~480 events per second), and in
   *      99% of frames the target did not change. The render showed that such a
   *      queue stops obeying the target: closed layers on the splash sounded at
   *      -21 dBFS instead of -80 (the pad opened by itself). In game that hid
   *      behind the layers being open anyway; in the silence of the menu it became
   *      audible at once.
   *  A linear ramp is written ONLY when the target changes, reaches it exactly on
   *  time and, like `linearRampToValueAtTime` in equalPowerFade, never throws, so
   *  the path from the ticker stays safe. */
  private glide(key: string, param: AudioParam, target: number, t: number, dur: number, floor = 0.0001) {
    const v = Math.max(floor, target)
    const g = this.glides[key]
    // the target has not changed (2% is the threshold at which the ear hears
    // nothing yet, while continuous tweaks from intensity stay smooth): leave the
    // schedule alone
    if (g && Math.abs(v - g.to) <= Math.max(1e-5, Math.abs(g.to) * 0.02)) return
    // where the parameter is RIGHT NOW: computed by ourselves from our own previous ramp
    const cur = !g ? v : t >= g.t1 ? g.to
      : g.from + (g.to - g.from) * Math.max(0, Math.min(1, (t - g.t0) / (g.t1 - g.t0)))
    param.cancelScheduledValues(t)
    param.setValueAtTime(cur, t)
    param.linearRampToValueAtTime(v, t + dur)
    this.glides[key] = { from: cur, to: v, t0: t, t1: t + dur }
  }

  /** the same for NON-level parameters (filter cutoff, breath depth) */
  private ramp(key: string, param: AudioParam, value: number, t: number, tc: number) {
    this.glide('~' + key, param, value, t, tc * 1.8, -Infinity)
  }

  private setLayer(name: string, want: boolean, node: GainNode, target: number, tc: number) {
    const t = this.ctx!.currentTime
    // tc used to be the time constant of an exponential; a linear ramp of the same
    // duration sounds sharper, so we take x1.8 and the transition sounds the same
    this.glide(name, node.gain, target, t, tc * 1.8)
    if (this.on[name] !== want) {
      this.on[name] = want
      this.log(want ? 'layer-on' : 'layer-off', name)
    }
  }

  // ── BUILDING THE PHRASE ───────────────────────────────────────────────────

  /** a variation of the motif by the chord's number in the cycle: theme ->
   *  question -> breath -> answer. In the storm the "breath" (v2) opens into the
   *  full motif, so the density grows by itself without a single extra random note. */
  private variant(chordIdx: number, intensity: number): MotifNote[] {
    const m = this.motif
    if (m.length === 0) return m
    const last = m.length - 1
    switch (chordIdx & 3) {
      case 0: // THE THEME as it is
        return m
      case 1: // THE QUESTION: the tail goes UP one degree and is left unsaid (shorter, quieter)
        return m.map((n, i) => (i === last
          ? { ...n, deg: n.deg + 1, hold: n.hold * 0.6, vel: n.vel * 0.92 }
          : n))
      case 2: // THE BREATH: only the edges of the phrase remain (in the storm the
        // motif opens back up). The density grows with intensity by itself.
        return intensity > 0.72
          ? m
          : [{ ...m[0] }, { ...m[last], hold: m[last].hold * 1.25 }]
            .filter((n, i, a) => i === 0 || n.step !== a[0].step)
      default: { // THE ANSWER: approach the cadence by a step from above + a long landing
        const out = m.map((n, i) => (i === last
          ? { ...n, hold: n.hold * 1.35, vel: n.vel * 0.94, cadence: true }
          : { ...n }))
        // the penultimate note becomes the upper neighbour of the final one, the
        // classic leading move the ear hears as "a full stop at the end of a sentence"
        if (out.length >= 2) out[last - 1] = { ...out[last - 1], deg: out[last].deg + 1 }
        return out
      }
    }
  }

  /** THE READY PHRASE for a chord: a motif variation -> snapping the anchors to
   *  chord tones -> breaking up repeats. Computed once per (chord x intensity mode)
   *  and cached: there is nothing to recompute on every scheduler step and, more
   *  importantly, the phrase KNOWS its previous note inside itself, so it can
   *  prevent stuttering. */
  private phrase(chordIdx: number, intensity: number): MotifNote[] {
    const p = this.preset
    const key = (chordIdx & 3) + (intensity > 0.72 ? '|s' : '|c')
    const hit = this.phraseCache.get(key)
    if (hit) return hit
    const deg0 = p.prog[chordIdx & 3]
    const len = p.mode.length
    const raw = this.variant(chordIdx, intensity)
    const out: MotifNote[] = []
    let prev = NaN
    for (let i = 0; i < raw.length; i++) {
      const n = raw[i]
      // a strong beat (or a cadence) must stand on a chord tone; a weak one is
      // free, and that is where the passing notes that make the line sing live
      const strong = (n.step & 3) === 0 || n.cadence === true
      // the snap can collapse two different degrees into one, which is stuttering
      // (it used to make «Вихрь» play D5-D5-D5 in a row). We pass the previous note
      // as forbidden: the snap then takes the NEXT nearest one instead of leaping.
      let d = strong ? snapToChord(n.deg, deg0, len, prev) : n.deg
      if (d === prev) d += i > 0 && n.deg < raw[i - 1].deg ? -1 : 1
      prev = d
      out.push({ ...n, deg: d })
    }
    this.phraseCache.set(key, out)
    return out
  }

  /** ── COUNTERPOINT ───────────────────────────────────────────────────────
   *  A second voice. Not a second melody and not a third-below harmony (that would
   *  sound like "more notes"), but the OLD TEXTBOOK TASK: a line that moves
   *  TOWARDS the motif and sounds where the motif is silent.
   *
   *  The rules it is built by:
   *   1) direction: opposite to the general move of the phrase (melody up -> it down);
   *   2) places: only FREE steps (where the motif rests), so the two voices never
   *      strike at the same time and the density grows without mush;
   *   3) pitches: only tones of the current chord (snap), the register is tenor,
   *      between the bass and the melody, in the band that used to be empty;
   *   4) the notes are LONG (x2.2 tail): it holds while the motif runs. */
  private counter(chordIdx: number, intensity: number): MotifNote[] {
    const key = 'ctr' + (chordIdx & 3) + (intensity > 0.72 ? '|s' : '|c')
    const hit = this.phraseCache.get(key)
    if (hit) return hit
    const p = this.preset
    const deg0 = p.prog[chordIdx & 3]
    const len = p.mode.length
    const mel = this.phrase(chordIdx, intensity)
    const busy = new Set(mel.map((n) => n.step))
    const dir = mel.length > 1 ? Math.sign(mel[mel.length - 1].deg - mel[0].deg) || 1 : 1
    // free positions sorted by "convenience": the middle, the breath, the start
    const slots = [6, 13, 10, 2, 4].filter((s) => !busy.has(s))
    const a = snapToChord(dir > 0 ? 4 : 2, deg0, len)
    const b = snapToChord(a - 3 * dir, deg0, len, a)
    const out: MotifNote[] = []
    if (slots.length) out.push({ step: slots[0], deg: a, hold: 2.2, vel: 0.55, offs: 0 })
    if (slots.length > 1) out.push({ step: slots[1], deg: b, hold: 2.8, vel: 0.46, offs: 0 })
    this.phraseCache.set(key, out)
    return out
  }

  private scheduleStep(step: number, time: number) {
    const p = this.preset
    // the chord length comes FROM THE FLAG (twice as long in Enigma: the ritual tempo)
    const spc = this.stepsPerChord
    const cycleStep = ((step % this.stepsPerCycle) + this.stepsPerCycle) % this.stepsPerCycle
    const chordIdx = Math.floor(cycleStep / spc)
    const stepInChord = cycleStep % spc
    const barInChord = Math.floor(stepInChord / STEPS_PER_BAR)
    const stepInBar = stepInChord % STEPS_PER_BAR
    const deg = p.prog[chordIdx]
    const rel = chordRel(p.mode, deg) // [0, third, fifth] from the chord root
    const rootRel = near0(degToSemi(p.mode, deg)) // the chord's offset from the tonic (-5..+6)
    // THE FLOOR OF THE FORM: 0 = the simpler cycle, 1 = the fuller one. See round()
    const rnd = this.round(step)

    if (stepInBar === 0) {
      const bar = Math.floor(step / STEPS_PER_BAR)
      if (bar !== this.barN) { this.barN = bar; this.log('bar', String(bar)) }
    }

    // ── THE PAD: a new chord every 2 bars, the voices led by the shortest path.
    //    We schedule it ALWAYS (not by the layer flag): the bed must be in place at
    //    the very moment padGain opens, not half a cycle later.
    if (stepInChord === 0) {
      const pitches = voiceChord(p.mode, deg, p.root - 12)
      this.padChord(time, pitches)
      // ── ENIGMA: the choir takes the same chord an octave above the pad, which
      //    is the vocal register (220-470 Hz in world 1), exactly the reference's
      //    "spectral centre 250-500". Scheduled ALWAYS, like the pad: the bed must
      //    be in place at the very moment the gain opens.
      if (this.enigma) {
        this.choirChord(time, voiceChord(p.mode, deg, p.root))
        this.breathe(time, this.chordSec * 0.62) // a breath on the harmony change
        // a temple bell every other chord: the rite's "stroke of the clock"
        if ((chordIdx & 1) === 0) this.temple(time)
      }
      if (chordIdx !== this.chordN) { this.chordN = chordIdx; this.log('chord', String(chordIdx)) }
    }
    // a second, quieter exhale in the middle of the chord: the breathing runs
    // EVENLY instead of coinciding with every harmony change (otherwise it is heard
    // as a trick rather than as air)
    if (this.enigma && stepInChord === spc >> 1) this.breathe(time, this.chordSec * 0.42, 0.6)

    // ── THE MENU: a warm floor + a rare CALL ─────────────────────────────────
    //    The game branches below are not reached here: in the menu
    //    on.bass/arp/spark/perc are false and only the gains are open. Everything
    //    that sounds on the splash is the pad (always scheduled) plus what is
    //    scheduled here.
    if (this.menu) {
      // the floor: the chord root very low, a long inhale-exhale over both bars.
      // This is not "bass" in the game sense (it does not hit the beats), it is the
      // body of the pad.
      if (stepInChord === 0) {
        const hz = midiHz(p.root - 12 + near0(degToSemi(p.mode, deg)))
        this.voice(time, hz, 'sine', 0.9, 3.4, 0.55, this.bassGain, 190)
      }
      // the call: 3 notes on the 1st chord (a descent home) and 3 on the 3rd (a
      // rising question). The outer notes snap to the current chord, so the figure
      // is the same for all presets and the agreement with the harmony is provided
      // by the snap rather than by hand-picking.
      const call = MENU_CALL[chordIdx]
      if (call) {
        for (let i = 0; i < call.length; i++) {
          const n = call[i]
          if (n.step !== stepInChord) continue
          const edge = i === 0 || i === call.length - 1
          const d = edge ? snapToChord(n.deg, deg, p.mode.length) : n.deg
          // the menu register is always mid-warm: we do not take the world's
          // melOct (in «Разлом» it is -12 and the splash theme would growl, while
          // the splash is one for the whole game)
          const hz = midiHz(p.root + 12 + degToSemi(p.mode, d))
          // the tail is 1.5x longer than in game: the bell has time to "call"
          this.bell(time, hz, this.arpGain, 0.62, 1.6 * n.hold, p.bellRatio)
        }
      }
      // the ANSWER by the second voice on chords 1 and 3, see MENU_ANSWER
      const ans = MENU_ANSWER[chordIdx]
      if (ans) {
        for (const n of ans) {
          if (n.step !== stepInChord) continue
          const d = snapToChord(n.deg, deg, p.mode.length)
          const hz = midiHz(p.root + degToSemi(p.mode, d))
          this.voice(time, hz, 'triangle', 0.5, 1.3 * n.hold, 0.5, this.ctrGain, 1250)
        }
      }
      // the air of the hall: once per chord, stealthily (see airWash)
      if (stepInChord === 0 && this.room(time, this.ab.airSides)) this.airWash(time, this.chordSec * 0.98)
      // a rare glint on top
      for (const sp of MENU_SPARKS) {
        if (sp.chord !== chordIdx || sp.step !== stepInChord) continue
        const pn = this.ctx!.createStereoPanner()
        pn.pan.value = sp.chord === 1 ? 0.55 : -0.55
        pn.connect(this.sparkGain)
        this.bell(time, midiHz(p.root + 24 + degToSemi(p.mode, sp.deg)), pn, 0.5, 2.4, 2)
      }
      return
    }

    // ── THE BASS: one note per bar (the root), sometimes the fifth in the second
    //    bar of the chord. In calm the bass is SILENT for the whole 3rd chord:
    //    2 bars of pad only ("silence is an instrument").
    if (this.on.bass && stepInBar === 0) {
      const calmRest = this.curIntensity < 0.35 && chordIdx === 2
      if (!calmRest) {
        const fifth = barInChord === 1 && this.bassLift === 1 && this.curIntensity > 0.45
        const semi = degToSemi(p.mode, deg) + (fifth ? rel[2] : 0)
        const hz = midiHz(p.root - 24 + (((semi % 12) + 12) % 12))
        const vel = barInChord === 0 ? 0.9 : 0.7
        this.voice(time, hz, p.bassType, 0.03, 1.15, vel, this.bassGain, 300)
        this.pub('bass', hz, time, 1.15, vel)
      }
    }

    // ── THE BASS MOVES. It used to be a metronome on the root: one note per bar
    //    and that is all. Now it gets MOVEMENT, an octave bounce on the "and" of
    //    the third beat once the game has warmed up. A classic device: the lower
    //    voice does not merely mark the harmony, it PUSHES it forward.
    //    Half as loud as the main note and four times shorter: a shadow, not a hit.
    if (this.on.bass && stepInBar === 5 && rnd === 1 && this.curIntensity > 0.55
      && !(this.curIntensity < 0.35 && chordIdx === 2)) {
      const hz = midiHz(p.root - 12 + (((degToSemi(p.mode, deg) % 12) + 12) % 12))
      this.voice(time, hz, p.bassType, 0.02, 0.28, 0.34, this.bassGain, 420)
    }

    // ── THE BASS'S LEADING NOTE on the last 1/8 of a chord: a scale degree
    //    BETWEEN the current root and the next one. The chord change stops
    //    "arriving": half a second earlier the bass takes you by the hand and
    //    leads you into the new harmony. Only once the game has warmed up (at rest
    //    silence is worth more).
    if (this.on.bass && stepInChord === spc - 1 && this.curIntensity > 0.4) {
      const nextDeg = p.prog[(chordIdx + 1) & 3]
      // a degree one step below the next root if we move upwards, otherwise one step above
      const approach = degToSemi(p.mode, deg) < degToSemi(p.mode, nextDeg)
        ? degToSemi(p.mode, nextDeg - 1)
        : degToSemi(p.mode, nextDeg + 1)
      const hz = midiHz(p.root - 24 + (((approach % 12) + 12) % 12))
      this.voice(time, hz, p.bassType, 0.02, 0.34, 0.5, this.bassGain, 260)
      this.pub('bass', hz, time, 0.34, 0.5)
    }

    // ── THE MELODY: the ready phrase (variation + snap to the chord + repeat
    //    breaking), 3-5 notes over 16 steps, everything else is a rest (the last
    //    3 steps always).
    if (this.on.arp) {
      for (const n of this.phrase(chordIdx, this.curIntensity)) {
        if (n.step !== stepInChord) continue
        const hz = midiHz(p.root + 12 + p.melOct + degToSemi(p.mode, n.deg))
        const relSec = p.arpRelease * n.hold
        const when = time + n.offs
        this.bell(when, hz, this.arpGain, n.vel, relSec, p.bellRatio)
        this.duckPad(when) // the pad crouches, the melody comes forward
        this.pub('arp', hz, when, relSec, n.vel)
      }
    }

    // ── COUNTERPOINT: the second voice in the motif's rests, moving towards it
    //    (see counter()). The voice is soft (a triangle under a dark filter, a
    //    0.22 s attack): it does not compete with the bell for attention, it gives
    //    it an interlocutor.
    if (this.on.ctr) {
      const line = this.counter(chordIdx, this.curIntensity)
      for (let i = 0; i < line.length; i++) {
        const n = line[i]
        if (n.step !== stepInChord) continue
        if (rnd === 0 && i > 0) continue // the first cycle has one line, the second both
        if (!this.room(time)) continue   // the voice cap: the interlocutor stays quiet
        const hz = midiHz(p.root + degToSemi(p.mode, n.deg))
        this.voice(time, hz, 'triangle', 0.22, p.arpRelease * n.hold, n.vel, this.ctrGain, 1500)
      }
    }

    // ── SPARKS: 1-2 per 8 bars, very quiet and high. A luxury, not a filler.
    //    The register was lowered from +36 to +24: «Вихрь» used to produce D8
    //    (~4.7 kHz), which is no longer a spark but a whistle, and it fell out of
    //    everything else.
    if (this.on.spark) {
      for (const sp of this.sparkSlots) {
        if (sp.chord !== chordIdx || sp.step !== stepInChord) continue
        // a spark is "a luxury, not a filler": it is the first to give way when
        // the voice budget runs out
        if (!this.room(time, this.ab.bellParts)) continue
        const hz = midiHz(p.root + 24 + rootRel + rel[sp.tone])
        // the sparks fly to the edges of the stage: slot 0 left, slot 1 right
        const pn = this.ctx!.createStereoPanner()
        pn.pan.value = sp.chord === 1 ? -0.62 : 0.62
        pn.connect(this.sparkGain)
        this.bell(time, hz, pn, 0.55, 1.7, 2)
        this.pub('spark', hz, time, 1.7, 0.55)
      }
    }

    // ── PERCUSSION. «Разлом» gets a hit and a rustle (chaos by rhythm and
    //    timbre), the other worlds get a SHAKER on the weak beats. The layer used
    //    to live in only one world out of five, and four worlds stood with no pulse
    //    at all.
    if (this.on.perc) {
      if (p.gritty) {
        if (stepInBar === 0) this.thud(time, 0.95)
        else if (stepInBar === 5 && ((step >> 3) & 1) === 0) this.thud(time, 0.55)
        if (stepInChord === 0) this.rustle(time)
        if (stepInBar === 2 || stepInBar === 6) this.shaker(time, 0.10, stepInBar === 2 ? -PAN.shaker : PAN.shaker)
      } else {
        // weak eighths: the "and" of the second and of the fourth beat, plus a
        // light extra on the "and" of the first in the storm, so the density grows
        // with intensity rather than all at once. The first cycle has only the "and"
        // of the second beat, the second cycle both weak beats: the density grows
        // not from randomness but from the PLACE IN THE FORM
        if (stepInBar === 2 || (stepInBar === 6 && rnd === 1)) {
          this.shaker(time, 0.16 + 0.08 * this.curIntensity, stepInBar === 2 ? -PAN.shaker : PAN.shaker)
        } else if (stepInBar === 4 && rnd === 1 && this.curIntensity > 0.7 && this.room(time)) {
          // the third, most optional shaker hit: only if there is room
          this.shaker(time, 0.09, 0.2)
        }
      }
    }
  }

  /** publishing a note on the shared bus: the visuals MEET it at `when` (see
   *  notebus.ts). The pad is deliberately NOT published: it has no visual role and
   *  would eat the melody's place in the drop queue. */
  private pub(layer: NoteLayer, hz: number, when: number, dur: number, velocity: number) {
    noteBus.emit({ layer, midi: hzMidi(hz), when, dur, velocity })
  }

  // ── VOICES ────────────────────────────────────────────────────────────────

  /** a pad chord: 3 tones x 2 detuned oscillators, a 1.4 s attack and a 1.8 s
   *  tail, so the tail of the leaving chord overlaps the attack of the next one
   *  (a seamless blend) */
  private padChord(time: number, pitches: number[]) {
    const ctx = this.ctx!
    const p = this.preset
    // UNISON x3 instead of x2: more voices, so each one is quieter.
    // 0.16 x 2 voices = 0.32 per tone -> 0.105 x 3 = 0.315, the same sum.
    // The number of voices comes from the budget, and the amplitude sum per tone
    // is kept CONSTANT (base x 2 / N), so switching the tier changes the width and
    // the cost but not the layer's loudness. That is verifiable: the pad level in
    // an offline render of the "rich" and "economical" paths must match.
    const uni = Math.max(1, Math.min(3, this.ab.unison))
    const peak = (p.sparse ? 0.13 : 0.16) * (2 / uni)
    const mk = (hz: number, cents: number, amp: number, side: number) => {
      const o = ctx.createOscillator()
      // the world's WAVE TABLE instead of a bare sine/triangle: that is where the
      // missing top end comes from. padType remains the fallback: if PeriodicWave
      // did not build for some reason, the pad sounds as before instead of going silent.
      if (this.padWave) o.setPeriodicWave(this.padWave)
      else o.type = p.padType
      o.frequency.setValueAtTime(hz, time)
      o.detune.setValueAtTime(cents, time)
      // A FILTER WITH AN ENVELOPE AND RESONANCE is what makes a synthesizer a
      // voice rather than a horn: the cutoff opens with the attack and softly
      // closes on the tail. The ear hears "the sound took a breath", not "a note
      // was switched on".
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'; f.Q.value = p.padQ
      const c0 = this.padCut()
      f.frequency.setValueAtTime(c0 * 0.45, time)
      f.frequency.linearRampToValueAtTime(c0 * 1.15, time + PAD_ATTACK * 1.3)
      f.frequency.linearRampToValueAtTime(c0 * 0.7, time + this.chordSec + PAD_RELEASE)
      // the unison is SPREAD across the pan: three detunes, three places on the
      // stage. Without it the detune is heard as beating, with it as width.
      const pn = ctx.createStereoPanner(); pn.pan.value = side
      const g = ctx.createGain()
      // an EQUAL-POWER crossfade: sin up / cos down. Linear ramps removed the
      // -8..-15 dB hole but left -3 dB: for uncorrelated voices the SQUARES add up,
      // and a linear sin+cos pair gives 0.5+0.5=1 in amplitude but 0.25+0.25=0.5 in
      // power. sin^2+cos^2=1 is exact. Each voice has its OWN gain living for
      // exactly one chord, but we still clear the schedule: the node is fresh, yet a
      // duplicate padChord call for the same time (a fast world change) must not
      // stack a second envelope.
      g.gain.cancelScheduledValues(time)
      g.gain.setValueAtTime(1e-6, time)
      equalPowerFade(g.gain, amp, time, PAD_ATTACK, true)
      // after the last ramp the value HOLDS until the next event, so there is no
      // need to schedule a plateau between the attack and the tail
      equalPowerFade(g.gain, amp, time + this.chordSec, PAD_RELEASE, false)
      o.connect(f); f.connect(g); g.connect(pn); pn.connect(this.padFilter)
      o.start(time); o.stop(time + this.chordSec + PAD_RELEASE + 0.05)
      this.mark(time + this.chordSec + PAD_RELEASE + 0.05)
    }
    // UNISON: 3 voices per tone, a detune of +-11 cents (noticeably wider than
    // the former +-5, where the detune was heard as "a little" rather than as a
    // choir), each voice in its own place in the pan. The middle tone of the chord
    // is spread WIDER than the outer ones, so the centre of the stage stays dense
    // while the edges breathe.
    // The unison layout by budget: x3 as before (-11 / 0 / +11 and three places on
    // the stage), x2 the edges without the centre (the detune and the width are
    // preserved), x1 a single voice in the centre. The arrays are constants outside
    // the loop: zero garbage.
    const spread = uni === 3 ? UNI3_PAN : uni === 2 ? UNI2_PAN : UNI1_PAN
    const cents = uni === 3 ? UNI3_CENTS : uni === 2 ? UNI2_CENTS : UNI1_CENTS
    pitches.forEach((m, idx) => {
      const w = idx === 1 ? 1 : 0.7
      const hz = midiHz(m)
      for (let v = 0; v < uni; v++) mk(hz, cents[v], peak, spread[v] * w)
    })
    // THE SHINE: a quiet partial two octaves above the top tone. For a sine pad
    // («Иней», «Ясность») it is the only way to be bright: it has no overtones and
    // no filter cutoff will create them. It goes AROUND padFilter, which would
    // otherwise cut it; instead it has its own level, so the light is dosed exactly.
    if (p.shine > 0.01 && pitches.length && this.room(time, this.ab.shinePair ? 2 : 1)) {
      const top = pitches[pitches.length - 1]
      // with a single shine we give it both shares of the level: the light stays,
      // only the "shimmer between the ears" (which is what the second oscillator
      // paid for) is gone
      const amp = peak * p.shine * (this.ab.shinePair ? 1 : 1.4)
      // the shine became a PAIR spread to the edges. The same pitch detuned by
      // +-4 cents left and right gives a slow beating between the ears: the
      // "shimmer" stopped being a word in a comment and became a sound.
      for (const side of (this.ab.shinePair ? SHINE_PAIR : SHINE_ONE)) {
        const o = ctx.createOscillator(); o.type = 'sine'
        o.frequency.setValueAtTime(midiHz(top + 24), time)
        o.detune.setValueAtTime(side < 0 ? -4 : 4, time)
        const g = ctx.createGain()
        g.gain.cancelScheduledValues(time)
        g.gain.setValueAtTime(1e-6, time)
        equalPowerFade(g.gain, amp * 0.72, time, PAD_ATTACK, true)
        equalPowerFade(g.gain, amp * 0.72, time + this.chordSec, PAD_RELEASE, false)
        const pn = ctx.createStereoPanner(); pn.pan.value = side
        o.connect(g); g.connect(pn); pn.connect(this.padGain)
        o.start(time); o.stop(time + this.chordSec + PAD_RELEASE + 0.05)
        this.mark(time + this.chordSec + PAD_RELEASE + 0.05)
      }
    }
  }

  /** ── THE PAD'S SIDECHAIN DUCK UNDER THE MELODY (audio design: "duck competing
   *  sources"). Without it the melody and the pad fight in the same band and the
   *  melody is heard "inside" the bed. The duck makes room for it: on a note's
   *  onset the pad crouches by 2.6 dB over 30 ms and returns over 0.3 s. The depth
   *  and the release are deliberately small: pumping is explicitly warned about,
   *  and a pumping pad is worse than no duck at all.
   *
   *  Only linearRamp: the method sits on the ticker path and no throwing primitive
   *  may be here. The setValueAtTime(1, time) at the start EXPLICITLY defines the
   *  starting point: without it, intercepting a moving ramp would leave the value
   *  unknown, with it the value is always known. */
  private duckPad(time: number) {
    if (!this.padDuck) return
    const g = this.padDuck.gain
    g.cancelScheduledValues(time)
    g.setValueAtTime(1, time)
    g.linearRampToValueAtTime(PAD_DUCK, time + PAD_DUCK_ATK)
    g.linearRampToValueAtTime(1, time + PAD_DUCK_ATK + PAD_DUCK_REL)
  }

  /** ── THE CURTAIN FLOURISH ────────────────────────────────────────────────
   *  Five bells up the tonic's tones (I-III-V-I-III), each next one quieter and
   *  with a longer tail, spreading across the pan from left to right, all of it
   *  with a full send into the hall. A one-off gesture on the theme's entry, that
   *  very "the curtain opened" after which it is interesting to keep listening.
   *
   *  Why an arpeggio on the tonic: any other set of notes would have to be agreed
   *  with the current chord, while the tonic triad agrees with the world's whole
   *  progression by construction, so the flourish cannot sound off. */
  private menuBloom(time: number) {
    const p = this.preset
    const ctx = this.ctx
    if (!ctx) return
    const degs = [0, 2, 4, 7, 9]
    for (let i = 0; i < degs.length; i++) {
      const hz = midiHz(p.root + 12 + degToSemi(p.mode, degs[i]))
      const pn = ctx.createStereoPanner()
      pn.pan.value = -0.5 + i * 0.25
      pn.connect(this.arpGain)
      // the level falls while the tail grows: the gesture "flies away" instead of breaking off
      this.bell(time + i * 0.17, hz, pn, 0.62 - i * 0.07, 2.0 + i * 0.5, p.bellRatio)
    }
    this.log('menu-bloom')
  }

  /** ── THE AIR OF THE HALL (menu only) ─────────────────────────────────────
   *  A very quiet high noise swell on each chord of the theme. Why: a measurement
   *  showed the menu's 8-16 kHz band lies at -79 dB, because nothing up there has
   *  anything to sound with (bells and pad do not reach that high), and the
   *  showcase therefore sounds "under a blanket". It deliberately adds no rhythm:
   *  4-second fades in and out, so what you hear is not a "shhh" but the fact that
   *  the room has gained a ceiling. */
  private airWash(time: number, dur: number) {
    const ctx = this.ctx
    if (!ctx || !this.noise) return
    // the economical tier hears the air on one side only: the 8-16 kHz band is
    // still filled, only the noise width is lost (not the "ceiling" itself)
    for (const side of (this.ab.airSides >= 2 ? AIR_SIDES : AIR_ONE)) {
      const src = ctx.createBufferSource()
      src.buffer = this.noise; src.loop = true
      src.playbackRate.value = side < 0 ? 1.31 : 1.07 // different chunks of noise -> width
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'; hp.frequency.value = 6500; hp.Q.value = 0.5
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'; lp.frequency.value = 14000; lp.Q.value = 0.4
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, time)
      g.gain.exponentialRampToValueAtTime(0.020, time + dur * 0.45)
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur)
      const pn = ctx.createStereoPanner(); pn.pan.value = side
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(pn); pn.connect(this.sparkGain)
      src.start(time); src.stop(time + dur + 0.05)
      this.mark(time + dur + 0.05)
    }
  }

  /** ── THE SHAKER ──────────────────────────────────────────────────────────
   *  A short burst of noise in the 4-11 kHz band on a weak beat. Two jobs at once:
   *  1) PULSE. The arrangement was "the pad holds, the melody sings", with nothing
   *     between them counting the time, which made the music feel static.
   *  2) AIR. Measured: the 4-8 kHz band lay at -63..-78 dB. A shaker is the
   *     cheapest and most natural way to put something there.
   *  The pan alternates, so the "hands" are heard left and right in turn. */
  private shaker(time: number, peak: number, side: number) {
    const ctx = this.ctx!
    if (!this.noise) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 1.8
    // the band is WIDE (Q 0.45, centre 5.5 kHz): a first attempt used 7 kHz with
    // Q 0.8 and in the calm world that left a dip at 2-4 kHz between the dark pad
    // and the narrow shaker. A shaker must smear, not squeak.
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 5500; bp.Q.value = 0.45
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'; hp.frequency.value = 2600; hp.Q.value = 0.6
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.09)
    const pn = ctx.createStereoPanner(); pn.pan.value = side
    src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(pn); pn.connect(this.percGain)
    src.start(time); src.stop(time + 0.14)
    this.mark(time + 0.14)
  }

  /** ── THE CHOIR (Enigma) ──────────────────────────────────────────────────
   *  For every chord tone, TWO detuned sawtooth voices (+-9 cents): a saw gives the
   *  full comb of overtones out of which the formants shape the vowel. The detune
   *  is wider than the pad's (+-5), because a live choir is not a unison, and that
   *  is its "thickness". The envelope is the same equal-power fade as the pad's
   *  (sin/cos piecewise linear): a 2.4 s attack, a 3.4 s tail, and NOT A SINGLE
   *  attack in the reference sense, only swells (the reference measured a rise of
   *  2.86 dB over 20 ms).
   *
   *  There is no setValueCurveAtTime here and there cannot be: it is the only
   *  throwing Web Audio primitive and we stand on the ticker path.
   */
  private choirChord(time: number, pitches: number[]) {
    const ctx = this.ctx!
    if (!this.choirGain || this.choirBands.length === 0) return
    // ── A BREATHING VOWEL. The formants no longer stand still: over a chord the
    //    first band travels 520 -> 430 Hz, i.e. the choir pronounces "a-a-a-o-o".
    //    That is exactly how live ritual vocals differ from a synthesizer: the
    //    vowel LIVES even when the pitch stands. The ramps are linear (they do not
    //    throw) and are written to the shared node once per chord.
    const bandsPerSide = CHOIR_FORMANTS.length
    for (let i = 0; i < this.choirBands.length; i++) {
      const f = CHOIR_FORMANTS[i % bandsPerSide]
      const k = i < bandsPerSide ? 0.97 : 1.03
      const par = this.choirBands[i].frequency
      par.cancelScheduledValues(time)
      par.setValueAtTime(f.hz * k, time)
      par.linearRampToValueAtTime(f.hz * k * 0.83, time + this.chordSec * 0.9)
    }
    // 3 tones x 2 voices, plus a MALE OCTAVE below the lowest tone: without it the
    // "choir" was a female trio, and the weight of a rite comes exactly from the
    // lower octave. The voices per tone come from the budget. The amplitude sum is
    // kept (x2/N), so the choir does not get quieter, it gets narrower: on the
    // economical tier it is one voice per tone instead of two, i.e. 4 oscillators
    // instead of 8.
    const cv = Math.max(1, Math.min(2, this.ab.choirVoices))
    const peak = 0.075 * (2 / cv)
    const all = pitches.concat([pitches[0] - 12])
    all.forEach((m, idx) => {
      const low = idx === all.length - 1
      const amp = peak * (low ? 0.55 : idx === pitches.length - 1 ? 0.72 : 1)
      for (const cents of (cv === 2 ? CHOIR_DET : CHOIR_DET1)) {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(midiHz(m), time)
        o.detune.setValueAtTime(cents, time)
        // SHARED VIBRATO: one LFO for the whole choir (see buildEnigma).
        //
        // AND A MANDATORY DISCONNECT. A voice is a one-shot node that stops
        // itself; but the INCOMING edge from the live LFO holds a reference to it,
        // and the collector will never take such a node. 6 voices per chord every
        // 9.6 s means hundreds of dead oscillators hanging on the LFO over a run
        // (audio design explicitly warns about "unbounded one-shot players").
        // We break the link on onended and keep the list of live voices capped: if
        // onended does not arrive for some reason, we detach the oldest by hand.
        if (this.choirVibDepth) {
          const vib = this.choirVibDepth
          vib.connect(o.detune)
          const drop = () => { try { vib.disconnect(o.detune) } catch { /* already detached */ } }
          o.onended = drop
          this.choirVoices.push(drop)
          while (this.choirVoices.length > 24) (this.choirVoices.shift() as () => void)()
        }
        const g = ctx.createGain()
        g.gain.cancelScheduledValues(time)
        g.gain.setValueAtTime(1e-6, time)
        equalPowerFade(g.gain, amp, time, CHOIR_ATTACK, true)
        equalPowerFade(g.gain, amp, time + this.chordSec, CHOIR_RELEASE, false)
        o.connect(g)
        // a voice goes into ITS OWN half of the choir: detune -9 to the left, +9
        // to the right, so the two groups sing one harmony with slightly different
        // voices. With one voice per tone the detune sign is the same for all and
        // splitting by it would degenerate into "the whole choir on the left", so
        // then we split by TONE INDEX: the chord's tones go to different groups and
        // the width is preserved.
        const half = cv === 2 ? (cents < 0 ? 0 : 1) : (idx & 1)
        for (let b = 0; b < bandsPerSide; b++) g.connect(this.choirBands[half * bandsPerSide + b])
        o.start(time)
        o.stop(time + this.chordSec + CHOIR_RELEASE + 0.05)
        this.mark(time + this.chordSec + CHOIR_RELEASE + 0.05)
      }
    })
  }

  /** ── THE TEMPLE BELL (Enigma) ────────────────────────────────────────────
   *  Once every two chords (19.2 s), one very low strike with a six-second tail
   *  going entirely into the cathedral. A rite needs a point of reference: without
   *  it "the breath and the choir" turn into an endless cushion with no events. The
   *  bell is quiet (-26 dB under the choir): you feel it more than you hear it. */
  private temple(time: number) {
    const ctx = this.ctx
    if (!ctx || !this.choirGain) return
    const base = midiHz(this.preset.root - 12)
    // inharmonic overtones: what makes a bell differ from an organ
    const parts: [number, number, number][] = [[1, 0.5, 6.0], [2.01, 0.22, 4.0], [2.98, 0.12, 2.6], [5.42, 0.05, 1.4]]
    for (const [r, a, rel] of parts) {
      const o = ctx.createOscillator(); o.type = 'sine'
      o.frequency.setValueAtTime(base * r, time)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, time)
      g.gain.exponentialRampToValueAtTime(a * 0.09, time + 0.06)
      g.gain.exponentialRampToValueAtTime(0.0001, time + rel)
      o.connect(g); g.connect(this.choirGain)
      o.start(time); o.stop(time + rel + 0.1)
      this.mark(time + rel + 0.1)
    }
  }

  /** ── THE WHISPERING BREATH (Enigma) ──────────────────────────────────────
   *  Band-passed noise with a slow inhale and exhale. The 780 Hz Q 0.7 band is the
   *  region of a voice's breathiness; above it the cassette "shh" begins, below it
   *  a rumble. A narrow "sibilant" at 2600 Hz, twice as quiet again, is added on
   *  top: because of it the noise reads as a HUMAN rather than as wind, while the
   *  centre of gravity does not leave the reference 250-500 Hz. Exponential ramps
   *  (they do not throw), the source stops itself.
   */
  private breathe(time: number, dur: number, level = 1) {
    const ctx = this.ctx!
    if (!this.breathGain || !this.noise) return
    // the inhale and the exhale are heard from DIFFERENT sides (the full inhale on
    // the harmony change on the left, the quiet one in the middle on the right).
    // The breath stopped being "noise in the centre" and became the presence of
    // someone alive nearby.
    const pan = ctx.createStereoPanner()
    pan.pan.value = level >= 1 ? -0.45 : 0.45
    pan.connect(this.breathGain)
    const mk = (hz: number, q: number, amp: number, rate: number) => {
      const src = ctx.createBufferSource()
      src.buffer = this.noise
      src.loop = true
      src.playbackRate.value = rate
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'; bp.frequency.value = hz; bp.Q.value = q
      const g = ctx.createGain()
      const inT = dur * 0.45 // the inhale is a bit shorter than the exhale: that is breathing, not pumping
      g.gain.setValueAtTime(0.0001, time)
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), time + inT)
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur)
      src.connect(bp); bp.connect(g); g.connect(pan)
      src.start(time); src.stop(time + dur + 0.05)
      this.mark(time + dur + 0.05)
    }
    mk(780, 0.7, 0.5 * level, 0.55)
    // the "sibilant" is a second noise source for the whole chord; on the
    // economical tier the breath stays, but as one layer only (the whisper is at
    // -21 dB anyway)
    if (this.ab.tier !== 'lite') mk(2600, 2.2, 0.22 * level, 0.8)
  }

  /** a single-voice note: osc -> lowpass -> a soft envelope -> the layer gain (self-stopping) */
  private voice(time: number, freq: number, type: OscillatorType, attack: number,
    release: number, peak: number, dest: GainNode, cut: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, time)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut; lp.Q.value = 0.4
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, time + attack + release)
    o.connect(lp); lp.connect(g); g.connect(dest)
    o.start(time); o.stop(time + attack + release + 0.05)
    this.mark(time + attack + release + 0.05)
  }

  /** THE LITTLE BELL: a pure sine + a quiet overtone (octave/twelfth), a fast
   *  attack and a long exponential tail. No saw, no square: nothing pricks the ear. */
  private bell(time: number, freq: number, dest: AudioNode, peak: number,
    release: number, ratio: number) {
    const ctx = this.ctx!
    // THE NOTE'S ATTACK. 12 ms is the "hammer strike" that makes a bell a bell.
    // In Enigma the attack is stretched to 55 ms: the reference measurement says
    // there are NO ATTACKS there at all (an average envelope rise of 2.6 dB/20 ms
    // against our 3.7), the sound always "floats in". That is heard as the
    // difference between "a note was played" and "a voice appeared". The melody
    // stays the same, only its edge changes.
    const atk = this.enigma ? 0.055 : 0.012
    const mk = (hz: number, amp: number, rel: number, det = 0, side = 0) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(hz, time)
      if (det) o.detune.setValueAtTime(det, time)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, time)
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), time + atk)
      g.gain.exponentialRampToValueAtTime(0.0001, time + atk + rel)
      o.connect(g)
      if (side !== 0) { const pn = ctx.createStereoPanner(); pn.pan.value = side; g.connect(pn); pn.connect(dest) }
      else g.connect(dest)
      o.start(time); o.stop(time + atk + rel + 0.05)
      this.mark(time + atk + rel + 0.05)
    }
    // ── A REAL BELL, not "a sine plus an octave".
    //    In a live bell the overtones are NOT multiples of the fundamental and fade
    //    the faster the higher they are. Hence four partials: the fundamental, the
    //    overtone set by the preset (octave/twelfth), the fifth above it and a high
    //    4.2x "strike" with a very short tail. It is the last one that gives the
    //    note PRESENCE at 3-8 kHz, where we had silence.
    //
    // How many partials we can afford comes from the budget. The ORDER MATTERS, we
    // cut from the tail by increasing contribution to the timbre:
    //   1 fundamental / 2 the preset's overtone / 3 the "hammer strike" (presence
    //   at 3-8 kHz, without it the note goes deaf) / 4 the detuned twin (width) /
    //   5 the fifth.
    // So even with three partials the bell stays a bell rather than a sine: tone +
    // overtone + strike is its recognisable edge. The call order is preserved
    // exactly (with parts=5 the graph is assembled with the same edges in the same
    // order as before), we cut by conditions.
    //
    // WHAT GETS CUT FIRST WAS DECIDED BY MEASUREMENT, NOT BY TASTE. Cutting from
    // the tail of the list (the fifth, then the twin) made an offline render show a
    // -8 dB dip in the 2-4 kHz band: the FIFTH above the overtone lived there, and
    // that is intelligibility and presence, the most valuable thing a melody has on
    // a phone speaker. So the detuned TWIN goes first: it gives width, and width is
    // inaudible on a phone's mono speaker anyway.
    const parts = this.ab.bellParts
    mk(freq, peak * 0.72, release)
    if (parts >= 5) mk(freq * 1.002, peak * 0.16, release * 0.9, 0, -0.35) // the twin: width
    mk(freq * ratio, peak * 0.2, release * 0.45)
    if (parts >= 4) mk(freq * ratio * 1.5, peak * 0.075, release * 0.3, 0, 0.3) // the fifth: 2-4 kHz
    mk(freq * 4.2, peak * 0.05, Math.min(0.22, release * 0.16)) // the "hammer strike"
  }

  /** a dull hit (the «Разлом» world): a sine 70->38 Hz under a dark filter, no click */
  private thud(time: number, peak: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(72, time)
    o.frequency.exponentialRampToValueAtTime(38, time + 0.14)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = 0.5
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(peak, time + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.26)
    o.connect(lp); lp.connect(g); g.connect(this.percGain)
    o.start(time); o.stop(time + 0.32)
    this.mark(time + 0.32)
  }

  /** a rustle (the «Разлом» world): narrow-band noise, a slow inhale-exhale on the chord change */
  private rustle(time: number) {
    const ctx = this.ctx!
    if (!this.noise) return
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = 0.6
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(0.5, time + 0.8)
    g.gain.exponentialRampToValueAtTime(0.0001, time + 2.2)
    src.connect(bp); bp.connect(g); g.connect(this.percGain)
    src.start(time); src.stop(time + 2.3)
    this.mark(time + 2.3)
  }

  /** engine.destroy(): stop the LFOs, release the graph */
  stop() {
    this.stopClock() // the clock is ALWAYS stopped, even if the ctx never opened
    if (this.unsubAudio) { this.unsubAudio(); this.unsubAudio = null }
    if (!this.ctx) return
    try { this.padLfo.stop() } catch { /* ok */ }
    try { this.choirLfo?.stop() } catch { /* ok */ }
    for (const l of this.chorusLfo) { try { l.stop() } catch { /* ok */ } }
    this.started = false
    this.log('engine-stop')
  }

  private log(...a: string[]) { console.debug('[hm-music]', ...a) }
}
