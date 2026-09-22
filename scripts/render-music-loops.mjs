#!/usr/bin/env node
// render-music-loops.mjs — PRODUCTION MUSIC LOOPS for the mobile build.
//
// WHY. On a phone the WebView audio thread cannot carry live synthesis (Andrey:
// «звук прям плавает»). The author's decision: keep live generation on the web,
// play PRE-RENDERED audio on the phone. This script bakes those recordings with
// THE SAME engine src/music.ts — not with "similar formulas", but with the game's
// own code, offline.
//
// HOW IT DIFFERS FROM render-music-preview.mjs:
//   1) 48 kHz (previews use 44.1): the native rate of the Android AudioContext;
//   2) NO edge fades and NO +16 dB "so it is audible in a player": the file must
//      butt against itself sample for sample, and the level is restored by an
//      inverse gain in the loop engine (STORE_DB);
//   3) determinism: Math.random is replaced by a seeded PRNG, so the three
//      intensities of one world come out aligned SAMPLE FOR SAMPLE — the whole
//      layer crossfade rests on that (see src/music-loops.ts);
//   4) the frequencies of free-running LFOs (pad chorus, choir vibrato) are
//      snapped to a WHOLE number of periods per cycle, otherwise the seam catches
//      a jump of the delay phase;
//   5) EXACTLY a whole number of form cycles is cut (2 harmony cycles = 128 steps
//      = 38.4 s; in Enigma the chord is twice as long -> 256 steps = 76.8 s), and
//      the THIRD cycle is taken: by then all hall tails and all setTargetAtTime
//      ramps have settled, so x(t) == x(t+L) and there is no seam by construction.
//
// Run:
//   node scripts/render-music-loops.mjs                 # everything: 5 worlds x 3 + 5 menu
//   node scripts/render-music-loops.mjs --worlds=1 --modes=storm --menu=0
//   node scripts/render-music-loops.mjs --enigma --worlds=5 --menuworld=1
//   node scripts/render-music-loops.mjs --codec=vorbis --kbps=128
//   node scripts/render-music-loops.mjs --wav                # also a WAV next to it (to listen)
//
// Output: public/музыка-лупы/<name>.ogg + manifest.json + a measurement report in the console.

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SR = 48000
const FPS = 60
const SEC_PER_8 = 60 / 100 / 2 // BPM 100, 1/8 step -> 0.3 s (music.ts:130)
const STEPS_PER_CYCLE = 64 // music.ts:135 — the harmony cycle
const ENIGMA_CHORD_MUL = 2 // music.ts:411
/** how many harmony cycles are in a LOOP. The musical form (round()/formPhase())
 *  lives in TWO cycles: "the theme stated" and "the same, but fuller" (music.ts:875).
 *  A loop shorter than two cycles would bring back the flat wall of sound. */
const CYCLES_PER_LOOP = 2
/** how many cycles are played as a warm-up before cutting. The longest hall tail
 *  is 4.2 s (ENIGMA_SPACE) and setTargetAtTime ramps settle in seconds; two cycles
 *  (76.8 s) is a twentyfold margin. */
const PREROLL_LOOPS = Number(process.env.HM2_PREROLL || 2)

/** storage level: in the game the music sits UNDER the events (peak -17..-26 dBFS).
 *  Such a quiet signal is wasteful for the codec, half of its dynamics idles. We
 *  raise it by a fixed +14 dB EQUALLY for all files (the balance between layers and
 *  worlds does not change), and the loop engine divides it back. Headroom check:
 *  the loudest clip is -17.5 dBFS + 14 = -3.5 dBFS, no clipping. */
const STORE_DB = 14
const STORE_GAIN = Math.pow(10, STORE_DB / 20)

const argv = Object.fromEntries(process.argv.slice(2)
  .filter((a) => a.startsWith('--'))
  .map((a) => { const [k, v = '1'] = a.slice(2).split('='); return [k, v] }))

const ENIGMA = !!argv.enigma
if (ENIGMA) globalThis.HM_VIBE = { enigmaMusic: true }
// loops are baked at the RICHEST quality step: CPU is free here, and the phone does
// not care afterwards — it just reads a ready file (that was the whole point)
globalThis.HM_AUDIO = 'rich'
globalThis.localStorage = { getItem: () => null, setItem: () => {} }

