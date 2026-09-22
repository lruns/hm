// StrudelMusicEngine: an EXPERIMENT behind the ?music=strudel flag. Same contract
// as our hand-rolled MusicEngine (ensureStarted / update / setWorld / stop), but
// the notes come not from our sequencer but from @strudel/web (TidalCycles in the
// browser): per-world mini-notation patterns, layers switched on by intensity/streak.
//
// KEY RISK AND ITS FIX (splicing into OUR audio graph):
// by default superdough collects its output into an isolated node
//   orbit -> channelMerger -> destinationGain -> ctx.destination
// i.e. bypassing our duck/dip/master (slow-mo, tunnel duck and M-mute would not
// work). We fix that in two moves:
//   1) setAudioContext(ourCtx) BEFORE initStrudel, so superdough takes OUR
//      AudioContext (the same one sound.ts uses) instead of making its own;
//   2) after init we grab controller.output.destinationGain, disconnect it from
//      ctx.destination and plug it through our own strudelGain into
//      sound.musicBus().dest (= duck). Everything Strudel plays now goes through
//      the common graph -> duck(slow-mo lowpass) -> dip(warp duck) -> master(mute).
// resetGlobalEffects (the only thing that would break this patch) is never called
// in live playback, only in the offline render, which we do not use.
//
// TEMPO: setcps so that 1 cycle = 1 bar (4 beats) at BEAT_HZ (100 BPM):
//   cps = bpm/60/4. The Strudel clock and our pulse both run at 100 BPM (same
//   caveat as in music.ts: the audio clock and the frame pulse are not
//   sample-exact, so there is a slight drift).
//
// LAYERS: pad always -> bass from intensity -> arp at x2 -> sparks at x3; hush
// strips it down to the pad. Layers change by recompiling the stack() pattern
// ONLY when the set of layers changes (not every frame): Strudel swaps the
// pattern at a cycle boundary, smoothly.

import type { SoundEngine } from './sound'
import { noteBus } from './notebus'

const BPM = 100
const CPS = BPM / 60 / 4 // 1 cycle = 1 bar of 4 beats -> in sync with BEAT_HZ
const SEC_PER_8 = 60 / BPM / 2 // duration of an eighth note (0.3 s)
const LOOKAHEAD = 0.42 // same horizon as music.ts: the visuals have time to meet the note

// Strudel produces notes inside itself, so we have no EXACT "before it sounds"
// event. But the patterns are deterministic and locked to CPS, so we MIRROR their
// grid onto the note bus with a parallel beat emitter (the same onsets as in
// recompile). The phase may wander slightly against Strudel's audio clock (the
// same drift as above), but the visuals stay musical. The exact "note before it
// sounds" lives in music.ts (the default engine).
const ROOT_MIDI: Record<string, number> = { A: 57, C: 60, D: 62, B: 59 }
const SCALE_SEMIS: Record<string, number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
}
const degToSemi = (mode: number[], idx: number): number => {
  const len = mode.length
  return mode[((idx % len) + len) % len] + 12 * Math.floor(idx / len)
}

// Levels in dB, as in music.ts. superdough's absolute output does not match our
// own synthesis one to one, so what matters here are the RATIOS between layers,
// while the overall level is trimmed by MUSIC_VOL.
const db = (x: number) => Math.pow(10, x / 20)
const MUSIC_VOL = 0.55 // master trim of the experiment (gentle, sits under the SFX)
const PAD_G = db(-18)
const BASS_G = db(-16)
const ARP_G = db(-17)
const SPARK_G = db(-23)
const PERC_G = db(-24)

interface SPreset {
  name: string
  root: string // tonic as a letter (the octave is added per layer)
  scale: string // mode name: ionian | lydian | dorian | aeolian
  /** progression: scale degrees, roots of 4 chords of 2 bars each (= 2 Strudel cycles) */
  prog: number[]
  padWave: string
  bassWave: string
  arpWave: string
  sparkWave: string
  padCut: number
  gritty: boolean // Разлом: a layer of dull low hits instead of dissonance
  sparse: boolean // Ясность: fewer notes
}

