// audiohud.ts — DEV OVERLAY: "what is happening to the sound RIGHT NOW".
//
// WHY IT EXISTS.
// The author hears glitches on his own phone. We have no access to that phone:
// we can neither plug it in nor take a profile off it. So the only honest way is
// to make the device tell about ITSELF in a single screenshot. Everything shown
// here is picked by one rule: the panel must make visible WHAT EXACTLY is falling
// behind — the audio thread (a heavy graph) or the main thread (render and
// scheduler). Two different diagnoses, two different cures, and without a number
// you cannot tell them apart.
//
// HOW TO READ IT:
//  · "нагрузка ... срывы" > 0 — the AUDIO THREAD is behind: cured by the graph
//    budget (the "экономный" tier) and a bigger buffer;
//  · low fps with no underruns — the MAIN THREAD is behind: cured by graphics
//    quality, sound has nothing to do with it;
//  · "поздних нот" > 0 — the scheduler slipped;
//  · "буфер" of 3-11 ms on a phone is an alarm: almost no window left to compute.
//
// HOW TO ENABLE:
//  1) `?debug=audio` in the URL (browser, itch);
//  2) in the packaged app the URL cannot be changed, so FIVE QUICK TAPS on the
//     "качество" row in the pause menu (see engine.ts, pauseAct);
//  3) from the console: `__hmAudio.toggle()`.
//
// The panel computes nothing on its own and affects nothing: it just reads ready
// numbers four times a second. No emoji glyphs (house rule), everything local,
// works over file://.

import { quality, IS_ANDROID, IS_WEBVIEW } from './quality'
import { makeIR } from './music'

/** ── HOW MUCH HEADROOM THIS HARDWARE HAS FOR OUR GRAPH ──────────────────────
 *  `AudioContext.renderCapacity` (direct audio-thread load) is far from
 *  universal: headless Chromium, where we test, has none, and the author's
 *  WebView may have none either. So we measure the HEADROOM ourselves, portably:
 *  we assemble a slice of our own graph in an OfflineAudioContext (convolution
 *  with a real impulse + nine filtered oscillators, exactly a pad chord), ask it
 *  to render one second and time how much REAL time that took.
 *
 *  "запас xN" = how many seconds of such sound the device manages to compute in
 *  one second. The real thread needs x1 plus everything else happening in the
 *  system; below x10 is tight, below x5 clicks are almost inevitable.
 *
 *  Measured EXACTLY ONCE and only while the panel is open: the offline render
 *  eats CPU itself, doing it in the background of the game would be sabotage. */
async function benchGraph(sec = 1): Promise<number> {
  const OAC = (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext
  if (!OAC) return -1
  const sr = 48000
  const ctx = new OAC(2, Math.round(sr * sec), sr)
  const conv = ctx.createConvolver()
  conv.normalize = true
  // the game's average hall (world 1, 2.1 s): not the most expensive (cathedral
  // 4.2) and not the cheapest, so the number describes a typical run, not an edge case
  conv.buffer = makeIR(ctx, { sec: 2.1, pre: 0.018, damp: 5200, dampFall: 5, early: 0.3 })
  const send = ctx.createGain(); send.gain.value = 0.4
  conv.connect(ctx.destination); send.connect(conv)
  for (let i = 0; i < 9; i++) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'
    o.frequency.value = 110 * (1 + i * 0.13)
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2000; f.Q.value = 1.4
    const p = ctx.createStereoPanner(); p.pan.value = (i % 3) - 1
    const g = ctx.createGain(); g.gain.value = 0.03
    o.connect(f); f.connect(g); g.connect(p); p.connect(ctx.destination); p.connect(send)
    o.start(0); o.stop(sec)
  }
  const t0 = performance.now()
  await ctx.startRendering()
  const ms = performance.now() - t0
  return ms > 0 ? (sec * 1000) / ms : -1
}

/** what we need from the sound engines, duck-typed, without importing classes
 *  (the Strudel engine lacks these fields, which is fine: we show a dash) */
interface SoundLike {
  audioStats?: () => {
    sr: number; state: string; base: number; out: number
    hint: AudioContextLatencyCategory | number
    load: number; peak: number; under: number
    drops: number; room: boolean
  } | null
}
interface MusicLike {
  health?: {
    resyncs: number; late: number; ticks: number; clock: string
    started: boolean; tier: string; voices: number; peak: number
    cap: number; dropped: number; enigma: boolean; irSec: number
    /** Two music engines exist: live synthesis and prerecorded loops.
     *  Both have this field; `loops` is filled only by the loop engine. */
    engine?: string
    loops?: {
      ready: number; mb: number; world: number; stage: string
      menu: boolean; loopSec: number; failed: boolean
    }
  }
}

const PERIOD = 250 // ms between updates: readable and costs next to nothing

const OK = '#9ff0b0'
const WARN = '#ffd479'
const BAD = '#ff8a8a'
const DIM = '#8fa0c8'

