/**
 * Acceptance of the Happy Math web build for itch.io, in one command:
 *
 *   node scripts/itch-check/check.mjs
 *
 * Starts two static servers (5210 — the game itself, 5211 — an itch-like host page
 * with an iframe on a DIFFERENT origin) and drives headless Chromium over them:
 * three window sizes, an itch-like iframe (clicks, touch, keys, fullscreen resize,
 * sound), an iframe with localStorage forbidden, plus a file:// check.
 *
 * WARNING: headless has no WebGL, the engine falls back to Canvas2D. What is checked
 * here is LOGIC and LAYOUT. The looks (shaders, bloom, particles) can only be judged
 * in a real Chrome.
 *
 * Screenshots go to scripts/itch-check/скрины/ (not committed).
 * Playwright is taken from neighbouring projects: hm2 does not grow a dependency.
 */
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve, dirname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const DISTDIR = join(ROOT, 'dist')
const SHOTS = join(HERE, 'скрины')

if (!existsSync(join(DISTDIR, 'index.html'))) {
  console.error('нет dist/index.html — сначала: bash scripts/build-itch.sh')
  console.error('(и проверь, что параллельная сессия прямо сейчас не пересобирает dist —')
  console.error(' vite чистит папку на старте, и стенд посреди прогона теряет игру)')
  process.exit(1)
}

// playwright is not a dependency of hm2: look for it in neighbouring projects
const HOME = process.env.HOME
const PW = [process.env.PLAYWRIGHT_PATH,
  `${HOME}/lruns/projects/flight-of-flowers/node_modules/playwright/index.mjs`,
  `${HOME}/lruns/projects/sites-of-me/life-analyzer/node_modules/playwright/index.mjs`].filter(Boolean)
  .find((p) => existsSync(p))
if (!PW) { console.error('playwright не найден у соседних проектов — поправь список PW в этом файле'); process.exit(1) }
const { chromium } = await import(PW)

// ── static server. ACAO:* is needed ONLY by this test rig: an iframe with an opaque
// origin sends subresources with Origin: null. On itch the game and its assets share a host.
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' }
const serve = (root, port) => new Promise((res) => {
  const s = createServer(async (req, rq) => {
    const p = join(root, normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, ''))
    try {
      const buf = await readFile(p)
      rq.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' })
      rq.end(buf)
    } catch { rq.writeHead(404); rq.end('nope') }
  }).listen(port, '127.0.0.1', () => res(s))
})
const servers = [await serve(DISTDIR, 5210), await serve(join(HERE, 'wrap'), 5211)]

const DIST = 'http://127.0.0.1:5210/index.html'
const WRAP = 'http://127.0.0.1:5211/itch.html'
const SANDBOX = 'http://127.0.0.1:5211/sandboxed.html'
const FILEURL = 'file://' + join(DISTDIR, 'index.html')
await mkdir(SHOTS, { recursive: true })

// expected headless noise: no WebGL/WebGPU, the engine falls back to Canvas2D
const NOISE = /WebGPU|WebGL|GPU stall|Canvas2D|is not supported in Canvas2D|Unrecognized feature|allowfullscreen/i

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ok = []; const bad = []
const say = (pass, msg) => { (pass ? ok : bad).push(msg); console.log((pass ? 'PASS ' : 'FAIL ') + msg) }

