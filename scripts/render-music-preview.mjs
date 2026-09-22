#!/usr/bin/env node
// render-music-preview.mjs — offline render of the HM2 generative music into WAV,
// so the author can LISTEN to it with his ears without launching the game.
//
// The render is honest: we do not rewrite the formulas "roughly the same way", we
// run the REAL src/music.ts. How:
//   1) esbuild bundles src/music.ts (+ notebus.ts) into an ESM module — same code;
//   2) node-web-audio-api gives an OfflineAudioContext with the same Web Audio nodes;
//   3) ctx is wrapped in a Proxy whose currentTime is our VIRTUAL clock: we advance
//      it in 1/60 s frames and call music.update(dt, state) exactly the way
//      engine.update does. The lookahead scheduler notices nothing.
//   4) the master chain is reproduced from sound.ts one to one:
//      musicGain -> duck(lowpass 16k, Q .4) -> dip(1.0) -> master(0.5)
//                -> compressor(thr -14, ratio 4, atk .004, rel .24) -> out
//
// Run:     node scripts/render-music-preview.mjs
// Output:  hm2/превью-музыки/мир{1..5}-{calm,mid,storm}.wav (25 s each)
//          hm2/превью-музыки/мир1-рост.wav (40 s: calm -> storm and back to calm)
//
// Mix debugging:  node scripts/render-music-preview.mjs --solo=bass --world=1
//   (renders one layer into a separate file: that is how layer levels are measured
//    with astats)
//
// Flags:     --enigma  turns on the Enigma layer (same as ?music=enigma in the game),
//            --menu=1  adds the MENU THEME (otherwise impossible to listen to),
//            --worlds= --modes= --seconds= --growth=0  — pick a subset.
//   Example: node scripts/render-music-preview.mjs --enigma \
//              --out=public/превью-музыки --suffix=-enigma \
//              --worlds=1,2,4 --modes=storm --seconds=45 --menu=1 --menuseconds=45 --growth=0

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'превью-музыки')
const SR = 44100
const FPS = 60
// In the game the music sits UNDER the events (peaks ~ -19 dBFS, RMS ~ -38 dBFS):
// right there, but barely audible in a player. So the preview file is raised by a
// FIXED +16 dB, equally for every clip, which keeps the RATIOS as in the game (calm
// quieter than storm, bass against melody) — the mix can still be judged.
// The report prints the IN-GAME numbers (before this gain) and the file ones (after).
const PREVIEW_DB = 16
const PREVIEW_GAIN = Math.pow(10, PREVIEW_DB / 20)

// ── dependencies ───────────────────────────────────────────────────────────
// node-web-audio-api is the only external thing. We look for it in the project, then
// in a scratch folder, then via NODE_PATH; if it is missing we explain how to install.
function loadWebAudio() {
  const candidates = [
    path.join(ROOT, 'node_modules'),
    process.env.HM2_WEBAUDIO_MODULES || '',
  ].filter(Boolean)
  for (const dir of candidates) {
    const entry = path.join(dir, 'node-web-audio-api', 'index.cjs')
    const pkg = path.join(dir, 'node-web-audio-api', 'package.json')
    if (fs.existsSync(entry) || fs.existsSync(pkg)) {
      return createRequire(path.join(dir, 'x.cjs'))('node-web-audio-api')
    }
  }
  try { return createRequire(import.meta.url)('node-web-audio-api') } catch { /* handled below */ }
  console.error(
    'Нет пакета node-web-audio-api. Поставь его разово (в package.json не пишем):\n' +
    '  npm install --no-save --no-package-lock node-web-audio-api\n' +
    'или укажи путь: HM2_WEBAUDIO_MODULES=/путь/к/node_modules node scripts/render-music-preview.mjs')
  process.exit(1)
}

// ── bundling the real music.ts ─────────────────────────────────────────────
async function buildEngineModule() {
  const esbuild = createRequire(path.join(ROOT, 'node_modules', 'x.cjs'))('esbuild')
  const outfile = path.join(os.tmpdir(), `hm2-music-${process.pid}.mjs`)
  await esbuild.build({
    // one bundle for both modules: noteBus must be THE SAME instance music.ts sees
    // (otherwise --notes catches nothing)
    stdin: {
      contents: "export { MusicEngine, makeIR, rt60Of } from './src/music'\n"
        + "export { SoundEngine } from './src/sound'\n"
        + "export { noteBus } from './src/notebus'\n",
      resolveDir: ROOT, loader: 'ts', sourcefile: 'preview-entry.ts',
    },
    bundle: true, format: 'esm', platform: 'neutral', target: 'es2020',
    outfile, logLevel: 'error',
  })
  return outfile
}