class AudioHUD {
  private box: HTMLDivElement | null = null
  private rows = new Map<string, HTMLSpanElement>()
  private timer: number | null = null
  private sound: SoundLike | null = null
  private music: MusicLike | null = null
  private expect = 0
  /** biggest main-thread lag over the last 4 s (ms) */
  private lagMax = 0
  private lagT = 0
  /** hardware headroom for our graph: -1 "still measuring", -2 "could not" (see benchGraph) */
  private bench = -1

  /** the engine calls this once at start. We take unknown and cast ourselves:
   *  there are two music engines (generative and Strudel) with no common type,
   *  and the panel only needs a duck-typed set of fields. */
  wire(sound: unknown, music: unknown) {
    this.sound = sound as SoundLike
    this.music = music as MusicLike
    try {
      if (new URLSearchParams(location.search).get('debug') === 'audio') this.show()
    } catch { /* no address bar, never mind */ }
  }

  get visible() { return !!this.box }

  toggle(): boolean {
    if (this.box) { this.hide(); return false }
    this.show(); return true
  }

  hide() {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null }
    if (this.box) { this.box.remove(); this.box = null }
    this.rows.clear()
    console.debug('[hm-audiohud] off')
  }

  show() {
    if (this.box) return
    try {
      const box = document.createElement('div')
      box.id = 'hm-audiohud'
      // IMPORTANT: pointer-events none, the panel must not swallow a single tap.
      // safe-area: on a notched phone it would otherwise slide under the cutout.
      box.setAttribute('style', [
        'position:fixed', 'z-index:99999', 'pointer-events:none',
        'left:8px', 'top:max(8px, env(safe-area-inset-top, 0px))',
        'max-width:min(92vw, 380px)',
        'padding:7px 9px', 'border-radius:10px',
        'background:rgba(6,8,20,0.82)', 'border:1px solid rgba(140,180,255,0.28)',
        'color:#dfe7ff',
        // font size from screen width: at 320 px the "буфер ..." row would not fit,
        // and we cannot cut the telemetry this whole thing was built for
        `font:${Math.max(9, Math.min(11, Math.floor(innerWidth / 33)))}px/1.42 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
        // pre keeps the columns aligned; overflow hidden keeps a long row on a
        // narrow screen inside the panel so it cannot stretch the page
        'white-space:pre', 'overflow:hidden', 'letter-spacing:0.2px',
      ].join(';'))
      this.box = box

      const title = document.createElement('div')
      title.setAttribute('style', 'font-weight:700;color:#9adfff;margin-bottom:3px')
      title.textContent = 'HM2 · ЗВУК И НАГРУЗКА'
      box.appendChild(title)

      // "движок" goes first: there are two of them (live synthesis and
      // prerecorded loops), and on a phone screenshot that is what to see first
      for (const label of ['движок', 'ступень', 'поток', 'буфер', 'нагрузка', 'запас',
        'голоса', 'ноты', 'зал', 'графика', 'экран', 'главный']) {
        const line = document.createElement('div')
        const l = document.createElement('span')
        // label column width via style, not spaces: values line up at any font
        // size and the label never sticks to the value
        l.setAttribute('style', `color:${DIM};display:inline-block;width:6.2em;padding-right:0.4em`)
        l.textContent = label
        const v = document.createElement('span')
        v.textContent = '—'
        line.appendChild(l); line.appendChild(v)
        box.appendChild(line)
        this.rows.set(label, v)
      }

      document.body.appendChild(box)
      this.expect = performance.now() + PERIOD
      this.lagMax = 0
      this.timer = setInterval(() => this.tick(), PERIOD) as unknown as number
      this.tick()
      // one-off hardware headroom measurement: let a frame draw first so the panel
      // appears before the offline render takes the CPU
      if (this.bench < 0) {
        setTimeout(() => {
          benchGraph().then((x) => { this.bench = x; console.debug('[hm-audiohud] запас ×' + x.toFixed(1)) })
            .catch(() => { this.bench = -2 })
        }, 700)
      }
      console.debug('[hm-audiohud] on')
    } catch (e) {
      console.warn('[hm-audiohud] плашка не поднялась:', e)
      this.box = null
    }
  }

  private set(key: string, text: string, color = '#dfe7ff') {
    const el = this.rows.get(key)
    if (!el) return
    if (el.textContent !== text) el.textContent = text
    if (el.style.color !== color) el.style.color = color
  }

  private tick() {
    // MAIN-THREAD LAG. Our own interval: how late it fires is how busy the main
    // thread was. This is the second of the two suspects, measured right here so
    // both stand side by side on the screenshot.
    const now = performance.now()
    const lag = Math.max(0, now - this.expect)
    this.expect = now + PERIOD
    if (lag > this.lagMax) this.lagMax = lag
    this.lagT += PERIOD
    if (this.lagT >= 4000) { this.lagT = 0; this.lagMax = lag }

    const q = quality.stats()
    const k = quality.knobs
    const a = this.sound?.audioStats?.() ?? null
    const h = this.music?.health

    // ── WHICH MUSIC ENGINE IS ON STAGE
    const lp = h?.loops
    if (!h) {
      this.set('движок', '—', DIM)
    } else if (h.engine === 'loops' && lp) {
      this.set('движок',
        `ЛУПЫ · мир ${lp.world} · ${lp.menu ? 'меню' : lp.stage} · ` +
        `${lp.ready} буф ${lp.mb}МБ · круг ${lp.loopSec}с`,
        lp.failed ? BAD : lp.ready ? OK : WARN)
    } else {
      this.set('движок', `живой синтез${h.engine === 'live' ? '' : ' (' + (h.engine || '?') + ')'}`, OK)
    }

    // ── audio tier and the knob. With loops the tier DOES NOT APPLY TO MUSIC:
    //    the music graph is three buffers and gains, nothing there can get richer.
    //    The knob still drives SFX (event room, voice cap), so that is what we print.
    if (h?.engine === 'loops') {
      this.set('ступень', `${quality.audioTier} — только SFX (музыка из файлов)`, DIM)
    } else {
      this.set('ступень', `${h?.tier ?? quality.audioTier}  (ручка: ${quality.audioMode})`,
        (h?.tier ?? quality.audioTier) === 'rich' ? WARN : OK)
    }

    if (!a) {
      this.set('поток', 'закрыто (нужен первый тап)', DIM)
    } else {
      this.set('поток', `${a.sr} Гц · ${a.state}${a.drops ? ` · падений ctx ${a.drops}` : ''}`,
        a.state === 'running' && !a.drops ? OK : BAD)
      const baseMs = a.base * 1000
      const outMs = a.out * 1000
      // 3-11 ms on a phone = almost no window left to compute. On desktop it is normal.
      const tight = IS_ANDROID && baseMs < 12
      this.set('буфер', `${baseMs.toFixed(1)}мс · вых ${outMs.toFixed(0)} · просим ${String(a.hint)}`,
        tight ? BAD : baseMs < 20 && IS_ANDROID ? WARN : OK)
      if (a.load < 0) {
        this.set('нагрузка', 'нет renderCapacity', DIM)
      } else {
        const u = a.under
        this.set('нагрузка',
          `ср ${a.load.toFixed(2)} · пик ${a.peak.toFixed(2)} · СРЫВЫ ${(u * 100).toFixed(1)}%`,
          u > 0.001 ? BAD : a.peak > 0.8 ? WARN : OK)
      }
    }

    // HARDWARE HEADROOM: a portable replacement for renderCapacity (see benchGraph)
    if (this.bench === -1) this.set('запас', 'меряю…', DIM)
    else if (this.bench === -2) this.set('запас', 'не смог померить', DIM)
    else this.set('запас', `×${this.bench.toFixed(1)} (аккорд+зал офлайн)`,
      this.bench < 5 ? BAD : this.bench < 10 ? WARN : OK)

    if (!h) {
      this.set('голоса', 'движок не подключён', DIM)
      this.set('ноты', '—', DIM)
      this.set('зал', '—', DIM)
    } else if (h.engine === 'loops') {
      // with loops a "voice" is a buffer source, not an oscillator; there is no
      // scheduler at all, so late notes and resyncs cannot happen, and the hall is
      // already baked into the file. We say so plainly, so dashes do not read as a failure.
      this.set('голоса', `${h.voices} источников-буферов${h.dropped ? ` · нет файлов ${h.dropped}` : ''}`,
        h.dropped ? BAD : OK)
      this.set('ноты', 'планировщика нет (ноты уже сыграны)', OK)
      this.set('зал', `в файле${h.enigma ? ' · enigma' : ''} · SFX-комната ${a?.room ? 'есть' : 'нет'}`, OK)
    } else {
      const cap = isFinite(h.cap) ? String(h.cap) : 'без потолка'
      this.set('голоса', `${h.voices} · пик ${h.peak} · потолок ${cap}${h.dropped ? ` · брошено ${h.dropped}` : ''}`,
        h.voices > 34 ? WARN : OK)
      this.set('ноты', `поздних ${h.late} · синхр ${h.resyncs} · ${h.clock} ${h.ticks}`,
        h.late > 0 ? BAD : h.resyncs > 2 ? WARN : OK)
      this.set('зал', `${h.irSec.toFixed(2)}с · SFX-комната ${a?.room ? 'есть' : 'нет'}${h.enigma ? ' · enigma' : ''}`,
        h.irSec > 2.5 ? WARN : OK)
    }

    const fps = Math.round(quality.fps)
    this.set('графика', `${q.level}(${q.mode}) fps ${fps || '—'} · частиц ×${k.particles} · res ${k.resCap}`,
      fps && fps < 30 ? BAD : fps && fps < 45 ? WARN : OK)

    const dpr = (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1).toFixed(2)
    this.set('экран', `${innerWidth}×${innerHeight} · dpr ${dpr} · ${IS_ANDROID ? 'Android' : 'десктоп'}${IS_WEBVIEW ? '+WebView' : ''}`, DIM)

    this.set('главный', `лаг ${Math.round(lag)}мс · пик 4с ${Math.round(this.lagMax)}мс`,
      this.lagMax > 250 ? BAD : this.lagMax > 90 ? WARN : OK)
  }
}

export const audioHUD = new AudioHUD()
try { (window as unknown as Record<string, unknown>).__hmAudio = audioHUD } catch { /* ok */ }