const STEPS_PER_CYCLE_EFF = STEPS_PER_CYCLE * (ENIGMA ? ENIGMA_CHORD_MUL : 1)
const LOOP_SEC = STEPS_PER_CYCLE_EFF * CYCLES_PER_LOOP * SEC_PER_8
const LOOP_N = Math.round(LOOP_SEC * SR)
/** step 0 is scheduled at ensureStarted() + 0.12 s (music.ts:915) */
const GRID0 = 0.12

const OUT_DIR = path.resolve(argv.out || path.join(ROOT, 'public', 'музыка-лупы'))
const CODEC = (argv.codec || 'opus').toLowerCase()
const KBPS = Number(argv.kbps || (CODEC === 'opus' ? 96 : 112))

// ── ffmpeg ─────────────────────────────────────────────────────────────────
// ffmpeg-static is installed into a scratch folder (not written into package.json):
//   npm install --no-save ffmpeg-static
// The path can be set by hand: HM2_FFMPEG=/path/to/ffmpeg
function findFfmpeg() {
  if (process.env.HM2_FFMPEG) return process.env.HM2_FFMPEG
  for (const dir of [path.join(ROOT, 'node_modules'), process.env.HM2_FFMPEG_MODULES || '']) {
    if (!dir) continue
    const p = path.join(dir, 'ffmpeg-static', 'ffmpeg')
    if (fs.existsSync(p)) return p
  }
  try { return execFileSync('which', ['ffmpeg']).toString().trim() } catch { /* handled below */ }
  console.error('Нет ffmpeg. Поставь ffmpeg-static в скретчпад и укажи путь:\n' +
    '  npm install --no-save ffmpeg-static\n' +
    '  HM2_FFMPEG=<скретчпад>/node_modules/ffmpeg-static/ffmpeg node scripts/render-music-loops.mjs')
  process.exit(1)
}
const FFMPEG = findFfmpeg()

// ── node-web-audio-api ─────────────────────────────────────────────────────
function loadWebAudio() {
  const dirs = [path.join(ROOT, 'node_modules'), process.env.HM2_WEBAUDIO_MODULES || ''].filter(Boolean)
  for (const dir of dirs) {
    if (fs.existsSync(path.join(dir, 'node-web-audio-api', 'package.json'))) {
      return createRequire(path.join(dir, 'x.cjs'))('node-web-audio-api')
    }
  }
  try { return createRequire(import.meta.url)('node-web-audio-api') } catch { /* handled below */ }
  console.error('Нет node-web-audio-api:\n  npm install --no-save node-web-audio-api\n' +
    'или HM2_WEBAUDIO_MODULES=/путь/к/node_modules')
  process.exit(1)
}

// ── bundling the real music.ts (same trick as in render-music-preview) ─────
async function buildEngineModule() {
  const esbuild = createRequire(path.join(ROOT, 'node_modules', 'x.cjs'))('esbuild')
  const outfile = path.join(os.tmpdir(), `hm2-loops-${process.pid}.mjs`)
  await esbuild.build({
    stdin: {
      contents: "export { MusicEngine } from './src/music'\n",
      resolveDir: ROOT, loader: 'ts', sourcefile: 'loops-entry.ts',
    },
    bundle: true, format: 'esm', platform: 'neutral', target: 'es2020',
    outfile, logLevel: 'error',
  })
  return outfile
}