// 5 presets, one per campaign mood: modes, progressions and timbres are kept in
// sync with music.ts. No sawtooth and no square anywhere: only sine/triangle.
const PRESETS: SPreset[] = [
  { name: 'Тёплый Счёт', root: 'A', scale: 'ionian', prog: [0, 5, 3, 4],
    padWave: 'triangle', bassWave: 'triangle', arpWave: 'sine', sparkWave: 'sine',
    padCut: 1100, gritty: false, sparse: false },
  { name: 'Иней', root: 'C', scale: 'lydian', prog: [0, 1, 5, 4],
    padWave: 'sine', bassWave: 'sine', arpWave: 'sine', sparkWave: 'sine',
    padCut: 1500, gritty: false, sparse: false },
  { name: 'Вихрь', root: 'D', scale: 'dorian', prog: [0, 3, 6, 4],
    padWave: 'triangle', bassWave: 'triangle', arpWave: 'sine', sparkWave: 'sine',
    padCut: 1250, gritty: false, sparse: false },
  { name: 'Разлом', root: 'B', scale: 'aeolian', prog: [0, 5, 2, 6],
    padWave: 'triangle', bassWave: 'sine', arpWave: 'sine', sparkWave: 'sine',
    padCut: 850, gritty: true, sparse: false },
  { name: 'Ясность', root: 'A', scale: 'ionian', prog: [0, 3, 5, 4],
    padWave: 'sine', bassWave: 'sine', arpWave: 'sine', sparkWave: 'sine',
    padCut: 1600, gritty: false, sparse: true },
]

/** progression -> mini-notation `<a!2 b!2 c!2 d!2>`: a chord holds for 2 cycles (2 bars) */
const progPat = (prog: number[]) => `<${prog.map((d) => `${d}!2`).join(' ')}>`

type StrudelMod = typeof import('@strudel/web')

export class StrudelMusicEngine {
  private sound: SoundEngine
  private mod: StrudelMod | null = null
  private strudelGain: GainNode | null = null
  private state: 'idle' | 'loading' | 'ready' | 'failed' = 'idle'

  private preset: SPreset = PRESETS[0]
  private pendingWorld = 0

  // current set of layers (for log diffing and the recompile decision)
  private layers = { pad: false, bass: false, arp: false, spark: false }
  private hushed = false
  private playing = false
  private lastSig = ''
  private evaluating = false
  private pendingSig: string | null = null

  // note-bus beat emitter (mirrors the pattern grid in CPS)
  private ctx: AudioContext | null = null
  private emitTime = 0
  private emitStep = 0

  constructor(sound: SoundEngine) {
    this.sound = sound
  }

  /** idempotent: as soon as sound.ts has opened the ctx (first gesture), load Strudel */
  ensureStarted() {
    if (this.state !== 'idle') return
    const bus = this.sound.musicBus()
    if (!bus) return // no ctx yet (no gesture happened): wait quietly
    this.state = 'loading'
    this.boot(bus.ctx, bus.dest).catch((e) => {
      this.state = 'failed'
      console.warn('[hm-music] strudel boot failed:', e)
    })
  }

  private async boot(ctx: AudioContext, dest: AudioNode) {
    const mod = await import('@strudel/web')
    this.mod = mod
    // (1) superdough must take OUR context instead of spawning one: BEFORE initStrudel
    mod.setAudioContext(ctx)
    await mod.initStrudel({ prebake: async () => { /* no samples, synths only */ } })
    // effect worklets are loaded IN THE BACKGROUND (no await!): in some environments
    // addModule never resolves, and basic oscillator synths do not need worklets,
    // so we must not block on it
    void mod.initAudio({}).catch(() => { /* without worklets we still play oscillators */ })

    // (2) rewire superdough's output into our graph
    const strudelGain = ctx.createGain()
    strudelGain.gain.value = MUSIC_VOL
    strudelGain.connect(dest)
    this.strudelGain = strudelGain
    const ctrl = mod.getSuperdoughAudioController()
    const out = ctrl.output.destinationGain
    // proof the context is shared: does superdough consider our ctx its own
    const sameCtx = mod.getAudioContext() === ctx
    console.debug('[hm-music] strudel-ctx-shared', String(sameCtx))
    if (out) {
      try { out.disconnect() } catch { /* it may not have been connected */ }
      out.connect(strudelGain)
      console.debug('[hm-music] strudel-rerouted', 'superdough.destinationGain -> musicBus(duck)')
    } else {
      // no output node: playback will bypass the graph; log the failed splice honestly
      console.warn('[hm-music] strudel: destinationGain недоступен — врезка в граф НЕ удалась')
    }

    this.state = 'ready'
    this.ctx = ctx
    this.emitTime = ctx.currentTime + 0.12
    this.emitStep = 0
    this.preset = PRESETS[this.pendingWorld]
    console.debug('[hm-music] strudel-engine-start', 'cps=' + CPS.toFixed(4))
    console.debug('[hm-music] world-preset', this.preset.name)
    // silence until the first update (update switches layers on from the game state)
  }