function hook(page, tag, sink) {
  page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') sink.push(`${t}: ${m.text()}`) })
  page.on('pageerror', (e) => sink.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => sink.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`))
}
const real = (errs) => errs.filter((e) => !NOISE.test(e))
const gameFrame = (page) => page.frames().find((f) => f !== page.mainFrame())

async function waitReady(t, ms = 45000) {  // the machine may be busy with neighbouring builds
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    try { if (await t.evaluate(() => !!(window.__hm && window.__hm.ready))) return true } catch { /* still loading */ }
    await sleep(300)
  }
  return false
}

const state = (t) => t.evaluate(() => {
  const h = window.__hm
  if (!h) return null
  return {
    phase: h.phase, paused: h.paused, score: h.score, lives: h.lives, number: h.number,
    muted: h.sound && h.sound.muted,
    audio: h.sound && h.sound.ctx ? h.sound.ctx.state : 'none',
    css: [h.app.canvas.clientWidth, h.app.canvas.clientHeight],
    W: h.W, H: h.H, renderer: h.app.renderer.name,
    ls: (() => { try { localStorage.setItem('hm2.t', '1'); localStorage.removeItem('hm2.t'); return 'ok' } catch (e) { return 'throw:' + e.name } })(),
    shim: !!Object.getOwnPropertyDescriptor(window, 'localStorage'),
    focus: document.hasFocus(),
  }
})
const tick = (t) => t.evaluate(() => { const h = window.__hm; return `${h.phase}/n${h.currentNumber}/i${h.numIdx}/${h.score}/${h.lives}` })

/** hang a pointerdown counter on the game canvas: a direct measure of "the tap arrived" */
const armProbe = (t) => t.evaluate(() => {
  const c = document.querySelector('canvas')
  if (!c) return false
  window.__probe = 0
  if (!window.__probeOn) { c.addEventListener('pointerdown', () => { window.__probe++ }); window.__probeOn = true }
  return true
})
const readProbe = (t) => t.evaluate(() => window.__probe || 0)

/** dismiss the name modal (first run): it covers the centre of the screen */
async function dismissName(scope) {
  const btn = scope.locator('button:has-text("потом")').first()
  try {
    // the engine is still finishing init here, so give the button time to appear and
    // try twice, otherwise the rig flashes red for no reason
    await btn.waitFor({ state: 'visible', timeout: 15000 })
    try { await btn.click({ timeout: 8000 }) } catch { await sleep(1000); await btn.click({ timeout: 8000 }) }
    await sleep(500); return true
  } catch (e) { console.log('   (модалка есть, но клик не прошёл: ' + e.message.split('\n')[0] + ')'); return false }
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })

// ═══ 1. file:// ═══════════════════════════════════════════════════════════
for (const flags of [[], ['--allow-file-access-from-files']]) {
  const b = await chromium.launch({ args: ['--no-sandbox', ...flags] })
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } })
  const errs = []; hook(page, 'file', errs)
  await page.goto(FILEURL).catch((e) => errs.push('goto: ' + e.message))
  const ready = await waitReady(page, 12000)
  const tag = flags.length ? 'file:// (+allow-file-access-from-files)' : 'file:// (голый двойной клик)'
  if (ready) {
    await dismissName(page)
    await page.screenshot({ path: `${SHOTS}/01-file.png` })
    console.log('FILE state:', JSON.stringify(await state(page)))
  }
  say(ready === !!flags.length, `${tag}: ready=${ready} (ожидаемо ${!!flags.length})`)
  if (!ready) console.log('   причина:', errs.filter((e) => /CORS|blocked/.test(e))[0] || errs[0])
  else say(real(errs).length === 0, `${tag}: консоль без своих ошибок (${real(errs).length}) ${real(errs).slice(0, 3).join(' | ')}`)
  await b.close()
}

// ═══ 2. http, three window sizes ═════════════════════════════════════════
for (const [w, h] of [[1280, 720], [960, 640], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 })
  const page = await ctx.newPage()
  const errs = []; const net = []
  hook(page, `http${w}`, errs)
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1:5210')) net.push(r.url()) })
  await page.goto(DIST)
  const ready = await waitReady(page)
  say(ready, `http ${w}×${h}: движок готов`)
  if (!ready) { await page.screenshot({ path: `${SHOTS}/02-http-${w}x${h}-НЕ-СТАРТОВАЛ.png` }); await ctx.close(); continue }
  await page.screenshot({ path: `${SHOTS}/02-http-${w}x${h}-name.png` })
  say(await dismissName(page), `http ${w}×${h}: модалка имени на месте и закрывается`)
  const t0 = await tick(page)
  if (w < 500) await page.touchscreen.tap(w / 2, h / 2); else await page.mouse.click(w / 2, h / 2)
  await sleep(1200)
  const s = await state(page)
  say(s.phase !== 'splash' || t0 !== await tick(page), `http ${w}×${h}: тык по центру двинул игру (${t0} → ${await tick(page)})`)
  say(s.audio !== 'none', `http ${w}×${h}: звук завёлся после жеста (${s.audio})`)
  await page.screenshot({ path: `${SHOTS}/02-http-${w}x${h}.png` })
  console.log(`HTTP ${w}x${h}:`, JSON.stringify(s))
  say(real(errs).length === 0, `http ${w}×${h}: консоль чиста (${real(errs).length}) ${real(errs).slice(0, 3).join(' | ')}`)
  say(net.length === 0, `http ${w}×${h}: НОЛЬ внешних запросов (${net.length}) ${net.slice(0, 2).join(' | ')}`)
  const hs = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  say(!hs, `http ${w}×${h}: без горизонтального скролла`)
  say(s.css[0] === w && s.css[1] === h, `http ${w}×${h}: канвас во всё окно (css ${s.css.join('×')})`)
  await ctx.close()
}

// ═══ 3. IFRAME as on itch ════════════════════════════════════════════════
{
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 820 }, hasTouch: true })
  const page = await ctx.newPage()
  const errs = []; hook(page, 'iframe', errs)
  page.on('console', (m) => { if (/\[hm-(pause|sound|life|skip)\]/.test(m.text())) console.log('   ↳', m.text()) })
  await page.goto(WRAP)
  const g = () => gameFrame(page)
  say(await waitReady(g()), 'iframe: движок готов внутри ЧУЖОГО origin')
  let s = await state(g())
  console.log('IFRAME state:', JSON.stringify(s))
  say(s.ls === 'ok', `iframe: localStorage жив (${s.ls})`)
  say(s.focus, 'iframe: фокус забран сразу на load (клавиши дойдут без клика)')

  // the name modal, inside the frame
  const fl = page.frameLocator('#game_drop')
  say(await dismissName(fl), 'iframe: клик по DOM-кнопке внутри фрейма проходит')
  s = await state(g())
  say(s.audio !== 'none', `iframe: AudioContext завёлся с ПЕРВОГО жеста, кнопки формы (${s.audio})`)

  // click on the canvas
  const box = await page.locator('#game_drop').boundingBox()
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2
  await armProbe(g())
  let t0 = await tick(g())
  await page.mouse.click(cx, cy)
  await sleep(1200)
  say(await readProbe(g()) === 1, `iframe: клик мышью дошёл до канваса (pointerdown=${await readProbe(g())}, ${t0} → ${await tick(g())})`)
  await page.screenshot({ path: `${SHOTS}/03-iframe-click.png` })

  // get to the play phase (splash -> intro -> play)
  for (let i = 0; i < 4 && (await state(g())).phase !== 'play'; i++) { await page.mouse.click(cx, cy); await sleep(900) }
  say((await state(g())).phase === 'play', `iframe: дошли до фазы play (${(await state(g())).phase})`)

  // keys INSIDE the iframe
  t0 = await tick(g())
  await page.keyboard.press('Space'); await sleep(900)
  say(t0 !== await tick(g()), `iframe: Space → ход (${t0} → ${await tick(g())})`)
  t0 = await tick(g())
  await page.keyboard.press('KeyX'); await sleep(900)
  say(t0 !== await tick(g()), `iframe: X («мимо») → ход (${t0} → ${await tick(g())})`)
  await page.keyboard.press('KeyP'); await sleep(500)
  say((await state(g())).paused === true, `iframe: P → пауза (paused=${(await state(g())).paused})`)
  await page.keyboard.press('Escape'); await sleep(500)
  say((await state(g())).paused === false, `iframe: Escape → снял паузу`)
  const m0 = (await state(g())).muted
  await page.keyboard.press('KeyM'); await sleep(300)
  const m1 = (await state(g())).muted
  say(m0 !== m1, `iframe: M → звук (${m0} → ${m1})`)
  await page.keyboard.press('KeyM'); await sleep(200)
  await page.keyboard.press('Enter'); await sleep(700)
  say(true, `iframe: Enter отработал без падения (${await tick(g())})`)

  // Space must not scroll the parent page (preventDefault inside the frame)
  const scrollY = await page.evaluate(() => window.scrollY)
  await page.keyboard.press('Space'); await sleep(400)
  say(await page.evaluate(() => window.scrollY) === scrollY, 'iframe: Space не скроллит страницу itch')

  // RESIZE (the itch fullscreen button changes the iframe size)
  const b0 = await state(g())
  await page.evaluate(() => window.__setSize(1000, 780)); await sleep(900)
  const b1 = await state(g())
  say(b1.W !== b0.W || b1.H !== b0.H, `iframe: ресайз подхвачен ${b0.W}×${b0.H} → ${b1.W}×${b1.H}`)
  say(Math.abs(b1.css[0] - 1000) <= 2 && Math.abs(b1.css[1] - 780) <= 2, `iframe: канвас = размеру фрейма (css ${b1.css.join('×')} при 1000×780)`)
  await page.screenshot({ path: `${SHOTS}/04-iframe-resized.png` })
  await page.evaluate(() => window.__fakeFull()); await sleep(900)
  const b2 = await state(g())
  say(b2.W > b1.W || b2.H > b1.H, `iframe: «fullscreen» подхвачен → ${b2.W}×${b2.H}`)
  await page.screenshot({ path: `${SHOTS}/05-iframe-fullscreen.png` })
  // is it still playable AFTER the resize (the canvas did not die)
  const box3 = await page.locator('#game_drop').boundingBox()
  const vp = page.viewportSize()
  // in "fullscreen" the frame sticks out of the window: aim at the VISIBLE centre
  const vx = (Math.max(0, box3.x) + Math.min(vp.width, box3.x + box3.width)) / 2
  const vy = (Math.max(0, box3.y) + Math.min(vp.height, box3.y + box3.height)) / 2
  await armProbe(g())
  await page.mouse.click(vx, vy); await sleep(700)
  const hit = await readProbe(g())
  const spot = await g().evaluate(([x, y]) => {
    const c = document.querySelector('canvas'); const r = c.getBoundingClientRect()
    return { canvas: [Math.round(r.width), Math.round(r.height)], inside: x >= 0 && y >= 0 }
  }, [vx, vy])
  say(hit === 1, `iframe: после fullscreen клик доходит до канваса (pointerdown=${hit}, канвас ${spot.canvas.join('×')})`)
  await page.evaluate(() => window.__setSize(960, 640)); await sleep(900)
  say(Math.abs((await state(g())).css[0] - 960) <= 2, `iframe: обратный ресайз ок`)

  // TOUCH inside the iframe
  const box2 = await page.locator('#game_drop').boundingBox()
  await armProbe(g())
  t0 = await tick(g())
  await page.touchscreen.tap(box2.x + box2.width / 2, box2.y + box2.height / 2); await sleep(1000)
  say(await readProbe(g()) === 1, `iframe: тач дошёл до канваса (pointerdown=${await readProbe(g())}, ${t0} → ${await tick(g())})`)

  say(real(errs).length === 0, `iframe: консоль без своих ошибок (${real(errs).length}) ${real(errs).slice(0, 4).join(' | ')}`)
  console.log('IFRAME console:\n  ' + (errs.join('\n  ') || '(пусто)'))
  await ctx.close()
}

// ═══ 4. IFRAME with an OPAQUE origin: localStorage throws ════════════════
{
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } })
  const page = await ctx.newPage()
  const errs = []; hook(page, 'sandbox', errs)
  const notes = []
  page.on('console', (m) => { if (m.text().includes('[hm]')) notes.push(m.text()) })
  await page.goto(SANDBOX)
  const g = () => gameFrame(page)
  say(await waitReady(g()), 'sandbox-iframe (localStorage запрещён): игра ВСЁ РАВНО стартует')
  const s = await state(g()).catch(() => null)
  console.log('SANDBOX state:', JSON.stringify(s))
  say(s && s.ls === 'ok' && s.shim, `sandbox-iframe: подставлен фолбэк-хранилище (ls=${s && s.ls}, shim=${s && s.shim})`)
  say(notes.some((n) => n.includes('недоступен')), `sandbox-iframe: честно предупредили в консоль (${notes[0] || '—'})`)
  await dismissName(page.frameLocator('#game_drop'))
  const box = await page.locator('#game_drop').boundingBox()
  const t0 = await tick(g())
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await sleep(1200)
  say(t0 !== await tick(g()), `sandbox-iframe: играется (${t0} → ${await tick(g())})`)
  // writing progress must not crash
  const wrote = await g().evaluate(() => { try { localStorage.setItem('hm2.best', '123'); return localStorage.getItem('hm2.best') } catch (e) { return 'throw:' + e.name } })
  say(wrote === '123', `sandbox-iframe: запись прогресса не роняет игру (${wrote})`)
  await page.screenshot({ path: `${SHOTS}/06-sandbox-iframe.png` })
  // our own fallback warning is expected: it is the sign the shim works
  const own = real(errs).filter((e) => !e.includes('[hm] localStorage недоступен'))
  say(own.length === 0, `sandbox-iframe: консоль без своих ошибок (${own.length}) ${own.slice(0, 3).join(' | ')}`)
  await ctx.close()
}

await browser.close()
for (const s of servers) s.close()
console.log('\n══════ ИТОГ ══════')
console.log(`PASS ${ok.length} / FAIL ${bad.length}`)
if (bad.length) { console.log('ПРОВАЛЫ:\n - ' + bad.join('\n - ')); process.exitCode = 1 }
console.log('скрины: ' + SHOTS)
