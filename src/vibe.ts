/**
 * VIBE FLAGS. Andrey: «сделай так чтобы можно было откатить быстро или чтобы
 * если что скином было» - every visual addition must be revertible in one move.
 *
 * Each flag turns ON one added vibe effect. With `false` the effect looks
 * EXACTLY as it did before it was added: the new code simply does not run (or is
 * multiplied by zero in the shader), the old path is untouched.
 *
 * LIVE ROLLBACK (no rebuild): `?vibe=mosaic:off,burst:off,depth:off`
 *   ?vibe=mosaic:off - the menu Play button is plain glass with a white triangle again
 *   ?vibe=burst:off  - portal without the violet-white exploding star
 *   ?vibe=depth:off  - simpler cosmos (6 nebulae, no planet, no star glints)
 * The opposite works too: `?vibe=mosaic:on` (values `on|1|true|yes` enable).
 *
 * PERMANENT ROLLBACK: flip `true` -> `false` in DEFAULTS below (one line per effect).
 */
export interface VibeFlags {
  /** stained-glass mosaic + neon triangle on the menu Play button */
  mosaicPlay: boolean
  /** exploding ray-star in the tunnel eclipse and in the portal vortex */
  portalBurst: boolean
  /** cosmos depth: nebulae 6->10, cross-shaped star glints, planet arc */
  cosmosDepth: boolean
  /** Enigma music layer: breathing formant choir, whispered breath, ritual tempo
   *  (chords twice as long), dark warm center. OFF BY DEFAULT - Andrey asked for an
   *  option, not a replacement: «пока не надо прям всё менять, хотя бы озвучь».
   *  Live: `?music=enigma` (short form) or `?vibe=enigma:on`.
   *  For good: `enigmaMusic: true` on the line below. Read by src/music.ts. */
  enigmaMusic: boolean
}

const DEFAULTS: VibeFlags = {
  mosaicPlay: true,
  portalBurst: true,
  cosmosDepth: true,
  enigmaMusic: false,
}

/** URL keys are shorter than the flag names: they get typed by hand in the address bar */
const ALIASES: Record<string, keyof VibeFlags> = {
  mosaic: 'mosaicPlay',
  mosaicplay: 'mosaicPlay',
  burst: 'portalBurst',
  portalburst: 'portalBurst',
  depth: 'cosmosDepth',
  cosmosdepth: 'cosmosDepth',
  enigma: 'enigmaMusic',
  enigmamusic: 'enigmaMusic',
}

const truthy = (v: string) => v === '' || v === 'on' || v === '1' || v === 'true' || v === 'yes'

/** parse `?vibe=mosaic:off,burst:off` on top of the defaults */
export function parseVibe(search: string): VibeFlags {
  const out: VibeFlags = { ...DEFAULTS }
  let raw = ''
  try { raw = new URLSearchParams(search).get('vibe') || '' } catch { raw = '' }
  if (!raw) return out
  for (const part of raw.split(',')) {
    const [k, v = ''] = part.split(':')
    const key = ALIASES[k.trim().toLowerCase()]
    if (key) out[key] = truthy(v.trim().toLowerCase())
  }
  return out
}

/** one live config per game (read by the fx modules and the engine) */
export const VIBE: VibeFlags = parseVibe(
  typeof window !== 'undefined' ? window.location.search : '',
)