  /** world change: preset (mode + timbre). Called from engine (setLevel and the eclipse). */
  setWorld(worldIdx: number, _levelIdx: number) {
    this.pendingWorld = Math.max(0, Math.min(PRESETS.length - 1, worldIdx))
    if (this.state !== 'ready') return
    const p = PRESETS[this.pendingWorld]
    if (p !== this.preset) {
      this.preset = p
      console.debug('[hm-music] world-preset', p.name)
      this.lastSig = '' // force a pattern recompile for the new mode
    }
  }

  /** every frame from engine.update: recompute layers, recompile when the set changes */
  update(_dt: number, s: { intensity: number; multiplier: number; hush: number; playing: boolean }) {
    if (this.state !== 'ready') return
    const hushed = s.hush > 0.2
    // same rules and hysteresis as in music.ts
    const pad = s.playing
    const bass = s.playing && !hushed && (this.layers.bass ? s.intensity > 0.15 : s.intensity > 0.22)
    const arp = s.playing && !hushed && s.multiplier >= 2
    const spark = s.playing && !hushed && s.multiplier >= 3

    this.diffLayer('pad', pad); this.diffLayer('bass', bass)
    this.diffLayer('arp', arp); this.diffLayer('spark', spark)
    this.hushed = hushed; this.playing = s.playing

    const sig = `${this.preset.name}|${+pad}${+bass}${+arp}${+spark}|${+hushed}|${+s.playing}`
    if (sig !== this.lastSig) {
      this.lastSig = sig
      this.recompile(pad, bass, arp, spark, hushed, s.playing)
    }

    // mirror the grid of active layers onto the note bus (visuals react in Strudel mode too)
    this.pumpNoteBus(s.playing && !hushed)
  }

  /** parallel beat emitter: publishes onsets of the active layers on the CPS grid */
  private pumpNoteBus(active: boolean) {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    const p = this.preset
    const rootBase = ROOT_MIDI[p.root] ?? 57
    const scale = SCALE_SEMIS[p.scale] ?? SCALE_SEMIS.major
    const midiAt = (oct: number, deg: number) => rootBase + (oct - 3) * 12 + degToSemi(scale, deg)
    while (this.emitTime < now + LOOKAHEAD) {
      const t = this.emitTime
      const step = this.emitStep
      const inBar = ((step % 8) + 8) % 8
      const bar = Math.floor(step / 8)
      // same harmonic grid as in recompile: a chord holds for 2 bars
      const chordIdx = Math.floor(bar / 2) % p.prog.length
      const barInChord = bar % 2
      const cRoot = p.prog[chordIdx]
      if (active) {
        // bass: one note per bar, the chord root, oct 1
        if (this.layers.bass && inBar === 0) {
          noteBus.emit({ layer: 'bass', midi: midiAt(1, cRoot), when: t, dur: 1.1, velocity: barInChord ? 0.7 : 0.9 })
        }
        // melody: 2-3 notes per bar from the chord tones, oct 5 (see seq in recompile)
        if (this.layers.arp) {
          const seqN = p.sparse
            ? (barInChord ? [-1, -1, 2, -1, -1, -1, -1, -1] : [0, -1, -1, -1, 4, -1, -1, -1])
            : (barInChord ? [-1, -1, 0, -1, 2, -1, -1, -1] : [2, -1, -1, 4, -1, -1, -1, -1])
          const d = seqN[inBar]
          if (d >= 0) noteBus.emit({ layer: 'arp', midi: midiAt(5, cRoot + d), when: t, dur: 1, velocity: inBar === 0 ? 0.85 : 0.62 })
        }
        // sparks: one note every 4 bars, oct 6, very rare
        if (this.layers.spark) {
          const b4 = bar % 4
          const hit = p.sparse
            ? (b4 === 3 && inBar === 5 ? 4 : -1)
            : (b4 === 1 && inBar === 4 ? 2 : b4 === 3 && inBar === 5 ? 4 : -1)
          if (hit >= 0) noteBus.emit({ layer: 'spark', midi: midiAt(6, cRoot + hit), when: t, dur: 1.6, velocity: 0.55 })
        }
      }
      this.emitTime += SEC_PER_8
      this.emitStep++
    }
  }

  private diffLayer(name: keyof typeof this.layers, want: boolean) {
    if (this.layers[name] !== want) {
      this.layers[name] = want
      console.debug('[hm-music]', want ? 'layer-on' : 'layer-off', name)
    }
  }