// ── determinism: a seeded PRNG instead of Math.random ──────────────────────
// Math.random is used in exactly two places in music.ts: the hall impulse (makeIR)
// and the noise buffer. Both are called while building the graph, in the same
// order. We reset the seed before EVERY render, so the three intensities of one
// world get the same hall and the same noise, and therefore mix perfectly.
const REAL_RANDOM = Math.random
function seedRandom(seed) {
  let a = (seed >>> 0) || 1
  Math.random = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── state profiles (the same as in render-music-preview.mjs) ───────────────
const PROFILES = {
  calm: { intensity: 0.26, multiplier: 1, hush: 0, playing: true },
  mid: { intensity: 0.6, multiplier: 2, hush: 0, playing: true },
  storm: { intensity: 1, multiplier: 4, hush: 0, playing: true },
  menu: { intensity: 0, multiplier: 0, hush: 0, playing: false },
}

/** snap a free-running LFO frequency to a whole number of periods per cycle.
 *  The pad chorus sways at 0.13 and 0.21 Hz, and 38.4 s is not divisible by those,
 *  so at the seam the delay would jump by a couple of milliseconds. A shift of
 *  0.16 % and 0.8 % is inaudible, and the seam becomes honestly periodic. */
const snapHz = (hz, loopSec) => Math.max(1, Math.round(hz * loopSec)) / loopSec

async function renderOne({ MusicEngine, OfflineAudioContext, worldIdx, levelIdx, profile }) {
  const total = GRID0 + (PREROLL_LOOPS + 1) * LOOP_SEC + 0.25
  const ctx = new OfflineAudioContext(2, Math.round(SR * total), SR)

  // the sound.ts master chain one to one (SoundEngine.unlock), but WITHOUT fades:
  // the loop must start and end exactly where the cycle ends
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

  let now = 0
  const clock = new Proxy(ctx, {
    get(target, key) {
      if (key === 'currentTime') return now
      const v = Reflect.get(target, key)
      return typeof v === 'function' ? v.bind(target) : v
    },
  })
  const fakeSound = { musicBus: () => ({ ctx: clock, dest: duck }), setMusicKey: () => {} }

  seedRandom(0x484D3202) // fixed seed: one hall for all intensities of a world
  const music = new MusicEngine(fakeSound)
  music.ensureStarted()
  music.setWorld(worldIdx, levelIdx)

  // ── PERIODICITY OF THE FREE-RUNNING LFOs (see snapHz) ────────────────────
  for (const l of music.chorusLfo || []) l.frequency.setValueAtTime(snapHz(l.frequency.value, LOOP_SEC), 0)
  if (music.choirLfo) music.choirLfo.frequency.setValueAtTime(snapHz(music.choirLfo.frequency.value, LOOP_SEC), 0)
  // the pad breathes at BPM/60/4 = 0.41667 Hz: exactly 16 periods per cycle, nothing to fix

  const dt = 1 / FPS
  const frames = Math.floor(total / dt)
  for (let i = 0; i < frames; i++) {
    now = i * dt
    music.update(dt, profile)
  }
  const buf = await ctx.startRendering()
  Math.random = REAL_RANDOM
  return buf
}

const dbOf = (x) => (x <= 0 ? -Infinity : 20 * Math.log10(x))

/** HEAD SPLICE (8 ms). Ordinary worlds are periodic down to -67 dB even without it,
 *  but Enigma is not: its form has a period TWICE as long as two harmony cycles
 *  (measured: cycle N matches cycle N-2 sample for sample, but cycle N-1 only down
 *  to -36 dB). The cure is not doubling the file (2.9 MB and 29 MB of RAM per
 *  buffer) but an honest splice: the first F samples of the loop are crossfaded
 *  from the "head of cycle N" to the "head of cycle N+1", i.e. to WHAT ACTUALLY
 *  FOLLOWED the tail we hand out at the end. Then the pair (last sample -> first)
 *  becomes an ordinary neighbouring pair of the signal, and there is no gap by
 *  construction. For ordinary worlds the splice is an identity (there the signals
 *  differ by -67 dB). */
const XFADE_MS = Number(process.env.HM2_LOOP_XFADE_MS || 8)

/** cut out the third cycle, plus seam and periodicity measurements */
function cutLoop(buf) {
  const ch = buf.numberOfChannels
  const src = []
  for (let c = 0; c < ch; c++) src.push(buf.getChannelData(c))
  const off3 = Math.round((GRID0 + PREROLL_LOOPS * LOOP_SEC) * SR) // start of the 3rd cycle
  const off2 = off3 - LOOP_N // start of the 2nd cycle (to measure periodicity)
  const F = Math.min(LOOP_N >> 2, Math.round((XFADE_MS / 1000) * SR))
  const out = []
  let peak = 0, sumSq = 0
  let periodErr = 0 // |cycle3 - cycle2|: how exactly periodic the signal already is
  let seam = 0      // |x[0] - x[N-1]|: the amplitude gap at the border
  let stepMax = 0   // the largest jump between neighbouring samples INSIDE the loop
  for (let c = 0; c < ch; c++) {
    const d = new Float32Array(LOOP_N)
    for (let i = 0; i < LOOP_N; i++) {
      let v = src[c][off3 + i]
      if (i < F) {
        // a: 0 -> 1 along a cosine. At a=0 we take exactly the continuation of the tail.
        const a = 0.5 - 0.5 * Math.cos((Math.PI * i) / F)
        v = a * v + (1 - a) * src[c][off3 + LOOP_N + i]
      }
      d[i] = v
      const abs = Math.abs(v)
      if (abs > peak) peak = abs
      sumSq += v * v
      const e = Math.abs(src[c][off3 + i] - src[c][off2 + i])
      if (e > periodErr) periodErr = e
      if (i > 0) { const s = Math.abs(v - d[i - 1]); if (s > stepMax) stepMax = s }
    }
    const s = Math.abs(d[0] - d[LOOP_N - 1])
    if (s > seam) seam = s
    out.push(d)
  }
  return { out, peak, rms: Math.sqrt(sumSq / (LOOP_N * ch)), periodErr, seam, stepMax }
}

/** WAV IEEE-float32 (lossless: this is the SOURCE for the codec) */
function toWavF32(chans, sr) {
  const ch = chans.length
  const n = chans[0].length
  const data = Buffer.alloc(n * ch * 4)
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) data.writeFloatLE(chans[c][i], (i * ch + c) * 4)
  }
  const head = Buffer.alloc(44)
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8)
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(3, 20) // 3 = float
  head.writeUInt16LE(ch, 22); head.writeUInt32LE(sr, 24)
  head.writeUInt32LE(sr * ch * 4, 28); head.writeUInt16LE(ch * 4, 32); head.writeUInt16LE(32, 34)
  head.write('data', 36); head.writeUInt32LE(data.length, 40)
  return Buffer.concat([head, data])
}

