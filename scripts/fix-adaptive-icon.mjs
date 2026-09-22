/**
 * Post-fix after `capacitor-assets generate --android`.
 *
 * The generator writes the adaptive icon BACKGROUND with `inset 16.7%`, so the
 * layer stops covering the full 108dp: on launchers with a large mask (and while
 * the icon does its parallax wobble) transparency shows at the edges. The
 * foreground needs its inset — that is where the content is — but the background
 * must fill the whole canvas.
 *
 * Idempotent: if the fix is already in place, the file is left alone.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = join(dirname(fileURLToPath(import.meta.url)),
  '..', 'android', 'app', 'src', 'main', 'res', 'mipmap-anydpi-v26')

const FROM = `    <background>
        <inset android:drawable="@mipmap/ic_launcher_background" android:inset="16.7%" />
    </background>`
const TO = `    <!-- фон БЕЗ inset: слой должен закрывать все 108dp, иначе на лаунчерах с
         крупной маской и при parallax-покачивании по краям вылезает прозрачность -->
    <background android:drawable="@mipmap/ic_launcher_background" />`

for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  const p = join(DIR, name)
  const src = await readFile(p, 'utf8')
  if (!src.includes(FROM)) { console.log('— уже поправлено:', name); continue }
  await writeFile(p, src.replace(FROM, TO))
  console.log('✔ фон без inset:', name)
}
