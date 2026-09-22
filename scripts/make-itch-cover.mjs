/**
 * Builds an itch.io cover of exactly 630x500 from any game frame.
 *
 *   node scripts/make-itch-cover.mjs промо/скрины-сторов/06-меню.jpg
 *   node scripts/make-itch-cover.mjs <frame> [out.png] [--full]
 *
 * itch shows the cover at 630x500 (and crops anything with other proportions),
 * so we take the central piece with the required 1.26:1 ratio and downscale it.
 * By default the bottom eighth of the frame is cut off — that is where the menu
 * captions sit; --full keeps the whole height.
 *
 * The original is never touched: a NEW file is written next to it (house rule).
 */
import sharp from 'sharp'
import { resolve, dirname, join } from 'node:path'

const [, , src, outArg, ...flags] = process.argv
if (!src) {
  console.error('нужен путь к кадру: node scripts/make-itch-cover.mjs <кадр.jpg> [выход.png] [--full]')
  process.exit(1)
}
const full = flags.includes('--full')
const out = outArg && !outArg.startsWith('--') ? outArg : join(dirname(resolve(src)), 'обложка-itch-630x500.png')

const W = 630, H = 500, AR = W / H

const img = sharp(resolve(src))
const { width, height } = await img.metadata()
const usable = full ? height : Math.round(height * 0.82) // bottom of the frame holds the menu captions
let cw = Math.round(usable * AR)
let ch = usable
if (cw > width) { cw = width; ch = Math.round(width / AR) }
const left = Math.round((width - cw) / 2)

await img
  .extract({ left, top: 0, width: cw, height: ch })
  .resize(W, H, { fit: 'fill' })
  .png({ compressionLevel: 9 })
  .toFile(resolve(out))

console.log(`обложка: ${out}  (из ${width}×${height}, вырез ${cw}×${ch} @ x=${left})`)