function encode(wavPath, outPath) {
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', wavPath]
  if (CODEC === 'opus') {
    // application=audio is the music mode (not speech); the frame is the default
    // 20 ms; Opus is always 48 kHz internally, and so is our source -> no resampling
    args.push('-c:a', 'libopus', '-b:a', `${KBPS}k`, '-vbr', 'on',
      '-compression_level', '10', '-application', 'audio', '-f', 'ogg')
  } else if (CODEC === 'vorbis') {
    args.push('-c:a', 'libvorbis', '-b:a', `${KBPS}k`, '-f', 'ogg')
  } else if (CODEC === 'aac') {
    args.push('-c:a', 'aac', '-b:a', `${KBPS}k`, '-movflags', '+faststart', '-f', 'mp4')
  } else throw new Error('неизвестный кодек: ' + CODEC)
  args.push(outPath)
  execFileSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'inherit'] })
}

const EXT = CODEC === 'aac' ? 'm4a' : 'ogg'

// ── main ───────────────────────────────────────────────────────────────────
const { OfflineAudioContext } = loadWebAudio()
const modFile = await buildEngineModule()
const { MusicEngine } = await import('file://' + modFile)
console.debug = () => {}

fs.mkdirSync(OUT_DIR, { recursive: true })
const tmpWav = path.join(os.tmpdir(), `hm2-loop-${process.pid}.wav`)

const listOf = (s) => (s === 'none' || s === '-' ? [] : String(s).split(',').filter(Boolean))
const worlds = listOf(argv.worlds || '1,2,3,4,5').map((n) => Number(n) - 1)
const modes = listOf(argv.modes || 'calm,mid,storm')
const wantMenu = argv.menu !== '0'
const menuWorlds = listOf(argv.menuworld || (argv.worlds || '1,2,3,4,5')).map((n) => Number(n) - 1)
const SUF = ENIGMA ? '-enigma' : ''

