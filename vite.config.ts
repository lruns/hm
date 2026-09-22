import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * `public/превью-музыки/` is 140 MB of WAVs for listening while composing
 * (rendered by scripts/render-music-preview.mjs). The game does NOT load them:
 * there is not a single reference in src/. Vite copies all of public/, so they
 * ended up in dist, from there in android/app/src/main/assets/public and finally
 * in the .aab: 142 MB for a game whose code is 3.
 *
 * We drop them from the BUILD only. The sources in public/ are untouched: on the
 * dev server the previews play as before (the plugin uses apply: 'build').
 */
const dropPreviews = () => ({
  name: 'hm-drop-music-previews',
  apply: 'build' as const,
  closeBundle: async () => {
    await rm(resolve(__dirname, 'dist/превью-музыки'), { recursive: true, force: true })
  },
})

/**
 * `public/музыка-лупы/` is 15 MB of pre-rendered production music (Opus).
 * These are NOT previews: src/music-loops.ts really loads them. But exactly ONE
 * build needs them, the mobile one:
 *   - a phone cannot carry live synthesis, so it plays the loops;
 *   - on the web (itch) the CPU is enough and music is generated live, so 15 MB
 *     in the zip would be a pure tax on page load.
 *
 * So the folder goes into dist ONLY with HM_LOOPS=1, and that flag sits in exactly
 * two places: the `sync` and `sync:release` scripts in package.json, the ones
 * scripts/build-android.sh uses (it calls sync:release). `npm run build`, which
 * builds the itch package, does not set the flag, so the folder is dropped.
 *
 * Check by eye: `ls dist/музыка-лупы` after `npm run build` (empty) and after
 * `npm run sync` (24 files). One more safety net is build-itch.sh: it complains
 * about both the folder and the size of dist.
 */
const KEEP_LOOPS = process.env.HM_LOOPS === '1'
// two names, same as LOOPS_DIRS in src/music-loops.ts (which explains why there is
// a fallback ASCII path). The plugin must know both, otherwise renaming the folder
// would silently smuggle 15 MB into the web package.
const LOOP_DIRS = ['музыка-лупы', 'music-loops']
const dropLoops = () => ({
  name: 'hm-drop-music-loops',
  apply: 'build' as const,
  closeBundle: async () => {
    if (KEEP_LOOPS) return
    for (const d of LOOP_DIRS) {
      await rm(resolve(__dirname, 'dist', d), { recursive: true, force: true })
    }
  },
})

// base './' so the build works both from file:// and inside Capacitor/TWA
export default defineConfig({
  plugins: [react(), dropPreviews(), dropLoops()],
  base: './',
  server: { host: true, port: 5199 },
})