// ── state profiles (as engine.update sees them) ────────────────────────────
// calm  — just started or just missed: pad + a skeleton of bass, lots of air
// mid   — a streak is going (x2): the melody joins in
// storm — the player is on fire (x4): everything, including the sparks
// menu  — splash/game over/finale: the engine sends playing:false and music.ts plays
//         the quiet menu theme. It enters after MENU_DELAY seconds.
const PROFILES = {
  calm: () => ({ intensity: 0.26, multiplier: 1, hush: 0, playing: true }),
  mid: () => ({ intensity: 0.6, multiplier: 2, hush: 0, playing: true }),
  storm: () => ({ intensity: 1, multiplier: 4, hush: 0, playing: true }),
  menu: () => ({ intensity: 0, multiplier: 0, hush: 0, playing: false }),
}

/** the "flight": 40 s of one world — calm -> streak -> storm -> breathing back to calm */
function growth(t, total) {
  const x = t / total
  // intensity: 0 -> 1 by 70 % of the clip, then a decline (like intensityTarget in the engine)
  const intensity = x < 0.7 ? Math.min(1, x / 0.7) : Math.max(0.15, 1 - (x - 0.7) / 0.3)
  const multiplier = intensity > 0.72 ? 4 : intensity > 0.34 ? 2 : 1
  return { intensity, multiplier, hush: 0, playing: true }
}

// ── render one clip ────────────────────────────────────────────────────────
async function render({ MusicEngine, OfflineAudioContext, worldIdx, seconds, stateAt, solo, voices }) {
  const ctx = new OfflineAudioContext(2, Math.round(SR * seconds), SR)

  // the sound.ts master chain (see SoundEngine.unlock)
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14; comp.ratio.value = 4
  comp.attack.value = 0.004; comp.release.value = 0.24
  comp.connect(ctx.destination)
  const master = ctx.createGain(); master.gain.value = 0.5
  master.connect(comp)
  const dip = ctx.createGain(); dip.gain.value = 1; dip.connect(master)
  const duck = ctx.createBiquadFilter()
  duck.type = 'lowpass'; duck.frequency.value = 16000; duck.Q.value = 0.4
  duck.connect(dip)
  // soft in/out: a preview must not click at the edges of the file
  master.gain.setValueAtTime(0.0001, 0)
  master.gain.exponentialRampToValueAtTime(0.5, 0.6)
  master.gain.setValueAtTime(0.5, Math.max(0.7, seconds - 2))
  master.gain.exponentialRampToValueAtTime(0.0001, seconds - 0.05)

  // virtual clock: the engine thinks it lives in real time
  let now = 0
  // ── VOICE DENSITY. We wrap the source factories and record [start, stop] of
  //    every voice. From those spans we count HOW MANY voices sound at the same
  //    time: a "rich or poor" metric that cannot be obtained from the finished WAV,
  //    where all voices have already summed into one signal.
  const spans = []
  const wrapSrc = (make) => () => {
    const node = make()
    let s0 = 0
    const realStart = node.start.bind(node)
    const realStop = node.stop.bind(node)
    node.start = (t = now) => { s0 = t; realStart(t) }
    node.stop = (t = now) => { spans.push([s0, t]); realStop(t) }
    return node
  }
  const clock = new Proxy(ctx, {
    get(target, key) {
      if (key === 'currentTime') return now
      const v = Reflect.get(target, key)
      if (typeof v !== 'function') return v
      const bound = v.bind(target)
      if (voices && (key === 'createOscillator' || key === 'createBufferSource')) return wrapSrc(bound)
      return bound
    },
  })
  // SoundEngine stub: the music only needs the bus and the key handshake from it
  // (setMusicKey is music.ts telling sound.ts the mode for the skip whoosh)
  const fakeSound = { musicBus: () => ({ ctx: clock, dest: duck }), setMusicKey: () => {} }

  const music = new MusicEngine(fakeSound)
  music.ensureStarted()
  music.setWorld(worldIdx, worldIdx * 4) // motif seed = the first level of the world

  const dt = 1 / FPS
  const frames = Math.floor(seconds / dt)
  const soloGains = {
    pad: 'padGain', bass: 'bassGain', arp: 'arpGain', spark: 'sparkGain', perc: 'percGain',
    choir: 'choirGain', breath: 'breathGain', // Enigma layers (exist only behind the flag)
  }
  for (let i = 0; i < frames; i++) {
    now = i * dt
    music.update(dt, stateAt(now, seconds))
    if (solo) {
      // solo mode for measurements: mute every layer but one, AFTER update
      for (const [name, field] of Object.entries(soloGains)) {
        if (name === solo) continue
        const g = music[field]
        if (g) { g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(0.0001, now) }
      }
    }
  }
  const buf = await ctx.startRendering()
  if (voices) buf.__voices = voiceDensity(spans, seconds)
  return buf
}