const manifest = {
  version: 1,
  codec: CODEC, ext: EXT, kbps: KBPS, sampleRate: SR,
  loopSec: LOOP_SEC, cyclesPerLoop: CYCLES_PER_LOOP, storeDb: STORE_DB,
  enigma: ENIGMA, files: {},
}
const mfPath = path.join(OUT_DIR, 'manifest.json')
if (fs.existsSync(mfPath)) {
  try {
    const old = JSON.parse(fs.readFileSync(mfPath, 'utf8'))
    if (old.files) manifest.files = old.files // append, do not wipe another run's entries
  } catch { /* broken file: it will be rewritten */ }
}

console.log(`лупы: ${CODEC} ${KBPS} кбит/с · ${SR} Гц · круг ${LOOP_SEC.toFixed(1)} с ` +
  `(${CYCLES_PER_LOOP} круга гармонии) · хранение +${STORE_DB} дБ`)
console.log('имя'.padEnd(26) + 'пик/RMS в игре'.padEnd(20) + 'период'.padEnd(10) +
  'шов'.padEnd(10) + 'размер')

const rows = []
async function bake(name, worldIdx, levelIdx, profile) {
  const buf = await renderOne({ MusicEngine, OfflineAudioContext, worldIdx, levelIdx, profile })
  const { out, peak, rms, periodErr, seam, stepMax } = cutLoop(buf)
  for (const d of out) for (let i = 0; i < d.length; i++) d[i] *= STORE_GAIN
  let clip = 0
  for (const d of out) for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) >= 0.999) clip++
  fs.writeFileSync(tmpWav, toWavF32(out, SR))
  const file = path.join(OUT_DIR, name + '.' + EXT)
  encode(tmpWav, file)
  if (argv.wav) fs.copyFileSync(tmpWav, path.join(OUT_DIR, name + '.wav'))
  const bytes = fs.statSync(file).size
  manifest.files[name] = { bytes, peakDb: +dbOf(peak).toFixed(1), rmsDb: +dbOf(rms).toFixed(1) }
  rows.push({ name, peak, rms, periodErr, seam, stepMax, bytes, clip })
  console.log(
    name.padEnd(26) +
    `${dbOf(peak).toFixed(1)} / ${dbOf(rms).toFixed(1)}`.padEnd(20) +
    `${dbOf(periodErr).toFixed(0)} дБ`.padEnd(10) +
    `${dbOf(seam).toFixed(0)} дБ`.padEnd(10) +
    `${(bytes / 1024).toFixed(0)} КБ` + (clip ? `  ⚠ clip ${clip}` : ''))
}

for (const w of worlds) {
  for (const mode of modes) {
    // the motif seed is the FIRST level of the world (as in the previews). On a
    // phone there is one motif per world, not one per level: a deliberate tradeoff.
    await bake(`world${w + 1}-${mode}${SUF}`, w, w * 4, PROFILES[mode])
  }
}
if (wantMenu) for (const w of menuWorlds) await bake(`menu${w + 1}${SUF}`, w, w * 4, PROFILES.menu)

fs.rmSync(tmpWav, { force: true })
fs.rmSync(modFile, { force: true })
fs.writeFileSync(mfPath, JSON.stringify(manifest, null, 2) + '\n')

// ── summary ────────────────────────────────────────────────────────────────
const worst = (k) => rows.reduce((m, r) => Math.max(m, r[k]), 0)
const totalBytes = fs.readdirSync(OUT_DIR)
  .filter((f) => f.endsWith('.ogg') || f.endsWith('.m4a'))
  .reduce((s, f) => s + fs.statSync(path.join(OUT_DIR, f)).size, 0)
console.log('\nхудший шов        %s дБ (порог −60)', dbOf(worst('seam')).toFixed(1))
console.log('худшая периодичн. %s дБ (круг3 против круга2)', dbOf(worst('periodErr')).toFixed(1))
console.log('перепад внутри    %s дБ (для сравнения: шов должен быть НЕ ХУЖЕ него)',
  dbOf(worst('stepMax')).toFixed(1))
console.log('всего в папке     %s МБ', (totalBytes / 1048576).toFixed(2))
console.log('готово →', OUT_DIR)
// node-web-audio-api keeps the event loop open after startRendering: without an
// explicit exit the process hangs forever.
process.exit(0)