  /** build the stack() code from the active layers and hand it to Strudel (swapped at a cycle boundary) */
  private recompile(pad: boolean, bass: boolean, arp: boolean, spark: boolean, hushed: boolean, playing: boolean) {
    if (!this.mod) return
    // nothing plays outside the game (splash/gameover): silence
    if (!playing) { this.evalCode('silence'); return }

    const p = this.preset
    const sc = (oct: number) => `${p.root}${oct}:${p.scale}`
    const parts: string[] = []
    // HARMONY, the common denominator of all layers: `.add(n(progression))`
    // shifts a part along the scale degrees to the root of the CURRENT chord. So
    // bass, melody and sparks automatically sing the chord instead of wandering
    // over the whole mode (that wandering was the main cause of the mush in the
    // first version).
    const chord = `.add(n("${progPat(p.prog)}"))`

    // pad drone: always on, a triad [0,2,4] over the chord degrees. A long 1.5 s
    // attack and a 2 s tail make chords blend into each other seamlessly. Under
    // hush it gets darker.
    const padCut = hushed ? Math.round(p.padCut * 0.4) : p.padCut
    const padG = hushed ? PAD_G * 0.45 : PAD_G
    parts.push(
      `n("0,2,4")${chord}.scale("${sc(3)}").s("${p.padWave}")` +
      `.attack(1.5).release(2).cutoff(${padCut}).gain(${padG.toFixed(4)})`,
    )

    if (pad && bass) {
      // one note per bar, the chord root (in the second bar sometimes the fifth)
      parts.push(
        `n("<0 [0|2]>")${chord}.scale("${sc(1)}").s("${p.bassWave}")` +
        `.attack(.03).release(1.1).cutoff(300).gain(${BASS_G.toFixed(4)})`,
      )
    }
    if (arp) {
      // a MELODY, not a picket fence of eighths: 2-3 notes per bar, two bars
      // alternating (motif -> its variation), everything else is rests. Tones
      // come only from the chord.
      const seq = p.sparse
        ? '<[0 ~ ~ ~ 4 ~ ~ ~] [~ ~ 2 ~ ~ ~ ~ ~]>'
        : '<[2 ~ ~ 4 ~ ~ ~ ~] [~ ~ 0 ~ ~ 2 ~ ~]>'
      const arpCut = p.gritty ? 2000 : 2800
      parts.push(
        `n("${seq}")${chord}.scale("${sc(5)}").s("${p.arpWave}")` +
        `.attack(.01).release(1).cutoff(${arpCut}).gain(${ARP_G.toFixed(4)})`,
      )
    }
    if (spark) {
      // sparks: one note every 4 bars, very quiet and very high: a luxury, not a bed
      const seq = p.sparse ? '<~ ~ ~ [~ ~ ~ ~ ~ 4 ~ ~]>' : '<~ [~ ~ ~ 2 ~ ~ ~ ~] ~ [~ ~ ~ ~ ~ 4 ~ ~]>'
      parts.push(
        `n("${seq}")${chord}.scale("${sc(6)}").s("${p.sparkWave}")` +
        `.attack(.01).release(1.6).cutoff(7000).gain(${SPARK_G.toFixed(4)})`,
      )
    }
    if (p.gritty && bass) {
      // Разлом: chaos comes from RHYTHM and timbre, dull low hits, no tritones.
      // A dissonant melody read as a bug, a hit reads as character.
      parts.push(
        `note("b1 ~ ~ ~ ~ <b1 ~> ~ ~").s("sine")` +
        `.attack(.006).release(.24).cutoff(150).gain(${PERC_G.toFixed(4)})`,
      )
    }

    const code = `setcps(${CPS})\nstack(\n  ${parts.join(',\n  ')}\n)`
    this.evalCode(code)
  }

  /** serialize evaluate: Strudel does not like racing recompiles */
  private evalCode(code: string) {
    if (!this.mod) return
    if (this.evaluating) { this.pendingSig = code; return }
    this.evaluating = true
    const run = (c: string) => {
      const done = () => {
        this.evaluating = false
        if (this.pendingSig && this.pendingSig !== c) {
          const next = this.pendingSig; this.pendingSig = null; this.evaluating = true; run(next)
        } else { this.pendingSig = null }
      }
      if (c === 'silence') {
        try { this.mod!.hush() } catch { /* ok */ }
        done(); return
      }
      this.mod!.evaluate(c).then(done, (e: unknown) => { console.warn('[hm-music] strudel eval error:', e); done() })
    }
    run(code)
  }

  /** engine.destroy(): stop Strudel, release the submix */
  stop() {
    if (this.mod) { try { this.mod.hush() } catch { /* ok */ } }
    if (this.strudelGain) { try { this.strudelGain.disconnect() } catch { /* ok */ } this.strudelGain = null }
    if (this.state === 'ready') console.debug('[hm-music] strudel-engine-stop')
    this.state = 'failed' // no re-init after destroy
  }
}