/** average and peak VOICE DENSITY: how many sources sound at the same time.
 *  Computed from the [start, stop] spans on a 20 ms grid. */
function voiceDensity(spans, seconds) {
  const step = 0.02
  const n = Math.ceil(seconds / step)
  const cnt = new Int32Array(n)
  for (const [a, b] of spans) {
    const i0 = Math.max(0, Math.floor(a / step))
    const i1 = Math.min(n, Math.ceil(Math.min(b, seconds) / step))
    for (let i = i0; i < i1; i++) cnt[i]++
  }
  let sum = 0, max = 0
  for (let i = 0; i < n; i++) { sum += cnt[i]; if (cnt[i] > max) max = cnt[i] }
  return { avg: sum / n, max, total: spans.length }
}

// ── render SFX ON TOP of the music (to hear an effect in context) ──────────
// Here the REAL SoundEngine from src/sound.ts runs: it is fed a global
// window.AudioContext that returns our offline context with the same virtual clock.
// So what you hear is exactly the in-game mix: SFX and music in one chain
// duck -> dip -> master -> compressor.
async function renderSfx({ MusicEngine, SoundEngine, OfflineAudioContext, worldIdx, seconds, events, noMusic }) {
  const ctx = new OfflineAudioContext(2, Math.round(SR * seconds), SR)
  let now = 0
  const clock = new Proxy(ctx, {
    get(target, key) {
      if (key === 'currentTime') return now
      // PORTABILITY (macOS + node-web-audio-api 2.2.0): here the offline context
      // reports state='suspended', so SoundEngine.unlock honestly calls ctx.resume(),
      // which is right in a browser (autoplay policy) but HANGS on an offline
      // context and the render comes out silent (-inf dBFS). We lie about this one
      // field so the engine itself stays unmodified.
      if (key === 'state') return 'running'
      const v = Reflect.get(target, key)
      return typeof v === 'function' ? v.bind(target) : v
    },
  })
  globalThis.window = { AudioContext: function () { return clock } }
  // The storage stub must be KEY DEPENDENT: sound.ts has volume steps
  // (hm2.vol.music / hm2.vol.sfx) where '0' means "off", while for hm2.mute '0'
  // means "not muted". A stub returning '0' for ANY key renders silence.
  globalThis.localStorage = {
    getItem: (k) => (k === 'hm2.mute' ? '0' : String(k).startsWith('hm2.vol.') ? '1' : null),
    setItem: () => {},
  }

  const snd = new SoundEngine()
  snd.unlock()
  const music = new MusicEngine(snd)
  music.ensureStarted()
  music.setWorld(worldIdx, worldIdx * 4)

  const dt = 1 / FPS
  const frames = Math.floor(seconds / dt)
  const fired = new Set()
  for (let i = 0; i < frames; i++) {
    now = i * dt
    music.update(dt, noMusic ? { intensity: 0, multiplier: 0, hush: 1, playing: false } : PROFILES.mid())
    for (let k = 0; k < events.length; k++) {
      if (fired.has(k) || events[k].at > now) continue
      fired.add(k); events[k].fire(snd)
    }
  }
  return ctx.startRendering()
}

// ── WAV (PCM 16 bit) ───────────────────────────────────────────────────────
function toWav(buffer) {
  const ch = buffer.numberOfChannels
  const n = buffer.length
  const data = Buffer.alloc(n * ch * 2)
  const chans = []
  for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c))
  let peak = 0
  let sumSq = 0
  let clipped = 0
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const raw = chans[c][i] // the in-game level (what is heard in the game)
      const a = Math.abs(raw)
      if (a > peak) peak = a
      sumSq += raw * raw
      const out = raw * PREVIEW_GAIN // the level of the preview file
      if (Math.abs(out) >= 0.999) clipped++
      const s = Math.max(-1, Math.min(1, out))
      data.writeInt16LE(Math.round(s * 32767), (i * ch + c) * 2)
    }
  }
  const head = Buffer.alloc(44)
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8)
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20)
  head.writeUInt16LE(ch, 22); head.writeUInt32LE(SR, 24)
  head.writeUInt32LE(SR * ch * 2, 28); head.writeUInt16LE(ch * 2, 32); head.writeUInt16LE(16, 34)
  head.write('data', 36); head.writeUInt32LE(data.length, 40)
  const rms = Math.sqrt(sumSq / (n * ch))
  return { wav: Buffer.concat([head, data]), peak, rms, clipped }
}

const dbOf = (x) => (x <= 0 ? -Infinity : 20 * Math.log10(x))

// ── main ───────────────────────────────────────────────────────────────────
const argv = Object.fromEntries(process.argv.slice(2)
  .filter((a) => a.startsWith('--'))
  .map((a) => { const [k, v = '1'] = a.slice(2).split('='); return [k, v] }))

// ── THE ENIGMA FLAG ────────────────────────────────────────────────────────
// `--enigma` turns on the same layer as `?music=enigma` in the browser. The engine
// reads the flag from globalThis.HM_VIBE (the handshake with src/vibe.ts, see
// readEnigmaFlag in music.ts), so here it is enough to set the global BEFORE
// creating MusicEngine. No copies of formulas: the same code is rendered.
if (argv.enigma) globalThis.HM_VIBE = { enigmaMusic: true }

// ── THE AUDIO QUALITY STEP ─────────────────────────────────────────────────
// `--audio=rich|mid|lite` renders the same engine with the audio-graph budget from
// quality.ts. Exactly the same trick as --enigma: the global is set BEFORE importing
// the bundle, and quality.ts reads it when its singleton is created. Needed for an
// A/B check that the rich path is not too heavy and the cheap path is not a stump.
if (argv.audio) globalThis.HM_AUDIO = argv.audio

const { OfflineAudioContext } = loadWebAudio()
const modFile = await buildEngineModule()
const { MusicEngine, SoundEngine, noteBus, makeIR, rt60Of } = await import('file://' + modFile)

// the engine logs every bar: in the render console that is just noise
console.debug = () => {}

fs.mkdirSync(OUT_DIR, { recursive: true })
const report = []

let usedDir = OUT_DIR // where the files really landed (for an honest final message)
async function one(name, worldIdx, seconds, stateAt, dir = OUT_DIR, solo = null) {
  usedDir = dir
  const buf = await render({ MusicEngine, OfflineAudioContext, worldIdx, seconds, stateAt, solo, voices: !!argv.voices })
  const { wav, peak, rms, clipped } = toWav(buf)
  const file = path.join(dir, name + '.wav')
  fs.writeFileSync(file, wav)
  report.push({ name, peak, rms, clipped, seconds })
  const vd = buf.__voices
  console.log(
    `${name.padEnd(22)} ${String(seconds).padStart(2)}s | в игре: peak ${dbOf(peak).toFixed(1)} ` +
    `rms ${dbOf(rms).toFixed(1)} dBFS | в файле (+${PREVIEW_DB}дБ): peak ` +
    `${(dbOf(peak) + PREVIEW_DB).toFixed(1)} rms ${(dbOf(rms) + PREVIEW_DB).toFixed(1)} dBFS | clip ${clipped}` +
    (vd ? ` | голосов ср.${vd.avg.toFixed(1)} макс.${vd.max} всего ${vd.total}` : ''))
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const noteName = (m) => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1)

if (argv.ir) {
  // ── --ir prints the honest RT60 of the synthesized halls.
  //    Measured not "by ear on the music" (there a note decay is indistinguishable
  //    from the hall decay) but on the impulse itself, by Schroeder backward
  //    integration, T20 -> T60. It is the same makeIR the game uses: imported, not
  //    copied.
  const ctx = new OfflineAudioContext(2, SR, SR)
  // the hall presets live inside music.ts; only their names are repeated here
  const spaces = [
    ['мир1 Тёплый Счёт', { sec: 2.1, pre: 0.018, damp: 5200, dampFall: 5, early: 0.30 }],
    ['мир2 Иней', { sec: 3.1, pre: 0.028, damp: 8000, dampFall: 3, early: 0.34 }],
    ['мир3 Вихрь', { sec: 2.4, pre: 0.022, damp: 6400, dampFall: 4, early: 0.40 }],
    ['мир4 Разлом', { sec: 1.9, pre: 0.012, damp: 3200, dampFall: 7, early: 0.44 }],
    ['мир5 Ясность', { sec: 3.6, pre: 0.038, damp: 7000, dampFall: 3.5, early: 0.26 }],
    ['Enigma (собор)', { sec: 4.2, pre: 0.055, damp: 7500, dampFall: 3, early: 0.22 }],
  ]
  console.log('зал'.padEnd(20), 'задано  измерено (Шрёдер T20→T60)  корреляция каналов')
  for (const [name, sp] of spaces) {
    const ir = makeIR(ctx, sp)
    const L = ir.getChannelData(0), R = ir.getChannelData(1)
    let ll = 0, rr = 0, lr = 0
    for (let i = 0; i < ir.length; i++) { ll += L[i] * L[i]; rr += R[i] * R[i]; lr += L[i] * R[i] }
    const corr = lr / Math.sqrt(ll * rr)
    console.log(name.padEnd(20), `${sp.sec.toFixed(1)} с`.padStart(6),
      `${rt60Of(ir).toFixed(2)} с`.padStart(24), corr.toFixed(3).padStart(18))
  }
} else if (argv.notes) {
  // --notes: print the score (what the engine will play and when), which shows the
  // melody is A MOTIF WITH VARIATIONS and not random notes from the scale
  const w = Number(argv.world || 1) - 1
  const seconds = Number(argv.seconds || 20)
  const rows = []
  noteBus.on((e) => rows.push(e))
  await render({ MusicEngine, OfflineAudioContext, worldIdx: w, seconds, stateAt: PROFILES.storm })
  const BAR = 60 / 100 * 4
  for (const e of rows.sort((a, b) => a.when - b.when)) {
    const bar = Math.floor(e.when / BAR)
    console.log(
      `т.${String(bar + 1).padStart(2)} +${(e.when % BAR).toFixed(2)}с  ` +
      `${e.layer.padEnd(5)} ${noteName(e.midi).padEnd(4)} vel ${e.velocity.toFixed(2)}`)
  }
} else if (argv.sfx) {
  // --sfx: "the skip sound in context" — the music of a world plus taps and skips.
  // Event order: a tap (as a loudness reference), skip, skip, a quiet skip.
  const dir = argv.out ? path.resolve(argv.out) : OUT_DIR
  const sfx = argv.suffix || ''
  fs.mkdirSync(dir, { recursive: true })
  usedDir = dir // the --sfx branch used to print OUT_DIR while writing into --out
  for (const w of [0, 1, 3]) { // warm / icy / dark: three different keys
    const events = [
      { at: 2.0, fire: (s) => s.tapGood(3) },
      { at: 3.6, fire: (s) => s.skip() },
      { at: 5.4, fire: (s) => s.tapGood(6) },
      { at: 7.0, fire: (s) => s.skip() },
      { at: 8.6, fire: (s) => s.skip(0.5) }, // a passive skip (the surprise floated away)
      { at: 10.4, fire: (s) => s.skip() },
    ]
    const name = `скип-мир${w + 1}${sfx}`
    const buf = await renderSfx({ MusicEngine, SoundEngine, OfflineAudioContext, worldIdx: w, seconds: 13, events, noMusic: !!argv.nomusic })
    const { wav, peak, rms, clipped } = toWav(buf)
    fs.writeFileSync(path.join(dir, name + '.wav'), wav)
    console.log(`${name.padEnd(22)} 13s | в игре: peak ${dbOf(peak).toFixed(1)} rms ${dbOf(rms).toFixed(1)} dBFS | clip ${clipped}`)
  }
} else if (argv.vehi) {
  // --vehi: COMBO MILESTONES AND THE RECORD. First a normal correct tap, which
  // serves as the ruler here: a milestone must be noticeably louder than the reward
  // for a move, but must NOT deafen (acceptance ceiling: peak <= -10 dBFS). Then four
  // milestones in ascending order and the congratulation on a new record.
  //   --nomusic  — sounds only, without the music bed (clean event metrics)
  //   --world=N  — in which key (a milestone is built from the current world's mode)
  const dir = argv.out ? path.resolve(argv.out) : OUT_DIR
  const sfx = argv.suffix || ''
  fs.mkdirSync(dir, { recursive: true })
  usedDir = dir
  const only = argv.world ? [Number(argv.world) - 1] : [0, 3]
  for (const w of only) {
    const events = [
      { at: 1.6, fire: (s) => s.tapGood(4) },       // the ruler: an ordinary reward
      { at: 3.0, fire: (s) => s.comboMilestone(0) }, // 10×
      { at: 5.0, fire: (s) => s.comboMilestone(1) }, // 25×
      { at: 7.0, fire: (s) => s.comboMilestone(2) }, // 50×
      { at: 9.0, fire: (s) => s.comboMilestone(3) }, // 100×
      { at: 11.5, fire: (s) => s.comboRecord() },    // a new streak record
    ]
    const name = `вехи-мир${w + 1}${sfx}`
    const buf = await renderSfx({ MusicEngine, SoundEngine, OfflineAudioContext, worldIdx: w, seconds: 14, events, noMusic: !!argv.nomusic })
    const { wav, peak, rms, clipped } = toWav(buf)
    fs.writeFileSync(path.join(dir, name + '.wav'), wav)
    console.log(`${name.padEnd(22)} 14s | в игре: peak ${dbOf(peak).toFixed(1)} rms ${dbOf(rms).toFixed(1)} dBFS | clip ${clipped}`)
  }
} else if (argv.solo) {
  const w = Number(argv.world || 1) - 1
  const dir = argv.out ? path.resolve(argv.out) : OUT_DIR
  fs.mkdirSync(dir, { recursive: true })
  await one(`solo-мир${w + 1}-${argv.solo}`, w, 16, PROFILES.storm, dir, argv.solo)
} else {
  // --out=path and --suffix=-v2 make a new version land next to the old one (in
  // public/превью-музыки for the PLAYER page) instead of silently overwriting it.
  // Subset selection exists because Enigma clips are long and rendering all 16 is
  // pointless; --menu renders the MENU THEME, which otherwise cannot be heard
  // outside the game at all.
  //   --worlds=1,2,4   which worlds (all five by default)
  //   --modes=storm    which intensities (calm,mid,storm by default)
  //   --seconds=40     clip length (an Enigma cycle needs 38.4 s)
  //   --menu=1         add the menu theme (--menuworld=1, --menuseconds=…)
  //   --growth=0       do not render the 40-second "flight"
  const dir = argv.out ? path.resolve(argv.out) : OUT_DIR
  const sfx = argv.suffix || ''
  fs.mkdirSync(dir, { recursive: true })
  const secs = Number(argv.seconds || 25)
  // `--worlds=none` / `--modes=none` mean "none of those": needed when rendering
  // ONE menu theme without waiting for sixteen clips
  const listOf = (s) => (s === 'none' || s === '-' ? [] : String(s).split(',').filter(Boolean))
  const worlds = listOf(argv.worlds || '1,2,3,4,5').map((n) => Number(n) - 1)
  const modes = listOf(argv.modes || 'calm,mid,storm')
  for (const w of worlds) {
    for (const mode of modes) {
      await one(`мир${w + 1}-${mode}${sfx}`, w, secs, PROFILES[mode], dir)
    }
  }
  if (argv.menu) {
    await one(`меню${sfx}`, Number(argv.menuworld || 1) - 1,
      Number(argv.menuseconds || secs), PROFILES.menu, dir)
  }
  if (argv.growth !== '0') await one(`мир1-рост${sfx}`, 0, 40, growth, dir)
}

fs.rmSync(modFile, { force: true })
console.log('\nготово →', usedDir)
