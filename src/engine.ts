// Happy Math v2 — PixiJS v8 renderer + shaders. The game rules did not change (ported
// one-to-one from the canvas version). The drawing layer did: the living cosmos
// background and the portal are fragment shaders (Filter/GlProgram), the storm is a
// ParticleContainer.
//
// Storm system with a dynamic range: one intensity axis — the player's streak drives
// particle density/brightness, pulse amplitude and colour. A mistake makes the world
// go abruptly quiet (hush) — silence hurts more than a penalty.
//
// Lights in orbit = lives (Andrey: «круг из класса»): miss and a light goes out and falls.
// Skip is an active "not this one": right click / X / the «мимо» button.

import {
  Application, Container, Graphics, Sprite, Texture, Text, TextStyle,
  Filter, GlProgram, BlurFilter, Rectangle, ColorMatrixFilter, CanvasTextMetrics,
  type TextOptions,
} from 'pixi.js'
import { AdvancedBloomFilter, RGBSplitFilter } from 'pixi-filters'
import {
  LEVELS, LevelDef, SurpriseKind, START_LIVES, MAX_LIVES, POINTS_PER_LIFE,
  WORLD_NAMES, WORLD_COUNT, worldFirstLevelIdx, worldGateStars, worldPalette,
} from './levels'
import { FILTER_VERT, PORTAL_FRAG, TUNNEL_FRAG, GEM_FRAG, FLOW_FRAG } from './shaders'
import { MUSIC } from './config'
import { hexNum, hexRgb, lerpColor, hsl, hueOf, palFade } from './color'
import { TAU, clamp01, backOut } from './util'
import { makeGlowTexture, makeDarkTexture, makeParticleAtlas, makeSpectrumVignette } from './fx/textures'
import { StormSystem } from './fx/storm'
import { Cosmos } from './fx/cosmos'
import { Frost } from './fx/frost'
import { MusicViz } from './fx/notes'
import { noteBus } from './notebus'
import { SoundEngine } from './sound'
import { MusicEngine } from './music'
import { StrudelMusicEngine } from './music-strudel'
import { LoopMusicEngine, useLoopMusic } from './music-loops'
import { drawWings } from './fx/wings'
import { quality, type QualityKnobs, type QualityMode } from './quality'
import { audioHUD } from './audiohud'
import { drawMosaicGlass, drawNeonTriangle } from './fx/neon'
import { VIBE } from './vibe'
/** PROMO CAPTURE: `?holo=1` asks for a transparent canvas (layers for the hologram) */
const HOLO = typeof window !== 'undefined' && /(?:^|[?&])holo=1(?:&|$)/.test(window.location.search)
import { drawSurpriseIcon, isGoodSurprise, surpriseColor } from './fx/icons'
import {
  MILESTONES, totalStars, bankStars, bankLevelScore, starsByLevel,
  hasMilestone, claimMilestones, getName, getSkin, toggleSkin, migrateProgress,
  isTermLearned, markTermsLearned, resetTermsLearned,
  saveSession, loadSession, clearSession, learnedTerms, type SessionSnapshot,
  bestCombo, bankCombo,
} from './progress'
import { termCards, type TermCard } from './terms'
import {
  NumberStream, genCondition, tierForScore, buildDaily,
  dateSeedUTC, dateLabelUTC, yesFraction,
} from './generator'

type Phase = 'splash' | 'intro' | 'play' | 'results' | 'portal' | 'gameover' | 'finale'
type PortalKind = 'vortex' | 'dissolve' | 'tunnel'
/** session mode: campaign (rules must not change), endless, number of the day */
type Mode = 'campaign' | 'endless' | 'daily'

const SAVE_ENDLESS = 'hm2.endless.best' // endless mode record
const DAILY_KEY = (seed: number) => `hm2.daily.${seed}` // number-of-the-day result by date

/** 0xrrggbb → '#rrggbb' (inverse of hexNum) — for the endless mode palette drift */
function numToHex(n: number): string { return '#' + (n & 0xffffff).toString(16).padStart(6, '0') }

/** how long the palette travels when entering a new world */
const PAL_FADE = 1.4
/**
 * How long the palette travels when a world circle is tapped in the MENU. Shorter
 * than the switch during play (1.4s there — that is an event); here it is a fitting
 * room: you tap and almost immediately see the world on you.
 */
const MENU_FIT_FADE = 0.6

/** swipe-to-skip threshold on touch, px (left or down) */
const SWIPE_MIN = 40

// ---- ENDLESS MODE GATE -----------------------------------------------------
// Three completed (starred) campaign levels are enough.
const ENDLESS_GATE_LEVELS = 3
const ENDLESS_GATE_MSG = 'бесконечность откроется, когда пройдёшь 3 этапа'

// ---- RULE CHANGE IN ENDLESS ------------------------------------------------
// A rule change is an EVENT: the ring flashes in the new rule's colour, a big banner
// for RULE_BANNER seconds, sound + haptics. The move on which the rule changed gets
// that much extra time — the player reads the condition instead of dying over it.
const RULE_BANNER = 2.0
/** palette of "rule colours": every new condition arrives in its own colour */
const RULE_COLORS = [0xffd54a, 0x9adfff, 0x5ef0a0, 0xff9ad4, 0xc0a0ff, 0xffa060]

const BEAT_HZ = MUSIC.bpm / 60 // world pulse beat (config is ready for a future suno track)

// ---- INVERSION DEBUFF ------------------------------------------------------
// Not an instant absolute negative but a scene: warning breath → smooth in → hold →
// smooth out. The strength is NOT 100%.
const INV_WARN = 0.5   // "the screen inhales": the world draws in, fills with violet
const INV_IN = 0.35    // smooth fade into the negative
const INV_HOLD = 1.3   // hold
const INV_OUT = 0.35   // smooth fade out  (the negative itself = IN+HOLD+OUT ≈ 2.0s)
const INV_MAX = 0.85   // negative strength: 85%, not a full inversion
const INV_TOTAL = INV_WARN + INV_IN + INV_HOLD + INV_OUT

/** golden wave on reaching ×3 — how long the celebration lasts */
const GOLD3_DUR = 1.15

// ════════════════════════════════════════════════════════════════════════════
// EFFECT SCALE BY STREAK. Andrey: «это всё-таки слишком мега-эффекты — я говорил,
// что [пик] это то, что я вижу на комбо 100» and «показывать не всегда, а что уже
// 10х 50х 100х комбо».
//
// A long curve with key points instead of a short linear ramp: the ceiling must be
// an event, not something almost every campaign level (12–20 moves) reaches.
// Canon of both references: in Tetris Effect there is ALMOST NOTHING at the start,
// the wow comes only on a huge streak (silence is an asset); in Bejeweled the voice
// and the bass arrive on STREAKS, not on every match.
//
// HOW TO TUNE: this is the only place where the shape of the curve lives. The points
// must ascend by streak; between them — linear interpolation, above the last one — a
// ceiling of 1. Want "stronger earlier" — raise the middle values, want "save up
// longer" — lower them. Everything else (storm, wings, bloom, protector, HUD) reads
// this ONE function and follows it.
// ════════════════════════════════════════════════════════════════════════════
const COMBO_CURVE: [streak: number, intensity: number][] = [
  [0, 0.00],   // calm: empty and quiet, like the Tetris Effect splash
  [3, 0.06],   // first sparks — the world noticed you but is still just breathing
  [9, 0.16],   // end of the "modest" zone: light sparks, no wings yet
  [10, 0.24],  // MILESTONE 10× — the world visibly comes alive for the first time (a step up!)
  [25, 0.45],  // MILESTONE 25× — beautiful: wings breathe, the flow has grown
  [50, 0.70],  // MILESTONE 50× — powerful: rivers, bloom, spectrum flow
  [100, 1.00], // MILESTONE 100× — THE maximum, everything the game has
]

/** streak → world intensity axis 0..1 along COMBO_CURVE (linear interpolation) */
function comboIntensity(streak: number): number {
  if (streak <= 0) return 0
  const last = COMBO_CURVE[COMBO_CURVE.length - 1]
  if (streak >= last[0]) return last[1]
  for (let i = 1; i < COMBO_CURVE.length; i++) {
    const [s1, v1] = COMBO_CURVE[i]
    if (streak > s1) continue
    const [s0, v0] = COMBO_CURVE[i - 1]
    return v0 + (v1 - v0) * ((streak - s0) / (s1 - s0))
  }
  return last[1]
}

/**
 * "WAKING UP" — a short scale for what is NOT the storm: HUD brightness, disc glow,
 * rim thickness. These must wake up on the first answers (otherwise the score is
 * unreadable) and have nothing to do with the storm. Hence a separate threshold,
 * tuned on the CURRENT curve to the same streak it used to mean.
 */
const WAKE_AT = 0.10 // ≈ streak 5 on COMBO_CURVE

// ---- COMBO MILESTONES ------------------------------------------------------
// Andrey: «как-то поздравить», «плюшки очками».
/** at which streaks a milestone is announced. Each one at most once per level */
const COMBO_MILESTONES = [10, 25, 50, 100]
/** points reward for a milestone: 10 × milestone (10× → +100, 100× → +1000) */
const COMBO_BONUS_PER = 10
/** the milestone banner lives this many seconds */
const COMBO_BANNER = 1.5
/**
 * A record is celebrated only if the PREVIOUS record was at least this number.
 * Without the threshold a newcomer's very first run got "new streak record: 8!" on
 * the eighth answer and then stayed silent all the way to a hundred, because we
 * congratulate once per run — exactly the opposite of the intent. Now the first run
 * just RAISES the bar silently, and the congratulation comes when there is something
 * to be proud of: you beat your former self.
 */
const COMBO_RECORD_MIN = 8

// ---- "THE MYSTERY OF THE TRANSITION" (Andrey: «мистика перехода») -----------
// The end of a level is one continuous show, with no dry pauses:
//   1) IMPLODE 0.62s — life lights, the flow, particles, hints and floating numbers
//      drain into the disc, each on its own micro-path (the hum builds);
//   2) a breath of silence;
//   3) the results fly in FAST and COMPACT into that same scene, on top of the
//      collapsed world (stars → score → a thin record line);
//   4) by themselves (no tap needed) → flash → tunnel → world banner.
const IMPLODE_DUR = 0.62
/** how long the results are held "read" before the scene leaves for the portal by itself */
const RESULTS_HOLD = 0.45
/** pause from the last star to the score count-up, and the duration of the count-up */
const COUNT_LAG = 0.28
const COUNT_DUR = 0.5

const smooth01 = (x: number) => { const k = clamp01(x); return k * k * (3 - 2 * k) }

// ── TEXT SHARPNESS ──────────────────────────────────────────────────────────
// Andrey: «шрифт местами размытый/мелкий». Pixi draws every Text into its OWN
// texture, and the density of that texture equals the renderer resolution by
// default. Our renderer lives under the quality.knobs.resCap ceiling: 2 on
// «красиво», 1.5 on «авто» and 1 on «быстро». On a phone with dpr = 3 (his
// realme8 is 3.0) that means the letters were baked into the texture three times
// sparser than the screen pixels and stretched on output — exactly the mush he
// saw. A second source of the same: some texts are scaled in-frame (the condBox
// condition, «мимо» ×1.35 in portrait, the results panels) — with scale > 1 a
// ready texture is stretched once more.
//
// FIXED GLOBALLY: TEXT has its own density, decoupled from resCap. Letter textures
// are small (tens of kilobytes) and cost nothing in fill — resCap exists to save
// the FILL of fullscreen shaders, not letters. We take devicePixelRatio with a
// ×1.5 margin for runtime scaling, a ceiling of 3 (above it the eye sees no
// difference and memory is wasted) and a floor of 2 (on a desktop with dpr = 1 the
// margin is needed just as much — texts spring there too).
function textResolution(): number {
  const dpr = window.devicePixelRatio || 1
  return Math.max(2, Math.min(3, dpr * 1.5))
}

/**
 * The only text factory of the engine. Everything that used to be written as
 * `mkText(...)` now goes through here — and gets an honest texture density.
 * A new text that bypasses the factory will be blurry, as before.
 */
function mkText(opts: TextOptions): Text {
  const t = new Text(opts)
  t.resolution = textResolution()
  return t
}

/** ?music=strudel — turn on the @strudel/web experiment (default is music.ts) */
function useStrudelMusic(): boolean {
  try { return new URLSearchParams(window.location.search).get('music') === 'strudel' }
  catch { return false }
}

// Phase timings of the tunnel portal (frame-by-frame study of Bejeweled 2):
// A disc flies off ~0.45s → B impact spark + white flash ~0.2s → C hypertunnel
// ~1.7s → D eclipse + the new world appearing ~0.5s → E disc flies in ~0.75s →
// the banner holds until the end. Full cycle ~4.1s "door to door".
const TUN_A = 0.45
const TUN_B = 0.65
const TUN_C = 2.35
const TUN_D = 2.85
const TUN_E = 3.6
const TUN_END = 4.1

const SAVE_LEVEL = 'hm2.level'
const SAVE_BEST = 'hm2.best'

interface Firefly {
  sprite: Sprite
  // 'suck' — end of the level: the light drains into the disc along its own spiral
  state: 'orbit' | 'fall' | 'arrive' | 'suck'
  ph: number; x: number; y: number; vy: number
  flash: number // flash on an arp note (a running light) — decays within the frame
  spin: number  // personal spin direction while being sucked in
}

/** pause-menu item: the player can finally get back to the menu */
type PauseAction = 'resume' | 'restart' | 'menu' | 'sound' | 'encyclopedia' | 'quality' | 'audio'
interface PauseItem { kind: PauseAction; txt: Text; y: number; h: number }

export class HappyMath {
  private host: HTMLElement
  private app!: Application
  private disposed = false
  private ready = false

  private W = 0; private H = 0
  private cx = 0; private cy = 0; private R = 0
  private scy = 0            // true vertical centre of the screen (in portrait the disc moves up)
  private portrait = false   // W/H < 1 — vertical layout (phone/shorts)
  private small = false      // narrow screen (< 480px) — bigger hit zones for the buttons
  private shortH = false     // low screen (< 560px): a phone in landscape — the stacks squeeze
  // radius of the Play ball ON THE SPLASH. Normally = R, but on a low landscape
  // (844×390) the ball shrinks: otherwise the satellite orbit, two hint lines, the
  // row of worlds and the "number of the day" do not fit under it — they overlapped
  private splashR = 0
  private satOrbitR = 0      // radius of the splash satellite orbit (tighter in portrait)
  private satR = 0           // radius of a satellite circle
  private pDown: { x: number; y: number; t: number; touch: boolean; diskTap: boolean } | null = null // press start: swipe-skip + deferred tap-vs-swipe decision on touch
  /** a UI element took the whole current gesture (pause/«мимо»/menu item) — pointerup stays silent */
  private uiClaimed = false

  // phases / logic
  private phase: Phase = 'splash'
  private levelIdx = 0
  private level: LevelDef = LEVELS[0]
  private score = 0
  private lives = START_LIVES
  private nextLifeAt = POINTS_PER_LIFE
  private best = 0
  private savedLevel = -1
  /**
   * Snapshot of an UNFINISHED run, found at startup. While it is here, the splash
   * offers not «продолжить: Мир N — M» but «продолжить: Мир N — M · счёт X» and
   * brings the player back with everything he had accumulated. Reset in resetRun
   * (a new run started) and in the clearSession places (the run honestly ended).
   */
  private resumeSnap: SessionSnapshot | null = null

  // ---------- modes: endless + number of the day ----------
  private mode: Mode = 'campaign'
  private endlessBest = Number(localStorage.getItem(SAVE_ENDLESS) || 0)
  private endlessStream: NumberStream | null = null
  private endlessCondEnd = 0    // numIdx at which a new condition is born
  private endlessNextSurp = 6   // moveIdx of the next surprise
  private endlessRoundN = 0     // counter of rounds (conditions)
  // a rule change is an EVENT: banner + ring flash + sound + haptics
  private ruleT = 0             // how much longer the new-rule banner lives
  private ruleColor = RULE_COLORS[0]
  private driftWorld = -1       // current world of the palette drift (the visual journey)
  private dailySeed = 0
  private dailyDoneScore = -1   // score of today's played number of the day (-1 = not played)

  private moveIdx = 0
  private numIdx = 0 // index of the NUMBER (a surprise move does not spend a number — nextTurn canon)
  private currentNumber = 0
  private moveTime = 0
  private moveAnim = 0 // separate clock for the number's arrival (runs in the tutorial too)
  private moveDur = 2
  private tapped = false
  private feedback: 'good' | 'bad' | null = null
  private feedbackT = 0
  private starsEarned = 0
  private paused = false
  /** UI clock: ALWAYS running, even on pause (menu and oscilloscope animation) */
  private uiT = 0
  /** collapsing the world into the disc at the end of a level: seconds left (0 — not running) */
  private implodeT = 0
  private implodeFired = false // the "breath of silence" has already played

  // progress celebration: level results + star economy
  private livesLost = 0        // lives lost DURING the level → quality stars
  private levelScoreStart = 0  // score when entering the level → score FOR the level
  private extraGiftLeft = 0    // milestone 10: an unscheduled gift (once per level)
  private skin = getSkin()     // milestone 15: the disc's second outfit
  private playerName = getName()
  private resultsT = 0
  private resultsPrevT = 0
  private resultsEndT = 2
  private resultsLevelScore = 0
  private resultsNewBest = false
  private resultsToastTexts: string[] = []
  private capstoneParty = false // milestone 51★: fireworks over the whole results screen
  private capstoneAcc = 0
  private resultsFinalHint = 'тапни — в портал'
  private scoreTickAcc = 0
  private scoreTickN = 0
  private totalCache = totalStars() // total stars (cached, so we do not read storage every frame)
  private mouse = { x: -1e4, y: -1e4 } // satellite hover on the splash

  // juice
  private shake = 0
  private flash = 0
  private glow = 0
  private hitStop = 0
  private timeScale = 1
  private slowmoT = 0
  private wobble = 0
  // PROMO CAPTURE (layers for the hologram). Alive only under the dev hooks
  // devLift / devHideBoard — in a normal game all three are zero/false and do nothing.
  private liftT = 0
  private liftDur = 0
  private holoHideBoard = false
  private streak = 0
  private multiplier = 1
  // ── COMBO MILESTONES AND RECORD ─────────────────────────────────────────
  /** which milestones have already been announced ON THIS LEVEL (spam filter) */
  private comboMilesHit = new Set<number>()
  /** best streak of all time (localStorage via progress.ts), cached in memory */
  private comboBest = 0
  /** the bar the RUN started from — this is what must be beaten for a "record".
   *  Comparing with the current comboBest is wrong: it grows on every answer, and then
   *  any streak longer than eight turns out to be a "record" (checked by playing). */
  private comboRunBase = 0
  /** the record has already been celebrated in this run — no second time in a row */
  private comboRecordShown = false
  /** timer of the milestone/record banner and its text */
  private comboBannerT = 0
  private comboBannerIsRecord = false
  private numberFlashT = 0 // warm flash of the number ≤0.15s, then the number is white again
  private ringFlashT = 0   // the colour of the reaction lives in the disc's RING
  private ringFlashCol = 0xffd54a
  // surprises from his old game: they appear IN THE DISC instead of the number (.lvl canon)
  private surpKind: SurpriseKind | null = null
  // ×3 is NOT an inversion (the author's canon: inversion = debuff only). The reward
  // for reaching ×3 is a golden wave across the screen + stronger glow
  private gold3T = 0
  private rotT = 0      // trap: the ring of numbers rotates
  private hintBoost = 0 // gift: a hint for 3 moves
  private tipSurp = false // the first surprise is explained in one line
  private tipTrapSeen = false
  // new campaign surprises (all 9 canon classes)
  private freezeT = 0     // freeze: a FULL time freeze, fullscreen ice at full strength
  private transferT = 0   // transfer: the disc smoothly travels across the screen
  private transferE = 0   // how far we have already travelled (trajectory phase)
  private warpT = 0       // warp: the disc's shape wobbles (scale/skew)
  private cmT = 0         // colorMusic: the screen softly shimmers through the spectrum
  private cmE = 0
  // inversion (debuff, ScreenEffects t2 canon). One timer for the whole scene:
  // 0.5s warning "inhale" → 0.35s smooth in → 1.3s hold → 0.35s out.
  // The strength is not absolute (85%) — not a "bang" but a heavy rolling turn inside out
  private inversionT = 0
  private diskOx = 0      // disc offset (transfer)
  private diskOy = 0

  // storm / atmosphere
  private t = 0
  private pulsePhase = 0
  private pulse = 0.5
  private beatAccent = 0 // accent on the strong BEAT_HZ beat (a decay envelope, not a sine)
  private intensity = 0
  private intensityTarget = 0
  /**
   * A second, SHORT axis — only for the musical bed (music.ts) and the pulse bass.
   * Why two: the visual axis is long now (peak at combo 100), while the music layers
   * switch on thresholds inside music.ts (bass > 0.22, counterpoint > 0.42). Fed with
   * the long curve, the bass would NEVER come in during the campaign (a level is
   * 12–20 moves), and instead of a "calm start" the music would be dead for the whole
   * game. So: the long curve for the eyes, the former arc (streak/12) for the ears —
   * the bed breathes as before, while the BIG sound events now come with milestones
   * and the record, not with the overall heat.
   */
  private musicIntensity = 0
  private hush = 0
  private glitchT = 0 // short glitch-"stumble" on a mistake (RGB shift / tremble)

  // sound (WebAudio synthesis, no assets) + rhythm
  private sound = new SoundEngine()
  // music engine behind a flag: ?music=strudel — the @strudel/web experiment,
  // otherwise (the default) our own generative sequencer music.ts. Both sit on the
  // same audio graph of sound.ts (duck/dip/master/mute come for free).
  // On a phone the music is pre-rendered loops (the audio graph is 19× cheaper, this
  // cures «звук плавает»); on the web — live synthesis. ?music=loops|live
  private music: MusicEngine | StrudelMusicEngine | LoopMusicEngine = useStrudelMusic()
    ? new StrudelMusicEngine(this.sound)
    : useLoopMusic()
      ? new LoopMusicEngine(this.sound)
      : new MusicEngine(this.sound)
  private beatN = 0        // beat number — we catch the boundary for the pulse bass
  private slowWas = false  // was there a slow-mo frame before (lowpass on the master)

  // number explosion celebration: the «числа взрываются сами» queue + ghosts
  private explosionQueue: { delay: number; num: number; pts: number }[] = []
  private ghosts: { txt: Text; x: number; y: number; vx: number; vy: number; vr: number; life: number; maxLife: number; grav: number }[] = []

  // portal
  private portalT = 0
  private portalKind: PortalKind = 'vortex'
  private portalWhite = 0      // white splice flash (tunnel phase B)
  private tunnelPalSet = false // the new world is already revealed (phase D)
  private tunnelChimed = false // the arrival chime has already played
  private tunnelHit = false    // the impact flash (phase B) has already sounded

  // five-layer response (layers of the Bejeweled reference)
  private boltT = 0            // zigzag lightning along the orbit (streak ≥5)
  private boltA0 = 0
  private boltSeed = 0
  private echoQueue: { delay: number; scale: number }[] = [] // cascade echo ×2/×3
  // streak points: ONE growing number «+120» that pulses on every increment
  // (a summing number instead of a stack of «+N +N»)
  private scorePop: { txt: Text; value: number; life: number; maxLife: number; pulse: number } | null = null

  // the "gem" disc shader and the shader threads of the flow
  private glintT = 2.5         // time until the next idle glint (4-6s)
  private glintA = 0           // strength of the current glint 0..1

  private hasGL = true

  // pixi objects and fx boxes
  private world!: Container
  private bloom: AdvancedBloomFilter | null = null
  private invertFx: ColorMatrixFilter | null = null
  private glitchFx: RGBSplitFilter | null = null
  private filterKey = -1 // current world.filters set (bloom|invert|glitch) — do not rebuild it for nothing
  private offQuality: (() => void) | null = null // quality: unsubscribe from level changes
  private cosmos!: Cosmos
  private storm!: StormSystem
  private frost!: Frost
  private musicViz!: MusicViz // audio-reactive layer v2: the note-fall flow / waves / background picture
  private brushAngle = 0      // angle of the next brush stroke on the orbit (the background is painted along with you)
  private arpFireIdx = 0      // running light: index of the life that flashes on an arp note
  private offNoteBus?: () => void
  private protector!: Sprite
  private diskLayer!: Container
  private wings!: Graphics
  private diskGlow!: Graphics
  private diskLens!: Graphics
  private timerRing!: Graphics
  private threads!: Graphics
  private aura!: Graphics
  private numberText!: Text
  private numberGlow!: Text
  // auto-fit of the number into the disc: the key is "how many digits · which R", so
  // the font is not measured every frame, plus the optical shift of the digits' ink centre
  private numFitKey = ''
  private numFitDy = 0
  private surpIcon!: Graphics
  // three-part hint: white text, only the key word in yellow
  private hintBox!: Container
  private hintPre!: Text
  private hintKey!: Text
  private hintPost!: Text
  // level condition — the MAIN text of the screen: white «жми, когда» + the key part
  // in the world's accent colour; softly pulses when the condition is new
  private ruleBanner!: Container    // the «новое правило» banner (endless mode)
  private ruleBannerG!: Graphics
  private ruleBannerLbl!: Text
  private ruleBannerText!: Text
  private comboBanner!: Container   // combo milestone banner «комбо 10×!»
  private comboBannerG!: Graphics
  private comboBannerText!: Text
  private comboBannerSub!: Text
  private condBox!: Container
  private condPre!: Text
  private condKey!: Text
  private seenConds = new Set<string>() // conditions the player has already seen (this session)
  private condNew = false
  private portalLayer!: Container
  private portalStreaks!: Graphics
  private portalFunnel!: Sprite
  private portalSprite!: Sprite
  private portalFilter: Filter | null = null
  private tunnelFilter: Filter | null = null
  private portalFxG!: Graphics   // funnel hole / spark / eclipse disc (Graphics — visible without WebGL too)
  private portalBanner!: Text    // the «Мир N» banner while the disc flies in
  private bolt!: Graphics        // zigzag lightning along the orbit of lights
  private gemSprite!: Sprite     // carrier of the gem-disc shader
  private gemFilter: Filter | null = null
  private flowSprite!: Sprite    // carrier of the flow-thread shader
  private flowFilter: Filter | null = null
  // OSCILLOSCOPE: a circular waveform of the master output around the disc. The chain
  // is shared: the analyser in sound.ts hears both the music (either engine) and the
  // SFX — the wave twitches on a tap by itself. Canvas2D Graphics, so it also works
  // without WebGL.
  private oscG!: Graphics
  /** oscilloscope auto-gain: a slowly decaying peak envelope (like AGC) */
  private oscEnv = 0.05
  private hudLayer!: Container
  private scoreLbl!: Text
  private scoreText!: Text
  private levelText!: Text
  private multiText!: Text
  private lifeBarG!: Graphics   // progress bar towards the next life
  private pauseBtn!: Graphics
  private muteBtn!: Graphics
  private skipBtn!: Container
  private overlay!: Container
  private overlayTitle!: Text
  private overlaySub!: Text
  private overlayScore!: Text
  // card explaining the condition in the level intro
  private learnBox!: Container
  private learnBg!: Graphics
  private learnTitle!: Text
  private learnBody!: Text
  private learnFoot!: Text
  /** all cards of the level condition in the order "pieces → the link" */
  private learnCards: TermCard[] = []
  /** how many of them the player sees for the first time (those open by themselves) */
  private learnFresh = 0
  /** which card is open now; −1 — closed, only the hint line is visible */
  private learnAt = -1
  /** the card was called by hand (a tap on the condition) — then ALL are paged, not only the new ones */
  private learnManual = false
  /** hit zone of the "condition line" in the intro (a tap on it calls the card) */
  private learnHit = { x: 0, y: 0, w: 0, h: 0 }
  /** bottom edge of the opened card (overlay coordinates) — the hint slides under it */
  private learnBottom = -1e9
  private flashRect!: Graphics
  // PAUSE MENU (Andrey: «почему мне нельзя нормально в меню попасть?»)
  private pauseOverlay!: Container
  private pauseVeil!: Graphics
  private pausePanel!: Graphics
  private pauseTitle!: Text
  private pauseOscG!: Graphics // small linear oscillogram — a pretty detail
  private pauseItems: PauseItem[] = []
  // counter of "five quick taps" on the quality line → dev overlay
  private qualityTapN = 0
  private qualityTapT = 0
  private qualityTapMode: QualityMode = 'auto'
  private pauseFocus = 0       // keyboard focus (game-ui-ux: something is always selected)
  private pausePanelBox = { x: 0, y: 0, w: 0, h: 0 }
  // separate volumes — labels under the icons (the note and the speaker are drawn by Graphics)
  private pauseVolMusicLbl!: Text
  private pauseVolSfxLbl!: Text
  /** hit zones of the volume icons in the «звук» row (computed in drawPauseMenu) */
  private volMusicHit = { x: 0, y: 0, r: 0 }
  private volSfxHit = { x: 0, y: 0, r: 0 }
  // the current level's rule + a tip, right in the pause menu
  private pauseRuleText!: Text
  private pauseHintText!: Text
  /** height of the rule block in the current layout (0 — it did not fit on this screen) */
  private pauseRuleH = 0
  /** whether the oscillogram is shown in pause (on a low screen its space costs more) */
  private pauseOscOn = true
  // RULE ENCYCLOPEDIA — a screen on top of pause
  private encOverlay!: Container
  private encVeil!: Graphics
  private encPanel!: Graphics
  private encTitle!: Text
  private encBack!: Text
  private encClip!: Container
  private encScrollBox!: Container
  private encMask!: Graphics
  private encBar!: Graphics
  private encOpen = false
  private encScroll = 0
  private encMaxScroll = 0
  private encViewH = 0
  private encBox = { x: 0, y: 0, w: 0, h: 0 }
  private encBackHit = { x: 0, y: 0, w: 0, h: 0 }
  /** dragging the list: where it was grabbed and from which scroll offset */
  private encDrag: { y: number; from: number; moved: boolean } | null = null
  private splashLayer!: Container
  private splashTitle!: Text
  private splashWings!: Graphics   // wings around Play in the MENU (maximum beauty)
  private splashPlay!: Container
  private splashSub!: Text
  private splashContinue!: Text
  private splashGreet!: Text
  private splashStarsG!: Graphics
  private splashStarsText!: Text
  // menu satellites (his canon of 2016/2017): little circles on the orbit around Play
  private sats: { c: Container; g: Graphics; kind: 'sound' | 'info' | 'records'; x: number; y: number; r: number; scale: number }[] = []
  // world gates: a row of 5 glass circles under Play (an unlocked one is coloured)
  private worldsG!: Graphics
  private worldLabels: Text[] = []
  private worldHits: { x: number; y: number; r: number }[] = []
  private splashGreetFits = true  // does the greeting fit between the title and Play
  private splashGateText!: Text   // «до мира N не хватает звёзд» after the gate block
  private splashGateMsg = ''
  // World circles do NOT jump in on the first tap. The first tap selects (the circle
  // grows, the world name goes into the message line), a repeat tap on it means go, a
  // tap elsewhere clears the selection. −1 = nothing selected.
  private splashWorldSel = -1
  private splashWorldSelT = 0     // time since the selection: the growth spring of the circle
  private splashRowGap = 99      // gap «тапни…» ↔ «продолжить»
  // the ∞ satellite (endless mode) + the «число дня» line — entries into the modes from the splash
  private endlessSat!: Container
  private endlessSatG!: Graphics
  private endlessHit = { x: 0, y: 0, r: 30 }
  private dailyText!: Text
  /** the «число дня» hit zone — a RECTANGLE along the line (it used to be a circle, see renderDailyLine) */
  private dailyHit = { x: 0, y: 0, w: 0, h: 0 }
  // colour music: a fullscreen vignette tinted by the running spectrum
  private cmOverlay!: Sprite
  private waveFx!: Graphics // the golden ×3 wave and the "inhale" before the inversion (screen)
  private iconSheet: Container | null = null // dev sheet of icons (devIconSheet)
  private splashPanel!: Container       // info/records overlay on top of the splash
  private splashPanelKind: 'none' | 'info' | 'records' = 'none'
  private skinBtn!: Graphics            // switch for the disc outfit (milestone 15)
  private skinHit = { x: 0, y: 0, r: 0 }
  // Andrey: «наряды не вижу особо ничего, уберу пока что (оставь на хорошие
  // времена)». The outfit code is ALIVE, only the entry in the UI is hidden.
  // Turn it back on on a live screen: window.__hm.devSkins()
  private skinsUI = false

  // level results screen
  private resultsLayer!: Container
  private resultsVeil!: Graphics   // backdrop of the results scene
  private resultsTitle!: Text
  private resultsStarsG!: Graphics
  private resultsScoreLbl!: Text
  private resultsScoreText!: Text
  private resultsBestText!: Text
  private resultsTotalG!: Graphics
  private resultsTotalText!: Text
  private resultsHint!: Text
  private resultsToasts!: Container
  private resultsBottom = 0   // bottom of the results safe zone (relative to the disc centre)

  private glowTex!: Texture
  private darkTex!: Texture
  private fireflies: Firefly[] = []
  private floats: { txt: Text; life: number; maxLife: number; vy: number }[] = []

  private skipHit = { x: 0, y: 0, r: 0 }
  private pauseHit = { x: 0, y: 0, r: 0 }
  private muteHit = { x: 0, y: 0, r: 0 }

  constructor(host: HTMLElement) {
    this.host = host
    migrateProgress() // milestones 8/20/33/45/51 and the 10×world records — before reading best
    this.best = Number(localStorage.getItem(SAVE_BEST) || 0)
    this.comboBest = bestCombo() // personal streak bar (the combo record)
    const sl = localStorage.getItem(SAVE_LEVEL)
    this.savedLevel = sl === null ? -1 : Number(sl)
    // a run that was interrupted (backgrounded / killed WebView / closed tab)
    this.resumeSnap = loadSession()
    if (this.resumeSnap) {
      console.debug('[hm-resume] найден незавершённый заход:',
        `уровень ${this.resumeSnap.levelIdx}`, `счёт ${this.resumeSnap.score}`, `жизней ${this.resumeSnap.lives}`)
    }
    this.init()
    ;(window as any).__hm = this
    // quality: dev hook for measurements — __hmQ.stats() / __hmQ.setMode('low')
    ;(window as any).__hmQ = quality
    // dev overlay with sound telemetry. It does not show itself — it waits for
    // `?debug=audio`, five taps on the «качество» line, or __hmAudio.toggle().
    audioHUD.wire(this.sound, this.music)
  }

  private async init() {
    const app = new Application()
    await app.init({
      resizeTo: this.host,
      antialias: true,
      background: '#05060d',
      // PROMO CAPTURE: `?holo=1` — a transparent canvas for layers with alpha. It MUST
      // be asked for here: Pixi decides the alpha attribute of the WebGL context once,
      // from backgroundAlpha (GlContextSystem: `alpha = background.alpha < 1`), and the
      // canvas cannot be made transparent later. Without the flag the game is as it was.
      backgroundAlpha: HOLO ? 0 : 1,
      // quality: the pixel density ceiling. On a phone with dpr 3 the former ceiling of
      // 2 meant rendering twice as large as the screen — quadruple fill for nothing.
      // The starting level comes from the previous run (localStorage) or from a guess by
      // the hardware; the fps measurement corrects it after 5 s.
      resolution: Math.min(window.devicePixelRatio || 1, quality.knobs.resCap),
      autoDensity: true,
      preference: 'webgl',
    })
    if (this.disposed) { app.destroy(true); return }
    this.app = app
    this.hasGL = app.renderer.name !== 'canvas' // without WebGL shaders are unavailable — degrade softly
    // the canvas does not trigger CSS font loading — we fetch Nunito explicitly,
    // otherwise Pixi draws the texts with the system serif
    try {
      await Promise.all([
        // the second, sample argument with Cyrillic also triggers the cyrillic subset
        document.fonts.load('800 16px Nunito', 'жми Aa'),
        document.fonts.load('900 16px Nunito', 'жми Aa'),
      ])
    } catch { /* no network/font — we survive on the fallback */ }
    await document.fonts.ready

    this.host.appendChild(app.canvas)
    this.buildScene()
    this.setLevel(0)
    this.updateMetrics()
    this.setPhaseVisibility()

    app.canvas.addEventListener('pointerdown', this.onPointer)
    app.canvas.addEventListener('pointerup', this.onPointerUp)
    app.canvas.addEventListener('pointermove', this.onPointerMove)
    app.canvas.addEventListener('contextmenu', this.onContext)
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('hm-name', this.onName)
    // snapshot of the run when it goes to the background. pagehide catches both
    // "browser minimised" and "tab closed" (unlike beforeunload it works on mobile);
    // visibilitychange is the only thing an Android WebView manages to send before the
    // process is killed.
    document.addEventListener('visibilitychange', this.onVisibility)
    window.addEventListener('pagehide', this.onHide)
    // the mouse wheel pages the encyclopedia (on desktop that is expected)
    app.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    app.renderer.on('resize', this.updateMetrics)

    // quality: spread the knobs over the systems and subscribe to level changes
    this.applyQuality(quality.knobs)
    this.offQuality = quality.subscribe((k) => this.applyQuality(k))

    app.ticker.add((tk) => this.frame(tk.deltaMS / 1000))
    this.ready = true
  }

  /** ── quality: THE ONLY PLACE where the quality level turns into actions ─────
   *  Called once at startup and then on every level change (auto-measurement or the
   *  player's choice in the pause menu). Everything inside is idempotent and creates no
   *  objects, so you can switch back and forth every five seconds if you like. */
  private applyQuality(k: QualityKnobs) {
    this.storm.setQuality(k.particles, k.stream)
    this.cosmos.setQuality(k.cosmosFar, k.cosmosGrain)
    if (this.bloom) {
      this.bloom.blur = k.bloomBlur
      this.bloom.quality = k.bloomQuality
    }
    // the world filter set is rebuilt in render() — we just reset the key
    this.filterKey = -1
    if (!k.bloom) this.world.filters = []
    else if (this.bloom) this.world.filters = [this.bloom]
    // Pixel density is the biggest fill knob, and it CAN be turned at runtime:
    // renderer.resize(w, h, res) recreates the canvas buffer and sends the 'resize'
    // event itself, and updateMetrics already hangs on that event (the whole layout is
    // recomputed, as on a phone rotation).
    if (this.app) {
      const res = Math.min(window.devicePixelRatio || 1, k.resCap)
      const sc = this.app.renderer.screen
      if (Math.abs(this.app.renderer.resolution - res) > 0.01) {
        try { this.app.renderer.resize(sc.width, sc.height, res) }
        catch (e) { console.warn('[hm-quality] resolution не переключилась:', e) }
      }
    }
    if (this.paused) this.drawPauseMenu() // refresh the label of the «качество» item
  }

  destroy() {
    this.disposed = true
    this.music.stop() // also stops the scheduler's worker clock
    if (this.offQuality) { this.offQuality(); this.offQuality = null }
    if (this.offNoteBus) this.offNoteBus()
    if (this.musicViz) this.musicViz.destroy()
    if (!this.app) return
    this.app.canvas.removeEventListener('pointerdown', this.onPointer)
    this.app.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.app.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.app.canvas.removeEventListener('contextmenu', this.onContext)
    window.removeEventListener('keydown', this.onKey)
    window.removeEventListener('hm-name', this.onName)
    document.removeEventListener('visibilitychange', this.onVisibility)
    window.removeEventListener('pagehide', this.onHide)
    this.app.canvas.removeEventListener('wheel', this.onWheel)
    this.app.destroy(true, { children: true })
  }

  // ---------- scene ----------
  private buildScene() {
    this.glowTex = makeGlowTexture()
    this.darkTex = makeDarkTexture()
    const stage = this.app.stage
    this.world = new Container()
    stage.addChild(this.world)

    // living cosmos: gradient + darkness of silence + nebulae + stars — in its own box
    this.cosmos = new Cosmos(this.glowTex)
    this.world.addChild(this.cosmos.layer)

    // audio-reactive layer v2: the background picture and the music waves live LOW (in
    // the nebula), the note-fall flow is higher, right at the disc (see below, before diskLayer)
    this.musicViz = new MusicViz(this.glowTex)
    this.world.addChild(this.musicViz.paint)  // lasting brush strokes of correct answers
    this.world.addChild(this.musicViz.waves)  // concentric music waves across the background

    // storm system: rivers/bokeh under the protector, flow + explosions above it
    const atlas = makeParticleAtlas()
    this.storm = new StormSystem(atlas.glow, atlas.streak, atlas.sparkle)
    this.world.addChild(this.storm.below)

    this.protector = new Sprite(this.darkTex)
    this.protector.anchor.set(0.5)
    this.world.addChild(this.protector)
    this.world.addChild(this.storm.above)

    // note-fall flow: a river of drops THROUGH the disc — above the storm but under the
    // disc (the disc and the number are always on top = readability), the drops fade out
    // at the centre (the protector)
    this.world.addChild(this.musicViz.flow)

    // life lights are musical: on EVERY arp note the next light around the circle
    // flashes — a running light, in sync with the music (not only on the beat)
    this.offNoteBus = noteBus.on((e) => {
      if (e.layer !== 'arp') return
      const orbit = this.fireflies.filter((f) => f.state === 'orbit')
      if (!orbit.length) return
      this.arpFireIdx = (this.arpFireIdx + 1) % orbit.length
      orbit[this.arpFireIdx].flash = 1
    })

    // disc
    this.diskLayer = new Container()
    this.world.addChild(this.diskLayer)
    // shader threads of the flow: a vertical river THROUGH the disc (the lowest disc layer)
    this.flowSprite = new Sprite(Texture.WHITE)
    this.flowSprite.blendMode = 'add'; this.flowSprite.visible = false
    try {
      this.flowFilter = new Filter({
        glProgram: GlProgram.from({ vertex: FILTER_VERT, fragment: FLOW_FRAG, name: 'hm-flow' }),
        resources: {
          uFlowU: {
            uTime: { value: 0, type: 'f32' },
            uFlow: { value: 0, type: 'f32' },
            uHush: { value: 0, type: 'f32' },
            uMult: { value: 1, type: 'f32' },
            uAccent: { value: new Float32Array([1, 0.7, 0.3]), type: 'vec3<f32>' },
            uMid: { value: new Float32Array([0.6, 0.3, 0.1]), type: 'vec3<f32>' },
          },
        },
      })
      this.flowSprite.filters = [this.flowFilter]
      console.debug('[hm-shader]', 'compiled: flow (нити потока)')
    } catch (e) { console.warn('flow shader off:', e); this.flowFilter = null }
    this.diskLayer.addChild(this.flowSprite)
    this.aura = new Graphics(); this.diskLayer.addChild(this.aura)
    // flame wings (the spirit of his 2017 ornament): under the disc glow, additive
    this.wings = new Graphics(); this.wings.blendMode = 'add'; this.diskLayer.addChild(this.wings)
    this.diskGlow = new Graphics(); this.diskLayer.addChild(this.diskGlow)
    this.threads = new Graphics(); this.threads.blendMode = 'add'; this.diskLayer.addChild(this.threads)
    // circular oscillogram: lives OUTSIDE all the disc rings (its own radius), so it
    // does not argue with the timer ring; additive — this is light, not paint
    this.oscG = new Graphics(); this.oscG.blendMode = 'add'; this.diskLayer.addChild(this.oscG)
    // zigzag lightning along the orbit of lights (streak ≥5) — above the threads, additive
    this.bolt = new Graphics(); this.bolt.blendMode = 'add'; this.diskLayer.addChild(this.bolt)
    // "cut gem" disc shader (the Bejeweled material): under the Graphics rim
    this.gemSprite = new Sprite(Texture.WHITE)
    this.gemSprite.visible = false
    try {
      this.gemFilter = new Filter({
        glProgram: GlProgram.from({ vertex: FILTER_VERT, fragment: GEM_FRAG, name: 'hm-gem' }),
        resources: {
          uGemU: {
            uTime: { value: 0, type: 'f32' },
            uGlint: { value: 0, type: 'f32' },
            uGlintPos: { value: new Float32Array([-0.2, -0.15]), type: 'vec2<f32>' },
            uPulse: { value: 0, type: 'f32' },
            uDeep: { value: new Float32Array([0.1, 0.07, 0.02]), type: 'vec3<f32>' },
            uMid: { value: new Float32Array([0.6, 0.3, 0.1]), type: 'vec3<f32>' },
            uAccent: { value: new Float32Array([1, 0.7, 0.3]), type: 'vec3<f32>' },
          },
        },
      })
      this.gemSprite.filters = [this.gemFilter]
      console.debug('[hm-shader]', 'compiled: gem (диск-самоцвет)')
    } catch (e) { console.warn('gem shader off:', e); this.gemFilter = null }
    this.diskLayer.addChild(this.gemSprite)
    this.diskLens = new Graphics(); this.diskLayer.addChild(this.diskLens)
    this.timerRing = new Graphics(); this.diskLayer.addChild(this.timerRing)

    this.numberGlow = mkText({ text: '', style: this.numStyle(true) })
    this.numberGlow.anchor.set(0.5); this.numberGlow.blendMode = 'add'
    try { this.numberGlow.filters = [new BlurFilter({ strength: 10 })] } catch { /* ok */ }
    this.diskLayer.addChild(this.numberGlow)
    this.numberText = mkText({ text: '', style: this.numStyle(false) })
    this.numberText.anchor.set(0.5); this.diskLayer.addChild(this.numberText)

    // surprise in the disc (instead of the number) — a neon icon
    this.surpIcon = new Graphics(); this.surpIcon.blendMode = 'add'
    this.diskLayer.addChild(this.surpIcon)

    // hint: three texts in a row (white + the key word in colour)
    this.hintBox = new Container(); this.diskLayer.addChild(this.hintBox)
    // the hint became quieter in size: it is a helper, not a heading
    const hintStyle = (fill: string) => new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 20, fill })
    this.hintPre = mkText({ text: '', style: hintStyle('#ffffff') })
    this.hintKey = mkText({ text: '', style: hintStyle('#ffd54a') })
    this.hintPost = mkText({ text: '', style: hintStyle('#ffffff') })
    for (const t of [this.hintPre, this.hintKey, this.hintPost]) { t.anchor.set(0, 0.5); this.hintBox.addChild(t) }
    // the level condition at the bottom — bright and weighty (this is the rule of the
    // game, not a caption): the dark outline keeps contrast on any world background
    this.condBox = new Container(); this.diskLayer.addChild(this.condBox)
    this.condPre = mkText({
      text: '', style: new TextStyle({
        fontFamily: 'Nunito', fontWeight: '800', fontSize: 17, fill: '#e8eeff',
        stroke: { color: 0x05060d, width: 3 },
      }),
    })
    this.condKey = mkText({
      text: '', style: new TextStyle({
        fontFamily: 'Nunito', fontWeight: '900', fontSize: 19, fill: '#ffd54a',
        stroke: { color: 0x05060d, width: 4 },
        dropShadow: { color: 0x000000, alpha: 0.45, blur: 3, distance: 2, angle: Math.PI / 3 },
      }),
    })
    for (const t of [this.condPre, this.condKey]) { t.anchor.set(0, 0.5); this.condBox.addChild(t) }
    this.condPre.alpha = 0.8

    // portal
    this.portalLayer = new Container()
    this.world.addChild(this.portalLayer)
    this.portalStreaks = new Graphics(); this.portalStreaks.blendMode = 'add'; this.portalLayer.addChild(this.portalStreaks)
    this.portalFunnel = new Sprite(this.glowTex); this.portalFunnel.anchor.set(0.5); this.portalFunnel.blendMode = 'add'
    this.portalLayer.addChild(this.portalFunnel)
    this.portalSprite = new Sprite(Texture.WHITE)
    this.portalSprite.blendMode = 'add'
    try {
      this.portalFilter = new Filter({
        glProgram: GlProgram.from({ vertex: FILTER_VERT, fragment: PORTAL_FRAG, name: 'hm-portal' }),
        resources: {
          uPortal: {
            uTime: { value: 0, type: 'f32' },
            uProgress: { value: 0, type: 'f32' },
            uAspect: { value: 1, type: 'f32' },
            uAccent: { value: new Float32Array([0.9, 0.4, 1.0]), type: 'vec3<f32>' },
            uMid: { value: new Float32Array([0.2, 0.3, 0.9]), type: 'vec3<f32>' },
            // switch for the star burst right inside the shader (0 — the frame as it was)
            uBurst: { value: VIBE.portalBurst ? 1 : 0, type: 'f32' },
          },
        },
      })
      this.portalSprite.filters = [this.portalFilter]
      this.portalLayer.addChild(this.portalSprite)
      console.debug('[hm-shader]', 'compiled: portal (вихрь)')
    } catch (e) { console.warn('portal shader off:', e); this.portalFilter = null }
    try {
      this.tunnelFilter = new Filter({
        glProgram: GlProgram.from({ vertex: FILTER_VERT, fragment: TUNNEL_FRAG, name: 'hm-tunnel' }),
        resources: {
          uTunnel: {
            uTime: { value: 0, type: 'f32' },
            uProgress: { value: 0, type: 'f32' },
            uAspect: { value: 1, type: 'f32' },
            uAccent: { value: new Float32Array([0.9, 0.4, 1.0]), type: 'vec3<f32>' },
            uMid: { value: new Float32Array([0.2, 0.3, 0.9]), type: 'vec3<f32>' },
            uHue: { value: 0.72, type: 'f32' },
            uBurst: { value: VIBE.portalBurst ? 1 : 0, type: 'f32' },
          },
        },
      })
      console.debug('[hm-shader]', 'compiled: tunnel (гиперпрыжок)')
    } catch (e) { console.warn('tunnel shader off:', e); this.tunnelFilter = null }
    const portalLabel = mkText({ text: 'портал!', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '900', fontSize: 30, fill: '#ffffff' }) })
    portalLabel.anchor.set(0.5); portalLabel.label = 'portalLabel'; this.portalLayer.addChild(portalLabel)
    // funnel hole / impact spark / eclipse disc: Graphics — the phases are visible without WebGL
    this.portalFxG = new Graphics(); this.portalFxG.blendMode = 'add'
    this.portalLayer.addChild(this.portalFxG)
    // the «Мир N» banner — orange-gold in the spirit of the reference's "LEVEL 16"
    this.portalBanner = mkText({
      text: '',
      style: new TextStyle({
        fontFamily: 'Nunito', fontWeight: '900', fontSize: 46, fill: '#ffc030',
        stroke: { color: 0x7a2800, width: 6 },
        dropShadow: { color: 0x000000, alpha: 0.6, blur: 4, distance: 4, angle: Math.PI / 3 },
      }),
    })
    this.portalBanner.anchor.set(0.5); this.portalBanner.visible = false
    this.portalLayer.addChild(this.portalBanner)

    // colour music (ScreenEffects t1 debuff): the whole screen softly shimmers with the
    // spectrum; the centre of the texture is transparent — the number does not drown (protector)
    this.cmOverlay = new Sprite(makeSpectrumVignette())
    this.cmOverlay.blendMode = 'screen'
    this.cmOverlay.visible = false
    this.world.addChild(this.cmOverlay)

    // the golden wave on reaching ×3 (a reward) and the violet "inhale" before the
    // inversion. Soft additive screen — the wave LIES on the world as light, it does not paint it
    this.waveFx = new Graphics()
    this.waveFx.blendMode = 'screen'
    this.world.addChild(this.waveFx)

    // freeze ice: FULLSCREEN, above the world but under the HUD (the author's correction)
    this.frost = new Frost()
    this.world.addChild(this.frost.layer)

    // HUD
    // HUD (Andrey: «ui уровня пугает»): aligned with the Tetris Effect frames — a tiny
    // caption and a value in the corner, and EMPTINESS BREATHING around them.
    // The caption is small and semi-transparent, the value is thin, not a "poster".
    this.hudLayer = new Container()
    this.world.addChild(this.hudLayer)
    this.scoreLbl = mkText({ text: 'счёт', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 11, fill: '#cdd6f0' }) })
    this.scoreLbl.alpha = 0.42; this.hudLayer.addChild(this.scoreLbl)
    this.scoreText = mkText({ text: '0', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 21, fill: '#ffffff' }) })
    this.hudLayer.addChild(this.scoreText)
    this.levelText = mkText({ text: 'Мир 1 — 1', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 12, fill: '#cdd6f0' }) })
    this.levelText.alpha = 0.42; this.hudLayer.addChild(this.levelText)
    this.multiText = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '900', fontSize: 17, fill: '#ffd54a' }) })
    this.hudLayer.addChild(this.multiText)
    // a thin bar "how much is left until the next life" — it stands in the same HUD
    // stack, under it (see renderLifeBar)
    this.lifeBarG = new Graphics(); this.hudLayer.addChild(this.lifeBarG)
    this.pauseBtn = new Graphics(); this.hudLayer.addChild(this.pauseBtn)
    this.muteBtn = new Graphics(); this.hudLayer.addChild(this.muteBtn)
    // the stars on the left are gone (a rudiment of the first skeleton, the author's
    // correction): the stars now live on the level results screen

    // the «мимо» skip button
    this.skipBtn = new Container()
    const sg = new Graphics(); sg.label = 'sg'; this.skipBtn.addChild(sg)
    const sl = mkText({ text: 'мимо', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 16, fill: '#cdd6f0' }) })
    sl.anchor.set(0.5); sl.label = 'sl'; this.skipBtn.addChild(sl)
    this.hudLayer.addChild(this.skipBtn)

    // splash
    this.splashLayer = new Container(); this.world.addChild(this.splashLayer)
    this.splashTitle = mkText({ text: 'Happy Math', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '900', fontSize: 54, fill: '#ffffff' }) })
    this.splashTitle.anchor.set(0.5); this.splashLayer.addChild(this.splashTitle)
    // Andrey: «в ГЛАВНОМ МЕНЮ — сразу максимум красоты». The flame wings (his 2017
    // ornament) breathe around Play at full strength. In BATTLE nothing changes: the same
    // drawWings there, but with a progression by streak — the author said he likes the
    // in-battle presentation as it is.
    this.splashWings = new Graphics(); this.splashWings.blendMode = 'add'
    this.splashLayer.addChild(this.splashWings)
    this.splashPlay = new Container(); this.splashLayer.addChild(this.splashPlay)
    // the halo around Play used to be a flat Graphics circle — on a dark background it
    // read as a "brown pancake" with a visible edge. Now it is a soft radial glow (the
    // same texture as the stars and the nebulae), the tone comes from the world palette.
    const halo = new Sprite(this.glowTex)
    halo.label = 'halo'; halo.anchor.set(0.5); halo.blendMode = 'add'
    this.splashPlay.addChild(halo)
    const pd = new Graphics(); pd.label = 'pd'; this.splashPlay.addChild(pd)
    this.splashSub = mkText({ text: 'тапни — и сразу играем', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 20, fill: '#cdd6f0' }) })
    this.splashSub.anchor.set(0.5); this.splashSub.alpha = 0.7; this.splashLayer.addChild(this.splashSub)
    this.splashContinue = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 20, fill: '#9adfff' }) })
    this.splashContinue.anchor.set(0.5); this.splashLayer.addChild(this.splashContinue)
    // «Привет, {имя}!» — the canon of his old splash («Привет, Павел!»)
    this.splashGreet = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 22, fill: '#ffe9a0' }) })
    this.splashGreet.anchor.set(0.5); this.splashLayer.addChild(this.splashGreet)
    // the star piggy bank in the corner of the splash
    this.splashStarsG = new Graphics(); this.splashLayer.addChild(this.splashStarsG)
    this.splashStarsText = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 20, fill: '#ffd54a' }) })
    this.splashStarsText.anchor.set(0, 0.5); this.splashLayer.addChild(this.splashStarsText)
    // menu satellites: glass circles on the orbit around Play (his 2016/2017 canon)
    for (const kind of ['sound', 'info', 'records'] as const) {
      const c = new Container()
      const g = new Graphics(); c.addChild(g)
      this.splashLayer.addChild(c)
      this.sats.push({ c, g, kind, x: 0, y: 0, r: 30, scale: 1 })
    }
    // world gates: a row of 5 glass circles under Play — the campaign map.
    // An unlocked world is coloured (a tap = play from the first uncompleted level),
    // a locked one is dark with the «N ★» threshold (the star is Graphics, no emoji)
    this.worldsG = new Graphics(); this.splashLayer.addChild(this.worldsG)
    for (let w = 0; w < WORLD_COUNT; w++) {
      const t = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '900', fontSize: 16, fill: '#ffffff' }) })
      t.anchor.set(0.5)
      this.splashLayer.addChild(t)
      this.worldLabels.push(t)
      this.worldHits.push({ x: 0, y: 0, r: 22 })
    }
    // the gate message: «до мира N не хватает звёзд» (after a block by the portal)
    this.splashGateText = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 18, fill: '#ffe9a0', align: 'center' }) })
    this.splashGateText.anchor.set(0.5); this.splashLayer.addChild(this.splashGateText)
    // the ∞ satellite (endless mode): a fourth circle on the orbit around Play.
    // The ∞ symbol is drawn with curves (Graphics), not with a text glyph.
    this.endlessSat = new Container()
    this.endlessSatG = new Graphics(); this.endlessSat.addChild(this.endlessSatG)
    this.splashLayer.addChild(this.endlessSat)
    // the «число дня: {дата}» line — small, under the gates
    this.dailyText = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 15, fill: '#9adfff', align: 'center' }) })
    this.dailyText.anchor.set(0.5); this.dailyText.alpha = 0.85; this.splashLayer.addChild(this.dailyText)
    // switch for the disc outfit (appears with milestone 15) — discreetly in the corner
    this.skinBtn = new Graphics(); this.splashLayer.addChild(this.skinBtn)
    // info/records overlay — on top of the whole splash
    this.splashPanel = new Container(); this.splashPanel.visible = false
    this.splashLayer.addChild(this.splashPanel)

    // level results screen — the celebration of progress
    this.resultsLayer = new Container(); this.world.addChild(this.resultsLayer)
    // RESULTS BACKDROP (accepted in a live Chrome). On the results the brush-stroke
    // background picture (resultsGlow), the collapsing world and bloom all shine at once
    // — on a bright frame the golden fill of the stars, the soft wings and the quiet score
    // lines drowned, only outlines were left («пустые белые звёзды»). A dark backdrop puts
    // the celebration on ITS OWN background: the world dims, fills and text read again.
    this.resultsVeil = new Graphics(); this.resultsLayer.addChild(this.resultsVeil)
    // The results are now WOVEN into the collapse scene instead of being a separate
    // table: everything is more compact and quieter, «лучший счёт» is a thin line, not a poster
    this.resultsTitle = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '900', fontSize: 26, fill: '#ffffff' }) })
    this.resultsTitle.anchor.set(0.5); this.resultsLayer.addChild(this.resultsTitle)
    this.resultsStarsG = new Graphics(); this.resultsLayer.addChild(this.resultsStarsG)
    this.resultsScoreLbl = mkText({ text: 'за уровень', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 12, fill: '#cdd6f0' }) })
    this.resultsScoreLbl.anchor.set(0.5); this.resultsScoreLbl.alpha = 0.5; this.resultsLayer.addChild(this.resultsScoreLbl)
    this.resultsScoreText = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '900', fontSize: 38, fill: '#ffffff' }) })
    this.resultsScoreText.anchor.set(0.5); this.resultsLayer.addChild(this.resultsScoreText)
    this.resultsBestText = mkText({ text: 'лучший результат уровня', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 14, fill: '#ffd54a' }) })
    this.resultsBestText.anchor.set(0.5); this.resultsBestText.alpha = 0.85; this.resultsLayer.addChild(this.resultsBestText)
    this.resultsTotalG = new Graphics(); this.resultsLayer.addChild(this.resultsTotalG)
    this.resultsTotalText = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 13, fill: '#cdd6f0' }) })
    this.resultsTotalText.anchor.set(0, 0.5); this.resultsLayer.addChild(this.resultsTotalText)
    this.resultsToasts = new Container(); this.resultsLayer.addChild(this.resultsToasts)
    this.resultsHint = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 14, fill: '#9adfff' }) })
    this.resultsHint.anchor.set(0.5); this.resultsLayer.addChild(this.resultsHint)

    // final screens
    this.overlay = new Container(); this.world.addChild(this.overlay)
    this.overlayTitle = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '900', fontSize: 34, fill: '#ffffff' }) })
    this.overlayTitle.anchor.set(0.5); this.overlay.addChild(this.overlayTitle)
    this.overlayScore = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '900', fontSize: 40, fill: '#ffffff' }) })
    this.overlayScore.anchor.set(0.5); this.overlay.addChild(this.overlayScore)
    this.overlaySub = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 20, fill: '#cdd6f0' }) })
    this.overlaySub.anchor.set(0.5); this.overlaySub.alpha = 0.7; this.overlay.addChild(this.overlaySub)

    // CONDITION EXPLANATION CARD. Lives only in the level intro: on the first
    // appearance of a new kind of condition it opens by itself, after that — on a tap on
    // the condition line. Its own layer, on top of overlay.
    this.learnBox = new Container(); this.learnBox.visible = false
    this.overlay.addChild(this.learnBox)
    this.learnBg = new Graphics(); this.learnBox.addChild(this.learnBg)
    this.learnTitle = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '900', fontSize: 20, fill: '#ffffff' }) })
    this.learnTitle.anchor.set(0.5, 0); this.learnBox.addChild(this.learnTitle)
    this.learnBody = mkText({
      text: '', style: new TextStyle({
        fontFamily: 'Nunito', fontWeight: '700', fontSize: 16, fill: '#e7ecff',
        align: 'center', wordWrap: true, wordWrapWidth: 300, lineHeight: 22,
      }),
    })
    this.learnBody.anchor.set(0.5, 0); this.learnBox.addChild(this.learnBody)
    this.learnFoot = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 13, fill: '#9adfff', align: 'center' }) })
    this.learnFoot.anchor.set(0.5, 0); this.learnFoot.alpha = 0.85; this.learnBox.addChild(this.learnFoot)

    // PAUSE MENU: not a «пауза» caption but a real mini menu — ПРОДОЛЖИТЬ / ЗАНОВО
    // УРОВЕНЬ / В МЕНЮ / звук. Screen stack per game-ui-ux: pause lies ON TOP of the
    // game, takes all input, "back" = resume.
    this.pauseOverlay = new Container(); this.world.addChild(this.pauseOverlay)
    this.pauseVeil = new Graphics(); this.pauseOverlay.addChild(this.pauseVeil)
    this.pausePanel = new Graphics(); this.pauseOverlay.addChild(this.pausePanel)
    this.pauseTitle = mkText({ text: 'пауза', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '900', fontSize: 26, fill: '#ffffff' }) })
    this.pauseTitle.anchor.set(0.5); this.pauseOverlay.addChild(this.pauseTitle)
    this.pauseOscG = new Graphics(); this.pauseOscG.blendMode = 'add'; this.pauseOverlay.addChild(this.pauseOscG)
    // quality: the fifth item — «качество» (his request to "let the user choose"). The
    // panel computes its height from the length of this list, and the hit test goes by the
    // same list — adding an item requires nothing anywhere else.
    // The sixth item — «звук: богатый/экономный». A knob separate from graphics quality on
    // purpose: the audio graph loads ITS OWN thread, and tastes differ here (some prefer
    // rich sound with a simple picture).
    // The seventh item — «энциклопедия правил» (a scrollable list of all opened conditions
    // with their cards). The «звук» line turned into a row with TWO step icons (a note and
    // a speaker) — its label is empty, everything is drawn by drawPauseMenu with Graphics
    // (emoji are forbidden in the game).
    for (const kind of ['resume', 'restart', 'menu', 'sound', 'encyclopedia', 'quality', 'audio'] as PauseAction[]) {
      const txt = mkText({ text: '', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 19, fill: '#e8eeff' }) })
      txt.anchor.set(0.5)
      this.pauseOverlay.addChild(txt)
      this.pauseItems.push({ kind, txt, y: 0, h: 46 })
    }
    // labels under the volume icons (Graphics cannot do letters, and letters are needed here)
    this.pauseVolMusicLbl = mkText({ text: 'музыка', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 12, fill: '#cdd6f0' }) })
    this.pauseVolMusicLbl.anchor.set(0, 0.5); this.pauseVolMusicLbl.alpha = 0.75
    this.pauseOverlay.addChild(this.pauseVolMusicLbl)
    this.pauseVolSfxLbl = mkText({ text: 'звуки', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 12, fill: '#cdd6f0' }) })
    this.pauseVolSfxLbl.anchor.set(0, 0.5); this.pauseVolSfxLbl.alpha = 0.75
    this.pauseOverlay.addChild(this.pauseVolSfxLbl)

    // ── THE CURRENT LEVEL'S RULE IN PAUSE ────────────────────────────────────
    // Andrey's wish: «ПРАВИЛО текущего уровня + быстрая подсказка („делится на 3 = сумма
    // цифр делится на 3“)». Pause is the only place where the player can calmly re-read
    // the condition without losing a life: the condition line at the bottom of the screen
    // reads badly in battle, and the explanation card lives only in the intro.
    this.pauseRuleText = mkText({
      text: '', style: new TextStyle({
        fontFamily: 'Nunito', fontWeight: '900', fontSize: 17, fill: '#ffffff', align: 'center',
      }),
    })
    this.pauseRuleText.anchor.set(0.5); this.pauseOverlay.addChild(this.pauseRuleText)
    this.pauseHintText = mkText({
      text: '', style: new TextStyle({
        fontFamily: 'Nunito', fontWeight: '800', fontSize: 13, fill: '#9adfff', align: 'center',
      }),
    })
    this.pauseHintText.anchor.set(0.5); this.pauseHintText.alpha = 0.9
    this.pauseOverlay.addChild(this.pauseHintText)

    // ── RULE ENCYCLOPEDIA ────────────────────────────────────────────────────
    // A separate screen on top of pause: a veil, a «назад» header, a scrollable list of
    // all OPENED conditions with their cards (termCards — they already exist, we do not
    // invent texts). Scrolling by dragging and by the wheel; the content lives in the
    // encScroll container under a mask, so the lines do not stick out of the panel.
    this.encOverlay = new Container(); this.encOverlay.visible = false
    this.world.addChild(this.encOverlay)
    this.encVeil = new Graphics(); this.encOverlay.addChild(this.encVeil)
    this.encPanel = new Graphics(); this.encOverlay.addChild(this.encPanel)
    this.encTitle = mkText({ text: 'энциклопедия правил', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '900', fontSize: 20, fill: '#ffffff' }) })
    this.encTitle.anchor.set(0.5); this.encOverlay.addChild(this.encTitle)
    this.encBack = mkText({ text: '‹ назад', style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 16, fill: '#9adfff' }) })
    this.encBack.anchor.set(0, 0.5); this.encOverlay.addChild(this.encBack)
    this.encClip = new Container(); this.encOverlay.addChild(this.encClip)
    this.encScrollBox = new Container(); this.encClip.addChild(this.encScrollBox)
    this.encMask = new Graphics(); this.encOverlay.addChild(this.encMask)
    this.encClip.mask = this.encMask
    this.encBar = new Graphics(); this.encOverlay.addChild(this.encBar)

    // ── RULE CHANGE BANNER (bug: "a rule change in endless goes unnoticed").
    //    A big banner with the new condition, lives RULE_BANNER seconds on top of the
    //    world. In hudLayer? No — in world above everything in the game, so HUD
    //    visibility does not hide it, but under the pause menu.
    this.ruleBanner = new Container()
    this.ruleBanner.visible = false
    this.world.addChild(this.ruleBanner)
    this.ruleBannerG = new Graphics(); this.ruleBanner.addChild(this.ruleBannerG)
    this.ruleBannerLbl = mkText({
      text: 'новое правило', style: new TextStyle({
        fontFamily: 'Nunito', fontWeight: '800', fontSize: 14, fill: '#cdd6f0',
      }),
    })
    this.ruleBannerLbl.anchor.set(0.5); this.ruleBanner.addChild(this.ruleBannerLbl)
    this.ruleBannerText = mkText({
      text: '', style: new TextStyle({
        fontFamily: 'Nunito', fontWeight: '900', fontSize: 26, fill: '#ffd54a',
        stroke: { color: 0x05060d, width: 4, join: 'round' },
        align: 'center',
      }),
    })
    this.ruleBannerText.anchor.set(0.5); this.ruleBanner.addChild(this.ruleBannerText)

    // ── COMBO MILESTONE BANNER ──────────────────────────────────────────────
    //    Andrey: «показывать не всегда, а что уже 10х 50х 100х комбо» — a short banner
    //    above the disc. Built like the rule banner (fly-in with a bounce, hold, soft
    //    exit), but it lives shorter and speaks with a big number: the caption is read
    //    in half a glance, because at that moment the player looks AT THE DISC, not at
    //    the text.
    this.comboBanner = new Container()
    this.comboBanner.visible = false
    this.world.addChild(this.comboBanner)
    this.comboBannerG = new Graphics(); this.comboBanner.addChild(this.comboBannerG)
    this.comboBannerText = mkText({
      text: '', style: new TextStyle({
        fontFamily: 'Nunito', fontWeight: '900', fontSize: 30, fill: '#ffd54a',
        stroke: { color: 0x05060d, width: 4, join: 'round' },
        align: 'center',
      }),
    })
    this.comboBannerText.anchor.set(0.5); this.comboBanner.addChild(this.comboBannerText)
    this.comboBannerSub = mkText({
      text: '', style: new TextStyle({
        fontFamily: 'Nunito', fontWeight: '800', fontSize: 15, fill: '#cdd6f0',
      }),
    })
    this.comboBannerSub.anchor.set(0.5); this.comboBanner.addChild(this.comboBannerSub)

    // error flash — on top of the world, does not shake
    this.overlayHostFlash()

    // bloom over the whole world: bright things glow and bleed (Tetris Effect).
    // The threshold keeps the dark disc clean, the protector guards the number's readability.
    if (this.hasGL) {
      try {
        this.bloom = new AdvancedBloomFilter({
          threshold: 0.5, bloomScale: 1.0, brightness: 1.0, blur: 7, quality: 4,
        })
        this.world.filters = [this.bloom]
      } catch (e) { console.warn('bloom off:', e); this.bloom = null }
      // colour inversion — a port of the spirit of his inversion_fragment.glsl (ColorMatrix negative)
      try { this.invertFx = new ColorMatrixFilter(); this.invertFx.negative(false) }
      catch (e) { console.warn('invert off:', e); this.invertFx = null }
      // glitch "stumble" on a mistake: a brief RGB shift (lives ~0.25s, see glitchT)
      try { this.glitchFx = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } }) }
      catch (e) { console.warn('glitch off:', e); this.glitchFx = null }
    }
  }

  private overlayHostFlash() {
    this.flashRect = new Graphics()
    this.app.stage.addChild(this.flashRect)
  }

  private numStyle(glow: boolean) {
    // The gem glows from inside now (a base of ~0.35-0.47 lightness), so the white number
    // needs a dark outline — the Bejeweled trick "a dark outline = readability on any
    // background". The glow layer gets no outline, otherwise the halo around the number
    // darkens instead of shining.
    return new TextStyle({
      fontFamily: 'Nunito', fontWeight: '900', fontSize: 80,
      fill: glow ? '#38c0ff' : '#ffffff',
      ...(glow ? {} : { stroke: { color: 0x0b0a1e, width: 5, join: 'round' as const } }),
    })
  }

  /**
   * AUTO-FIT + OPTICAL CENTRING OF THE NUMBER. Andrey: «число съезжает при 3 цифрах, а
   * когда будет больше?»
   *
   * It used to be a hard `R * 0.85` font size for any digit count. Already «888» hit the
   * rim, «8888»/«88888» (endless mode!) went OUTSIDE the disc by half a screen. On top of
   * that `anchor(0.5)` centres by the TEXT BLOCK (which includes the font's descender —
   * ~0.21em in Nunito), while digits have no descenders, so the number visually sat below
   * the disc centre by ~4-5% of the font size.
   *
   * Now: the font size shrinks so the line fits the chord inside the rim, and a shift up
   * by the difference "block centre ↔ ink centre of the digits" is added. The metrics are
   * computed once per (digit count, R) pair — the key is `numFitKey`.
   */
  private fitNumber(str: string, force = false) {
    const key = `${str.length}|${Math.round(this.R)}`
    if (!force && key === this.numFitKey) return
    this.numFitKey = key

    const base = Math.max(10, Math.round(this.R * 0.85))
    // width of the line inside the rim: the rim is drawn at R, we leave air on the sides
    const maxW = this.R * 1.56
    const st = this.numberText.style
    st.fontSize = base
    const w0 = CanvasTextMetrics.measureText(str, st).width
    const size = w0 > maxW ? Math.max(10, Math.floor(base * (maxW / w0))) : base

    // the outline shrinks with the font size — otherwise it eats the eye of a digit at 5 characters
    const strokeW = Math.max(2, Math.round(5 * (size / base) * 10) / 10)
    st.fontSize = size
    st.stroke = { color: 0x0b0a1e, width: strokeW, join: 'round' }
    this.numberGlow.style.fontSize = size

    // optical centre: the block = ascent+descent(+outline), the ink of the digits stands
    // on the baseline and rises to cap height. The shift is computed honestly from metrics.
    const fp = CanvasTextMetrics.measureText('8', st).fontProperties
    const cap = this.digitInkAscent(size)
    this.numFitDy = (fp.descent - fp.ascent) / 2 + cap / 2
  }

  /** height of the ink of the digit «8» above the baseline (cap height) for the current font size */
  private digitInkAscent(size: number): number {
    const ctx = this.measureCtx()
    if (!ctx) return size * 0.72
    ctx.font = `900 ${size}px Nunito`
    const m = ctx.measureText('8')
    return m.actualBoundingBoxAscent || size * 0.72
  }

  private measureCanvasCtx: CanvasRenderingContext2D | null | undefined
  private measureCtx(): CanvasRenderingContext2D | null {
    if (this.measureCanvasCtx === undefined) {
      try {
        const c = document.createElement('canvas')
        c.width = c.height = 8
        this.measureCanvasCtx = c.getContext('2d')
      } catch { this.measureCanvasCtx = null }
    }
    return this.measureCanvasCtx ?? null
  }

  /**
   * Auto-fit of a text by width: we take the base font size and shrink it if the line is
   * wider than allowed. Cheap (Pixi caches metrics), call it when the text changes.
   *
   * The shrinking has a FLOOR. Without it a long line simply shrank to 9px — formally it
   * "fitted", but it was unreadable (the finale on 360px: 11px across the full width).
   * Now, if fitting needs a size below minSize, the line WRAPS by words and stays big.
   * minSize = 0 — the former behaviour (for lines laid out in a row by hand, which a wrap
   * would break).
   */
  private fitTextToWidth(t: Text, baseSize: number, maxW: number, minSize = 0) {
    const st = t.style
    if (st.wordWrap) st.wordWrap = false // measure as a single line
    if (st.fontSize !== baseSize) st.fontSize = baseSize
    const w = CanvasTextMetrics.measureText(t.text, st).width
    if (w <= maxW) return
    const want = Math.floor(baseSize * (maxW / w))
    if (!minSize || want >= minSize) { st.fontSize = Math.max(9, want); return }
    st.fontSize = minSize
    st.wordWrap = true
    st.wordWrapWidth = maxW
    st.align = 'center'
  }

  /**
   * Overlay texts (intro / gameover / finale) within the screen bounds: the score does not
   * stick out of the disc rim (4-6 digits in endless mode), the title and the condition
   * line are not cut off by the edges of a narrow phone.
   * The title and the subtitle have a font size floor — below it the text wraps.
   */
  private fitOverlayTexts() {
    this.fitTextToWidth(this.overlayScore, 40, this.R * 1.56)
    this.fitTextToWidth(this.overlayTitle, 34, this.W - 28, 20)
    this.fitTextToWidth(this.overlaySub, 20, this.W - 28, 15)
  }

  /**
   * SPLASH lines that had no fit at all and were cut off by the phone edges (measured on
   * 360×780): the gate message «мир 4 откроется с 20 звёздами (у тебя 0)» was cut on BOTH
   * sides; the greeting «Привет, {имя}! Удачной игры!» hit the edges already on the name
   * «Андрей», and a name can be up to 16 characters; «продолжить: Мир N — M» and the
   * number-of-the-day line lived right at the limit.
   * Call it when the text changes (renderSplash) — Pixi caches the metrics.
   */
  /**
   * SPLASH HEADER as an honest stack (found with a land 844×390 screenshot): the title
   * stood at cy − sR·1.95, the greeting at cy − sR·1.5, i.e. 0.45·sR ≈ 22px between them
   * with a title height of ~70px — «Привет, {имя}! Удачной игры!» LAY RIGHT ON TOP of
   * «Happy Math». Now we count by real heights, and if there is no room above the Play
   * ball the greeting hides (the title matters more). Called from updateMetrics and after
   * fitting the splash lines.
   */
  private layoutSplashHeader() {
    const sR = this.splashR
    const titleH = this.splashTitle.height
    const greetH = this.splashGreet.text ? this.splashGreet.height : 26
    const playTop = this.cy - sR * 1.28              // edge of the Play halo
    let titleY = Math.max(this.cy - sR * 1.95, titleH / 2 + 8)
    const greetY = titleY + titleH / 2 + greetH / 2 + 2
    this.splashGreetFits = greetY + greetH / 2 <= playTop
    if (!this.splashGreetFits) titleY = Math.max(titleH / 2 + 8, this.cy - sR * 1.75)
    this.splashTitle.position.set(this.cx, titleY)
    this.splashGreet.position.set(this.cx, greetY)
  }

  private fitSplashTexts() {
    const maxW = this.W - 24
    this.fitTextToWidth(this.splashTitle, this.shortH && !this.portrait ? 36 : this.small ? 46 : 54, maxW)
    this.fitTextToWidth(this.splashGreet, 22, maxW, 15)
    this.fitTextToWidth(this.splashGateText, 18, maxW, 13)
    this.fitTextToWidth(this.splashContinue, 20, maxW)
    this.fitTextToWidth(this.splashSub, 20, maxW)
    this.fitTextToWidth(this.dailyText, 15, maxW)
    this.layoutSplashHeader() // the font sizes changed — rebuild the header stack
  }

  // ---------- metrics / layout ----------
  private updateMetrics = () => {
    if (!this.app) return
    this.W = this.app.screen.width
    this.H = this.app.screen.height
    // the layout is recomputed LIVE on every resize/rotation — a single code base
    const aspectWH = this.W / this.H
    this.portrait = aspectWH < 1
    this.small = this.W < 480
    this.scy = this.H / 2
    this.cx = this.W / 2
    if (this.portrait) {
      // the disc is bigger relative to the width (a finger) and A BIT above the centre (the bottom is reached by the thumb)
      this.R = Math.min(this.W * 0.30, this.H * 0.19)
      this.cy = this.H * 0.43
    } else {
      // landscape — as it was (no regressions allowed)
      this.R = Math.min(this.W, this.H) * 0.17
      // ⚠ on a LOW phone landscape (844×390) a centred disc left no room at the bottom —
      // «мимо» sat on the condition line, and its tap zone overlapped the disc tap zone
      // (a tap on the edge of the ball = a lost life). We raise the ball, as in portrait.
      // On a 1440×900 desktop everything is as it was.
      this.cy = this.H < 520 ? this.H * 0.42 : this.scy
    }
    this.shortH = this.H < 560
    this.splashR = (!this.portrait && this.shortH) ? Math.min(this.R, this.H * 0.125) : this.R

    this.cosmos.resize(this.W, this.H)
    this.storm.resize(this.W, this.H, this.cx, this.cy, this.R)
    this.frost.resize(this.W, this.H)
    this.cmOverlay.width = this.W; this.cmOverlay.height = this.H
    // bloom must not compute bounds from particles that flew away — we pin the area to the screen
    this.world.filterArea = new Rectangle(0, 0, this.W, this.H)
    this.portalSprite.width = this.W; this.portalSprite.height = this.H
    // the layer stands at the centre of the screen while the sprite anchor is (0,0) — shift it to cover the whole screen
    this.portalSprite.position.set(-this.cx, -this.cy)
    this.protector.position.set(this.cx, this.cy)
    this.protector.width = this.R * 4.4; this.protector.height = this.R * 4.4

    const aspect = this.W / this.H
    if (this.portalFilter) (this.portalFilter.resources as any).uPortal.uniforms.uAspect = aspect
    if (this.tunnelFilter) (this.tunnelFilter.resources as any).uTunnel.uniforms.uAspect = aspect

    this.diskLayer.position.set(this.cx, this.cy)
    this.portalLayer.position.set(this.cx, this.cy)
    // carriers of the disc shaders: the gem is a square slightly wider than the disc (room
    // for the outline), the threads are a ribbon over the full screen height THROUGH the
    // disc. Coordinates are inside diskLayer
    const gemS = this.R * 2.08
    this.gemSprite.width = this.gemSprite.height = gemS
    this.gemSprite.position.set(-gemS / 2, -gemS / 2)
    this.flowSprite.width = this.R * 3.2
    this.flowSprite.height = this.H
    this.flowSprite.position.set(-this.R * 1.6, -this.cy)
    this.portalBanner.position.set(0, -this.R * 0.1)
    // the number font size is computed by auto-fit (digit count × R) — see fitNumber
    this.fitNumber(this.numberText.text || '8', true)
    this.numberText.position.set(0, this.numFitDy); this.numberGlow.position.set(0, this.numFitDy)
    this.hintBox.position.set(0, this.R + (this.portrait ? 40 : 44))
    // the condition above the bottom edge: a safe-area inset (Capacitor gives edge-to-edge)
    // — a fixed ~4.5% of the height in portrait (env(safe-area-inset) cannot reach canvas coordinates)
    const condMargin = this.portrait ? Math.max(34, Math.round(this.H * 0.045)) : 34
    this.condBox.position.set(0, (this.H - condMargin) - this.cy) // bottom of the screen relative to the disc centre

    // HUD — corners (robust to orientation). A «caption → value» stack with air:
    // a small caption, the value under it, the world even lower and very quiet
    this.scoreLbl.position.set(22, 18)
    this.scoreText.position.set(22, 29)
    this.levelText.position.set(22, 58)
    this.multiText.position.set(22, 76)
    // pause hit zone: ≥44px across always, more generous in portrait (a finger)
    const btnR = this.portrait ? 30 : this.small ? 26 : 24
    const btnY = Math.max(34, btnR + 10)
    this.pauseHit = { x: this.W - (btnR + 12), y: btnY, r: btnR }
    // The sound button is REMOVED from the battle HUD (Andrey: «попробовал во время игры
    // и жизнь пропала пока отвлекался»). Mute lives in the pause menu and on the M key.
    // Zero radius = no zone either for a tap or for drawing.
    this.muteHit = { x: -1e4, y: -1e4, r: 0 }
    // the skip button under the disc: a big zone for the thumb in portrait, with a margin
    // so the «жми!» hint (at R+40) does not overlap the enlarged chevron
    const skipGap = this.portrait ? Math.max(118, this.R * 0.78) : 96
    const skipR = this.portrait ? 62 : this.small ? 52 : 40
    // ⚠ on a narrow landscape 844×390 the «мимо» button stood at y = cy+R+96 = 357 and the
    // condition line at H−34 = 356. They were drawn on top of each other. We press «мимо»
    // so that there is air above the condition, but no closer than 30px to the disc rim
    // (otherwise a tap on the button starts to catch the disc).
    const condY = (this.H - condMargin)
    const sy = Math.max(
      this.cy + this.R + 30,
      Math.min(this.cy + this.R + skipGap, condY - 26 - skipR * 0.62),
    )
    this.skipBtn.position.set(this.cx, sy)
    this.skipBtn.scale.set(this.portrait ? 1.35 : 1) // the chevron visual is bigger for the finger
    this.skipHit = { x: this.cx, y: sy, r: skipR }
    ;(this.skipBtn.getChildByLabel('sl') as Text).position.set(0, 0)

    // splash (everything from splashR — on a low landscape the ball is squeezed, see splashR)
    const sR = this.splashR
    this.splashPlay.position.set(this.cx, this.cy)
    // ⚠ found with a land 844×390 screenshot: «Happy Math» stood at cy − sR·1.95 and the
    // greeting at cy − sR·1.5, i.e. only 0.45·sR ≈ 22px between them — with a title height
    // of ~70px. On a low landscape «Привет, {имя}! Удачной игры!» LAY RIGHT ON THE TITLE.
    // Now the header is an honest stack by the real text heights, and if there is
    // physically no room above the Play ball the greeting hides (the title matters more).
    this.layoutSplashHeader()
    // menu satellites: in portrait the orbit is tighter (the disc is bigger), in landscape — as it was
    this.satR = Math.max(24, sR * 0.21)
    this.satOrbitR = sR * (this.portrait ? 1.5 : 1.85)
    // narrow portrait: ∞/sound — the leftmost satellites (angle ≈ π) stuck out over the left edge.
    // We squeeze the orbit so that the outermost satellite with its glass rim (satR*1.35)
    // keeps ≥8px from both edges. On wide viewports min() does not trigger (no change).
    const satEdge = this.satR * 1.4 // room for the glass rim of the circle
    this.satOrbitR = Math.min(this.satOrbitR, this.cx - 8 - satEdge, this.W - this.cx - 8 - satEdge)
    // On a LOW landscape window (1280×620) the satellite orbit ate the whole bottom strip
    // — the «продолжить: Мир N — M» line had no room between the lowest satellite and the
    // row of worlds, and it lay on the «i» satellite. We tighten the orbit so that there
    // are always ~74px under it for two lines.
    if (!this.portrait) {
      const maxOrbit = (this.H - 52) - 74 - this.satR - this.cy
      // ⚠ a hole left by the previous fix, now closed: with maxOrbit ≤ R·1.15 the clamp
      // simply DID NOT apply — on 844×390 the orbit stayed 122px and the satellites lay on
      // the row of worlds and on «тапни — и сразу играем». Now the clamp is always there,
      // but with a floor of R·1.15 (closer and the circles climb onto the Play ball itself);
      // the missing height is made up by the squeezed splashR.
      this.satOrbitR = Math.max(sR * 1.15 + this.satR * 0.5, Math.min(this.satOrbitR, maxOrbit))
    }
    // bottom edge of the LOWEST satellite: the angle 0.70π (see baseAngs in renderSplash)
    // gives sin ≈ 0.809, not 1 — we count honestly, otherwise we waste ~19% of the orbit
    // and on a low screen there is not enough room for the hints
    const satsBottom = this.cy + this.satOrbitR * 0.81 + this.satR * 1.4
    // the bottom of the splash as a stack: hint → continue/gates → row of worlds → number of the day.
    // safe area at the bottom: in portrait a fixed inset of ~5% of the height (Capacitor edge-to-edge)
    const bottomSafe = this.portrait ? Math.max(16, Math.round(this.H * 0.05)) : 16
    let rowY: number, contY: number, subY: number, dailyY: number
    if (this.portrait) {
      // portrait: the stack is anchored UNDER the satellites (the group clings to Play), not
      // to the edge — so the gates / number of the day do not slide under the phone's system bar
      subY = satsBottom + Math.round(this.H * 0.02)
      contY = subY + 40
      rowY = contY + 46
      dailyY = Math.min(rowY + 40, this.H - bottomSafe)
    } else {
      dailyY = this.H - 16
      rowY = this.H - 52
      contY = Math.min(this.cy + sR * 2.55, rowY - 48)
      subY = Math.min(this.cy + sR * 2.25, contY - 28)
    }
    // «тапни — и сразу играем» is always below the satellite orbit (info overlapped it in BOTH orientations)
    subY = Math.max(subY, satsBottom + 14)
    // ⚠ this clamp could push the hint DOWN onto the «продолжить: Мир N — M» line itself —
    // both were drawn on top of each other, a mess. We separate the lines strictly:
    // «продолжить» goes below the hint but does not climb onto the row of worlds. If there
    // was not enough room for two lines, the renderer hides the hint (see renderSplash):
    // «продолжить» matters more, it is the button back into the game.
    contY = Math.min(Math.max(contY, subY + 30), rowY - 26)
    this.splashRowGap = contY - subY
    this.splashSub.position.set(this.cx, subY)
    this.splashContinue.position.set(this.cx, contY)
    // the gate message lives in the «продолжить» slot (when it is there, it matters more)
    this.splashGateText.position.set(this.cx, contY)
    // row of worlds: 5 circles in a row if they fit by width; otherwise 3+2 (narrow portrait)
    const wr = 22
    const wGapWanted = 62
    const rowWidth = (WORLD_COUNT - 1) * wGapWanted + wr * 2
    if (rowWidth <= this.W - 24) {
      // one row of five, centred
      const wGap = wGapWanted
      for (let w = 0; w < WORLD_COUNT; w++) {
        this.worldHits[w] = { x: this.cx + (w - (WORLD_COUNT - 1) / 2) * wGap, y: rowY, r: wr }
      }
    } else {
      // two rows: 3 on top, 2 below (tight portrait)
      const wGap = Math.min(wGapWanted, (this.W - 24 - wr * 2) / 2)
      const topN = 3, botN = WORLD_COUNT - topN
      const rowY2 = rowY + wr * 2 + 8
      // shift the row of worlds and the hints a bit higher, so the second row does not go under the edge
      this.worldHits[0] = { x: this.cx - wGap, y: rowY - wr - 4, r: wr }
      this.worldHits[1] = { x: this.cx, y: rowY - wr - 4, r: wr }
      this.worldHits[2] = { x: this.cx + wGap, y: rowY - wr - 4, r: wr }
      for (let i = 0; i < botN; i++) {
        this.worldHits[topN + i] = { x: this.cx + (i - (botN - 1) / 2) * wGap, y: rowY2 - wr - 4, r: wr }
      }
    }
    // the «число дня» line — small, under the row of worlds right at the edge
    this.dailyText.position.set(this.cx, dailyY)
    // the star piggy bank — top left corner of the splash
    this.splashStarsG.position.set(30, 32)
    this.splashStarsText.position.set(46, 32)
    // the disc outfit — discreetly in the bottom right corner
    this.skinHit = { x: this.W - 44, y: this.H - 44, r: this.small ? 26 : 22 }
    // RESULTS — around the DISC (it is the core of the scene): the title and the stars on
    // top, the score and the record below, the middle is clean.
    // ⚠ the layer used to stand at scy while in portrait the disc is raised to 0.43·H —
    // three golden stars lay RIGHT ON THE BALL. The layer goes to cy, all offsets below
    // are from the disc centre.
    this.resultsLayer.position.set(this.cx, this.cy)
    // the results backdrop covers the whole screen (the layer stands on the disc — we draw from -cx/-cy)
    if (this.resultsVeil) {
      this.resultsVeil.clear()
      this.resultsVeil.rect(-this.cx - 4, -this.cy - 4, this.W + 8, this.H + 8).fill(0x05060f)
    }
    this.resultsTitle.position.set(0, -this.R * 2.45)
    // the bottom of the results is laid out by renderResults FROM THE BOTTOM UP (milestone
    // toasts arrive dynamically, 0-3 of them) — here only the safe zone margin and the hint
    this.resultsBottom = (this.H - (this.portrait ? Math.max(18, Math.round(this.H * 0.035)) : 14)) - this.cy
    this.resultsHint.position.set(0, (this.H - 40) - this.cy)
    this.fitTextToWidth(this.resultsTitle, 26, this.W - 28)
    // INTRO/RESULT/FINALE — the texts live around the DISC, not around the screen centre.
    // ⚠ the layer used to stand at scy (the true centre) while in portrait the disc is
    // raised to cy = 0.43·H. The ~59px difference on 390×844 put «Мир 1 — 4» and the
    // condition line RIGHT ON THE DISC in the intro, and the gameover score below the
    // centre of the ball. We put the layer on cy — in landscape cy === scy, so nothing
    // changes there.
    this.overlay.position.set(this.cx, this.cy)
    this.overlayTitle.position.set(0, -this.R * 1.9)
    this.overlayScore.position.set(0, 0)
    this.overlaySub.position.set(0, this.R * 1.9)
    this.fitOverlayTexts()
    this.layoutRuleBanner()   // the new-rule banner lives above the disc
    this.layoutComboBanner()  // the combo milestone banner — in the same place
    this.splashFitKey = ''    // the width changed — re-fit the splash lines
    // PAUSE MENU: the panel is centred on the SCREEN (not the disc), rows ≥46px for a finger
    this.pauseVeil.clear()
    this.pauseVeil.rect(0, 0, this.W, this.H).fill({ color: 0x05050f, alpha: 0.72 })
    // The row height is COMPUTED FROM THE SCREEN instead of being a fixed number. With the
    // sixth item («звук») the former 48 px gave a 402 px panel in landscape on a screen 390
    // px high — it stuck out over the edge. Now the row shrinks exactly as much as needed,
    // and never below 40 px (a finger still hits it).
    // ⚠ There are SEVEN items now (the «энциклопедия» was added), and a block with the
    // level RULE and a tip asks for room on top. On a phone in landscape (844×390) all of
    // that physically does not fit at once. So the layout is not a "rigid formula" but a
    // BUDGET: we assemble the panel with everything, and while it is taller than the screen
    // we drop the cheapest thing by meaning, in turn:
    //   1) the oscillogram (a pretty detail, but pure decoration)
    //   2) the tip (the rule matters more than the tip)
    //   3) the whole rule block (it stays in the encyclopedia and at the bottom of the screen)
    //   4) and only then we squeeze the row height down to 38px
    // So on a big screen the player sees EVERYTHING, and on a small one — a working menu
    // instead of a panel that hangs off the edge.
    const pw = Math.min(380, this.W - 48)
    const n = this.pauseItems.length
    // ⚠ Room for the rule block is reserved ALWAYS, not "if a game is running now":
    //   updateMetrics is called on resize while pause opens later — with a phase check here
    //   the block never appeared at all (caught on a 390×844 run).
    //   Pause can only be opened from play/intro, so the reservation is not wasted; the
    //   texts themselves are hidden by drawPauseRule when there is nothing to show.
    const budget = this.H - 24
    let titleH = 54, footH = 26
    let oscH = 34
    let ruleH = 48
    let minRow = 40
    let rowH = this.portrait ? 54 : 48
    let ph = 0
    // The concessions go strictly in order of increasing price: first decoration, then air,
    // and only at the very end the meaning itself (the rule). On 844×390 (a phone in
    // landscape) this is exactly the ladder that lets the rule survive.
    for (let pass = 0; pass <= 5; pass++) {
      const chrome = titleH + oscH + footH + ruleH
      const fitH = Math.floor((budget - chrome) / n)
      rowH = Math.max(minRow, Math.min(this.portrait ? 54 : 48, fitH))
      ph = chrome + rowH * n
      if (ph <= budget) break
      if (pass === 0) oscH = 0                       // the oscillogram is decoration
      else if (pass === 1) ruleH = 30                // the rule on one line, without the tip
      else if (pass === 2) { titleH = 44; footH = 14 } // trim the panel's air
      else if (pass === 3) minRow = 38               // slightly tighter rows (a finger still hits)
      else ruleH = 0                                 // the last concession — drop the rule
    }
    this.pauseOscOn = oscH > 0
    this.pauseRuleH = ruleH
    const px = this.cx - pw / 2
    const py = Math.max(12, this.scy - ph / 2)
    this.pausePanelBox = { x: px, y: py, w: pw, h: ph }
    this.pauseTitle.position.set(this.cx, py + titleH / 2 + 1)
    // the rule block lives right under the title (and above the oscillogram)
    const ruleY = py + titleH + 4
    this.pauseRuleText.position.set(this.cx, ruleY + (ruleH >= 48 ? 11 : 12))
    this.pauseHintText.position.set(this.cx, ruleY + 32)
    const rowsTop = py + titleH + ruleH + oscH
    this.pauseItems.forEach((it, i) => {
      it.h = rowH
      it.y = rowsTop + rowH * i + rowH / 2
      it.txt.position.set(this.cx, it.y)
    })
    this.layoutEncyclopedia()

    this.drawStaticUI()
  }

  // ── RULE ENCYCLOPEDIA ──────────────────────────────────────────────────────
  // Andrey: «Пункт „энциклопедия“ — прокручиваемый список всех ОТКРЫТЫХ правил с их
  // карточками». Opened = the ones the game has already explained (progress.learnedTerms).
  // The texts come from terms.ts as they are — we do not invent our own.
  // The current level's rule is highlighted: the player most likely came here for it.

  /** all campaign cards once each, in the order they appear in the levels */
  private allTermCards(): TermCard[] {
    const out: TermCard[] = []
    const seen = new Set<string>()
    for (const l of LEVELS) {
      for (const c of termCards(l.term)) {
        if (!seen.has(c.kind)) { seen.add(c.kind); out.push(c) }
      }
    }
    return out
  }

  /** build the list content (called on opening and on a resize) */
  private buildEncyclopedia() {
    const box = this.encScrollBox
    box.removeChildren().forEach((c) => c.destroy({ children: true }))
    const open = new Set(learnedTerms())
    const cur = new Set(termCards(this.level.term).map((c) => c.kind))
    const cards = this.allTermCards().filter((c) => open.has(c.kind))
    const w = this.encBox.w
    const padX = 20
    const innerW = w - padX * 2
    let y = 8
    if (!cards.length) {
      const empty = mkText({
        text: 'здесь будут все правила, которые ты откроешь.\nпройди первый этап — и карточка появится тут.',
        style: new TextStyle({
          fontFamily: 'Nunito', fontWeight: '800', fontSize: 15, fill: '#9adfff',
          align: 'center', wordWrap: true, wordWrapWidth: innerW, lineHeight: 22,
        }),
      })
      empty.anchor.set(0.5, 0); empty.alpha = 0.85
      empty.position.set(w / 2, 24)
      box.addChild(empty)
      y = 24 + empty.height + 16
    }
    for (const c of cards) {
      const here = cur.has(c.kind)
      const card = new Container()
      const title = mkText({
        text: c.title,
        style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '900', fontSize: 16, fill: here ? '#ffd54a' : '#ffffff' }),
      })
      title.position.set(padX + 14, 12)
      const body = mkText({
        text: c.body,
        style: new TextStyle({
          fontFamily: 'Nunito', fontWeight: '700', fontSize: 14, fill: '#e7ecff',
          wordWrap: true, wordWrapWidth: innerW - 28, lineHeight: 20,
        }),
      })
      body.position.set(padX + 14, 12 + title.height + 6)
      const h = 12 + title.height + 6 + body.height + 14
      const bg = new Graphics()
      bg.roundRect(padX, 0, innerW, h, 16)
        .fill({ color: here ? 0x161a3c : 0x0e1130, alpha: 0.92 })
        .stroke({ width: here ? 2 : 1, color: here ? 0xffd54a : 0x38c0ff, alpha: here ? 0.7 : 0.28 })
      card.addChild(bg, title, body)
      card.position.set(0, y)
      box.addChild(card)
      y += h + 10
    }
    this.encMaxScroll = Math.max(0, y + 8 - this.encViewH)
    this.encScroll = Math.min(this.encScroll, this.encMaxScroll)
    box.position.set(0, -this.encScroll)
  }

  private encOpenScreen() {
    this.encOpen = true
    this.encScroll = 0
    this.encDrag = null
    this.layoutEncyclopedia()
    this.buildEncyclopedia()
    this.encOverlay.visible = true
    this.sound.ui(0.8)
    console.debug('[hm-enc] энциклопедия открыта, карточек:', this.encScrollBox.children.length)
  }

  private encClose(silent = false) {
    if (!this.encOpen) return
    this.encOpen = false
    this.encOverlay.visible = false
    this.encDrag = null
    if (!silent) this.sound.ui(0.7)
  }

  /** scrolling the list (wheel, dragging) clamped to the bounds */
  private encScrollBy(dy: number) {
    this.encScroll = Math.max(0, Math.min(this.encMaxScroll, this.encScroll + dy))
    this.encScrollBox.position.set(0, -this.encScroll)
  }

  private onWheel = (e: WheelEvent) => {
    if (!this.encOpen) return
    e.preventDefault()
    this.encScrollBy(e.deltaY)
  }

  /** the frame and the scrollbar — drawn per frame (the panel breathes with the palette) */
  private renderEncyclopedia() {
    if (!this.encOpen) return
    const b = this.encBox
    const accent = hexNum(this.level.palette[2])
    this.encPanel.clear()
    this.encPanel.roundRect(b.x, b.y, b.w, b.h, 24).fill({ color: 0x0b0d24, alpha: 0.97 })
      .stroke({ width: 2, color: accent, alpha: 0.5 })
    this.encPanel.moveTo(b.x + 16, b.y + 52).lineTo(b.x + b.w - 16, b.y + 52)
      .stroke({ width: 1, color: accent, alpha: 0.25 })
    this.encBar.clear()
    if (this.encMaxScroll > 1) {
      const trackH = this.encViewH - 16
      const kh = Math.max(28, trackH * (this.encViewH / (this.encViewH + this.encMaxScroll)))
      const ky = b.y + 62 + (trackH - kh) * (this.encScroll / this.encMaxScroll)
      this.encBar.roundRect(b.x + b.w - 10, b.y + 62, 4, trackH, 2).fill({ color: 0xffffff, alpha: 0.08 })
      this.encBar.roundRect(b.x + b.w - 10, ky, 4, kh, 2).fill({ color: accent, alpha: 0.6 })
    }
    this.encBack.alpha = 0.75 + 0.25 * Math.sin(this.uiT * 3)
  }

  /** the encyclopedia screen: an almost fullscreen panel, the list under a mask */
  private layoutEncyclopedia() {
    const w = Math.min(520, this.W - 32)
    const h = Math.min(this.H - 32, 640)
    const x = this.cx - w / 2
    const y = this.scy - h / 2
    this.encBox = { x, y, w, h }
    this.encVeil.clear()
    this.encVeil.rect(0, 0, this.W, this.H).fill({ color: 0x05050f, alpha: 0.88 })
    // ⚠ The title used to be centred on the PANEL and overlapped «‹ назад».
    // We centre it in the REMAINING strip (to the right of the button), and on a narrow
    // screen we shrink the font as well — otherwise they meet again.
    this.encBack.position.set(x + 16, y + 26)
    const backW = Math.max(64, this.encBack.width) + 22
    this.fitTextToWidth(this.encTitle, 20, Math.max(120, w - backW * 2 - 12))
    this.encTitle.position.set(x + backW + (w - backW - 14) / 2, y + 26)
    this.encBackHit = { x: x + 4, y: y + 4, w: backW + 12, h: 44 }
    const top = y + 54
    this.encViewH = h - 54 - 14
    this.encClip.position.set(x, top)
    this.encMask.clear()
    this.encMask.rect(x, top, w, this.encViewH).fill({ color: 0xffffff })
    if (this.encOpen) this.buildEncyclopedia() // the width changed — re-lay out
  }

  private drawStaticUI() {
    // pause button: a circle exactly on the hit zone (≥44px), but QUIET — glass, not a plate
    this.pauseBtn.clear()
    const { x: pbx, y: pby, r: pbr } = this.pauseHit
    this.pauseBtn.circle(pbx, pby, pbr).fill({ color: 0xffffff, alpha: 0.07 })
    this.pauseBtn.circle(pbx, pby, pbr).stroke({ width: 1, color: 0xffffff, alpha: 0.14 })
    const bh = Math.round(pbr * 0.62), bw = Math.max(4, Math.round(pbr * 0.20))
    this.pauseBtn.rect(pbx - bw * 1.7, pby - bh / 2, bw, bh)
      .rect(pbx + bw * 0.7, pby - bh / 2, bw, bh).fill({ color: 0xffffff, alpha: 0.8 })
    this.drawMuteIcon()
    // skip button: a circle + a «‹‹» chevron in lines (no emoji)
    const sg = this.skipBtn.getChildByLabel('sg') as Graphics
    sg.clear()
    sg.circle(0, -14, 26).fill({ color: 0xffffff, alpha: 0.1 }).stroke({ width: 2, color: 0x9adfff, alpha: 0.6 })
    sg.moveTo(4, -22).lineTo(-6, -14).lineTo(4, -6).stroke({ width: 3, color: 0x9adfff, alpha: 0.9 })
    sg.moveTo(12, -22).lineTo(2, -14).lineTo(12, -6).stroke({ width: 3, color: 0x9adfff, alpha: 0.9 })
    // splash Play button (a glass disc + a triangle)
    const pd = this.splashPlay.getChildByLabel('pd') as Graphics
    pd.clear()
    // The menu is the shop window of the game. It used to be: a violet disc 0x121846 + an
    // amber ring + a brown halo = three temperatures in one frame, plus a grey ellipse
    // highlight that read as a dirty spot. Now: the same gem glowing from inside as in the
    // game — a wall made of the world's deep and mid tone, lightening towards the centre,
    // and the highlight is a thin glass crescent along the top edge.
    const R = this.splashR || this.R // the splash ball (squeezed on a low landscape)
    const { wall, core, accent } = this.glassTones()
    const halo = this.splashPlay.getChildByLabel('halo') as Sprite | null
    if (halo) {
      halo.width = halo.height = R * 4.6
      halo.tint = accent
      halo.alpha = 0.13
    }
    // the hm1 vibe behind the `mosaicPlay` flag (vibe.ts): instead of a smooth lens — a
    // STAINED GLASS of shards with dark seams, like on his 2017 button. With the flag off
    // it is exactly the former four circles, not a single new line per frame.
    if (VIBE.mosaicPlay) {
      drawMosaicGlass(pd, 0, 0, R, { wall, core, accent, seed: 7.31 })
    } else {
      pd.circle(0, 0, R).fill({ color: wall, alpha: 0.97 })
      pd.circle(0, 0, R * 0.78).fill({ color: lerpColor(wall, core, 0.55), alpha: 0.6 })
      pd.circle(0, 0, R * 0.56).fill({ color: core, alpha: 0.55 })
      pd.circle(0, 0, R * 0.34).fill({ color: lerpColor(core, 0xffffff, 0.18), alpha: 0.4 })
    }
    // highlight — a glass crescent at the top left (lens gloss, not a milky spot)
    this.glassCrescent(pd, 0, 0, R * 0.86, Math.max(2, R * 0.075), 0.28)
    pd.circle(0, 0, R + 5).stroke({ width: 11, color: accent, alpha: 0.18 })
    pd.circle(0, 0, R).stroke({ width: 5, color: accent, alpha: 0.95 })
    const s = R * 0.42
    // a neon triangle as an OUTLINE in three layers (halo → colour → white core), the neon
    // is the world's accent. With the flag off it is the former white fill.
    if (VIBE.mosaicPlay) {
      drawNeonTriangle(pd, 0, 0, s, { neon: accent, hot: lerpColor(accent, 0xffffff, 0.55) })
    } else {
      pd.moveTo(-s * 0.55, -s).lineTo(-s * 0.55, s).lineTo(s * 0.95, 0).closePath().fill(0xffffff)
    }
    this.drawSats()
  }

  /**
   * Glass crescent highlight on the "gem".
   *
   * ⚠ The crescent used to be drawn with a bare `g.arc(...)`. In Pixi v8 (as in canvas)
   * arc on a NON-EMPTY path draws a line from the current point to the start of the arc —
   * and the Graphics of the gates/satellites already contained circles in ABSOLUTE
   * coordinates. The result was a fan of thin straight "scratches" across the whole screen
   * from the top left corner. Cured by one moveTo to the start of the arc — the path starts
   * anew and there is no connecting line.
   */
  private glassCrescent(g: Graphics, cx: number, cy: number, rad: number, width: number, alpha: number) {
    const a0 = -2.55, a1 = -1.15
    g.moveTo(cx + Math.cos(a0) * rad, cy + Math.sin(a0) * rad)
    g.arc(cx, cy, rad, a0, a1)
    g.stroke({ width, color: 0xffffff, alpha, cap: 'round' })
  }

  /**
   * Glass tones of the current world for the Graphics "gems" of the menu.
   * One vocabulary for the Play button, the satellites and the gate circles — so that the
   * menu sounds in one palette, like the in-game disc. The skin only tints the wall, it
   * does not replace it with its own forever-violet one.
   */
  private glassTones(pal: [string, string, string] = this.level.palette, useSkin = true) {
    const deep = hexNum(pal[0]), mid = hexNum(pal[1]), accent = hexNum(pal[2])
    const skinCol = this.skin === 1 ? 0x8a2ae0 : this.skin === 2 ? 0x0f8a58 : -1
    let wall = lerpColor(deep, mid, 0.46)
    if (useSkin && skinCol >= 0) wall = lerpColor(wall, skinCol, 0.32)
    return { deep, mid, accent, wall, core: lerpColor(wall, 0xffffff, 0.17) }
  }

  /** menu satellites: glass circles in the spirit of the disc, icons are Graphics (no emoji) */
  private drawSats() {
    const { wall, core, accent } = this.glassTones()
    const sr = Math.max(24, this.splashR * 0.21)
    for (const s of this.sats) {
      s.r = sr
      const g = s.g
      g.clear()
      // the world's glass: a glow + a lens glowing from inside + a crescent highlight + a rim.
      // The glow is a stepped falloff instead of a flat ring (the edge of a flat circle read
      // as a dirty pancake around the button)
      for (const [k, al] of [[1.6, 0.035], [1.42, 0.045], [1.22, 0.055]] as [number, number][]) {
        g.circle(0, 0, sr * k).fill({ color: accent, alpha: al })
      }
      g.circle(0, 0, sr).fill({ color: wall, alpha: 0.95 })
      g.circle(0, 0, sr * 0.6).fill({ color: core, alpha: 0.5 })
      this.glassCrescent(g, 0, 0, sr * 0.84, Math.max(1.5, sr * 0.09), 0.26)
      g.circle(0, 0, sr).stroke({ width: 3, color: accent, alpha: 0.85 })
      const k = sr / 30
      if (s.kind === 'sound') {
        const muted = this.sound.isMuted
        g.moveTo(-10 * k, -3 * k).lineTo(-5 * k, -3 * k).lineTo(0, -8 * k)
          .lineTo(0, 8 * k).lineTo(-5 * k, 3 * k).lineTo(-10 * k, 3 * k)
          .closePath().fill({ color: 0xffffff, alpha: muted ? 0.5 : 1 })
        if (muted) {
          g.moveTo(-9 * k, 9 * k).lineTo(11 * k, -9 * k).stroke({ width: 3, color: 0xff8080, cap: 'round' })
        } else {
          g.arc(3 * k, 0, 5 * k, -1.05, 1.05).stroke({ width: 2, color: 0xffffff, alpha: 0.95 })
          g.arc(3 * k, 0, 9 * k, -0.95, 0.95).stroke({ width: 2, color: 0xffffff, alpha: 0.6 })
        }
      } else if (s.kind === 'info') {
        // «i»: a dot + a bar
        g.circle(0, -8 * k, 2.6 * k).fill(0xffffff)
        g.roundRect(-2.4 * k, -3.5 * k, 4.8 * k, 12.5 * k, 2.4 * k).fill(0xffffff)
      } else {
        // records: a pedestal + a star above it
        g.roundRect(-11.5 * k, 0, 6.5 * k, 9 * k, 1.5 * k).fill({ color: 0xffffff, alpha: 0.7 })
        g.roundRect(-3.2 * k, -5 * k, 6.5 * k, 14 * k, 1.5 * k).fill(0xffffff)
        g.roundRect(5 * k, -2 * k, 6.5 * k, 11 * k, 1.5 * k).fill({ color: 0xffffff, alpha: 0.7 })
        this.drawStar(g, 0, -11.5 * k, 4.2 * k, 0xffd54a)
      }
    }
    this.drawSkinBtn()
  }

  /** disc outfit switch (milestone 8★, from 45★ — three outfits): palette slices in the corner */
  private drawSkinBtn() {
    const g = this.skinBtn
    g.clear()
    if (!this.skinsUI || !hasMilestone(8)) return
    const { x, y } = this.skinHit
    const r = 15
    g.circle(x, y, r + 6).fill({ color: 0xffffff, alpha: 0.08 })
    if (hasMilestone(45)) {
      // three slices: classic / aurora / emerald
      const cols = [0x2a3fae, 0x8a2ae0, 0x0f8a58]
      for (let i = 0; i < 3; i++) {
        const a0 = -Math.PI / 2 + (i * TAU) / 3
        g.moveTo(x, y).arc(x, y, r, a0, a0 + TAU / 3).closePath().fill(cols[i])
      }
    } else {
      // two halves: classic / aurora
      g.moveTo(x, y - r).arc(x, y, r, -Math.PI / 2, Math.PI / 2).closePath().fill(0x8a2ae0)
      g.moveTo(x, y + r).arc(x, y, r, Math.PI / 2, Math.PI * 1.5).closePath().fill(0x2a3fae)
    }
    const rim = this.skin === 1 ? 0xe060ff : this.skin === 2 ? 0x30ffb0 : 0x38c0ff
    g.circle(x, y, r).stroke({ width: 2.5, color: rim, alpha: 0.9 })
  }

  /** speaker icon next to pause (Graphics, no emoji): waves or a slash */
  private drawMuteIcon() {
    const g = this.muteBtn, { x, y, r } = this.muteHit
    // r === 0 — there is no button in the HUD: clear the layer and leave
    if (r <= 0) { g.clear(); return }
    const muted = this.sound.isMuted
    g.clear()
    g.circle(x, y, r).fill({ color: 0xffffff, alpha: 0.07 })
    g.circle(x, y, r).stroke({ width: 1, color: 0xffffff, alpha: 0.14 })
    // speaker body: the box and the horn in one path
    g.moveTo(x - 10, y - 3).lineTo(x - 5, y - 3).lineTo(x, y - 8)
      .lineTo(x, y + 8).lineTo(x - 5, y + 3).lineTo(x - 10, y + 3)
      .closePath().fill({ color: 0xffffff, alpha: muted ? 0.55 : 1 })
    if (muted) {
      // crossed out — the sound is off
      g.moveTo(x - 9, y + 9).lineTo(x + 11, y - 9).stroke({ width: 3, color: 0xff8080, cap: 'round' })
    } else {
      // sound wave arcs
      g.arc(x + 3, y, 5, -1.05, 1.05).stroke({ width: 2, color: 0xffffff, alpha: 0.95 })
      g.arc(x + 3, y, 9, -0.95, 0.95).stroke({ width: 2, color: 0xffffff, alpha: 0.6 })
    }
  }

  private toggleMute() {
    this.sound.unlock()
    this.sound.toggleMute()
    this.drawMuteIcon()
    this.drawSats() // the sound satellite on the splash stays in sync with M
  }

  // ---------- level ----------
  private setLevel(idx: number) {
    this.levelIdx = idx
    // Andrey: «резкая смена цвета неприятна» — the palette does not click over like a
    // switch. level.palette is a REFERENCE to the live triple palFade.live, which travels
    // to the new world's palette over PAL_FADE seconds; everything that reads level.palette
    // per frame (rings, particles, lights, glows, shaders) travels with it. The first level
    // of a run is instant (there is nothing to travel from).
    const fresh = this.phase === 'splash' || !this.ready
    palFade.to(LEVELS[idx].palette, fresh ? 0 : PAL_FADE)
    this.level = { ...LEVELS[idx], palette: palFade.live }
    this.resetLevelState()
    this.applyLevelVisuals(idx)
  }

  /** reset the move/surprise/star game state on a level boundary (shared by all modes) */
  private resetLevelState() {
    this.moveIdx = 0
    this.numIdx = 0
    this.surpKind = null
    // surprise effects do not survive a level boundary
    this.freezeT = 0; this.transferT = 0; this.transferE = 0
    this.warpT = 0; this.cmT = 0; this.cmE = 0; this.inversionT = 0
    this.diskOx = 0; this.diskOy = 0
    this.rotT = 0; this.hintBoost = 0
    this.diskLayer.position.set(this.cx, this.cy)
    this.diskLayer.skew.set(0, 0)
    this.diskLayer.scale.set(1)
    this.diskLayer.rotation = 0
    this.protector.position.set(this.cx, this.cy)
    this.starsEarned = 0
    this.livesLost = 0                 // quality stars are counted from the losses DURING the level
    this.levelScoreStart = this.score  // the level score is a delta
    this.extraGiftLeft = hasMilestone(33) ? 1 : 0 // milestone 33: kind surprises more often
    // combo milestones — "each one once per level" (otherwise a long streak spams)
    this.comboMilesHit.clear()
    this.comboBannerT = 0
    // a new condition? — then the condition line softly pulses for the first 2 moves
    this.condNew = !this.seenConds.has(this.level.conditionText)
    this.seenConds.add(this.level.conditionText)
  }

  /** apply the palette/music/particles for the current this.level (idx — for regenerating the music patterns) */
  private applyLevelVisuals(idx: number) {
    // colours (background, shaders, lights, the number's glow) — a shared path with the travel
    this.applyPaletteColors()
    // audio-reactive layer: a new level = a clean canvas
    // (the background picture is painted anew; mistakes do NOT erase strokes — only the end of a level)
    this.musicViz.clearPaint()
    this.brushAngle = Math.random() * TAU
    // the character of the world's particles (embers/snowflakes/wind/shards/clarity)
    this.storm.setWorld(this.level.worldIdx)
    // music: the world preset (mode + timbre) + regeneration of patterns from the level number
    this.music.setWorld(this.level.worldIdx, idx)
  }

  /**
   * Apply the CURRENT palette colours. Called both on a level change and on every frame
   * of the travel. `redrawUI` — whether to redraw the static HUD (expensive, ~8 times a
   * second is enough during the travel).
   */
  private applyPaletteColors(redrawUI = true) {
    const [deep, mid, accent] = this.level.palette
    this.cosmos.setPalette(deep, mid, accent)
    this.musicViz.setPalette(deep, mid, accent)
    if (this.portalFilter) {
      const u = (this.portalFilter.resources as any).uPortal.uniforms
      u.uAccent = hexRgb(accent); u.uMid = hexRgb(mid)
    }
    // the world palette — into the disc and thread shaders
    if (this.gemFilter) {
      const u = (this.gemFilter.resources as any).uGemU.uniforms
      u.uDeep = hexRgb(deep); u.uMid = hexRgb(mid); u.uAccent = hexRgb(accent)
    }
    if (this.flowFilter) {
      const u = (this.flowFilter.resources as any).uFlowU.uniforms
      u.uAccent = hexRgb(accent); u.uMid = hexRgb(mid)
    }
    this.numberGlow.style.fill = hexNum(accent)
    // the life lights and the menu glass also live in the world palette
    const ft = this.fireflyTint()
    for (const f of this.fireflies) f.sprite.tint = ft
    if (redrawUI && this.ready) this.drawStaticUI()
  }

  /** a step of the palette travel: the colours move, the static HUD catches up 8 times a second */
  private palUiT = 0
  private tickPalette(dt: number) {
    if (!palFade.tick(dt)) return
    this.palUiT += dt
    const ui = !palFade.moving || this.palUiT > 0.12
    if (ui) this.palUiT = 0
    this.applyPaletteColors(ui)
  }

  /** the number of the i-th move: endless stream / fixedNumbers (chaos) / first + delta·i */
  private numberAt(i: number) {
    if (this.mode === 'endless' && this.endlessStream) return this.endlessStream.at(i)
    const f = this.level.fixedNumbers
    if (f && f.length) return f[Math.min(i, f.length - 1)]
    return this.level.firstNumber + this.level.deltaNumbers * i
  }

  /** the first two moves of level 1 are the tutorial: time stands still until you answer */
  // ⚠ it used to be `levelIdx === 0` — but endless and the number of the day also set
  // levelIdx = 0, and their first two moves ran WITHOUT A TIMER (and with someone else's
  // hint «это чётное»). The tutorial belongs only to the first level of the CAMPAIGN.
  private get tutorialMove() { return this.mode === 'campaign' && this.levelIdx === 0 && this.moveIdx < 2 }

  /** the life ceiling: the «20 звёзд» milestone gives +1 forever */
  private get maxLivesNow() { return MAX_LIVES + (hasMilestone(20) ? 1 : 0) }

  /**
   * The price multiplier for points = the WORLD number (the author's canon: 10×episode,
   * not 10×level). Levels inside a world cost the same — the score is moved by combos and
   * accuracy; the «+жизнь за 1000» threshold makes sense again, lives do not pour in.
   */
  private get worldMult() { return this.level.worldIdx + 1 }

  /**
   * The level caption in the "5 worlds" model: «Мир 4 — 2» instead of a flat «Level 14»
   * (the HUD must match the mental map of the worlds)
   */
  private levelTag(idx = this.levelIdx): string {
    const l = LEVELS[Math.max(0, Math.min(idx, LEVELS.length - 1))]
    if (l.worldIdx === 4) return 'Финал'
    const k = idx - worldFirstLevelIdx(l.worldIdx) + 1
    return `Мир ${l.worldIdx + 1} — ${k}`
  }

  private startMove() {
    // countdown: the previous number FALLS down on a change (gravity panic)
    const prevWasNumber = this.numIdx > 0 && !this.surpKind
    if (this.level.countdown && prevWasNumber) this.spawnFallingNumber(this.currentNumber)
    this.moveTime = 0
    this.moveAnim = 0
    this.tapped = false
    this.feedback = null
    if (this.hintBoost > 0) this.hintBoost--
    // endless: the speed grows by the formula from the doc, the palette drifts across the worlds
    if (this.mode === 'endless') this.endlessTuneMove()
    const progress = this.moveIdx / Math.max(1, this.level.countOfMoves - 1)
    this.moveDur = this.level.timeStep / (1 + (this.level.endSpeedup - 1) * progress)

    if (this.mode === 'endless') {
      // endless: surprises on their own schedule (the shift good→evil with the score)
      this.surpKind = this.endlessPickSurprise()
    } else {
      // .lvl canon: on the moves from places there is a surprise instead of a number (no number spent)
      const pi = this.level.places?.indexOf(this.moveIdx) ?? -1
      this.surpKind = pi >= 0 ? this.level.surprises![pi] : null
      // 4.x outOfOrder canon: a surprise can pop up OUTSIDE the places schedule
      if (!this.surpKind && this.level.outOfOrder && this.moveIdx > 2
        && this.moveIdx < this.level.countOfMoves - 1 && Math.random() < 0.13) {
        const list = this.level.surprises
        if (list?.length) this.surpKind = list[Math.floor(Math.random() * list.length)]
      }
      // the 10 stars milestone: gift surprises a bit more often — a rare unscheduled gift
      // (good only, not before move 4, at most once per level)
      if (!this.surpKind && this.extraGiftLeft > 0 && this.moveIdx > 2 && Math.random() < 0.08) {
        this.extraGiftLeft--
        this.surpKind = Math.random() < 0.5 ? 'score' : 'life'
      }
    }
    // on a level with a progression an explosion jump breaks the count in your head — we
    // replace it with a neutral gift (see safeSurprise). A single replacement point for all
    // modes: places, outOfOrder and endless all come here.
    this.surpKind = this.safeSurprise(this.surpKind)
    if (this.surpKind) {
      // a surprise takes longer to think about than a number — the player decides whether to take it
      this.moveDur = Math.max(this.moveDur, this.level.timeStep) * 1.25
      if (!this.tipSurp) {
        this.tipSurp = true
        this.addFloat('сюрприз! тапни — возьмёшь, «мимо» — пропустишь', '#ffd54a', 2.6, 'top')
      } else if (!isGoodSurprise(this.surpKind) && !this.tipTrapSeen) {
        this.tipTrapSeen = true
        this.addFloat('фиолетовое — лучше мимо…', '#c060ff', 2.2, 'top')
      }
      return
    }
    // endless: once a round a new condition is born (an honest validator), and the numbers
    // may "fall" in a countdown burst — visually that is countdown
    if (this.mode === 'endless') {
      this.endlessMaybeNewRound()
      this.level.countdown = this.endlessStream!.isFalling(this.numIdx)
    }
    this.currentNumber = this.numberAt(this.numIdx)
    this.numIdx++
  }

  // ---------- input ----------
  private onKey = (e: KeyboardEvent) => {
    this.sound.unlock() // the AudioContext only wakes up after a user gesture
    // The PAUSE MENU takes the keyboard entirely (screen stack: the top screen owns the
    // input). Arrows move the focus, Enter presses, Esc — "back" = play.
    // The encyclopedia takes the keyboard entirely too (the top screen of the stack)
    if (this.encOpen) {
      e.preventDefault()
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Backspace') { this.encClose(); return }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') this.encScrollBy(60)
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') this.encScrollBy(-60)
      else if (e.code === 'PageDown' || e.code === 'Space') this.encScrollBy(this.encViewH * 0.8)
      else if (e.code === 'PageUp') this.encScrollBy(-this.encViewH * 0.8)
      return
    }
    if (this.paused) {
      e.preventDefault()
      const n = this.pauseItems.length
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { this.pauseFocus = (this.pauseFocus + n - 1) % n; this.sound.ui(0.5) }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { this.pauseFocus = (this.pauseFocus + 1) % n; this.sound.ui(0.5) }
      else if (e.code === 'Enter' || e.code === 'Space') this.pauseAct(this.pauseItems[this.pauseFocus].kind)
      else if (e.code === 'Escape' || e.code === 'KeyP') this.pauseAct('resume')
      else if (e.code === 'KeyM') { this.toggleMute(); this.drawPauseMenu() }
      return
    }
    if (e.code === 'Escape' && this.phase === 'play') { e.preventDefault(); this.setPaused(true); return }
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.press(this.cx, this.cy, 0) }
    else if (e.code === 'KeyX') { e.preventDefault(); if (this.phase === 'play') this.doSkip() }
    else if (e.code === 'KeyP' && this.phase === 'play') this.setPaused(true)
    else if (e.code === 'KeyM') this.toggleMute()
  }

  // ---------- PAUSE MENU ----------

  /**
   * The hardware Android "back" button (Capacitor).
   * The same screen stack as Escape: pause is open → close it; a game is running → pause
   * it; not a game (splash/results) → false, and the wrapper minimises the app. It invents
   * nothing of its own — it calls the existing transitions.
   * @returns true if the event was handled by the game
   */
  public handleBack(): boolean {
    this.sound.unlock()
    if (this.paused) { this.pauseAct('resume'); return true }
    if (this.phase === 'play' || this.phase === 'intro') { this.setPaused(true); return true }
    return false
  }

  /** The app went to the background — if a game was running, we freeze on pause (the sound does not "buzz") */
  public suspendForBackground() {
    if (!this.paused && (this.phase === 'play' || this.phase === 'intro')) this.setPaused(true)
  }

  private setPaused(on: boolean) {
    if (this.paused === on) return
    this.paused = on
    this.pauseFocus = 0
    this.pauseOverlay.visible = on
    if (on) { this.snapshotSession(); this.drawPauseMenu(); this.sound.ui(0.8) }
    else this.encClose(true) // the encyclopedia does not survive leaving pause
    console.debug('[hm-pause]', on ? 'open' : 'close')
  }

  /** a menu item was pressed (with the mouse, a finger or Enter) */
  private pauseAct(kind: PauseAction) {
    // the «звук» row is not a button but two volume steps. A tap on the ROW away from the
    // icons (or Enter from the keyboard) turns both at once: a player who just wants it
    // «потише» does not have to aim at an icon.
    if (kind === 'sound') {
      this.sound.cycleMusicVolume()
      this.sound.cycleSfxVolume()
      this.sound.ui(0.7)
      this.drawPauseMenu()
      return
    }
    if (kind === 'encyclopedia') { this.encOpenScreen(); return }
    // quality: a switch item, like the sound — the menu does not close, the player
    // immediately sees the new label (and the difference behind the panel: the veil is semi-transparent)
    if (kind === 'quality') {
      this.sound.ui(0.9)
      // ── FIVE QUICK TAPS = THE SOUND TELEMETRY DEV OVERLAY.
      //    A built app has no address bar, and we badly need to see the numbers from a
      //    LIVE phone (only the author hears the glitches). The "five taps on a line"
      //    combination is the standard trick (that is how developer mode is opened on
      //    Android). The quality mode wound up by those taps is PUT BACK: a gesture has no
      //    right to change a setting.
      const t = performance.now()
      if (t - this.qualityTapT > 900) { this.qualityTapN = 0; this.qualityTapMode = quality.mode }
      this.qualityTapT = t
      this.qualityTapN++
      quality.cycleMode()
      if (this.qualityTapN >= 5) {
        this.qualityTapN = 0
        quality.setMode(this.qualityTapMode)
        audioHUD.toggle()
      }
      this.drawPauseMenu()
      return
    }
    if (kind === 'audio') {
      this.sound.ui(0.9)
      quality.cycleAudioMode()
      this.drawPauseMenu()
      return
    }
    this.sound.ui()
    if (kind === 'resume') { this.setPaused(false); return }
    if (kind === 'restart') {
      this.setPaused(false)
      if (this.mode === 'endless') this.beginEndless()
      else if (this.mode === 'daily') this.beginDaily(this.dailySeed)
      else this.beginGame(this.levelIdx)
      return
    }
    this.goToMenu()
  }

  /**
   * «В МЕНЮ»: the progress is saved, the run state is wiped CLEAN — nothing may leak on a
   * second entry (no debuffs, no master duck, no particles, no floats). Previously there
   * was no path from the game to the splash at all.
   */
  private goToMenu() {
    this.paused = false
    this.pauseOverlay.visible = false
    // progress: where the player stopped (so that «продолжить» leads back here)
    this.saveProgress()
    // going to the menu is a PAUSE of the run, not its end. The snapshot is written BEFORE
    // the state is cleaned (this.score is still alive below) and re-read into resumeSnap, so
    // that the splash immediately offers «продолжить · счёт X».
    this.snapshotSession()
    this.resumeSnap = loadSession()
    if (this.mode === 'campaign' && this.levelIdx > this.savedLevel) {
      this.savedLevel = this.levelIdx
      try { localStorage.setItem(SAVE_LEVEL, String(this.savedLevel)) } catch { /* ok */ }
    }
    if (this.mode === 'endless') this.saveEndlessBest()
    // ── cleaning up the run ──
    for (const f of this.floats) f.txt.destroy()
    this.floats = []
    for (const g of this.ghosts) g.txt.destroy()
    this.ghosts = []
    if (this.scorePop) { this.scorePop.txt.destroy(); this.scorePop = null }
    this.explosionQueue = []; this.echoQueue = []
    this.boltT = 0; this.bolt.clear(); this.oscG.clear()
    this.implodeT = 0; this.implodeFired = false
    this.ruleT = 0; this.ruleBanner.visible = false
    this.comboBannerT = 0; this.comboBanner.visible = false
    this.comboMilesHit.clear(); this.comboRecordShown = false
    this.restoreFireflies()
    this.storm.setImplode(0, this.cx, this.cy); this.storm.quench()
    this.sound.tunnelRelease()          // the warp duck must not survive the exit
    this.sound.setSlow(false); this.slowWas = false
    this.timeScale = 1; this.slowmoT = 0
    // surprise effects and flashes
    this.freezeT = 0; this.transferT = 0; this.transferE = 0
    this.warpT = 0; this.cmT = 0; this.cmE = 0; this.inversionT = 0
    this.rotT = 0; this.hintBoost = 0; this.gold3T = 0
    this.glitchT = 0; this.flash = 0; this.shake = 0; this.glow = 0
    this.hush = 0; this.wobble = 0; this.hitStop = 0
    this.portalT = 0; this.portalWhite = 0
    this.diskOx = 0; this.diskOy = 0
    this.diskLayer.position.set(this.cx, this.cy)
    this.diskLayer.scale.set(1); this.diskLayer.skew.set(0, 0); this.diskLayer.rotation = 0
    this.protector.position.set(this.cx, this.cy)
    this.intensity = 0; this.intensityTarget = 0
    this.streak = 0; this.multiplier = 1
    this.cmOverlay.visible = false
    this.waveFx.clear()
    // the world is calm again: the filters go back to a single bloom
    this.filterKey = -1
    if (this.bloom && quality.knobs.bloom) this.world.filters = [this.bloom] // quality
    else this.world.filters = []
    this.mode = 'campaign'
    this.splashGateMsg = ''
    this.totalCache = totalStars()
    this.phase = 'splash'
    this.setPhaseVisibility()
    this.drawStaticUI()
    console.debug('[hm-menu]', 'вышли в меню, состояние очищено')
  }
  private onPointer = (e: PointerEvent) => {
    this.sound.unlock() // the first gesture — resume the audio (autoplay policy)
    const rect = this.app.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    const touch = e.pointerType === 'touch'
    this.uiClaimed = false // press() raises the flag if a UI element took the tap
    // the intent "a tap on the disc" is fixed at pointerdown (before press): a playable
    // disc, not the pause, not the «мимо» button. On touch the decision itself is deferred
    // to pointerup — otherwise a swipe-skip started on the disc would already have cost a
    // life before the finger moved.
    // …and NEVER on the pause/sound button (previously on touch a finger that landed on the
    // pause pill near the disc edge could be counted as a move on release)
    const diskTap = this.phase === 'play' && !this.paused &&
      Math.hypot(x - (this.cx + this.diskOx), y - (this.cy + this.diskOy)) <= this.R * 1.45 &&
      Math.hypot(x - this.skipHit.x, y - this.skipHit.y) >= this.skipHit.r &&
      Math.hypot(x - this.pauseHit.x, y - this.pauseHit.y) >= this.pauseHit.r &&
      Math.hypot(x - this.muteHit.x, y - this.muteHit.y) >= this.muteHit.r
    this.pDown = { x, y, t: performance.now(), touch, diskTap }
    // mouse/pen — an instant tap (precision + right click / X for skip); touch —
    // allowTap=false, a tap on the disc is decided on release (tap vs swipe)
    this.press(x, y, e.button, !touch)
  }
  /**
   * Finger release: on touch this is where tap vs swipe is decided.
   *
   * The «мимо» gesture is a swipe LEFT or DOWN (the disc throws the number aside / under
   * the table). The «мимо» button stays — the swipe complements it, it does not replace it.
   * On desktop there is deliberately NO click-skip (a tap and a skip on the same mouse
   * button confuse people).
   */
  private onPointerUp = (e: PointerEvent) => {
    const d = this.pDown; this.pDown = null
    const claimed = this.uiClaimed
    this.uiClaimed = false
    // encyclopedia: released after a drag — just finish the gesture
    if (this.encOpen) { this.encDrag = null; return }
    if (!d) return
    if (this.phase !== 'play' || this.paused) return
    // a UI element (pause / «мимо» / a pause-menu item) has already eaten this gesture whole
    if (claimed) return
    const rect = this.app.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    const dx = x - d.x, dy = y - d.y
    const quick = performance.now() - d.t < 600
    const swipeLeft = dx < -SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.3 && quick
    const swipeDown = dy > SWIPE_MIN && Math.abs(dy) > Math.abs(dx) * 1.3 && quick
    const swipe = swipeLeft || swipeDown
    if (d.touch) {
      // touch: a swipe (the gesture could start anywhere, including on the disc) = a «мимо»
      // skip WITHOUT losing a life; a small movement on the disc = an ordinary tap (as before)
      if (swipe) {
        // eslint-disable-next-line no-console
        console.log(`[hm-swipe] skip ${swipeLeft ? 'left' : 'down'} dx=${dx.toFixed(0)} dy=${dy.toFixed(0)}`)
        this.doSkip()
        return
      }
      if (d.diskTap && !this.tapped && !this.feedback) this.doTap()
      return
    }
    // mouse/pen: the tap already fired on pointerdown; here we only catch a swipe-skip from
    // the lower half (people rarely swipe with a cursor, but let it work as before)
    if (d.y < this.cy) return
    if (swipeLeft) {
      // eslint-disable-next-line no-console
      console.log(`[hm-swipe] skip dx=${dx.toFixed(0)} dy=${dy.toFixed(0)}`)
      this.doSkip()
    }
  }
  private onContext = (e: MouseEvent) => {
    e.preventDefault()
    if (this.phase === 'play' && !this.paused) this.doSkip()
  }
  /** hover of the menu satellites (splash): the cursor in canvas coordinates */
  private onPointerMove = (e: PointerEvent) => {
    // the encyclopedia is paged by dragging (a finger on a phone is the only way to scroll:
    // there is no wheel there)
    if (this.encOpen && this.encDrag) {
      const rect = this.app.canvas.getBoundingClientRect()
      const y = e.clientY - rect.top
      const dy = y - this.encDrag.y
      if (Math.abs(dy) > 4) this.encDrag.moved = true
      this.encScroll = Math.max(0, Math.min(this.encMaxScroll, this.encDrag.from - dy))
      this.encScrollBox.position.set(0, -this.encScroll)
      return
    }
    if (this.phase !== 'splash') return
    const rect = this.app.canvas.getBoundingClientRect()
    this.mouse.x = e.clientX - rect.left; this.mouse.y = e.clientY - rect.top
  }
  /** the React overlay reported the name — greet right away */
  private onName = (e: Event) => {
    this.playerName = String((e as CustomEvent).detail || '') || getName()
  }

  private press(x: number, y: number, button: number, allowTap = true) {
    // ── THE UI EATS ITS OWN TAP (Andrey: «нажимаю паузу — а игра начинается»). The pause
    //    button hangs in the HUD in the INTRO too (hudLayer.visible = play||intro), while
    //    the intro branch below started the game on ANY tap — it used to stand above the
    //    pauseHit check, so a finger on the pause pill launched a move.
    //    Now the HUD buttons are handled FIRST, before any phase logic, and they raise
    //    uiClaimed — then pointerup counts nothing more.
    if (!this.paused && (this.phase === 'play' || this.phase === 'intro')) {
      if (Math.hypot(x - this.pauseHit.x, y - this.pauseHit.y) < this.pauseHit.r) {
        this.uiClaimed = true
        this.setPaused(true)
        return
      }
      if (this.muteHit.r > 0 && Math.hypot(x - this.muteHit.x, y - this.muteHit.y) < this.muteHit.r) {
        this.uiClaimed = true
        this.toggleMute()
        return
      }
    }
    // ── THE PAUSE MENU TAKES THE TAP BEFORE THE PHASES ──────────────────────────
    // This block used to stand BELOW the phase handling, after the line `if (this.phase !==
    // 'play') return`. But pause can be opened in the INTRO too (see the block above and
    // openPause). That gave literally what the author complained about: pause is open, the
    // panel is drawn, the player presses «продолжить» — and the intro branch above catches
    // the tap first and STARTS A MOVE from under the menu. The panel items were completely
    // dead at that point (measured: the first click on the «качество» line in the intro did
    // nothing, pauseFocus stayed 0).
    // Now pause is the very first thing handled after the HUD buttons: while it is open,
    // taps belong only to it, in any phase.
    // ── THE ENCYCLOPEDIA LIES ON TOP OF PAUSE ───────────────────────────────────
    // The same screen stack: while it is open, the input belongs only to it.
    if (this.encOpen) {
      this.uiClaimed = true
      const bb = this.encBackHit
      if (x >= bb.x && x <= bb.x + bb.w && y >= bb.y && y <= bb.y + bb.h) { this.encClose(); return }
      const b = this.encBox
      // a tap outside the panel is also "back" (the habitual gesture for closing a modal)
      if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) { this.encClose(); return }
      // inside the list — start dragging (the "tap or swipe" decision is made on release)
      this.encDrag = { y, from: this.encScroll, moved: false }
      return
    }
    if (this.paused) {
      const b = this.pausePanelBox
      // the volume icons have their own hit zones INSIDE the «звук» row, handled before the
      // row itself (otherwise a tap on the note would turn both steps)
      if (this.volMusicHit.r > 0 && Math.hypot(x - this.volMusicHit.x, y - this.volMusicHit.y) < this.volMusicHit.r) {
        this.uiClaimed = true
        this.sound.cycleMusicVolume(); this.sound.ui(0.7); this.drawPauseMenu()
        return
      }
      if (this.volSfxHit.r > 0 && Math.hypot(x - this.volSfxHit.x, y - this.volSfxHit.y) < this.volSfxHit.r) {
        this.uiClaimed = true
        this.sound.cycleSfxVolume(); this.sound.ui(0.7); this.drawPauseMenu()
        return
      }
      for (const it of this.pauseItems) {
        if (Math.abs(x - this.cx) <= b.w / 2 && Math.abs(y - it.y) <= it.h / 2) {
          this.pauseFocus = this.pauseItems.indexOf(it)
          // ⚠ the flag MUST be raised here too. «Продолжить» takes pause off in this very
          //    frame, and on release pointerup already sees a NON-paused game and counts
          //    the gesture itself. The only thing that saved us was diskTap=false (computed
          //    on pointerdown while pause was still on) — but that is insurance by accident,
          //    not a rule. Here is the rule.
          this.uiClaimed = true
          this.pauseAct(it.kind)
          return
        }
      }
      // outside the panel we treat it as "back", inside the panel we stay silent.
      // A tap on the pause button itself (it is under the veil) must NOT instantly return
      // to the game — otherwise "I pressed pause and the game went on".
      const inPanel = x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
      const onPauseBtn = Math.hypot(x - this.pauseHit.x, y - this.pauseHit.y) < this.pauseHit.r
      this.uiClaimed = true
      if (!inPanel && !onPauseBtn) this.pauseAct('resume')
      return
    }
    if (this.phase === 'splash') {
      // an open overlay (info/records) is closed by any tap
      if (this.splashPanelKind !== 'none') { this.closeSplashPanel(); return }
      // did the finger land in a world circle? Counted BEFORE everything else. The hit zone
      // is generous (r+12 ≈ 68px), a selected circle is bigger still.
      let hitWorld = -1
      for (let w = 0; w < WORLD_COUNT; w++) {
        const h = this.worldHits[w]
        const pad = w === this.splashWorldSel ? 16 : 12
        if (Math.hypot(x - h.x, y - h.y) < h.r + pad) { hitWorld = w; break }
      }
      // ── WHAT ELSE IS UNDER THE FINGER (counted BEFORE clearing the selection).
      //    It used to be: any tap outside a world circle reset splashWorldSel, and a tap on
      //    Play (also "outside the circles") first dropped the fitting and then called
      //    beginGame(0) — the selected stage was ignored. Now only a tap INTO EMPTINESS
      //    clears the selection, and Play respects the fitting room.
      let hitSat = -1
      for (let i = 0; i < this.sats.length; i++) {
        const s = this.sats[i]
        if (Math.hypot(x - s.x, y - s.y) < s.r + 8) { hitSat = i; break }
      }
      const hitSkin = this.skinsUI && hasMilestone(8)
        && Math.hypot(x - this.skinHit.x, y - this.skinHit.y) < this.skinHit.r + 6
      const hitEndless = Math.hypot(x - this.endlessHit.x, y - this.endlessHit.y) < this.endlessHit.r + 8
      const hitDaily = this.dailyHit.w > 0 && this.dailyText.visible
        && Math.abs(x - this.dailyHit.x) <= this.dailyHit.w / 2
        && Math.abs(y - this.dailyHit.y) <= this.dailyHit.h / 2
      // ⚠ the «продолжить» zone used to be a circle with r=140 — on a phone it reached the
      // row of worlds and the number-of-the-day line. The same cure: a flat strip along the
      // line itself (height for a finger, width the whole line with a margin).
      const contH = Math.max(44, this.splashContinue.height + 14)
      const contW = Math.max(220, this.splashContinue.width + 40)
      const hitContinue = this.splashContinue.visible && (this.savedLevel >= 1 || !!this.resumeSnap)
        && Math.abs(x - this.cx) <= contW / 2
        && Math.abs(y - this.splashContinue.y) <= contH / 2
      const hitPlay = Math.hypot(x - this.cx, y - this.cy) < Math.max(this.splashR * 1.15, 44)
      const hitSomething = hitWorld >= 0 || hitSat >= 0 || hitSkin || hitEndless || hitDaily
        || hitContinue || hitPlay
      if (!hitSomething && this.splashWorldSel >= 0) {
        this.clearWorldFitting()
      }
      // menu satellites: sound / info / records
      if (hitSat >= 0) {
        const s = this.sats[hitSat]
        s.scale = 1.35 // a spring response, renderSplash settles it
        if (s.kind === 'sound') { this.toggleMute(); this.sound.ui() }
        else if (s.kind === 'info') { this.openSplashPanel('info'); this.sound.ui() }
        else { this.openSplashPanel('records'); this.sound.ui() }
        return
      }
      // the disc outfit (milestone 15) — the entry is hidden behind a dev flag
      if (hitSkin) {
        this.skin = toggleSkin()
        this.sound.ui()
        this.drawStaticUI()
        this.addFloat(
          this.skin === 1 ? 'наряд диска: аврора' : this.skin === 2 ? 'наряд диска: изумруд' : 'наряд диска: классика',
          this.skin === 2 ? '#80ffc0' : '#e0b0ff', 1.4, 'top')
        return
      }
      // WORLD GATES — two steps (Andrey: «нажимается и ты типа выбираешь», rather than
      // falling into the game from the first touch of a finger).
      if (hitWorld >= 0) { this.tapWorld(hitWorld); return }
      // the ∞ satellite — endless mode (unlocked after the 3rd campaign stage)
      if (hitEndless) {
        if (this.endlessUnlocked()) { this.sound.ui(); this.beginEndless() }
        else { this.sound.ui(0.6); this.splashGateMsg = ENDLESS_GATE_MSG }
        return
      }
      // «продолжить» is handled BEFORE the «число дня». Coming back to YOUR OWN run is the
      // most valuable action on this screen, and it has no right to lose to a neighbour over
      // a disputed pixel (see the history of the zones in renderDailyLine).
      if (hitContinue) {
        // there is an interrupted run — bring THAT one back (with the score and the lives),
        // otherwise the former behaviour "you reached level N" (stars/gates respected)
        this.sound.ui()
        if (this.resumeSnap) this.resumeSession(this.resumeSnap)
        else this.continueGame(this.savedLevel)
        return
      }
      // the number of the day — a small line under the gates (one attempt a day)
      if (hitDaily) {
        const seed = dateSeedUTC(this.dailyDate())
        const done = this.readDailyDone(seed)
        if (done >= 0) { this.sound.ui(0.6); this.splashGateMsg = `число дня уже сыграно сегодня · счёт ${done}` }
        else { this.sound.ui(); this.beginDaily(seed) }
        return
      }
      // PLAY RESPECTS THE FITTING ROOM: if a world circle is selected, Play leads into THAT
      // world (to its first uncompleted level), not into the first stage of the campaign.
      // A locked world refuses honestly and does not lose the selection.
      if (hitPlay) {
        const sel = this.splashWorldSel
        if (sel >= 0) {
          if (this.totalCache >= worldGateStars(sel)) {
            this.sound.ui()
            this.splashWorldSel = -1
            this.beginGame(this.firstUnpassedLevelOfWorld(sel))
          } else { this.sound.ui(0.6); this.splashGateMsg = this.worldGateMsg(sel) }
        } else this.beginGame(0)
      }
      return
    }
    if (this.phase === 'results') {
      // a tap during the celebration — see it through instantly; after it — into the portal
      if (this.resultsT < this.resultsEndT) {
        // the milestone is voiced anyway — a gift must not pass silently
        if (this.resultsToastTexts.length && this.resultsT < this.resultsEndT - 0.45) this.sound.milestone()
        this.resultsT = this.resultsPrevT = this.resultsEndT + 0.001
      } else this.leaveResults()
      return
    }
    if (this.phase === 'intro') {
      // the explanation card takes the tap for itself — finish reading first
      if (this.learnAt >= 0) {
        const total = this.learnManual ? this.learnCards.length : this.learnFresh
        this.learnAt = this.learnAt + 1 < total ? this.learnAt + 1 : -1
        this.sound.ui(0.7)
        return
      }
      // a tap on the condition line — call the explanation back (and page through all of it)
      if (this.learnCards.length && this.hitLearnStrip(x, y)) {
        this.learnManual = true
        this.learnAt = 0
        this.sound.ui(0.7)
        return
      }
      this.phase = 'play'; this.startMove(); this.setPhaseVisibility(); return
    }
    if (this.phase === 'gameover') {
      if (this.mode === 'endless') { this.beginEndless(); return }        // straight to "once more"
      if (this.mode === 'daily') { this.mode = 'campaign'; this.phase = 'splash'; this.setPhaseVisibility(); return }
      this.beginGame(this.levelIdx); return
    }
    if (this.phase === 'finale') { this.beginGame(0); return }
    if (this.phase !== 'play') return
    // (the pause menu is handled at the start of press — it is above ANY phase)
    // (the pause/sound button is handled at the start of press — the UI eats its own tap)
    if (button === 2) return // the right click is handled in contextmenu
    if (Math.hypot(x - this.skipHit.x, y - this.skipHit.y) < this.skipHit.r) { this.uiClaimed = true; this.doSkip(); return }
    if (!allowTap) return // touch: a tap on the disc is decided on pointerup (tap vs swipe)
    // the disc can travel (transfer) — we aim at its current place
    if (Math.hypot(x - (this.cx + this.diskOx), y - (this.cy + this.diskOy)) > this.R * 1.45 || this.tapped || this.feedback) return
    this.doTap()
  }

  private doTap() {
    this.tapped = true
    if (this.surpKind) { this.activateSurprise(this.surpKind); return }
    if (this.level.test(this.currentNumber)) this.resolveGood(true)
    else this.resolveBad(true)
  }

  private doSkip() {
    if (this.tapped || this.feedback) return
    this.tapped = true
    if (this.surpKind) { this.passSurprise(this.surpKind); return }
    const correctToSkip = !this.level.test(this.currentNumber)
    if (correctToSkip) {
      // a correct skip: points — and a SHORT rest pause (nextMove() used to fly instantly
      // and timeAfterStep did not apply to a skip — skip-heavy levels were harsher than
      // intended). We keep the feeling of speed: the skip pause = 0.6×timeAfterStep, shorter
      // than a tap, but not zero
      const wasMult = this.multiplier
      this.streak++
      this.multiplier = this.streak >= 10 ? 3 : this.streak >= 5 ? 2 : 1
      if (this.multiplier === 3 && wasMult < 3) this.celebrateMult3()
      const pts = 10 * this.worldMult * this.multiplier
      this.score += pts
      this.onStreakUp() // milestones 10/25/50/100 and the streak record
      this.glow = 0.8; this.hitStop = 0.03
      this.storm.burst(0.7, this.cx + this.diskOx, this.cy + this.diskOy)
      this.storm.feed(1.2) // a skip also pours a jet into the flow
      this.sound.skip()
      this.addScorePop(pts) // points in the world's colour, summed during a streak
      this.fireStreakLayers()
      this.checkExtraLife()
      this.feedback = 'good'
      this.feedbackT = Math.max(0.18, this.level.timeAfterStep * 0.6)
      this.ringFlashT = 0.3; this.ringFlashCol = 0x9adfff // blue — the language of a skip
    } else {
      // skipped a matching number — minus a life
      this.resolveBad(true)
    }
  }

  // ---------- rules (ported verbatim) ----------
  private beginGame(fromLevel: number) {
    this.mode = 'campaign'
    this.resetRun()
    this.setLevel(fromLevel)
    this.resetFireflies()
    this.enterIntro() // enterIntro writes the run snapshot itself
  }

  /** the common reset of a run session (score/lives/streams) — before setLevel in any mode */
  private resetRun() {
    this.score = 0; this.lives = START_LIVES; this.nextLifeAt = POINTS_PER_LIFE
    this.ruleT = 0
    this.resumeSnap = null // a new run started — the «продолжить» offer is withdrawn
    this.streak = 0; this.multiplier = 1; this.intensity = 0; this.intensityTarget = 0
    this.musicIntensity = 0
    // the streak record is celebrated ONCE per run; the bar itself is forever
    this.comboRecordShown = false
    this.comboRunBase = this.comboBest // what we compete with IN THIS run
    this.comboMilesHit.clear(); this.comboBannerT = 0
    this.timeScale = 1; this.slowmoT = 0
    this.splashGateMsg = ''
    this.explosionQueue = []
    for (const g of this.ghosts) g.txt.destroy()
    this.ghosts = []
    if (this.scorePop) { this.scorePop.txt.destroy(); this.scorePop = null }
    this.echoQueue = []
    this.boltT = 0
    this.sound.tunnelRelease() // insurance: the warp duck must not survive a restart
    this.storm.quench()
  }

  // ---------- ENDLESS MODE ----------

  /** enter endless mode: one stream without an end, the speed grows, there is a record */
  private beginEndless() {
    this.mode = 'endless'
    this.resetRun()
    this.endlessStream = new NumberStream(Math.random, 2 + Math.floor(Math.random() * 6))
    this.endlessCondEnd = 0
    this.endlessNextSurp = 6
    this.endlessRoundN = 0
    this.driftWorld = -1
    // a synthetic "level": worldIdx 0 → a flat ×1 multiplier (comparable records),
    // countOfMoves is huge (there will be no results — the end comes only from lives)
    palFade.set(worldPalette(0))
    this.level = {
      test: (n) => n % 2 === 0, conditionText: 'число ЧЁТНОЕ (делится на 2)',
      firstNumber: 2, deltaNumbers: 1, countOfMoves: 1e9,
      timeStep: 2.2, endSpeedup: 1, timeAfterStep: 0.8,
      palette: palFade.live, hintMoves: 0,
      worldIdx: 0, starsRequired: 0, countdown: false,
    }
    this.levelIdx = 0
    this.resetLevelState()
    this.applyLevelVisuals(0)
    this.endlessNewRound(true) // the first condition — honest right away
    this.resetFireflies()
    this.enterIntro()
  }

  /** the move tempo of endless mode: the speed growth formula from the doc + the palette drift */
  private endlessTuneMove() {
    const m = this.moveIdx
    this.level.timeStep = Math.max(0.85, 2.2 - 0.02 * m)
    this.level.timeAfterStep = Math.max(0.35, 0.80 - 0.01 * m)
    this.level.endSpeedup = 1
    this.endlessDrift()
  }

  /** a visual journey: the palette/particles/music slowly drift across the worlds */
  private endlessDrift() {
    const param = this.moveIdx / 40 // ~one world per 40 moves
    const wi = Math.floor(param) % 5
    const f = param - Math.floor(param)
    const A = worldPalette(wi), B = worldPalette((wi + 1) % 5)
    const mix = (a: string, b: string) => numToHex(lerpColor(hexNum(a), hexNum(b), f))
    const deep = mix(A[0], B[0]), mid = mix(A[1], B[1]), accent = mix(A[2], B[2])
    palFade.set([deep, mid, accent])   // the drift is smooth anyway — set it at once
    this.applyPaletteColors(false)
    if (wi !== this.driftWorld) {
      this.driftWorld = wi
      this.storm.setWorld(wi)
      this.music.setWorld(wi, wi)
    }
  }

  /** the endless surprise pool: with the score it shifts good→evil */
  private endlessPickSurprise(): SurpriseKind | null {
    if (this.moveIdx <= 2 || this.moveIdx < this.endlessNextSurp) return null
    const tier = tierForScore(this.score)
    // frequency: once in ~8 moves at the start → once in ~4 by T3
    const interval = Math.max(4, 8 - tier)
    this.endlessNextSurp = this.moveIdx + interval + Math.floor(Math.random() * 3)
    // the share of evil grows with the points: ~25% at the beginning → 60% in the late game
    const evilProb = Math.min(0.6, 0.22 + this.score / 2500 * 0.38)
    const good: SurpriseKind[] = ['life', 'score', 'help', 'slow', 'explosion', 'freeze']
    const evil: SurpriseKind[] = ['rotation', 'transfer', 'warp', 'fast', 'colorMusic', 'inversion', 'lifeTrap', 'scoreTrap']
    const pool = Math.random() < evilProb ? evil : good
    return pool[Math.floor(Math.random() * pool.length)]
  }

  /** is it time to give birth to a new condition (a round is 8-14 numbers)? */
  private endlessMaybeNewRound() {
    if (this.numIdx >= this.endlessCondEnd) this.endlessNewRound(false)
  }

  /** give birth to an honest condition for the current score tier (a validator at 30-60% "yes") */
  private endlessNewRound(first: boolean) {
    const tier = tierForScore(this.score)
    const preview = this.endlessStream!.preview(this.numIdx, 20)
    // ⚠ REVISION (measured on 390×844): the generator honestly rolls the dice, and on the
    //    first tier its pool is literally {divisible by 2, divisible by 3}
    //    (devAuditGenerator(60, 0)). So every ~sixth "new round" brought THE SAME condition,
    //    and a big «НОВОЕ ПРАВИЛО: делится на 2» banner rose over it. That is anti-feedback:
    //    the player looks for a catch where nothing changed and stops believing the banner —
    //    exactly what the banner was built to cure.
    //    Cured in two steps. (1) We re-roll up to four times — almost always enough.
    //    (2) If the generator is STUCK (the window of numbers allows only one honest
    //    condition), there is NO event: the rule simply lives on, the round is extended.
    //    The honesty of the validator (30-60% "yes") is untouched.
    const was = this.level.conditionText
    let term = genCondition(Math.random, tier, preview)
    for (let i = 0; i < 3 && term.text === was; i++) term = genCondition(Math.random, tier, preview)
    if (!first && term.text === was) {
      this.endlessCondEnd = this.numIdx + 4 + Math.floor(Math.random() * 4) // 4-7 more numbers
      return
    }
    this.level.test = term.test
    this.level.conditionText = term.text
    this.condNew = true
    this.seenConds.add(term.text)
    this.endlessCondEnd = this.numIdx + 8 + Math.floor(Math.random() * 7) // 8–14
    this.endlessRoundN++
    if (!first) this.fireRuleChange(term.text)
  }

  /**
   * A RULE CHANGE IS AN EVENT. Andrey: «в бесконечном смена правил незаметна — надо чтобы
   * цвет и что-то ещё, прям вибрация».
   *
   * It used to be one float from the top in the common stream — nobody noticed it.
   * Now five channels hit at once (game feel: layers, not a single gesture):
   *  1) the disc RING flashes in the COLOUR of the new rule (RULE_COLORS in a cycle) — the
   *     colour becomes the rule's "name" and repeats in the banner and in the condition;
   *  2) a BIG BANNER with the new condition for RULE_BANNER ≈ 2s;
   *  3) sound — sound.milestone() (a bell + a flourish), an already existing API;
   *  4) navigator.vibrate([30,40,30]) where it is supported (in try/catch);
   *  5) a storm burst + a glow — the event is visible even with peripheral vision.
   * And most importantly: the game DOES NOT KILL while you read — the current move gets
   * RULE_BANNER seconds added (endlessNewRound is called from startMove AFTER moveDur is
   * computed, so the time correction is made right here).
   */
  private fireRuleChange(text: string) {
    this.ruleColor = RULE_COLORS[this.endlessRoundN % RULE_COLORS.length]
    this.ruleT = RULE_BANNER
    this.ringFlashT = 0.9
    this.ringFlashCol = this.ruleColor
    this.glow = 1
    this.storm.burst(1.1, this.cx + this.diskOx, this.cy + this.diskOy)
    this.sound.milestone()
    this.vibrate([30, 40, 30])
    // a head start for reading: the move on which the rule changed is longer by the banner
    this.moveDur += RULE_BANNER
    this.ruleBannerText.text = text
    this.layoutRuleBanner()
    // eslint-disable-next-line no-console
    console.log(`[hm-rule] новое правило: ${text}`)
  }

  /** the phone's haptic response: where there is none, silently nothing (Andrey: «вибрация!») */
  private vibrate(pattern: number[]) {
    try { navigator.vibrate?.(pattern) } catch { /* a device without vibration — fine */ }
  }

  private saveEndlessBest() {
    if (this.score > this.endlessBest) {
      this.endlessBest = this.score
      try { localStorage.setItem(SAVE_ENDLESS, String(this.endlessBest)) } catch { /* ok */ }
    }
  }

  // ---------- NUMBER OF THE DAY ----------

  /** enter the number of the day: a deterministic 20-move challenge from the date seed (UTC) */
  private beginDaily(seedOverride?: number) {
    this.mode = 'daily'
    this.dailySeed = seedOverride ?? dateSeedUTC(this.dailyDate())
    this.resetRun()
    const daily = buildDaily(this.dailySeed)
    palFade.set(daily.palette)
    this.level = { ...daily, palette: palFade.live }
    this.levelIdx = 0
    this.resetLevelState()
    this.applyLevelVisuals(16) // music patterns as in the finale — a special vibe
    this.resetFireflies()
    this.enterIntro()
  }

  /** the date for the number of the day: usually now, but a dev hook can substitute it (to test a date change) */
  private dailyDateOverride: Date | null = null
  private dailyDate(): Date { return this.dailyDateOverride ?? new Date() }

  /** the saved result of the number of the day for the current seed (−1 if not played yet) */
  private readDailyDone(seed: number): number {
    try {
      const v = JSON.parse(localStorage.getItem(DAILY_KEY(seed)) || 'null')
      return v && typeof v.best === 'number' ? v.best : -1
    } catch { return -1 }
  }

  private saveDailyResult(score: number) {
    const prev = this.readDailyDone(this.dailySeed)
    const best = Math.max(prev, score)
    try { localStorage.setItem(DAILY_KEY(this.dailySeed), JSON.stringify({ best, done: true })) } catch { /* ok */ }
  }

  /** continue: if the saved level is locked by the gates — fall back to the last open one */
  private continueGame(idx: number) {
    let i = Math.min(idx, LEVELS.length - 1)
    while (i > 0 && totalStars() < LEVELS[i].starsRequired) i--
    this.beginGame(i)
  }

  /**
   * A TAP ON A WORLD CIRCLE — a two-step selection.
   *
   * Step 1 (the circle is not selected yet): we highlight it — the circle grows with a
   * spring, the world's name appears in the message line («Мир 3. „…“ — тапни ещё раз»),
   * for a locked one we honestly write the star threshold. No transition: a finger on a
   * phone hits the neighbours, and falling into the game from the first touch is annoying.
   * Step 2 (a tap on an ALREADY selected one): an open world — off we go; a locked one —
   * the same honest refusal (there is nowhere to go).
   * A tap outside the circles clears the selection — that is done by the caller (see press).
   */
  private tapWorld(w: number) {
    const open = this.totalCache >= worldGateStars(w)
    const confirm = this.splashWorldSel === w
    if (!confirm) {
      this.splashWorldSel = w
      this.splashWorldSelT = 0
      // MENU FITTING ROOM: the WHOLE splash travels into the selected world's palette over
      // MENU_FIT_FADE. Everything moves at once, because level.palette is a REFERENCE to the
      // live triple palFade.live: the cosmos background, the glass of the Play disc (the
      // world's gem), the wings, the satellites, the gates. Cancelling the selection (a tap
      // outside / leaving the splash) brings the "home" palette back.
      palFade.to(worldPalette(w), MENU_FIT_FADE)
      // ── THE FITTING ROOM NOW SOUNDS TOO (Andrey: «музыка не меняется при выборе этапа в
      //    меню — примерочная перекрашивает картинку, но не звук»).
      //    We call the PUBLIC music.setWorld: it changes the world preset (mode, progression,
      //    pad timbre, hall) and regenerates the motif. We do not touch the volume — on the
      //    splash the engine feeds the music with playing:false, and all the layers are held
      //    by the quiet "menu theme" branch (MENU_*_VOL). So the fitting sounds EXACTLY at
      //    the volume of the intro theme, just in the mode of the selected world.
      this.previewWorldMusic(w)
      this.sound.ui(open ? 0.85 : 0.6)
      this.splashGateMsg = open
        ? (w === 4
          ? `Финал. «${WORLD_NAMES[4]}» — тапни ещё раз`
          : `Мир ${w + 1}. «${WORLD_NAMES[w]}» — тапни ещё раз`)
        : this.worldGateMsg(w)
      return
    }
    if (open) { this.sound.ui(); this.splashWorldSel = -1; this.beginGame(this.firstUnpassedLevelOfWorld(w)) }
    else { this.sound.ui(0.6); this.splashGateMsg = this.worldGateMsg(w) }
  }

  /** fitting a world on in the menu: the music preset of that world (quietly, at the menu theme's volume) */
  private previewWorldMusic(w: number) {
    const idx = worldFirstLevelIdx(Math.max(0, Math.min(WORLD_COUNT - 1, w)))
    this.music.setWorld(LEVELS[idx].worldIdx, idx)
  }

  /**
   * Take the world fitting off: the colour and the SOUND go "home".
   * Called from press — a tap INTO EMPTINESS (outside the circles, Play, the satellites, the
   * gates and «продолжить»); a tap on any of them respects the fitting, see hitSomething.
   * ⚠ REVISION: leaving the splash deliberately does NOT come here — there the phase is
   * changed by setPhaseVisibility, and the palette and music preset are set right away by
   * setLevel (or beginEndless) for the RIGHT world. Pulling "home" on the way would mean an
   * extra repaint back and forth at the very moment of entering the game.
   */
  private clearWorldFitting(silent = false) {
    if (this.splashWorldSel < 0) return
    this.splashWorldSel = -1
    this.splashGateMsg = ''
    if (!silent) this.sound.ui(0.5)
    palFade.to(this.splashHomePal, MENU_FIT_FADE)
    this.previewWorldMusic(this.splashHomeWorld)
  }

  /**
   * THE ENDLESS GATE: open after ENDLESS_GATE_LEVELS completed campaign stages. We count by
   * the star piggy bank (completed = stars > 0) rather than by "the whole world 1 is
   * closed" — so the order of completion does not matter.
   */
  private endlessUnlocked(): boolean {
    const stars = starsByLevel()
    let n = 0
    for (let i = 0; i < LEVELS.length; i++) if (stars[i] > 0) n++
    return n >= ENDLESS_GATE_LEVELS
  }

  /**
   * The "home" of the menu palette — the palette we entered the menu with.
   * The fitting room (tapWorld) takes the splash into the colour of the selected world,
   * cancelling the selection brings it back here. The snapshot is taken BY VALUE (not as a
   * reference to palFade.live), otherwise home would travel together with the fitting.
   */
  private splashHomePal: [string, string, string] = [...LEVELS[0].palette]
  /** the "home" of the menu SOUND: the world whose preset plays while no fitting is selected */
  private splashHomeWorld = 0
  private enterMenuPalette() {
    const p = this.level.palette
    this.splashHomePal = [p[0], p[1], p[2]]
    this.splashHomeWorld = this.level.worldIdx
    palFade.set(this.splashHomePal)
    this.level = { ...this.level, palette: palFade.live }
    if (this.ready) this.applyPaletteColors()
  }

  /** an honest refusal from a locked world: how many stars are needed and how many there are */
  private worldGateMsg(w: number): string {
    const need = worldGateStars(w)
    return w === 4
      ? `финал откроется с ${need} звёздами (у тебя ${this.totalCache})`
      : `мир ${w + 1} откроется с ${need} звёздами (у тебя ${this.totalCache})`
  }

  /** the first uncompleted (starless) level of world w; if all are done — the world's first level */
  private firstUnpassedLevelOfWorld(w: number): number {
    const stars = starsByLevel()
    const first = worldFirstLevelIdx(w)
    for (let i = first; i < LEVELS.length && LEVELS[i].worldIdx === w; i++) {
      if (!(stars[i] > 0)) return i
    }
    return first
  }
  private enterIntro() {
    this.phase = 'intro'
    this.prepareLearnCards()
    this.setPhaseVisibility()
    // entering a level is exactly the point we restore from
    this.snapshotSession()
  }

  /**
   * Andrey: «что за прогрессия, что полный квадрат — даже мне тяжело в голове». We collect
   * the explanation cards for the level's condition: first the pieces, then the link
   * (termCards). The ones the player sees for the FIRST time go to the front and open by
   * themselves — and are immediately recorded as shown, so that on a second run the intro
   * does not hold him up. The rest wait for a tap on the condition line. The campaign and
   * the «число дня» — yes; endless mode changes the condition on the fly, cards have no
   * place there (there is one intro for the whole run).
   */
  private prepareLearnCards() {
    this.learnAt = -1
    this.learnFresh = 0
    this.learnManual = false
    this.learnCards = []
    if (this.mode === 'endless') return
    const all = termCards(this.level.term)
    if (!all.length) return
    const fresh = all.filter((c) => !isTermLearned(c.kind))
    const old = all.filter((c) => isTermLearned(c.kind))
    this.learnCards = [...fresh, ...old]
    this.learnFresh = fresh.length
    if (fresh.length) {
      this.learnAt = 0
      markTermsLearned(fresh.map((c) => c.kind))
    }
  }


  /**
   * Andrey: «взрыв чисел на уровнях с прогрессией сбивает счёт игрока».
   *
   * The explosion (the Explosion canon) JUMPS several moves forward: the numbers explode by
   * themselves, moveIdx and numIdx jump by k. For an ordinary condition that is pure
   * celebration. But on a level with a progression the player holds the ladder IN HIS HEAD
   * («с 7, шаг +4 → 7, 11, 15…»): when the row silently jumps four steps, the count in his
   * head breaks and he computes the next number wrong. The celebration turns into a
   * punishment — exactly what the author complained about.
   *
   * So on such levels the explosion is REPLACED by a neutral gift (+points): the event
   * stays, the joy stays, the ladder is not torn. We detect a progression by the level's own
   * terms (arithProg/geomProg from terms.ts) — guessing by the condition text is not
   * allowed, it can be compound.
   */
  private levelHasProgression(): boolean {
    const cards = termCards(this.level.term)
    if (cards.some((c) => c.kind === 'arithProg' || c.kind === 'geomProg')) return true
    // the «число дня» and endless assemble a level on the fly and may have no term —
    // then we fall back to the condition text (it is written by the same terms, one word)
    return !this.level.term && this.level.conditionText.includes('прогресси')
  }

  /** the surprise as it will come out on this level (see levelHasProgression) */
  private safeSurprise(kind: SurpriseKind | null): SurpriseKind | null {
    if (kind !== 'explosion' || !this.levelHasProgression()) return kind
    console.debug('[hm-surprise] взрыв заменён подарком: на уровне прогрессия')
    return 'score'
  }

  /**
   * Andrey: «+1 жизнь за 1000 очков — незаметно, сделай праздником».
   *
   * It used to be: a quiet bell and an ordinary side float «+ жизнь!» the size of a «+10» —
   * the event the player saved a thousand points for passed by unnoticed. Now it is a scene
   * of three layers, as game feel teaches:
   *   1) a BIG «+ жизнь!» float in the centre above the disc (at: 'top');
   *   2) an ORBIT PULSE: all the life lights flash in a wave, a new one flies in — the eye
   *      is led to where the gain is (see lifeCelebT in updateFireflies);
   *   3) sound in two layers via the existing API: lifeBell (a bell) + gift (a fanfare),
   *      plus a disc ring flash and a storm burst.
   * Plus a permanent thin progress bar towards the next life next to the score — so that the
   * event is not a surprise out of nowhere (see renderLifeBar).
   */
  private lifeCelebT = 0
  private readonly LIFE_CELEB = 1.5

  private celebrateExtraLife(text = '+ жизнь!') {
    this.lifeCelebT = this.LIFE_CELEB
    for (const f of this.fireflies) f.flash = 1
    this.ringFlashT = 0.55
    this.ringFlashCol = 0xff6090 // pink "heart" light — the language of lives
    this.glow = Math.max(this.glow, 0.9)
    this.storm.burst(1.3)
    this.sound.lifeBell()
    this.sound.gift() // as a second layer — the gift fanfare (both knobs already exist)
    this.vibrate([12, 40, 22])
    this.addFloat(text, '#ff6090', 1.9, 'top')
  }

  private checkExtraLife() {
    if (this.score >= this.nextLifeAt && this.lives < this.maxLivesNow) {
      this.lives++; this.nextLifeAt += POINTS_PER_LIFE
      this.addFirefly()
      this.celebrateExtraLife()
    }
  }

  /**
   * the rest pause after a move (the timeAfterStep canon): the rhythm cushion of the
   * original. The feedback pause is never shorter than it — even in the finale 0.4s to blink
   */
  private restPad(base: number) { return Math.max(base, this.level.timeAfterStep) }

  /**
   * The player TAPPED a surprise — activation (the WaitState.displayClicked canon):
   * good — a reward and a golden flash; a trap — an effect penalty, but there is no full
   * "silence" as for a mistake: the pain of a trap is its own effect.
   */
  private activateSurprise(kind: SurpriseKind) {
    const good = isGoodSurprise(kind)
    this.feedback = good ? 'good' : 'bad'
    this.feedbackT = this.restPad(0.7)
    this.ringFlashT = 0.45
    // "good" = the light of the CURRENT world (it used to be an eternal amber 0xffd54a),
    // "bad" stays red — that is the language of the game, not the palette
    this.ringFlashCol = good ? this.goodFlash() : 0xff3d6e
    if (good) { this.glow = 1; this.hitStop = 0.045; this.storm.burst(1.2) }
    else { this.shake = 0.5 }

    switch (kind) {
      case 'life':
        // a life surprise is celebrated with the same scene as "for 1000 points"
        if (this.lives < this.maxLivesNow) { this.lives++; this.addFirefly(); this.celebrateExtraLife() }
        else {
          this.sound.lifeBell()
          const b = 100 * this.worldMult; this.score += b
          this.addFloat(`жизни полны: +${b}!`, '#ffd54a', 1.6)
        }
        break
      case 'score': {
        const bonus = 50 * this.worldMult
        this.score += bonus; this.checkExtraLife()
        this.sound.gift()
        this.addFloat(`подарок: +${bonus}!`, '#ffd54a', 1.6)
        break
      }
      case 'lifeTrap':
        this.lives--; this.livesLost++; this.dropFirefly(); this.flash = 0.6
        this.sound.trap()
        this.addFloat('ловушка: — жизнь…', '#ff8080', 1.6)
        break
      case 'scoreTrap': {
        const loss = Math.min(this.score, 50 * this.worldMult)
        this.score -= loss
        this.sound.trap()
        this.addFloat(`ловушка: −${loss}`, '#c060ff', 1.6)
        break
      }
      case 'slow':
        this.timeScale = 0.55; this.slowmoT = 8
        this.sound.freeze() // an icy chime; the lowpass on the master is turned on by slow-sync
        this.addFloat('время медленнее…', '#9adfff', 1.6)
        break
      case 'fast':
        this.timeScale = 1.5; this.slowmoT = 6
        this.sound.trap()
        this.addFloat('подвох: время быстрее!', '#c060ff', 1.6)
        break
      case 'help':
        this.hintBoost = 3 + 1 // this move is a surprise, the hint lasts 3 NUMBERS
        this.sound.gift()
        this.addFloat('подсказка на 3 хода!', '#9adfff', 1.6)
        break
      case 'rotation':
        this.rotT = 5
        this.sound.trap()
        this.addFloat('подвох: круг вращается!', '#c060ff', 1.6)
        break
      case 'explosion': {
        // CELEBRATION (the Explosion canon): the nearest numbers explode BY THEMSELVES —
        // they are skipped WITHOUT losing lives, points drip in for them, ghosts fly apart,
        // fireworks. The old guard `moveIdx+3 < countOfMoves` killed the explosion near the
        // end of a level completely — now we take as many as fit (up to 5).
        const k = Math.max(0, Math.min(5, this.level.countOfMoves - 1 - this.moveIdx))
        const pts = 10 * this.worldMult
        for (let i = 0; i < k; i++) {
          this.explosionQueue.push({ delay: 0.3 + i * 0.24, num: this.numberAt(this.numIdx + i), pts })
        }
        this.moveIdx += k; this.numIdx += k
        this.feedbackT = this.restPad(0.7) + k * 0.28 // we watch the celebration to the end
        this.sound.salute()
        this.storm.burst(1.6)
        this.addFloat('взрыв чисел! салют!', '#ffd54a', 1.8, 'top')
        break
      }
      case 'freeze':
        // a FULL time freeze (the FullFreezing canon): ice over the whole screen, the world
        // stands still — a kind breather, but the world is cold
        this.freezeT = 3.5
        this.sound.freeze()
        this.addFloat('лёд! время замёрзло — выдохни', '#9adfff', 1.8)
        break
      case 'transfer':
        this.transferT = 7; this.transferE = 0
        this.sound.transfer()
        this.addFloat('подвох: диск поехал!', '#c060ff', 1.6)
        break
      case 'warp':
        this.warpT = 6
        this.sound.warp()
        this.addFloat('подвох: диск поплыл…', '#c060ff', 1.6)
        break
      case 'colorMusic':
        this.cmT = 7; this.cmE = 0
        this.sound.colorMusic()
        this.addFloat('цветомузыка! держи фокус', '#c060ff', 1.6)
        break
      case 'inversion':
        this.inversionT = INV_TOTAL
        this.sound.inversion()
        this.addFloat('инверсия… мир выворачивается', '#b44dff', 1.8)
        break
    }
  }

  /** a surprise was passed (skipped or timed out) — the displayNotClicked canon: only a flash */
  private passSurprise(kind: SurpriseKind) {
    const good = isGoodSurprise(kind)
    this.feedback = 'good' // the move does not count as a mistake — we move on
    this.feedbackT = this.restPad(0.45)
    this.ringFlashT = 0.35
    this.ringFlashCol = good ? 0xc060ff : this.goodFlash() // missed a gift — dim, dodged a trap — the world's light
    this.sound.skip(0.5)
    this.addFloat(good ? 'подарок уплыл…' : 'умно! мимо ловушки', good ? '#c060ff' : '#ffd54a', 1.3)
  }

  private resolveGood(byTap: boolean) {
    const wasMult = this.multiplier
    this.streak++
    this.multiplier = this.streak >= 10 ? 3 : this.streak >= 5 ? 2 : 1
    // reaching ×3 is a rare peak: a GOLDEN WAVE (inversion is a debuff only, the author's canon)
    if (this.multiplier === 3 && wasMult < 3) this.celebrateMult3()
    const pts = 10 * this.worldMult * this.multiplier
    this.score += pts
    this.onStreakUp() // milestones 10/25/50/100 and the streak record
    if (byTap) this.hitStop = 0.045
    this.checkExtraLife()
    this.feedback = 'good'; this.feedbackT = this.restPad(byTap ? 0.5 : 0.4)
    // the reward colour goes to the ring and the flash; the number stays white (≤0.15s of warmth)
    this.numberFlashT = 0.14
    this.ringFlashT = 0.4; this.ringFlashCol = this.goodFlash()
    // every correct answer pours a jet in — the vertical flow accumulates
    this.storm.feed(byTap ? 1.6 : 1.2)
    // the background is painted WITH you: a lasting light stroke at a point on the orbit
    // (lives until the end of the level). The angle steps by the golden ratio — the strokes
    // lie in an even fan-picture
    this.brushAngle += 2.399963 // the golden angle
    const bR = this.R * (1.35 + 0.35 * Math.random())
    const bx = this.cx + this.diskOx + Math.cos(this.brushAngle) * bR
    const by = this.cy + this.diskOy + Math.sin(this.brushAngle) * bR
    // the stroke whitens along the long scale — white strokes become the trace of a BIG
    // streak, not of an ordinary five
    const bcol = lerpColor(hexNum(this.level.palette[2]), 0xffffff, Math.min(1, this.streak / 40))
    this.musicViz.addBrush(bx, by, bcol, this.audioNow())
    // the crystal ping grows with the streak — a ladder of reward; a passive success is quieter
    if (byTap) this.sound.tapGood(this.streak)
    else this.sound.skip(0.6)
    if (byTap) {
      // the FIVE-LAYER response of the reference: (a) a white star flash at the number's
      // position + golden shards with gravity — inside storm.burst; (b) the points in the
      // world's colour, stacking; (c) lightning along the orbit on a streak ≥5; (d) echo ×2/×3
      this.glow = 1
      this.storm.burst(1, this.cx + this.diskOx, this.cy + this.diskOy)
      this.addScorePop(pts)
      this.fireStreakLayers()
    } else this.addFloat('+' + pts, '#9adfff', 0.9)
  }

  /**
   * Reaching ×3 is celebrated WITHOUT an inversion (the author's correction: in his canon
   * an inversion is a debuff and only a debuff). Instead of blinking with a negative — a
   * golden wave spreads from the disc across the whole screen + the world glows brighter for
   * a second (stronger bloom and glow), plus a warm salute of shards.
   */
  private celebrateMult3() {
    this.gold3T = GOLD3_DUR
    this.glow = 1
    this.storm.feed(2.2)
    this.storm.burst(1.25, this.cx + this.diskOx, this.cy + this.diskOy)
  }

  // ── COMBO MILESTONES AND RECORD ────────────────────────────────────────────
  // Called ONCE per streak increment (from resolveGood and from a correct skip — both grow
  // the streak). There are two different events here and they must not be confused:
  //   MILESTONE — "you reached 25×", an absolute bar, the same for everyone, gives points;
  //           once per level, so as not to spam.
  //   RECORD  — "you beat YOURSELF", a personal bar from localStorage; celebrated once per
  //           run and with a bass and a voice (the Bejeweled "incredible" canon).

  private onStreakUp() {
    if (this.phase !== 'play') return
    let milestone = false
    for (const at of COMBO_MILESTONES) {
      if (this.streak !== at || this.comboMilesHit.has(at)) continue
      this.comboMilesHit.add(at)
      this.celebrateComboMilestone(at)
      milestone = true
    }
    // the record accumulates ALWAYS (even when we stay silent), it is celebrated once per run
    if (this.streak > this.comboBest) {
      this.comboBest = this.streak
      bankCombo(this.streak)
      if (!this.comboRecordShown && this.comboRunBase >= COMBO_RECORD_MIN
        && this.streak > this.comboRunBase) {
        this.comboRecordShown = true
        // a milestone and a record can fall on ONE answer — then the record waits until the
        // milestone's ladder has finished speaking (otherwise the two loudest events add up
        // into a single peak; the measurement and the reasoning are in sound.comboRecord)
        this.celebrateComboRecord(this.streak, milestone ? 0.55 : 0)
      }
    }
  }

  /**
   * MILESTONE: a banner + a burst in the world's colour + a rising sound accent + POINTS.
   * The strength of everything (burst scale, glow, volume) grows with the milestone step —
   * 10× is "oh", 100× is "EVERYTHING WE HAVE". The points are «плюшки за это» in the
   * author's words: 10 × the milestone number, as a float, so the gain is read by the eye.
   */
  private celebrateComboMilestone(at: number) {
    const tier = COMBO_MILESTONES.indexOf(at) // 0..3
    const k = (tier + 1) / COMBO_MILESTONES.length // 0.25..1 — the strength of the step
    const bonus = COMBO_BONUS_PER * at
    this.score += bonus
    this.checkExtraLife()
    this.showComboBanner(`комбо ${at}×!`, `+${bonus} очков`, false)
    this.glow = Math.max(this.glow, 0.85 + 0.15 * k)
    this.storm.feed(1.4 + 2.2 * k)
    this.storm.burst(1.0 + 0.9 * k, this.cx + this.diskOx, this.cy + this.diskOy)
    // the disc ring flashes with the world's light — the reward is where the player is looking
    this.ringFlashT = 0.55; this.ringFlashCol = this.goodFlash()
    this.addFloat(`+${bonus} за комбо!`, '#ffd54a', 1.5)
    this.sound.comboMilestone(tier)
    this.vibrate(tier >= 2 ? [18, 40, 24] : [16])
    console.debug('[hm-combo]', 'веха', at, '+' + bonus)
  }

  /** STREAK RECORD: a warm deep bass + a voice-like exclamation + a line */
  private celebrateComboRecord(streak: number, delay = 0) {
    this.showComboBanner(`новый рекорд серии: ${streak}!`, 'ты сам себя обошёл', true)
    this.gold3T = Math.max(this.gold3T, GOLD3_DUR)
    this.glow = 1
    this.storm.feed(2.6)
    this.storm.burst(1.35, this.cx + this.diskOx, this.cy + this.diskOy)
    this.sound.comboRecord(delay)
    this.vibrate([26, 50, 40])
    console.debug('[hm-combo]', 'рекорд серии', streak)
  }

  /** the milestone/record banner: the text big, the caption small, lives COMBO_BANNER */
  private showComboBanner(text: string, sub: string, record: boolean) {
    this.comboBannerT = COMBO_BANNER
    this.comboBannerIsRecord = record
    this.comboBannerText.text = text
    this.comboBannerSub.text = sub
    this.comboBannerText.style.fill = record ? '#fff0b8' : numToHex(this.goodFlash())
    this.layoutComboBanner()
  }

  /**
   * The strength of the inversion debuff 0..INV_MAX by the phases of the scene (inhale → in
   * → hold → out). The "inhale" 0..1 is returned separately — the world draws in BEFORE the
   * turn inside out.
   */
  private inversionPhase(): { warn: number; amount: number } {
    const T = this.inversionT
    if (T <= 0) return { warn: 0, amount: 0 }
    const el = INV_TOTAL - T // how much has passed since the start of the scene
    if (el < INV_WARN) return { warn: smooth01(el / INV_WARN), amount: 0 }
    const e = el - INV_WARN
    if (e < INV_IN) return { warn: 1, amount: smooth01(e / INV_IN) * INV_MAX }
    if (e < INV_IN + INV_HOLD) return { warn: 1, amount: INV_MAX }
    return { warn: 1, amount: smooth01(1 - (e - INV_IN - INV_HOLD) / INV_OUT) * INV_MAX }
  }

  /** layers of streak strength: zigzag lightning along the orbit (≥5) and the cascade echo of the flash (×2/×3) */
  private fireStreakLayers() {
    if (this.streak >= 5) {
      this.boltT = 0.32
      this.boltA0 = Math.random() * TAU
      this.boltSeed = Math.floor(Math.random() * 1000)
    }
    if (this.multiplier >= 2) this.echoQueue.push({ delay: 0.13, scale: 0.5 })
    if (this.multiplier >= 3) this.echoQueue.push({ delay: 0.26, scale: 0.32 })
  }

  /**
   * The points in the COLOUR of the world's accent with a 3D outline (a dark stroke + a
   * shadow). A streak is summed into ONE growing number («+40 → +80 → +120») that pulses on
   * every increment — as in the reference; the number's life is extended by an increment
   */
  private addScorePop(pts: number) {
    const p = this.scorePop
    if (p && p.life > 0.2) {
      // the streak is alive — the number grows and pulses
      p.value += pts
      p.txt.text = '+' + p.value
      p.life = p.maxLife
      p.pulse = 1
      return
    }
    if (p) { p.txt.destroy(); this.scorePop = null }
    // like addFloat — the font size ×1.25 on small screens
    const tiny = Math.min(this.W, this.H) < 500
    const txt = mkText({
      text: '+' + pts,
      style: new TextStyle({
        fontFamily: 'Nunito', fontWeight: '900', fontSize: tiny ? 38 : 30, fill: this.level.palette[2],
        stroke: { color: 0x140a26, width: 5 },
        dropShadow: { color: 0x000000, alpha: 0.55, blur: 2, distance: 3, angle: Math.PI / 3 },
      }),
    })
    txt.anchor.set(0.5)
    // Andrey: «+1/+2 вылезают за экран». It used to spawn WITHOUT any clamp at all — and x
    // is also moved by diskOx of the «диск поплыл» trap (up to ±0.20·W), so on a narrow
    // phone it easily flies off the right edge. We clamp it the same way as addFloat (see
    // its big comment above)
    const x = this.clampFloatX(this.cx + this.diskOx + this.R * 1.7, txt.width / 2)
    const y = Math.min(this.floatBottomCeil(txt.height / 2), Math.max(this.floatTopFloor(txt.height / 2), this.cy + this.diskOy - this.R * 0.5))
    txt.position.set(x, y)
    this.app.stage.addChildAt(txt, this.app.stage.children.indexOf(this.flashRect))
    this.scorePop = { txt, value: pts, life: 1.15, maxLife: 1.15, pulse: 1 }
  }

  private resolveBad(byTap: boolean) {
    this.lives--; this.livesLost++; this.streak = 0; this.multiplier = 1; this.hitStop = 0.09
    this.dropFirefly()
    // ABRUPT silence: the world goes quiet in half a second (more painful than a penalty)
    this.intensity = 0; this.intensityTarget = 0; this.hush = 1
    this.storm.quench() // the flow breaks off together with the world
    this.feedback = 'bad'; this.feedbackT = this.restPad(0.7); this.flash = 1; this.shake = 1
    this.numberFlashT = 0.14
    this.ringFlashT = 0.5; this.ringFlashCol = 0xff5252
    // glitch "stumble": a false note + frames of RGB shift/tremble (≤0.3s) towards the hush
    this.glitchT = 0.25
    this.sound.bad()
    this.sound.glitch()
    this.addFloat(byTap ? 'не то!' : 'пропустил!', '#ff8080', 1.1)
  }

  private endOfMove() {
    if (!this.tapped && !this.feedback) {
      if (this.surpKind) { this.passSurprise(this.surpKind); return }
      if (this.level.test(this.currentNumber)) this.resolveBad(false)
      else this.resolveGood(false)
    }
  }

  private nextMove() {
    if (this.lives <= 0) {
      // we meet the defeat screen clean: we put out the floating hints and the score number,
      // cut off the jets — silence without litter
      this.phase = 'gameover'
      for (const f of this.floats) f.txt.destroy()
      this.floats = []
      if (this.scorePop) { this.scorePop.txt.destroy(); this.scorePop = null }
      this.storm.quench()
      // endless: save the record; number of the day: fix today's result
      if (this.mode === 'endless') this.saveEndlessBest()
      else if (this.mode === 'daily') this.saveDailyResult(this.score)
      else this.saveProgress()
      this.endSession() // the run is over — there is nothing left to «продолжить»
      this.setPhaseVisibility(); return
    }
    this.moveIdx++
    if (this.moveIdx >= this.level.countOfMoves) { this.enterResults(); return }
    this.startMove()
    this.snapshotSession() // a snapshot at EVERY end of a move
  }

  // ---------- level results: the celebration of progress ----------

  /** the level is passed → quality stars: 3 without losses, 2 — one life, 1 — just passed */
  private enterResults() {
    const stars = this.livesLost === 0 ? 3 : this.livesLost === 1 ? 2 : 1
    this.showResults(stars, this.score - this.levelScoreStart)
  }

  /**
   * COLLAPSING THE WORLD (Andrey: «как все элементы красиво деваются»).
   * Nothing is switched off: everything drains to the disc in 0.62s, each on its own micro
   * path — the life lights along personal spirals, the particles/flow in a funnel
   * (storm.setImplode), the floating lines and the score number by attraction to the centre.
   * A rising hum goes under it; at the exit — a breath of silence.
   */
  private beginImplode() {
    this.implodeT = IMPLODE_DUR
    this.implodeFired = false
    for (const f of this.fireflies) {
      if (f.state === 'orbit' || f.state === 'arrive') f.state = 'suck'
    }
    this.sound.collapseHum(IMPLODE_DUR)
  }

  private showResults(stars: number, levelScore: number) {
    this.phase = 'results'
    // The flow is NO LONGER cut off by a switch (it used to be storm.quench() — the world
    // simply vanished). Now it is sucked into the disc, and the quench happens by itself at
    // the end of the collapse — by the time the stars arrive the screen is clean, but
    // clean BEAUTIFULLY
    this.beginImplode()
    this.starsEarned = stars
    this.resultsLevelScore = Math.max(0, levelScore)
    this.resultsT = this.resultsPrevT = 0
    this.scoreTickAcc = 0; this.scoreTickN = 0
    if (this.mode === 'daily') {
      // number of the day: we do NOT touch the campaign piggy bank — only the personal result for the date
      const prev = this.readDailyDone(this.dailySeed)
      this.resultsNewBest = prev < 0 || this.resultsLevelScore > prev
      this.saveDailyResult(this.resultsLevelScore)
      this.resultsToastTexts = []
      this.capstoneParty = false; this.capstoneAcc = 0
      const countEnd = this.starsAt(stars - 1) + COUNT_LAG + COUNT_DUR
      this.resultsEndT = countEnd + (this.resultsNewBest ? 0.35 : 0.15)
      this.buildResultsToasts()
      this.resultsTitle.text = 'Число дня пройдено!'
      this.resultsFinalHint = 'тапни — на сплэш'
      this.setPhaseVisibility()
      return
    }
    // the piggy bank: the best level score and the best stars (localStorage)
    this.resultsNewBest = bankLevelScore(this.levelIdx, this.resultsLevelScore)
    bankStars(this.levelIdx, stars)
    // milestone gifts: reached one — a festive toast (permanent bonuses)
    this.totalCache = totalStars()
    const fresh = claimMilestones(this.totalCache)
    this.resultsToastTexts = fresh.map((m) => m.text)
    // the 51★ capstone: fireworks over the whole celebration + a warm line for the one who collected everything
    this.capstoneParty = fresh.some((m) => m.at === 51)
    this.capstoneAcc = 0
    if (this.capstoneParty) {
      this.resultsToastTexts.push('идеальная ясность. эта игра ждала именно тебя =)')
    }
    this.saveProgress()
    // the timings of the celebration (a tap skips it): stars → count-up → «лучший!» → toasts
    const countEnd = this.starsAt(stars - 1) + COUNT_LAG + COUNT_DUR
    this.resultsEndT = countEnd + (this.resultsNewBest ? 0.35 : 0.15) + (this.resultsToastTexts.length ? 0.55 : 0)
    this.buildResultsToasts()
    this.resultsTitle.text = `${this.levelTag()} пройден!`
    this.resultsFinalHint = this.levelIdx + 1 >= LEVELS.length ? 'тапни — дальше' : 'летим дальше…'
    this.setPhaseVisibility()
  }

  /**
   * The moment the i-th star arrives. The stars start AFTER the breath of silence (the
   * collapse ends at 0.62s) and go twice as densely as before — "fast and compact", as the
   * author asked. It used to be 0.55 + i·0.45.
   */
  private starsAt(i: number) { return 0.85 + i * 0.24 }

  private leaveResults() {
    if (this.mode !== 'campaign') {
      // the number of the day / endless do not go through the campaign gates — back to the splash
      this.mode = 'campaign'
      this.totalCache = totalStars()
      this.phase = 'splash'; this.saveProgress(); this.setPhaseVisibility(); return
    }
    if (this.levelIdx + 1 >= LEVELS.length) {
      // the end of the campaign: the «Ясность» finale screen
      this.phase = 'finale'; this.saveProgress()
      this.endSession() // the campaign is finished, there is nothing to continue
      this.setPhaseVisibility(); return
    }
    // world gates: the next level is locked — to the splash, honestly saying how many stars
    const next = this.levelIdx + 1
    const need = LEVELS[next].starsRequired
    if (this.totalCache < need) {
      const w = LEVELS[next].worldIdx
      this.splashGateMsg = w === 4
        ? `дальше — финал: нужно ${need} звёзд, у тебя ${this.totalCache}. Переиграй уровни на 2-3 звезды!`
        : `врата мира ${w + 1}: нужно ${need} звёзд, у тебя ${this.totalCache}. Переиграй уровни на 2-3 звезды!`
      // the gates are closed — this run goes no further, «продолжить» would lead into an
      // already finished level. We close the run honestly (the stars and the record are already banked)
      this.phase = 'splash'; this.saveProgress(); this.endSession(); this.setPhaseVisibility()
      return
    }
    this.enterPortal()
  }

  /** milestone toasts: a panel with a star (Graphics) and a warm line */
  private buildResultsToasts() {
    this.resultsToasts.removeChildren().forEach((c) => c.destroy({ children: true }))
    this.resultsToastTexts.forEach((text, i) => {
      const c = new Container()
      const label = mkText({ text, style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 21, fill: '#ffe9a0' }) })
      label.anchor.set(0, 0.5)
      // long milestones («идеальная ясность…») made the panel wider than the phone and ran
      // off the edges — we shrink the font to the screen width minus the star and the margins
      this.fitTextToWidth(label, 21, Math.max(120, this.W - 24 - 78))
      const w = label.width + 78, h = 52
      const panel = new Graphics()
      panel.roundRect(-w / 2, -h / 2, w, h, 26).fill({ color: 0x1a1034, alpha: 0.92 })
        .stroke({ width: 2, color: 0xffd54a, alpha: 0.7 })
      this.drawStar(panel, -w / 2 + 30, 0, 13, 0xffd54a)
      label.position.set(-w / 2 + 52, 0)
      c.addChild(panel, label)
      c.position.set(0, i * 62)
      this.resultsToasts.addChild(c)
    })
  }

  private saveProgress() {
    if (this.score > this.best) { this.best = this.score; localStorage.setItem(SAVE_BEST, String(this.best)) }
  }

  // ── SNAPSHOT OF A LIVE RUN (a release blocker) ─────────────────────────────
  // Andrey: «Отвлёкся, возвращаюсь — очки пропали, предлагает первый уровень». Android kills
  // the WebView of a backgrounded tab without warning, and a correct shutdown cannot be
  // relied on at all: the snapshot must already lie in localStorage by the moment we are
  // killed. So we write it on every significant event, not "on exit".
  //
  // We write: the end of a move · opening pause · going to the background · pagehide · going
  // to the menu. We clear: game over · the campaign finale · returning to the splash through
  // the results.

  /** write a snapshot of the current run (cheap: one 100-byte JSON) */
  private snapshotSession() {
    // campaign only: endless lives by its record, the number of the day by a single attempt
    if (this.mode !== 'campaign' || this.lives <= 0) return
    if (this.phase !== 'play' && this.phase !== 'intro' && this.phase !== 'results' && this.phase !== 'portal') return
    saveSession({
      mode: 'campaign',
      levelIdx: this.levelIdx,
      score: this.score,
      lives: this.lives,
      nextLifeAt: this.nextLifeAt,
      moveIdx: this.moveIdx,
      seed: this.dailySeed,
    })
  }

  /** the run honestly ended — there is nothing left for «продолжить» to offer */
  private endSession() {
    clearSession()
    this.resumeSnap = null
  }

  /**
   * Bring the player back into an interrupted run. We return him to the START of the current
   * level — with all the accumulated score, lives and the next-life threshold. Honest and
   * simple: resurrecting the middle of a level (half-eaten surprises, someone else's timer,
   * half a flow) would be both harder and less honest — while the score, which is what it
   * was all about, is preserved in full.
   */
  private resumeSession(s: SessionSnapshot) {
    const idx = Math.max(0, Math.min(s.levelIdx, LEVELS.length - 1))
    this.beginGame(idx) // mode=campaign, resetRun (zeroes the score), setLevel, intro
    // ...and on top of a clean run we lay the saved state
    this.score = Math.max(0, Math.round(s.score) || 0)
    this.lives = Math.max(1, Math.min(this.maxLivesNow, Math.round(s.lives) || 1))
    // the «+1 life» threshold: if the snapshot brought garbage (or the threshold is already
    // passed) — we recompute it from the score, otherwise a life would be given away at once and again
    const nl = Math.round(s.nextLifeAt)
    this.nextLifeAt = Number.isFinite(nl) && nl > this.score
      ? nl
      : (Math.floor(this.score / POINTS_PER_LIFE) + 1) * POINTS_PER_LIFE
    this.levelScoreStart = this.score // the level score is counted from this point
    this.resetFireflies()             // the lights on the orbit — for the restored lives
    this.addFloat(`с возвращением! счёт ${this.score}`, '#9adfff', 2.2, 'top')
    console.debug('[hm-resume] заход восстановлен:',
      `${this.levelTag(idx)}`, `счёт ${this.score}`, `жизней ${this.lives}`, `порог ${this.nextLifeAt}`)
    this.snapshotSession() // immediately rewrite the snapshot for the new entry point
  }

  /**
   * The page goes out of sight (the game was minimised, the tab switched, a phone call).
   * The snapshot is a must; plus the game itself goes on pause, so that the returning player
   * does not find that his lives ran out during the conversation.
   */
  private onHide = () => {
    this.snapshotSession()
    if (!this.paused && (this.phase === 'play' || this.phase === 'intro')) this.setPaused(true)
  }
  private onVisibility = () => { if (document.visibilityState === 'hidden') this.onHide() }

  private enterPortal(kindOverride?: PortalKind) {
    this.phase = 'portal'; this.portalT = 0
    this.portalWhite = 0
    this.tunnelPalSet = false; this.tunnelChimed = false; this.tunnelHit = false
    this.implodeT = 0; this.storm.setImplode(0, this.cx, this.cy)
    this.restoreFireflies() // the lights fly into the new world together with the disc
    // colour inversion must not cover the portal: a negative over the vortex is "white paper
    // with a red spiral", scary (checked by the author =)
    this.inversionT = 0; this.gold3T = 0
    // the river flow breaks off: the world is leaving, the warp is an "exhale" (otherwise
    // columns of drops hang over the tunnel); in the new world the flow honestly accumulates anew
    this.storm.quench()
    const dest = this.levelIdx + 1
    const destL = LEVELS[Math.min(dest, LEVELS.length - 1)]
    // the hypertunnel is now ALWAYS used (a nameless vortex used to spin inside a world and
    // there was no "arrival of a level" — the author asked for a show and a banner on every
    // transition). The vortex is still available through devPortal.
    this.portalKind = kindOverride ?? 'tunnel'
    if (this.portalKind === 'tunnel') {
      // the sound canon: the whoosh of the departure, the master dips — "the warp is the quietest moment"
      this.sound.tunnelFly()
      // the disc flies away "as is": we put out the traces of the game state on it
      this.wings.clear(); this.bolt.clear(); this.aura.clear(); this.oscG.clear()
      this.diskLayer.position.set(this.cx, this.cy)
      // the arrival banner: a new world is called by name, your own world by the level number
      const newWorld = destL.worldIdx !== this.level.worldIdx
      this.portalBanner.text = !newWorld
        ? this.levelTag(dest)
        : destL.worldIdx === 4
          ? `Финал. «${WORLD_NAMES[4]}»`
          : `Мир ${destL.worldIdx + 1}. «${WORLD_NAMES[destL.worldIdx]}»`
      // ⚠ MOBILE: the banner used to live at font size 46 without a fit — «Мир 1. „Тёплый
      // Счёт“» is ~460px, on a 360px phone it was cut on BOTH sides. World names are long and
      // changeable (WORLD_NAMES), so we fit them.
      this.fitTextToWidth(this.portalBanner, 46, this.W - 28)
      this.portalBanner.visible = false
    } else {
      this.sound.portal() // a rising whoosh ~1.5s
    }
    // the tunnel is painted in the palette of the DESTINATION level — we fly to the new world
    if (this.tunnelFilter) {
      const u = (this.tunnelFilter.resources as any).uTunnel.uniforms
      u.uAccent = hexRgb(destL.palette[2]); u.uMid = hexRgb(destL.palette[1])
      // the hue of the destination world — the tunnel colour drifts around it.
      // In the shader's cos palette (0.5+0.5·cos(2π(h+[0,⅓,⅔]))) the circle goes the OPPOSITE
      // way from HSL: 0→red, ⅓→blue, ⅔→green. Hence 1 − hue/360
      u.uHue = 1 - hueOf(hexNum(destL.palette[2])) / 360
    }
    // save the progress: reached a new level
    if (dest > this.savedLevel) { this.savedLevel = dest; localStorage.setItem(SAVE_LEVEL, String(dest)) }
    this.setPhaseVisibility()
  }

  // ---------- life lights ----------
  private resetFireflies() {
    for (const f of this.fireflies) f.sprite.destroy()
    this.fireflies = []
    for (let i = 0; i < this.lives; i++) this.fireflies.push(this.makeFirefly('orbit'))
  }
  /**
   * The colour of the life lights = the light of the current world. It used to be a
   * hardcoded amber 0xffe0a0 — in a blue/turquoise world it stuck out as alien warmth. The
   * accent, whitened by half: the light stays a "live firefly", but of its own palette.
   */
  private fireflyTint(): number {
    return lerpColor(hexNum(this.level.palette[2]), 0xffffff, 0.5)
  }

  /** the "good" ring flash — the world's accent, whitened to a festive light */
  private goodFlash(): number {
    return lerpColor(hexNum(this.level.palette[2]), 0xffffff, 0.35)
  }

  private makeFirefly(state: Firefly['state']): Firefly {
    const sp = new Sprite(this.glowTex)
    sp.anchor.set(0.5); sp.blendMode = 'add'; sp.tint = this.fireflyTint()
    sp.width = sp.height = 30
    this.diskLayer.addChild(sp)
    return {
      sprite: sp, state, ph: Math.random() * TAU, x: this.cx, y: this.cy, vy: 0, flash: 0,
      spin: Math.random() < 0.5 ? -1 : 1,
    }
  }
  private addFirefly() { this.fireflies.push(this.makeFirefly('arrive')) }
  /**
   * After the collapse, put the lights back on the orbit. Without this they stayed in the
   * 'suck' state at zero radius — and in the NEW level the lives were invisible (caught by
   * reading the flow of phases: setLevel does not rebuild the lights).
   */
  private restoreFireflies() {
    for (const f of this.fireflies) {
      if (f.state === 'suck') { f.state = 'orbit'; f.sprite.alpha = 1 }
    }
  }
  private dropFirefly() {
    const orbit = this.fireflies.filter((f) => f.state === 'orbit')
    const f = orbit[orbit.length - 1]
    if (f) { f.state = 'fall'; f.vy = 120 }
  }
  private updateFireflies(dt: number, pulseAmt: number) {
    // the «+жизнь» celebration — a pulse wave along the orbit. The lights flash not all at
    // once but one after another (shifted by index): the orbit "breathes" in a circle and the
    // eye comes by itself to where the gain is. Lives LIFE_CELEB seconds and fades.
    if (this.lifeCelebT > 0) {
      this.lifeCelebT = Math.max(0, this.lifeCelebT - dt)
      const k = this.lifeCelebT / this.LIFE_CELEB          // 1 → 0
      const wave = 6.5 * (this.LIFE_CELEB - this.lifeCelebT) // the phase of the running wave
      this.fireflies.forEach((f, i) => {
        const ph = wave - i * 0.55
        if (ph > 0) f.flash = Math.max(f.flash, k * Math.max(0, Math.sin(ph)))
      })
    }
    const orbit = this.fireflies.filter((f) => f.state === 'orbit')
    orbit.forEach((f, i) => {
      const ang = this.t * 0.5 + (i / Math.max(1, orbit.length)) * TAU
      const rad = this.R * 1.32 + Math.sin(this.t * 1.5 + f.ph) * this.R * 0.05
      f.x = Math.cos(ang) * rad; f.y = Math.sin(ang) * rad
    })
    for (const f of this.fireflies) {
      if (f.state === 'suck') {
        // end of the level: the light is drawn into the disc along ITS OWN spiral —
        // the radius melts, the angle winds up in its personal direction, brighter at the very edge
        const d = Math.hypot(f.x, f.y) || 1
        const a = Math.atan2(f.y, f.x) + f.spin * dt * (2.4 + 4.2 * (1 - d / (this.R * 1.4)))
        const nd = Math.max(0, d - dt * (this.R * 1.9 + d * 2.6))
        f.x = Math.cos(a) * nd; f.y = Math.sin(a) * nd
        f.sprite.alpha = clamp01(nd / (this.R * 0.55))
        const s = 30 * (0.5 + 0.9 * clamp01(nd / (this.R * 1.3)))
        f.sprite.width = f.sprite.height = s
        f.sprite.position.set(f.x, f.y)
        continue
      }
      if (f.state === 'arrive') {
        const tx = 0, ty = -this.R * 1.32
        if (f.y < -this.R * 3) { f.x = 0; f.y = -this.R * 4 }
        f.x += (tx - f.x) * Math.min(1, dt * 4)
        f.y += (ty - f.y) * Math.min(1, dt * 4)
        if (Math.hypot(f.x - tx, f.y - ty) < this.R * 0.15) f.state = 'orbit'
        f.sprite.alpha = 1
      } else if (f.state === 'fall') {
        f.vy += 500 * dt; f.y += f.vy * dt
        f.sprite.alpha = Math.max(0, f.sprite.alpha - dt * 0.7)
        if (f.y > this.H) { f.sprite.destroy(); this.fireflies = this.fireflies.filter((x) => x !== f); continue }
      } else {
        f.sprite.alpha = 0.85 + 0.15 * Math.sin(this.t * 3 + f.ph)
      }
      // running light: the flash on an arp note decays within a frame (~0.35s)
      f.flash = Math.max(0, f.flash - dt * 2.8)
      // in the storm (×3) the life lights FLASH on the beat — in sync with the music
      const stormFlash = this.multiplier >= 3 ? this.beatAccent * (2 - this.beatAccent) : 0
      const anyFlash = Math.max(stormFlash, f.flash)
      if (anyFlash > 0 && f.state === 'orbit') f.sprite.alpha = Math.min(1, f.sprite.alpha + anyFlash * 0.5)
      const pl = 1 + pulseAmt * 0.25 * Math.sin(this.pulsePhase + f.ph) + anyFlash * 0.4
      f.sprite.width = f.sprite.height = 30 * pl
      f.sprite.position.set(f.x, f.y)
    }
  }

  /** a ghost number: flies out of the disc as fireworks (the explosion celebration) */
  private spawnGhostNumber(num: number) {
    const txt = mkText({
      text: String(num),
      // the ghost burns with the world's light, not with an eternal amber
      style: new TextStyle({
        fontFamily: 'Nunito', fontWeight: '900',
        fontSize: Math.max(28, Math.round(this.R * 0.55)), fill: this.goodFlash(),
      }),
    })
    txt.anchor.set(0.5); txt.blendMode = 'add'
    txt.position.set(this.cx, this.cy)
    this.app.stage.addChildAt(txt, this.app.stage.children.indexOf(this.flashRect))
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4 // in a fan upwards
    const sp = 260 + Math.random() * 220
    this.ghosts.push({
      txt, x: this.cx, y: this.cy,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      vr: (Math.random() - 0.5) * 4, life: 1.25, maxLife: 1.25, grav: 170,
    })
  }

  /** countdown: the previous number falls DOWN out of the disc (gravity panic) */
  private spawnFallingNumber(num: number) {
    const txt = mkText({
      text: String(num),
      style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '900', fontSize: Math.max(26, Math.round(this.R * 0.5)), fill: '#ffffff' }),
    })
    txt.anchor.set(0.5); txt.alpha = 0.85
    txt.position.set(this.cx + this.diskOx, this.cy + this.diskOy)
    this.app.stage.addChildAt(txt, this.app.stage.children.indexOf(this.flashRect))
    this.ghosts.push({
      txt, x: this.cx + this.diskOx, y: this.cy + this.diskOy,
      vx: (Math.random() - 0.5) * 70, vy: 90,
      vr: (Math.random() - 0.5) * 2.4, life: 1.0, maxLife: 1.0, grav: 1150,
    })
  }

  // ---------- floats ----------
  // side — points / short events: to the right of the disc, so they do not stick to the highlight;
  // top — long messages (surprises): above the disc
  /**
   * Andrey from his phone: «+1/+2 вылезают за экран, иногда надо щуриться». The previous fix
   * (see the comment below) clamped only the BIRTH POINT of a float in addFloat — and not
   * everywhere:
   *  (a) scorePop («+40 → +80 → +120», the growing streak number) spawned WITH NO CLAMP AT
   *      ALL, and its x is also moved by diskOx of the «диск поплыл» trap (up to ±0.20·W) —
   *      on a narrow phone it easily flies off the edge;
   *  (b) the rise (txt.y -= vy·dt) was NEVER re-checked by a clamp — a float was born inside
   *      the frame but crawled above the top edge during its lifetime. For scorePop that is
   *      worse still: its life is EXTENDED by every streak increment, so the upward drift is
   *      not bounded by "vy·life" at spawn at all — a floor is needed EVERY frame, not only
   *      at birth;
   *  (c) the text anchor is the centre (0.5): right at a side edge half the line still stuck
   *      out if the point was clamped WITHOUT counting the half width.
   * The shared clamps (clampFloatX/floatTopFloor/floatBottomCeil) now stand BOTH at birth
   * AND on every frame of the rise — at once for addFloat and scorePop.
   */
  private clampFloatX(x: number, halfW: number) {
    const m = 16 // the margin from the edge, see the comment below
    return Math.max(halfW + m, Math.min(x, this.W - halfW - m))
  }

  private floatTopFloor(halfH: number) {
    // no higher than the bottom of the HUD stack (score → value → world → ×N, ends at y≈86)
    return 90 + halfH
  }

  private floatBottomCeil(halfH: number) {
    return this.H - 16 - halfH
  }

  private addFloat(text: string, color: string, life: number, at: 'side' | 'top' = 'side') {
    if (this.floats.length > 12) return
    // on small screens (min(W,H) < 500) the floats read too small («+10» — you have to
    // squint). Font size ×1.25, fitTextToWidth will shrink it further by itself
    const tiny = Math.min(this.W, this.H) < 500
    const baseSize = tiny ? 30 : 24
    const txt = mkText({ text, style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: baseSize, fill: color }) })
    txt.anchor.set(0.5)
    // ⚠ MOBILE (Andrey: «в САМОЙ ИГРЕ обрезаются буквы»).
    // Floats were born at font size 24 with no regard for the screen width: the line
    // «сюрприз! тапни — возьмёшь, „мимо“ — пропустишь» on 360px stuck out over BOTH edges
    // (it was cut to «...пропусти»). Now the font size shrinks to the screen, and the start
    // point is pressed so that even a side float stays fully in frame.
    // ⚠ REVISION (floats measured on 360×780): a margin of 8px is NOT a margin. «умно! мимо
    //    ловушки» stood at 102…352 out of 360, and on a live phone with rounded corners and
    //    a gesture bar the tail of the line reads as cut off (exactly the complaint «слова не
    //    влезают»). We keep 16px on each side — both in the font fit and in the start point.
    this.fitTextToWidth(txt, baseSize, this.W - 32)
    const halfW = txt.width / 2
    const halfH = txt.height / 2
    // the top float does not climb onto the HUD stack (score → value → world → ×N, it ends
    // at y≈86) and does not go off the top edge on a low screen
    let x: number, y: number
    if (at === 'top') { x = this.cx; y = Math.max(100, this.cy - this.R * 2.15) }
    else { x = Math.min(this.cx + this.R * 1.75, this.W - halfW - 16); y = this.cy - this.R * 0.85 }
    x = this.clampFloatX(x, halfW)
    y = Math.min(this.floatBottomCeil(halfH), Math.max(this.floatTopFloor(halfH), y))
    // ⚠ (found on a screenshot of the life celebration): ALL top floats were born at the
    // same point, and two live lines were printed on top of each other — «+ жизнь!» lay right
    // on «с возвращением!». If the place is taken, the new line stands ONE LINE LOWER (until
    // it hits the ceiling of the bottom zone).
    if (at === 'top') {
      for (let guard = 0; guard < 6; guard++) {
        const busy = this.floats.find((f) =>
          f.txt.visible && Math.abs(f.txt.y - y) < halfH + f.txt.height / 2 + 6)
        if (!busy) break
        const next = busy.txt.y + busy.txt.height / 2 + halfH + 10
        if (next > this.floatBottomCeil(halfH)) break
        y = next
      }
    }
    txt.position.set(x, y)
    this.app.stage.addChildAt(txt, this.app.stage.children.indexOf(this.flashRect))
    this.floats.push({ txt, life, maxLife: life, vy: 40 })
  }

  // ---------- loop ----------
  private frame(dtRaw: number) {
    if (this.disposed || !this.ready) return
    // quality: the measurement uses the RAW dt — the engine clamps it to 0.05s (so the
    // physics does not jump), while we need the honest frame length, otherwise 20 fps would
    // look like 20 fps right up to the threshold and like 20 again beyond it.
    quality.frame(dtRaw)
    const dt = Math.min(0.05, dtRaw)
    this.uiT += dt // the UI clock runs on pause too (the menu / oscilloscope stay alive)
    if (!this.paused) { this.t += dt; this.update(dt) }
    else {
      // under the pause menu the music is not cut off: the scheduler must be fed, otherwise
      // the lookahead runs out and the pad dies (and the oscillogram in the menu goes dead)
      this.music.ensureStarted()
      this.music.update(dt, { intensity: 0.10, multiplier: 1, hush: 0, playing: true })
    }
    this.render(dt)
  }

  private update(dt: number) {
    this.tickPalette(dt)   // the smooth travel of the world palette
    this.pulsePhase += dt * BEAT_HZ * TAU
    this.pulse = 0.5 + 0.5 * Math.sin(this.pulsePhase)
    // the beat boundary — a quiet pulse bass (layers: silence → tick → tick+sub on ×2+)
    const beatN = Math.floor(this.pulsePhase / TAU)
    if (beatN !== this.beatN) {
      this.beatN = beatN
      // the pulse bass follows the MUSICAL axis: the heart of the world must not stay silent
      // for the first ten answers only because the storm got longer
      if (this.phase === 'play') this.sound.beat(this.musicIntensity, this.multiplier)
      // beat accent: the strong beat of the bar (every 4th) hits fuller, the weak ones
      // softer. This is the CHARGE of a decay envelope: the disc/number/ring peck on the beat and let go.
      const strong = beatN % 4 === 0
      this.beatAccent = Math.max(this.beatAccent, strong ? 1 : 0.5)
      // the music wave "somewhere else": a soft circle across the background from the disc on the beat (a strong one is wider)
      if (this.phase === 'play' || this.phase === 'portal' || this.phase === 'results') {
        this.musicViz.beatWave(strong, this.audioNow(), this.intensity)
      }
    }
    // release the accent (a fast decay — a "peck", not a jerk): ~0.28s to zero
    this.beatAccent = Math.max(0, this.beatAccent - dt * 3.6)
    this.glitchT = Math.max(0, this.glitchT - dt)

    if (this.hitStop > 0) { this.hitStop -= dt; return }
    if (this.slowmoT > 0) { this.slowmoT -= dt; if (this.slowmoT <= 0) this.timeScale = 1 }
    // freeze: a FULL freeze of the move's time (the FullFreezing canon)
    this.freezeT = Math.max(0, this.freezeT - dt)
    // slow-mo and the freeze muffle the world's sound ("through the ice"), released when the ice ends
    const slowNow = (this.timeScale < 1 && this.slowmoT > 0) || this.freezeT > 0
    if (slowNow !== this.slowWas) { this.slowWas = slowNow; this.sound.setSlow(slowNow) }
    this.wobble = Math.max(0, this.wobble - dt)
    this.gold3T = Math.max(0, this.gold3T - dt)
    this.rotT = Math.max(0, this.rotT - dt)
    this.warpT = Math.max(0, this.warpT - dt)
    this.inversionT = Math.max(0, this.inversionT - dt)
    // colour music: the spectrum runs while the effect lasts
    this.cmT = Math.max(0, this.cmT - dt)
    if (this.cmT > 0) this.cmE += dt; else this.cmE = 0
    // transfer: the disc travels smoothly across the screen in a soft Lissajous loop;
    // the amplitude fades in and out — by the end the disc returns home by itself
    this.transferT = Math.max(0, this.transferT - dt)
    if (this.transferT > 0) {
      this.transferE += dt
      const amp = Math.min(1, this.transferE / 1.3) * Math.min(1, this.transferT / 1.3)
      this.diskOx = Math.sin(this.transferE * 0.85) * this.W * 0.20 * amp
      this.diskOy = Math.sin(this.transferE * 1.31 + 0.7) * this.H * 0.13 * amp
    } else {
      this.transferE = 0
      this.diskOx *= Math.max(0, 1 - dt * 6)
      this.diskOy *= Math.max(0, 1 - dt * 6)
    }
    this.numberFlashT = Math.max(0, this.numberFlashT - dt)
    this.ringFlashT = Math.max(0, this.ringFlashT - dt)
    this.ruleT = Math.max(0, this.ruleT - dt) // the «новое правило» banner
    this.comboBannerT = Math.max(0, this.comboBannerT - dt) // the milestone banner
    this.boltT = Math.max(0, this.boltT - dt)
    this.portalWhite = Math.max(0, this.portalWhite - dt * 5)
    // the gem's idle glint: once every 4-6s a white 4-ray star on a random facet
    this.glintA = Math.max(0, this.glintA - dt * 2.2)
    this.glintT -= dt
    if (this.glintT <= 0) {
      this.glintT = 4 + Math.random() * 2
      this.glintA = 1
      if (this.gemFilter) {
        const a = Math.random() * TAU
        const rr = 0.28 + Math.random() * 0.14
        ;(this.gemFilter.resources as any).uGemU.uniforms.uGlintPos =
          new Float32Array([Math.cos(a) * rr, Math.sin(a) * rr])
      }
    }
    // cascade echo: the flash is reflected by a second weaker layer on ×2/×3
    if (this.echoQueue.length) {
      for (const e of this.echoQueue) e.delay -= dt
      const fire = this.echoQueue.filter((e) => e.delay <= 0)
      if (fire.length) {
        this.echoQueue = this.echoQueue.filter((e) => e.delay > 0)
        for (const e of fire) this.storm.burst(e.scale, this.cx + this.diskOx, this.cy + this.diskOy)
      }
    }
    // the growing score number: drifts up barely, pulses on an increment, melts
    if (this.scorePop) {
      const p = this.scorePop
      p.life -= dt
      p.pulse = Math.max(0, p.pulse - dt * 5)
      // a floor EVERY frame — the life of scorePop is extended by every streak increment,
      // so "vy·life" at spawn does not bound it
      p.txt.y = Math.max(this.floatTopFloor(p.txt.height / 2), p.txt.y - 10 * dt)
      p.txt.scale.set(1 + 0.35 * p.pulse * p.pulse) // a pop on the increment, ease-out
      p.txt.alpha = Math.min(1, p.life * 2.2)
      if (p.life <= 0) { p.txt.destroy(); this.scorePop = null }
    }
    this.flash = Math.max(0, this.flash - dt * 2.2)
    this.glow = Math.max(0, this.glow - dt * 1.6)
    this.shake = Math.max(0, this.shake - dt * 3)
    this.hush = Math.max(0, this.hush - dt * 1.5)

    // ── COLLAPSING THE WORLD INTO THE DISC ────────────────────────────────
    if (this.implodeT > 0) {
      this.implodeT = Math.max(0, this.implodeT - dt)
      const k = smooth01(1 - this.implodeT / IMPLODE_DUR) // 0 → 1, accelerating
      this.storm.setImplode(k, this.cx + this.diskOx, this.cy + this.diskOy)
      // the floating lines and the score number also drain to the disc instead of just melting
      const px = this.cx + this.diskOx, py = this.cy + this.diskOy
      const pullK = Math.min(1, dt * (2.2 + 7 * k))
      for (const f of this.floats) {
        f.txt.x += (px - f.txt.x) * pullK
        f.txt.y += (py - f.txt.y) * pullK
        f.txt.scale.set(Math.max(0.15, f.txt.scale.x * (1 - dt * 1.6)))
        f.vy = 0
      }
      if (this.scorePop) {
        const p = this.scorePop
        p.txt.x += (px - p.txt.x) * pullK
        p.txt.y += (py - p.txt.y) * pullK
      }
      if (this.implodeT <= 0) {
        // the world is swallowed: the funnel switches off, the flow dies, A BREATH OF SILENCE
        this.storm.setImplode(0, px, py)
        this.storm.quench()
        if (!this.implodeFired) {
          this.implodeFired = true
          this.sound.breathIn(0.10)
          this.glow = Math.max(this.glow, 0.8) // the disc fills with light for an instant
          this.storm.burst(0.8, px, py)
        }
      }
    }

    // ── THE INTENSITY AXIS (a long curve, the peak at combo 100) ───────────
    // The shape lives in COMBO_CURVE at the top of the file — here only "where we are going".
    // The portal/results set their own values directly: there the axis describes not the
    // streak but the scene (the sound arc of the transition), and the streak curve has
    // nothing to do with it.
    if (this.phase === 'play') this.intensityTarget = comboIntensity(this.streak)
    else if (this.phase === 'portal') {
      // THE SOUND ARC OF THE PORTAL: the music does not go dead, it slims down.
      // An acceleration on the departure → in the tunnel ONE pad is left as a thin thread
      // (the bass threshold of 0.15 is not crossed) → on arrival it blooms in the new world
      const pt = this.portalT
      this.intensityTarget = this.portalKind !== 'tunnel' ? 0.8
        : pt < TUN_B ? 0.80
          : pt < TUN_C ? 0.08
            : pt < TUN_E ? 0.32 : 0.55
    } else if (this.phase === 'results') {
      // the collapse still hums — the world is full; after it the scene is almost empty:
      // the ambient leaves with the world, the disc, the stars and the pad remain
      this.intensityTarget = this.implodeT > 0 ? 0.6 : 0.16
    } else this.intensityTarget = 0
    const rate = this.intensityTarget > this.intensity ? 1.2 : 3.5 // the fall is faster than the rise
    this.intensity += (this.intensityTarget - this.intensity) * Math.min(1, dt * rate)
    if (this.hush > 0.2) this.intensity = Math.min(this.intensity, 0.05)
    // the MUSICAL axis (see the musicIntensity field): in game — the former streak/12 arc,
    // outside the game — the same as the world's (the portal/results describe a scene).
    const musTarget = this.phase === 'play'
      ? Math.min(1, this.streak / 12) : this.intensityTarget
    this.musicIntensity += (musTarget - this.musicIntensity) * Math.min(1, dt * rate)
    if (this.hush > 0.2) this.musicIntensity = Math.min(this.musicIntensity, 0.05)

    // generative music: it comes alive as soon as sound.ts has opened the ctx (the first
    // gesture), the layers crossfade from intensity/streak, hush muffles everything but the pad
    this.music.ensureStarted()
    this.music.update(dt, {
      intensity: this.musicIntensity, multiplier: this.multiplier, hush: this.hush,
      playing: this.phase === 'intro' || this.phase === 'play'
        || this.phase === 'portal' || this.phase === 'results',
    })

    this.storm.update({
      // on a full freeze the particles visually stand still (world 2: "the frost freezes time itself")
      dt: this.freezeT > 0 ? dt * 0.1 : dt, t: this.t,
      intensity: this.intensity, pulse: this.pulse, pulsePhase: this.pulsePhase,
      hush: this.hush, multiplier: this.multiplier,
      // the whole gamut of the particles comes from the world palette, not from a hardcoded amber
      accent: hexNum(this.level.palette[2]),
      mid: hexNum(this.level.palette[1]),
      deep: hexNum(this.level.palette[0]),
    })

    this.floats = this.floats.filter((f) => {
      f.life -= dt
      // a floor EVERY frame, not only at spawn — otherwise the rise still carries the float
      // over the top edge (see addFloat)
      f.txt.y = Math.max(this.floatTopFloor(f.txt.height / 2), f.txt.y - f.vy * dt)
      f.txt.alpha = Math.min(1, f.life)
      if (f.life <= 0) { f.txt.destroy(); return false }
      return true
    })

    // the number explosion celebration: the skipped ones explode in turn — points drip in
    if (this.explosionQueue.length) {
      for (const q of this.explosionQueue) q.delay -= dt
      const due = this.explosionQueue.filter((q) => q.delay <= 0)
      if (due.length) {
        this.explosionQueue = this.explosionQueue.filter((q) => q.delay > 0)
        for (const q of due) {
          this.score += q.pts
          this.spawnGhostNumber(q.num)
          this.addFloat('+' + q.pts, '#ffd54a', 0.9)
          this.storm.burst(0.9)
        }
        this.checkExtraLife()
      }
    }
    // ghost numbers: upwards as fireworks, light gravity, melting
    this.ghosts = this.ghosts.filter((g) => {
      g.life -= dt
      g.vy += g.grav * dt
      g.x += g.vx * dt; g.y += g.vy * dt
      g.txt.position.set(g.x, g.y)
      g.txt.rotation += g.vr * dt
      const k = Math.max(0, g.life / g.maxLife)
      g.txt.alpha = Math.min(1, k * 2.5)
      g.txt.scale.set(0.7 + (1 - k) * 0.7)
      if (g.life <= 0) { g.txt.destroy(); return false }
      return true
    })

    if (this.phase === 'play') {
      // the breathing wakes up early, but reaches full depth at the peak
      const pulseAmt = 0.15 + 0.85 * Math.max(this.wake * 0.45, this.intensity)
      this.updateFireflies(dt, pulseAmt)
      if (this.feedback) {
        this.feedbackT -= dt
        if (this.feedbackT <= 0) { this.nextMove(); this.setPhaseVisibility() }
        return
      }
      this.moveAnim += dt // the number's arrival clock always runs (otherwise it gets stuck small)
      // the tutorial: for the first two moves time stands still — the player answers when he
      // is ready. A full freeze also stops the move clock
      if (!this.tutorialMove && this.freezeT <= 0) this.moveTime += dt * this.timeScale
      if (this.moveTime >= this.moveDur) { this.endOfMove(); if (!this.feedback) { this.nextMove(); this.setPhaseVisibility() } }
    } else {
      this.updateFireflies(dt, 0.2)
    }

    if (this.phase === 'portal') {
      this.portalT += dt
      if (this.portalKind === 'tunnel') {
        // the full Bejeweled cycle ~4.1s: the phase events follow the timings of the study
        const dest = Math.min(this.levelIdx + 1, LEVELS.length - 1)
        if (!this.tunnelHit && this.portalT >= TUN_A) {
          // phase B: THE IMPACT FLASH — the disc is swallowed, the screen goes white
          this.tunnelHit = true
          this.sound.portalHit()
          this.shake = Math.max(this.shake, 0.8)
        }
        if (!this.tunnelPalSet && this.portalT >= TUN_C) {
          // phase D: the NEW world appears behind the eclipse (palette / particle character)
          this.tunnelPalSet = true
          const L = LEVELS[dest]
          // not a switch but the start of the travel right inside the tunnel's eclipse —
          // the new world APPEARS while the camera is still flying
          palFade.to(L.palette, PAL_FADE)
          this.storm.setWorld(L.worldIdx)
          // the music preset changes exactly at the tunnel's "eclipse" (a drone glide)
          this.music.setWorld(L.worldIdx, dest)
        }
        if (!this.tunnelChimed && this.portalT >= TUN_D) {
          // phase E: the arrival chime, the master releases the warp duck
          this.tunnelChimed = true
          this.sound.tunnelArrive()
        }
        if (this.portalT > TUN_END) {
          this.setLevel(this.levelIdx + 1)
          this.enterIntro()
        }
      } else if (this.portalT > 2.4) {
        this.setLevel(this.levelIdx + 1)
        this.enterIntro()
      }
    }

    if (this.phase === 'results') this.updateResults(dt)
  }

  /** the clock of the results celebration: the sounds sit on the moments of the timeline */
  private updateResults(dt: number) {
    this.resultsPrevT = this.resultsT
    this.resultsT += dt
    const t = this.resultsT, pt = this.resultsPrevT
    // the fanfare is NO LONGER played on entry (the collapse hum is there) — it sounds
    // exactly when the stars fly out of the collapsed world
    const fanfareAt = this.starsAt(0) - 0.10
    if (pt < fanfareAt && t >= fanfareAt) { this.sound.fanfare(); this.storm.burst(1.1) }
    // the stars land with a bounce — an impact + a chime on landing
    for (let i = 0; i < this.starsEarned; i++) {
      const at = this.starsAt(i) + 0.18
      if (pt < at && t >= at) { this.sound.starLand(i); this.storm.burst(0.5); this.glow = Math.max(this.glow, 0.6) }
    }
    // the score count-up: "casino" ticks (shorter — the whole scene got more compact)
    const c0 = this.starsAt(this.starsEarned - 1) + COUNT_LAG
    const cDur = COUNT_DUR
    if (this.resultsLevelScore > 0 && t > c0 && pt <= c0 + cDur) {
      this.scoreTickAcc += dt
      while (this.scoreTickAcc > 0.045) { this.scoreTickAcc -= 0.045; this.sound.scoreTick(this.scoreTickN++) }
    }
    const bestAt = c0 + cDur + 0.12
    if (this.resultsNewBest && pt < bestAt && t >= bestAt) { this.sound.gift(); this.glow = 1 }
    const toastAt = this.resultsEndT - 0.45
    if (this.resultsToastTexts.length && pt < toastAt && t >= toastAt) {
      this.sound.milestone(); this.storm.burst(1.2); this.glow = 1
      if (this.capstoneParty) this.sound.salute() // 51★ — the fireworks begin
    }
    // the 51★ capstone: salvos of fireworks across the whole screen while the results screen lives
    if (this.capstoneParty && t >= toastAt) {
      this.capstoneAcc += dt
      if (this.capstoneAcc > 0.55) {
        this.capstoneAcc = 0
        this.storm.burst(1.1,
          this.cx + (Math.random() - 0.5) * this.W * 0.7,
          this.cy + (Math.random() - 0.5) * this.H * 0.55)
        this.glow = Math.max(this.glow, 0.7)
      }
    }
    // NO DRY PAUSE: in the campaign the scene leaves for the portal by itself — the results
    // are read, the world is already collapsed, there is nothing to wait a tap for (a tap
    // still speeds it up). In the «число дня» / endless modes the result waits for the
    // player — there people read the number.
    if (this.mode === 'campaign' && !this.capstoneParty
      && t >= this.resultsEndT + RESULTS_HOLD) this.leaveResults()
  }

  /** the time of the audio clock (ctx) — a shared axis with the note bus; 0 until audio is open */
  private audioNow(): number { return this.sound.musicBus()?.ctx.currentTime ?? 0 }

  /**
   * "WAKING UP" 0..1 — a short scale for the things that are NOT the storm: HUD brightness,
   * the disc glow, the oscilloscope amplitude, the breathing of the lights. They must not
   * ride the long combo curve: the player has to see the score and the buttons from the
   * first answers, not from the tenth. The WAKE_AT threshold is chosen so that these things
   * wake up on the same streak (≈5) as on the old streak/12 curve.
   */
  private get wake(): number { return clamp01(this.intensity / WAKE_AT) }

  // ---------- render ----------
  private render(dt: number) {
    this.cosmos.render({
      dt: this.paused ? 0 : dt, t: this.t,
      intensity: this.intensity, pulse: this.pulse,
      pulsePhase: this.pulsePhase, hush: this.hush,
    })
    // audio-reactive layer v2: the note-fall flow at the disc, the music waves across the
    // background, the background picture of strokes (highlighted on the results)
    this.musicViz.render({
      audioNow: this.audioNow(), t: this.t,
      cx: this.cx, cy: this.cy, R: this.R, W: this.W, H: this.H,
      intensity: this.intensity, hush: this.hush, multiplier: this.multiplier,
      resultsGlow: this.phase === 'results',
    })
    // FULLSCREEN ice: a slowdown — a vignette from slowmoT; a FULL freeze — ice at full
    // strength while time stands still
    const slowFrost = this.timeScale < 1 && this.slowmoT > 0 ? Math.min(1, this.slowmoT / 1.2) : 0
    const freezeFrost = Math.min(1, this.freezeT / 0.7)
    this.frost.render(this.paused ? 0 : dt, this.t, Math.max(slowFrost, freezeFrost))
    // THE GOLDEN ×3 WAVE (a reward instead of the former blink of inversion) — strength 0..1
    const gold3 = this.gold3T > 0 ? this.gold3T / GOLD3_DUR : 0
    // The glow strength breathes with the storm and flares on events. We keep the ceiling
    // "tasty": a peak of ~1.5 instead of the former 1.9 (on ×3 the world got bleached)
    if (this.bloom) {
      // the world's glow is on the long curve too, and with a squeezed bottom (power 1.35):
      // on a streak of 10-25 the bloom is almost the same as at rest, the whole range is given
      // to the peak. The ceiling and the event contribution (glow / golden wave) are as before.
      this.bloom.bloomScale = Math.min(1.55,
        0.70 + Math.pow(this.intensity, 1.35) * 0.50 + this.glow * 0.35 + gold3 * gold3 * 0.30)
    }
    // INVERSION is a DEBUFF only (the author's canon). The scene: a warning inhale → a
    // smooth in → hold → a smooth out; strength 85%, not an absolute negative.
    // In the portal and outside the game it is switched off entirely.
    const inv = this.phase === 'play' ? this.inversionPhase() : { warn: 0, amount: 0 }
    // quality: the condition used to be the bloom itself — on "быстро" the inversion and the
    // glitch would have disappeared with it, and those are the AUTHOR'S debuffs, not
    // decoration. The condition is now "is there WebGL at all", and the bloom is mixed into
    // the set only if it is enabled.
    if (this.hasGL) {
      const invOn = !!this.invertFx && inv.amount > 0.004
      if (invOn) this.invertFx!.alpha = inv.amount
      // glitch on a mistake: a short RGB shift with a tremble, the amplitude falls in ~0.25s.
      // The amplitude is half as thin as before — the former 7px cut the eye
      const glOn = !!this.glitchFx && this.glitchT > 0
      if (glOn) {
        const k = Math.min(1, this.glitchT / 0.25) // 1 → 0
        const amp = 3.5 * k
        const jx = () => (Math.random() - 0.5) * amp * 2
        this.glitchFx!.red = { x: amp + jx() * 0.3, y: jx() * 0.4 }
        this.glitchFx!.blue = { x: -amp + jx() * 0.3, y: jx() * 0.4 }
        this.glitchFx!.green = { x: jx() * 0.2, y: 0 }
      }
      // compose the filters: bloom (if the quality keeps it), + inversion, + glitch
      const bloomOn = !!this.bloom && quality.knobs.bloom // quality
      const wantKey = (invOn ? 1 : 0) | (glOn ? 2 : 0) | (bloomOn ? 4 : 0)
      if (wantKey !== this.filterKey) {
        this.filterKey = wantKey
        const fs: Filter[] = bloomOn ? [this.bloom!] : []
        if (invOn && this.invertFx) fs.push(this.invertFx)
        if (glOn && this.glitchFx) fs.push(this.glitchFx)
        this.world.filters = fs
      }
    }
    // COLOUR MUSIC (a debuff) — the "limited palette of the moment" of Tetris Effect:
    // not a fullscreen spectral cycle but a SLOW drift of two or three neighbouring hues
    // AROUND the world's colour, desaturated by ~40%. It unsettles but does not blind.
    const cmOn = this.cmT > 0 && this.phase === 'play'
    this.cmOverlay.visible = cmOn
    if (cmOn) {
      const ramp = Math.min(1, this.cmE / 0.9) * Math.min(1, this.cmT / 1.1)
      const base = hueOf(hexNum(this.level.palette[2]))
      // two overlaid slow sines — the hue wanders in a ±36° corridor
      const drift = 24 * Math.sin(this.cmE * 0.55) + 12 * Math.sin(this.cmE * 0.31 + 1.3)
      this.cmOverlay.tint = hsl(base + drift, 0.50, 0.64)
      // the readability of the debuff is kept by BREATHING rather than by saturation: the
      // screen visibly "inhales and exhales" the colour in time with the pulse, staying pastel
      this.cmOverlay.alpha = ramp * (0.24 + 0.13 * Math.sin(this.pulsePhase))
    }

    // THE GOLDEN ×3 WAVE + the "inhale" before the inversion — one screen layer over the world
    this.waveFx.clear()
    if (gold3 > 0) {
      const k = 1 - gold3                               // progress 0→1
      const maxR = Math.hypot(this.W, this.H) * 0.60
      // an almost even spread (pow 1.25): the wave LIVES in the frame for ~0.85s instead of
      // shooting off the edge in a third of a second — otherwise the reward is simply not seen
      const r = maxR * (1 - Math.pow(1 - k, 1.25))
      const fade = Math.pow(gold3, 1.3)
      const wx = this.cx + this.diskOx, wy = this.cy + this.diskOy
      this.waveFx.circle(wx, wy, r * 1.07).stroke({ width: 34 * fade + 3, color: 0xff9a30, alpha: 0.16 * fade })
      this.waveFx.circle(wx, wy, r).stroke({ width: 20 * fade + 3, color: 0xffd54a, alpha: 0.40 * fade })
      this.waveFx.circle(wx, wy, r * 0.93).stroke({ width: 9 * fade + 2, color: 0xfff2c8, alpha: 0.28 * fade })
      // a golden halo right at the disc: it keeps the reward WHERE the player is looking for
      // the whole celebration (the wave leaves — the halo still breathes)
      const halo = Math.pow(gold3, 0.7)
      this.waveFx.circle(wx, wy, this.R * (1.22 + 0.85 * k))
        .stroke({ width: 11 * halo + 2, color: 0xffd54a, alpha: 0.30 * halo })
      // a short warm breath across the whole frame (the first ~0.4s)
      const warm = Math.max(0, gold3 - 0.62) / 0.38
      if (warm > 0) this.waveFx.rect(0, 0, this.W, this.H).fill({ color: 0xffc860, alpha: 0.07 * warm })
    }
    if (inv.warn > 0 && inv.amount <= 0) {
      // a warning half a second ahead: a violet ring CONTRACTS towards the disc —
      // the screen literally inhales before the turn inside out
      const k = inv.warn
      const maxR = Math.hypot(this.W, this.H) * 0.62
      const r = maxR * (1 - 0.5 * k)
      this.waveFx.circle(this.cx + this.diskOx, this.cy + this.diskOy, r)
        .stroke({ width: 6 + 24 * k, color: 0xb44dff, alpha: 0.08 + 0.20 * k })
    }

    // shake / wobble — on world
    let ox = 0, oy = 0
    if (this.shake > 0) { ox = (Math.random() - 0.5) * 10 * this.shake; oy = (Math.random() - 0.5) * 10 * this.shake }
    this.world.position.set(ox, oy)
    if (this.wobble > 0) {
      const w = Math.min(1, this.wobble)
      this.world.pivot.set(this.cx, this.cy)
      this.world.position.set(this.cx + ox, this.cy + oy)
      this.world.rotation = Math.sin(this.t * 6) * 0.02 * w
      const sc = 1 + Math.sin(this.t * 4) * 0.012 * w
      this.world.scale.set(sc)
    } else { this.world.pivot.set(0, 0); this.world.rotation = 0; this.world.scale.set(1) }
    // the "inhale" before the inversion: for half a second the camera SOFTLY ZOOMS IN — a
    // warning with the body, not with text (the author's correction: not a "bang" but a roll).
    // Zoom in, not out: zooming out would open a black frame at the edges.
    if (inv.warn > 0 && inv.amount <= 0) {
      const k = 1 + 0.014 * inv.warn
      this.world.pivot.set(this.cx, this.cy)
      this.world.position.set(this.cx + ox, this.cy + oy)
      this.world.scale.set(this.world.scale.x * k, this.world.scale.y * k)
    }
    // PROMO: the world RISES out of the screen (the lift layer for the hologram). Outside
    // devLift() liftDur === 0 — the branch does not run, alpha stays 1.
    if (this.liftDur > 0) {
      this.liftT = Math.min(this.liftDur, this.liftT + dt)
      const e = Math.pow(this.liftT / this.liftDur, 1.7)
      this.world.pivot.set(this.cx, this.cy)
      this.world.position.set(this.cx + ox, this.cy + oy - this.H * 0.85 * e)
      this.world.scale.set(this.world.scale.x * (1 + 0.4 * e), this.world.scale.y * (1 + 0.4 * e))
      this.world.alpha = 1 - 0.85 * e
    } else if (this.world.alpha !== 1) this.world.alpha = 1

    // THE READABILITY PROTECTOR (the requirement "the number is readable even at 100×"):
    // the dark halo under the disc thickens TOGETHER with the storm density — both values now
    // ride the same long curve, so at combo 100 (maximum particles) the protector is at its
    // maximum too. The ceiling was raised 0.95 → 1.0 exactly for that frame: where the scale
    // used to end at a streak of 12, combo 100 now stands.
    this.protector.alpha = Math.min(1, 0.5 + this.intensity * 0.5)

    // The disc lives on the results too: it is the CORE of the collapse scene — the world
    // drains into it, the stars land next to it, the portal later flies out of it. The
    // number/timer/hints inside renderDisk are themselves tied to phase==='play', so on the
    // results only clean glass with a rim is left
    if (this.phase === 'play' || this.phase === 'intro' || this.phase === 'results') this.renderDisk()
    if (this.phase === 'portal') this.renderPortal()
    if (this.phase === 'splash') this.renderSplash(dt)
    if (this.phase === 'results') this.renderResults()
    this.renderOsc()

    this.renderHud()
    this.renderRuleBanner() // a rule change in endless is an event
    this.renderComboBanner() // a combo milestone / streak record is an event
    // the pause menu on top of everything: drawn per frame — the focus / the sound icon /
    // the oscillogram must stay alive while the world under them stands still
    this.pauseOverlay.visible = this.paused
    if (this.paused) this.drawPauseMenu()
    // the rule encyclopedia — a screen ON TOP of pause
    this.encOverlay.visible = this.encOpen
    if (this.encOpen) this.renderEncyclopedia()
    // The floats live on the stage, ABOVE the world, while pause and the encyclopedia are
    // inside the world. So a line caught by the pause hung right over the panel and got in
    // the way of reading: the float clock stands still on pause, so it hung there for as long
    // as the menu was open. The reading screens hide them; when the game resumes, the line
    // calmly lives out its life in place.
    const modal = this.encOpen || this.paused
    for (const f of this.floats) f.txt.visible = !modal

    // the error flash
    this.flashRect.clear()
    if (this.flash > 0) this.flashRect.rect(0, 0, this.W, this.H).fill({ color: 0xff2828, alpha: this.flash * 0.25 })
    // the "inhale" before the inversion: the frame fills with dark violet — the air thickens
    if (inv.warn > 0 && inv.amount <= 0) {
      this.flashRect.rect(0, 0, this.W, this.H).fill({ color: 0x2a0a3a, alpha: 0.13 * inv.warn })
    }
    // the white splice flash of the tunnel (phase B): "a jump into hyperspace"
    if (this.portalWhite > 0) {
      this.flashRect.rect(0, 0, this.W, this.H).fill({ color: 0xffffff, alpha: Math.min(1, this.portalWhite) })
    }
  }

  private renderDisk() {
    const R = this.R, accent = hexNum(this.level.palette[2])
    const pulseAmt = 0.15 + 0.85 * Math.max(this.wake * 0.45, this.intensity)
    // beat accent: an ease-out envelope (a peck on the beat) rather than a continuous sine.
    // Noticeable but soft — the depth grows with the intensity, but is always visible.
    const beatEnv = this.beatAccent * (2 - this.beatAccent)
    const diskScale = 1 + (0.012 + 0.03 * this.intensity) * beatEnv
    // transfer: the disc (and the readability protector with it) travels across the screen
    this.diskLayer.position.set(this.cx + this.diskOx, this.cy + this.diskOy)
    this.protector.position.set(this.cx + this.diskOx, this.cy + this.diskOy)
    // warp: the disc's shape wobbles (scale/skew drift) — the number stays readable
    if (this.warpT > 0) {
      const w = Math.min(1, this.warpT / 1.2)
      const sx = 1 + 0.11 * Math.sin(this.t * 4.3) * w
      const sy = 1 - 0.09 * Math.sin(this.t * 3.4 + 1.1) * w
      this.diskLayer.scale.set(diskScale * sx, diskScale * sy)
      this.diskLayer.skew.set(0.09 * Math.sin(this.t * 2.7) * w, 0.05 * Math.sin(this.t * 3.9 + 0.6) * w)
    } else {
      this.diskLayer.scale.set(diskScale)
      this.diskLayer.skew.set(0, 0)
    }
    // the "rotating ring of numbers" trap (his Rotation): a ±17° sway, the number stays readable
    this.diskLayer.rotation = this.rotT > 0
      ? Math.sin(this.t * 1.3) * 0.3 * Math.min(1, this.rotT / 1.5) : 0

    // ── THE SURPRISE AURA (Andrey: «какой хороший, какой плохой — должно читаться
    //    мгновенно»). It used to be one R*1.5 pancake in the icon's colour — by eye good and
    //    evil differed only by hue, and the playtest mother asked «а нажимать этот эффект, а
    //    этот?».
    //    Now there are two DIFFERENT languages (game feel: behaviour, not hue):
    //      GOOD — a warm golden glow in steps + a noticeable "take me" pulse (0.9 Hz, depth
    //             18%): the disc breathes and calls;
    //      EVIL — cold violet, even and dim, the halo CONTRACTS towards the disc (it does not
    //             call), plus a tremble of the icon itself (see below).
    this.aura.clear()
    if (this.phase === 'play' && this.surpKind && !this.feedback) {
      const sc = surpriseColor(this.surpKind)
      const good = isGoodSurprise(this.surpKind)
      if (good) {
        const call = 0.5 + 0.5 * Math.sin(this.t * 5.6) // "take me"
        for (const [k, a] of [[1.92, 0.05], [1.66, 0.08], [1.42, 0.12], [1.18, 0.15]] as [number, number][]) {
          this.aura.circle(0, 0, R * k * (1 + 0.06 * call))
            .fill({ color: sc, alpha: a * (0.7 + 0.5 * call) })
        }
      } else {
        // the evil aura: cold, tight, barely breathing — "do not come closer"
        const cold = 0.5 + 0.5 * Math.sin(this.t * 2.1)
        this.aura.circle(0, 0, R * 1.34).fill({ color: sc, alpha: 0.10 })
        this.aura.circle(0, 0, R * 1.16).fill({ color: sc, alpha: 0.13 })
        this.aura.circle(0, 0, R * (1.28 + 0.02 * cold))
          .stroke({ width: 2, color: sc, alpha: 0.35 + 0.15 * cold })
      }
    }

    // flame wings: they flare up with the streak, die out in the hush
    drawWings(this.wings, {
      R, t: this.t, intensity: this.intensity, hush: this.hush,
      pulsePhase: this.pulsePhase, accent,
      detail: quality.knobs.wings, // quality
    })

    // the disc glow: almost none at rest ("a minimum of glows"), it flares up with the storm
    // and on events
    const calmStorm = this.wake // the disc glow wakes up early
    this.diskGlow.clear()
    // It used to be one flat ring R*1.5 — on a dark background its edge read as a "brown
    // pancake" around the disc. Now a stepped falloff: the same peak brightness, but the halo
    // dissolves instead of breaking off
    const glowA = 0.06 + 0.12 * calmStorm + this.glow * 0.28
    for (const [k, w] of [[1.78, 0.18], [1.56, 0.24], [1.36, 0.28], [1.16, 0.30]] as [number, number][]) {
      this.diskGlow.circle(0, 0, R * k).fill({ color: accent, alpha: glowA * w })
    }

    // threads of energy between the lights: arcs ALONG the orbit (not a polyline through the centre!)
    this.threads.clear()
    if (this.phase === 'play' && this.streak >= 3 && !this.feedback) {
      const orbit = this.fireflies.filter((f) => f.state === 'orbit')
      if (orbit.length > 1) {
        // the threads fill up to the 25× milestone, not to a streak of 10 (the long scale)
        const it = Math.min(1, (this.streak - 2) / 22)
        const rad = R * 1.32
        const angs = orbit.map((f) => Math.atan2(f.y, f.x)).sort((a, b) => a - b)
        for (let i = 0; i < angs.length; i++) {
          const a0 = angs[i]
          const a1 = i + 1 < angs.length ? angs[i + 1] : angs[0] + TAU
          this.threads.arc(0, 0, rad, a0 + 0.12, a1 - 0.12)
          this.threads.stroke({ width: 1.5 + it * 2.5, color: accent, alpha: 0.18 + it * 0.45 })
        }
      }
    }

    // zigzag lightning (streak ≥5): a yellow crackling arc runs along the orbit of the
    // lights (layer "c" of the five-layer response, the Bejeweled canon)
    this.bolt.clear()
    if (this.boltT > 0) {
      const bk = this.boltT / 0.32 // 1 → 0
      const head = this.boltA0 + (1 - bk) * TAU * 1.2
      const tail = head - 1.7
      const rad = R * 1.32
      const segs = 16
      const flick = Math.floor(this.t * 42) // the zigzag trembles every frame or two
      const jag = (i: number) =>
        (Math.sin((i * 7.13 + this.boltSeed * 3.7 + flick * 1.31)) * 0.5
          + Math.sin(i * 13.7 + flick * 2.9) * 0.5) * R * 0.14
      // the arc is in the world's light — a wide halo in the accent, a white-hot core
      // (it used to be a hard yellow 0xffe94a — alien warmth in cold worlds)
      const boltGlow = accent
      const boltBody = lerpColor(accent, 0xffffff, 0.55)
      for (const [w, col, al] of [[6, boltGlow, 0.35], [3, boltBody, Math.min(1, bk * 1.8)], [1.4, 0xffffff, Math.min(1, bk * 1.8)]] as [number, number, number][]) {
        for (let i = 0; i <= segs; i++) {
          const a = tail + ((head - tail) * i) / segs
          const rr = rad + (i === 0 || i === segs ? 0 : jag(i))
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr
          if (i === 0) this.bolt.moveTo(x, y); else this.bolt.lineTo(x, y)
        }
        this.bolt.stroke({ width: w, color: col, alpha: al, join: 'round', cap: 'round' })
      }
    }

    // the "gem" disc shader: lives instead of the Graphics body (with a fallback without
    // WebGL); the shader threads: a river through the disc, the intensity from the flow,
    // broken off on a mistake
    const gemOn = this.hasGL && !!this.gemFilter
    this.gemSprite.visible = gemOn
    if (gemOn) {
      const u = (this.gemFilter!.resources as any).uGemU.uniforms
      u.uTime = this.t
      u.uPulse = this.pulse * pulseAmt
      u.uGlint = this.glintA
    }
    const flowOn = this.hasGL && !!this.flowFilter && this.phase === 'play'
    this.flowSprite.visible = flowOn && this.storm.streamPower > 0.15
    if (flowOn) {
      const u = (this.flowFilter!.resources as any).uFlowU.uniforms
      u.uTime = this.t
      u.uFlow = Math.min(1, this.storm.streamPower / 8)
      u.uHush = this.hush
      u.uMult = this.multiplier
    }

    // the glossy 2017 ball: a deep saturated fill, a SMALL bright highlight, a juicy neon
    // rim with an outer glow.
    // Outfits: "аврора" (8★) takes the glass towards violet, "изумруд" (45★) towards green.
    // The body of the fallback disc (without WebGL) uses the same glass tones of the world as
    // the Graphics gems of the menu. A fixed dark blue 0x0e123f used to be mixed in here, and
    // in any world the disc was a navy "hole"
    const gt = this.glassTones()
    // the rim colour lives by the state of the timer — his canon (in 2017 the ring was green)
    const timeLeft = this.phase === 'play' && !this.tutorialMove ? 1 - this.moveTime / this.moveDur : 1
    let rimCol = timeLeft > 0.35 ? accent : timeLeft > 0.15 ? 0xffb84a : 0xff5252
    // while a surprise is in the disc, the RIM is painted in its colour — gold "take it" /
    // violet "pass" reads even with peripheral vision, before the eye makes out the icon
    // itself. We mix rather than replace: the timer stays alive.
    if (this.phase === 'play' && this.surpKind && !this.feedback) {
      rimCol = lerpColor(rimCol, surpriseColor(this.surpKind), 0.6)
    }
    // the reaction colour goes to the ring: an event flash paints the rim
    const rf = Math.min(1, this.ringFlashT / 0.4)
    if (rf > 0) rimCol = lerpColor(rimCol, this.ringFlashCol, rf)
    this.diskLens.clear()
    if (!gemOn) {
      // the fallback without WebGL: the former Graphics ball (the 2017 gloss)
      this.diskLens.circle(0, 0, R).fill({ color: gt.wall, alpha: 0.98 })
      // glowing from inside: steps towards the centre (as in the shader — light gathers in the core)
      this.diskLens.circle(0, 0, R * 0.78).fill({ color: lerpColor(gt.wall, gt.core, 0.55), alpha: 0.6 })
      this.diskLens.circle(0, 0, R * 0.56).fill({ color: gt.core, alpha: 0.55 })
      this.diskLens.circle(0, 0, R * 0.34).fill({ color: lerpColor(gt.core, 0xffffff, 0.18), alpha: 0.4 })
      // the highlight — a glass crescent at the top left (a grey ellipse read as a dirty spot)
      this.glassCrescent(this.diskLens, 0, 0, R * 0.86, Math.max(2, R * 0.075), 0.26)
      // the specular — a ROUND spark dot, not an oval (an oval read as a "grey spot")
      this.diskLens.circle(-R * 0.30, -R * 0.56, R * 0.055).fill({ color: 0xffffff, alpha: 0.75 })
    }
    // the neon rim: an outer glow + a dense ring (it lives over the gem too —
    // the rim colour = the timer + reaction flashes, that is the language of the game)
    // the ring pecks on the beat too: the outer glow softly flares on a strong beat
    this.diskLens.circle(0, 0, R + 5 + beatEnv * 2)
      .stroke({ width: 11, color: rimCol, alpha: 0.12 + 0.12 * calmStorm + rf * 0.25 + beatEnv * 0.12 })
    this.diskLens.circle(0, 0, R).stroke({ width: 5, color: rimCol, alpha: 0.95 })

    // the timer ring (not there yet in the tutorial — time appears on the third move).
    // On countdown levels the ring turns the OPPOSITE way — it is felt with the body
    this.timerRing.clear()
    if (this.phase === 'play' && !this.feedback && !this.tutorialMove) {
      if (this.level.countdown) {
        this.timerRing.arc(0, 0, R + 14, -Math.PI / 2, -Math.PI / 2 - TAU * Math.max(0, timeLeft), true)
      } else {
        this.timerRing.arc(0, 0, R + 14, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, timeLeft))
      }
      // the ring is thinner and calmer at rest: it is a counter, not a light show
      this.timerRing.stroke({ width: 5 + 2 * calmStorm, color: rimCol, alpha: 0.72 + 0.28 * calmStorm, cap: 'round' })
      // on a full freeze the ring freezes over into ice
      if (this.freezeT > 0) {
        this.timerRing.circle(0, 0, R + 14).stroke({ width: 7, color: 0xbfeaff, alpha: Math.min(1, this.freezeT / 0.5) * 0.85 })
      }
    }

    // a surprise in the disc — a neon icon instead of the number (the .lvl canon)
    const showSurp = this.phase === 'play' && !!this.surpKind
    this.surpIcon.visible = showSurp
    if (showSurp) {
      drawSurpriseIcon(this.surpIcon, this.surpKind!, R, this.t)
      const pop = this.feedback === 'good' ? 1.15 : this.feedback === 'bad' ? 0.9 : 1
      const arrive = Math.min(1, this.moveAnim * 5)
      // the icon now has ITS OWN behaviour depending on the sign of the surprise — good
      // breathes broadly ("take me", ±9% at 0.9 Hz), evil TREMBLES finely (the sum of two
      // incommensurable sines ≈ a nervous tremor, ~1.5% of the radius).
      // Behaviour reads faster than colour — that is what the author asked for («мгновенно»).
      const good = isGoodSurprise(this.surpKind!)
      const breath = good ? 1 + 0.09 * Math.sin(this.t * 5.6) : 1 + 0.02 * Math.sin(this.t * 3)
      this.surpIcon.scale.set(arrive * pop * breath)
      if (good) {
        this.surpIcon.position.set(0, 0)
        this.surpIcon.rotation = 0
      } else {
        const j = R * 0.015
        this.surpIcon.position.set(
          Math.sin(this.t * 41) * j + Math.sin(this.t * 27.3) * j * 0.6,
          Math.cos(this.t * 37.7) * j + Math.sin(this.t * 23.1) * j * 0.6,
        )
        this.surpIcon.rotation = Math.sin(this.t * 31.7) * 0.018
      }
    } else if (this.surpIcon.rotation !== 0 || this.surpIcon.x !== 0) {
      this.surpIcon.position.set(0, 0); this.surpIcon.rotation = 0
    }

    // the number: ALWAYS white with a cold glow (the main character of the screen);
    // the warm flash is held ≤0.15s, the reaction colour is given to the ring
    const showNum = this.phase === 'play' && !this.surpKind
    this.numberText.visible = this.numberGlow.visible = showNum
    if (showNum) {
      const str = String(this.currentNumber)
      if (this.numberText.text !== str) { this.numberText.text = str; this.numberGlow.text = str }
      // auto-fit: 4-5 digits (endless mode) are squeezed into the disc instead of climbing over the rim
      this.fitNumber(str)
      const fb = this.feedback
      const tt = Math.min(1, this.moveAnim * 4)
      // at rest (not at the moment of a reaction) the number softly pecks on the strong beat
      const beatBump = fb ? 1 : 1 + (0.03 + 0.05 * this.intensity) * beatEnv
      const sc = (fb === 'good' ? 1.18 : fb === 'bad' ? 0.92 : 0.4 + 0.6 * backOut(tt)) * beatBump
      this.numberText.scale.set(sc); this.numberGlow.scale.set(sc * 1.04)
      // countdown: the number ARRIVES from above and falls into the disc with a bounce
      let yOff = 0
      if (this.level.countdown && !fb) {
        const ft = Math.min(1, this.moveAnim * 3.2)
        yOff = -(1 - backOut(ft)) * R * 2.3
      }
      // numFitDy — the optical correction "block centre → ink centre of the digits"
      this.numberText.position.set(0, yOff + this.numFitDy)
      this.numberGlow.position.set(0, yOff + this.numFitDy)
      this.numberText.style.fill = this.numberFlashT > 0
        ? (fb === 'bad' ? 0xffa0a0 : 0xffe9a0) : 0xffffff
      // in the storm the bloom inflates it anyway — we mute our own glow so the number does not drown
      this.numberGlow.alpha = 0.6 - this.intensity * 0.3
    }

    // tutorial + hints: immersion step by step, without a wall of text.
    // The text is white, only the key word is in colour
    this.hintBox.visible = false
    if (this.phase === 'play' && !this.feedback && !this.surpKind) {
      const correct = this.level.test(this.currentNumber)
      // ⚠ found on an endless-mode screenshot: the tutorial hints hung on `levelIdx === 0`,
      // but endless mode also sets levelIdx = 0 — and on the rule "divisible by 3" the player
      // was told «это нечётное — жми „мимо“». The advice was accidentally right, the words
      // were a lie. The tutorial lives only in the CAMPAIGN, on its first stage.
      const tut = this.mode === 'campaign' && this.levelIdx === 0
      if (tut && this.moveIdx <= 1) {
        // the text comes from the NUMBER itself, not from the move index — so it never drifts apart
        if (correct) this.setHint('это ', 'ЧЁТНОЕ', ' — тапни диск!', 0xffd54a)
        else this.setHint('это ', 'нечётное', ' — жми «мимо»!', 0x9adfff)
      } else if (tut && this.moveIdx === 2) {
        this.setHint('время пошло! ', correct ? 'жми!' : 'скипай!', '', correct ? 0xffd54a : 0x9adfff)
      } else if (this.moveIdx < this.level.hintMoves || this.hintBoost > 0) {
        this.setHint('', correct ? 'жми!' : 'скипай!', '', correct ? 0xffd54a : 0x9adfff)
      }
    }

    // the level condition — the main text of the screen: the key part in the world's accent
    // colour, on the first 2 moves of a NEW condition the line softly pulses (learning by body)
    this.condBox.visible = this.phase === 'play'
    if (this.phase === 'play') {
      if (this.condPre.text !== 'жми, когда ') this.condPre.text = 'жми, когда '
      if (this.condKey.text !== this.level.conditionText) this.condKey.text = this.level.conditionText
      this.condKey.style.fill = accent
      const w = this.condPre.width + this.condKey.width
      this.condPre.x = -w / 2
      this.condKey.x = -w / 2 + this.condPre.width
      // we squeeze a long condition to the screen width (narrow portrait) — we do not cut it,
      // but we do not shrink a short one either.
      // It used to be W*0.94 (on 360px the line «(кончается на 6 ИЛИ 8) И НЕ делится на 4»
      // stood right against both edges). We keep a 14px margin.
      const fit = Math.min(1, (this.W - 28) / Math.max(1, w))
      const fresh = this.condNew && this.moveIdx < 2
      if (fresh) {
        const pu = 0.5 + 0.5 * Math.sin(this.t * 4.2)
        this.condBox.scale.set(fit * (1 + 0.055 * pu))
        this.condBox.alpha = 0.92 + 0.08 * pu
      } else {
        this.condBox.scale.set(fit)
        // the condition is always readable, but at rest it does not press
        this.condBox.alpha = 0.72 + 0.23 * calmStorm
      }
    }

    // intro texts through the overlay
    this.overlayTitle.visible = this.overlaySub.visible = this.overlayScore.visible = false
    this.learnBox.visible = false
    if (this.phase === 'intro') {
      this.overlayTitle.visible = this.overlaySub.visible = true
      // the first level of a world greets with the world's caption (the names are sentences, see WORLD_NAMES)
      const w = this.level.worldIdx
      const isWorldFirst = worldFirstLevelIdx(w) === this.levelIdx
      if (this.mode === 'endless') {
        this.overlayTitle.text = 'Бесконечность'
        this.overlaySub.text = `Жми, когда ${this.level.conditionText}`
      } else if (this.mode === 'daily') {
        this.overlayTitle.text = `Число дня · ${dateLabelUTC(this.dailyDate())}`
        this.overlaySub.text = `Жми, когда ${this.level.conditionText}`
      } else if (isWorldFirst) {
        this.overlayTitle.text = w === 4 ? `Финал. «${WORLD_NAMES[4]}»` : `Мир ${w + 1}. «${WORLD_NAMES[w]}»`
        this.overlaySub.text = `Жми, когда ${this.level.conditionText}`
      } else {
        this.overlayTitle.text = this.levelTag()
        this.overlaySub.text = `Жми, когда ${this.level.conditionText}`
      }
      // the intro texts change every level — we fit them right here, otherwise a long
      // condition («делится на 2 И делится на 3») runs off the edges of the phone
      this.fitOverlayTexts()
      // ⚠ REVISION (found on a land 844×390 screenshot): the intro title stood rigidly at
      //    −R−90 from the DISC CENTRE. In portrait that is beautiful, but on a low landscape
      //    the disc centre itself sits at y≈164, and «Мир 4. „Разлом“» ran off the screen
      //    WITH ITS TOP HALF. Now the header is a stack with a floor: if there is no room
      //    above the disc, it sits down from the top edge (8px), and the subtitle follows,
      //    keeping the gap.
      const titleH = this.overlayTitle.height, subH = this.overlaySub.height
      let titleY = -R - 90
      let subY = -R - 48
      const titleFloor = 8 + titleH / 2 - this.cy   // above this — off the screen edge
      if (titleY < titleFloor) {
        titleY = titleFloor
        subY = Math.max(subY, titleY + titleH / 2 + subH / 2 + 4)
      }
      this.overlayTitle.position.set(0, titleY)
      this.overlaySub.position.set(0, subY)
      this.overlaySub.alpha = 0.9
      // the card must not climb onto the subtitle, wherever it has slid
      this.renderLearnCard(R, accent, subY + subH / 2 + 8)
      this.setHint('', 'тапни, чтобы начать', '', 0x9adfff)
      // …and «тапни, чтобы начать» must go under the card (landscape 780×360)
      this.hintBox.position.set(0, Math.max(R + 60, this.learnBottom + 22))
    } else {
      this.hintBox.position.set(0, R + 44)
    }
  }

  /**
   * THE EXPLANATION CARD in the level intro.
   * Two states: open (a panel over the disc: a title + a human text with examples + the
   * counter «1 из N») and collapsed (one invitation line under the condition, a tap on the
   * condition line opens it). The hit zone is a strip around the condition line, noticeably
   * taller than the line itself, so a finger can hit it.
   *
   * topFloor — the bottom edge of the condition line in overlay coordinates: on a low
   * landscape the header slides down (see the caller), and the card must slide with it
   * instead of lying on top of the subtitle.
   */
  private renderLearnCard(R: number, accent: number, topFloor: number) {
    this.learnHit = { x: 0, y: 0, w: 0, h: 0 }
    this.learnBottom = -1e9
    if (!this.learnCards.length) return
    this.learnBox.visible = true
    // the hit strip around the CONDITION LINE — we take its real place (it travels),
    // not the old constant −R−48, which lied on a low landscape
    this.learnHit = { x: this.cx, y: this.cy + this.overlaySub.y, w: this.W, h: 52 }

    if (this.learnAt < 0) {
      // collapsed: only the invitation under the condition
      this.learnBg.visible = this.learnTitle.visible = this.learnBody.visible = false
      this.learnFoot.visible = true
      this.learnFoot.text = 'не понял условие? тапни по нему — объясню'
      this.learnFoot.position.set(0, Math.max(-R - 30, topFloor))
      this.learnBox.position.set(0, 0)
      return
    }

    const total = this.learnManual ? this.learnCards.length : this.learnFresh
    const c = this.learnCards[Math.min(this.learnAt, this.learnCards.length - 1)]
    const w = Math.min(this.W - 28, 344)
    this.learnBg.visible = this.learnTitle.visible = this.learnBody.visible = true
    this.learnFoot.visible = true
    this.learnTitle.text = c.title
    this.learnTitle.style.fill = accent
    this.learnBody.style.wordWrapWidth = w - 36
    this.learnBody.text = c.body
    this.learnFoot.text = total > 1
      ? `${this.learnAt + 1} из ${total} · тапни — дальше`
      : 'тапни — понятно, играем'
    const pad = 16
    const hTitle = this.learnTitle.height, hBody = this.learnBody.height, hFoot = this.learnFoot.height
    const hh = pad + hTitle + 8 + hBody + 10 + hFoot + pad
    this.learnBg.clear()
    this.learnBg.roundRect(-w / 2, 0, w, hh, 20).fill({ color: 0x0b0d24, alpha: 0.95 })
    this.learnBg.roundRect(-w / 2, 0, w, hh, 20).stroke({ width: 1.5, color: accent, alpha: 0.55 })
    let y = pad
    this.learnTitle.position.set(0, y); y += hTitle + 8
    this.learnBody.position.set(0, y); y += hBody + 10
    this.learnFoot.position.set(0, y)
    // the panel sits at the disc centre, but does not climb onto the condition line above
    // it (nor under a header that has slid — topFloor), and below it does not go off the edge
    let boxY = Math.max(-hh / 2, -R - 18, topFloor)
    const bottomMax = this.H - this.cy - hh - 10
    if (bottomMax > topFloor) boxY = Math.min(boxY, bottomMax) // the bottom edge matters more, but not at the cost of the header
    this.learnBox.position.set(0, boxY)
    this.learnBottom = boxY + hh
  }

  /** did the tap land in the intro's condition line? (it calls the explanation card) */
  private hitLearnStrip(x: number, y: number): boolean {
    const h = this.learnHit
    return h.h > 0 && Math.abs(x - h.x) <= h.w / 2 && Math.abs(y - h.y) <= h.h / 2
  }

  /** a three-part hint: pre/post white, key in colour; the whole thing is centred */
  private setHint(pre: string, key: string, post: string, keyColor: number) {
    if (this.hintPre.text !== pre) this.hintPre.text = pre
    if (this.hintKey.text !== key) this.hintKey.text = key
    if (this.hintPost.text !== post) this.hintPost.text = post
    this.hintKey.style.fill = keyColor
    const w = this.hintPre.width + this.hintKey.width + this.hintPost.width
    let x = -w / 2
    this.hintPre.x = x; x += this.hintPre.width
    this.hintKey.x = x; x += this.hintKey.width
    this.hintPost.x = x
    // the hint is laid out as a ROW of three texts, so a font-size fit does not suit it
    // (measuring and repositioning three times) — we shrink the whole container. On 360px
    // «это ЧЁТНОЕ — тапни диск!» and «время пошло! скипай!» hit the edges; now a 12px margin
    // is left on each side.
    this.hintBox.scale.set(Math.min(1, (this.W - 24) / Math.max(1, w)))
    this.hintBox.visible = true
  }

  private renderPortal() {
    const t = this.portalT
    this.portalStreaks.clear()
    this.portalFxG.clear()
    const label = this.portalLayer.getChildByLabel('portalLabel') as Text
    if (this.portalKind === 'tunnel') { this.renderTunnel(t, label); return }

    label.visible = true
    this.portalBanner.visible = false
    if (this.portalKind === 'vortex') {
      const n = 150
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU + t * 1.5
        const base = ((i * 53) % 100) + t * (200 + (i % 7) * 120) * (1 + t)
        const d0 = base % (Math.max(this.W, this.H))
        const len = 30 + (i % 5) * 30
        const x1 = Math.cos(ang) * d0, y1 = Math.sin(ang) * d0
        const x2 = Math.cos(ang) * (d0 + len * (1 + t)), y2 = Math.sin(ang) * (d0 + len * (1 + t))
        const alpha = Math.min(1, d0 / 160) * 0.8
        this.portalStreaks.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 2.2, color: hsl(270), alpha })
      }
    }
    // the portal shader — only on WebGL; otherwise the funnel below keeps the look
    const filter = this.portalKind === 'vortex' ? this.portalFilter : null
    const showShader = this.hasGL && !!filter
    if (filter) {
      const u = (filter.resources as any).uPortal.uniforms
      u.uTime = this.t
      u.uProgress = Math.min(1, t / 2.4)
      if (showShader && this.portalSprite.filters?.[0] !== filter) this.portalSprite.filters = [filter]
    }
    this.portalSprite.visible = showShader

    // the procedural funnel core (for all renderers): it tightens towards the end
    const accent = hexNum(this.level.palette[2])
    const fr = this.R * (2.6 - Math.min(2.2, t * 0.9))
    this.portalFunnel.width = this.portalFunnel.height = fr * 2
    this.portalFunnel.tint = lerpColor(accent, 0xffffff, 0.5 + 0.3 * Math.sin(this.t * 6))
    // with the shader active the funnel is muted — otherwise it floods the arms/the hole
    this.portalFunnel.alpha = this.portalKind === 'dissolve' ? 0.25 : showShader ? 0.35 : 0.9
    label.position.set(0, -this.H * 0.34)
    label.alpha = 0.4 + 0.3 * Math.sin(this.t * 5)
    label.text = this.portalKind === 'dissolve' ? 'мир рассыпается…' : 'портал!'
  }

  /**
   * The tunnel portal in a full Bejeweled cycle (~4.1s):
   * A — the disc tilts in 3D and spirals away into a black hole at the "horizon";
   * B — an impact spark + a PURE white splice flash; C — a fullscreen hypertunnel
   * (a shader, the fallback is Graphics warp streaks); D — an "eclipse" disc + the new world
   * smoothly appearing; E — the disc flies in with a bounce + the «Мир N» banner.
   */
  private renderTunnel(t: number, label: Text) {
    label.visible = false
    this.portalFunnel.alpha = 0
    const destL = LEVELS[Math.min(this.levelIdx + 1, LEVELS.length - 1)]
    const accD = hexNum(destL.palette[2])
    const holeX = 0, holeY = -this.H * 0.24
    const g = this.portalFxG

    if (t < TUN_B) {
      // a black hole with a dim violet accretion ring appears at the horizon
      const ha = Math.min(1, t / (TUN_A * 0.6))
      g.circle(holeX, holeY, this.R * 0.52).fill({ color: 0x030308, alpha: 0.92 * ha })
      g.circle(holeX, holeY, this.R * 0.58).stroke({ width: 5, color: 0x7a3ab0, alpha: 0.75 * ha })
      g.arc(holeX, holeY, this.R * 0.75, this.t * 3.2, this.t * 3.2 + 2.2)
      g.stroke({ width: 3, color: accD, alpha: 0.5 * ha })
      g.arc(holeX, holeY, this.R * 0.9, -this.t * 2.1, -this.t * 2.1 + 1.6)
      g.stroke({ width: 2, color: 0xc060ff, alpha: 0.35 * ha })
    }

    if (t < TUN_A) {
      // phase A: the departure — a tilt "like a card", a spiral, shrinking
      this.diskLayer.visible = true
      const k = t / TUN_A
      const e = k * k
      const px = this.cx + holeX * e + Math.sin(e * Math.PI * 3) * this.R * 0.7 * (1 - e)
      const py = this.cy + holeY * e - Math.cos(e * Math.PI * 3) * this.R * 0.25 * e * (1 - e)
      this.diskLayer.position.set(px, py)
      const sc = 1 - 0.94 * e
      this.diskLayer.scale.set(sc, sc * (1 - 0.45 * k))
      this.diskLayer.rotation = e * 2.6
    } else if (t < TUN_D) {
      this.diskLayer.visible = false
    }

    if (t >= TUN_A && t < TUN_B) {
      // phase B: a white star impact spark at the hole's point → the screen goes pure white
      const bk = (t - TUN_A) / (TUN_B - TUN_A)
      const sk = 1 - bk
      const len = this.R * (0.6 + 1.2 * bk)
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + 0.3
        g.moveTo(holeX, holeY).lineTo(holeX + Math.cos(a) * len, holeY + Math.sin(a) * len)
      }
      g.stroke({ width: 4 * sk + 1, color: 0xffffff, alpha: 0.9 })
      g.circle(holeX, holeY, this.R * 0.3 * (1 + bk)).fill({ color: 0xffffff, alpha: 0.8 * sk + 0.2 })
      this.portalWhite = Math.min(1, bk * 1.6)
    } else if (t >= TUN_B && t < TUN_B + 0.3) {
      // the splice: the white frame melts, the tunnel is born out of it
      this.portalWhite = Math.max(this.portalWhite, 1 - (t - TUN_B) / 0.3)
    }

    // phase C: a fullscreen hypertunnel (the colour drift is in the shader)
    const inC = t >= TUN_B && t < TUN_C
    const showShader = inC && this.hasGL && !!this.tunnelFilter
    if (inC && this.tunnelFilter) {
      const u = (this.tunnelFilter.resources as any).uTunnel.uniforms
      u.uTime = this.t
      u.uProgress = Math.min(1, (t - TUN_B) / (TUN_C - TUN_B))
      if (showShader && this.portalSprite.filters?.[0] !== this.tunnelFilter) {
        this.portalSprite.filters = [this.tunnelFilter]
      }
    }
    this.portalSprite.visible = showShader
    if (inC) {
      // the fallback warp streaks (in headless it is exactly they that show the flight);
      // with a live shader — a light motion-blur addition on top.
      // They used to be rainbow (700°/s around the circle — eye-searing). Now a ±30° corridor
      // around the hue of the world we are flying to, and the saturation is down
      const ct = (t - TUN_B) / (TUN_C - TUN_B)
      const hue0 = hueOf(accD)
      const n = 150
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU
        const base = ((i * 53) % 100) + ct * (500 + (i % 7) * 260) * (1 + ct)
        const d0 = base % Math.max(this.W, this.H)
        const len = (40 + (i % 5) * 40) * (1 + ct * 2)
        const alpha = Math.min(1, d0 / 160) * (showShader ? 0.22 : 0.8)
        this.portalStreaks.moveTo(Math.cos(ang) * d0, Math.sin(ang) * d0)
          .lineTo(Math.cos(ang) * (d0 + len), Math.sin(ang) * (d0 + len))
          .stroke({ width: 2.2, alpha, color: hsl(hue0 + 30 * Math.sin(ct * 3.1 + i * 0.35), 0.72, 0.74) })
      }
    }

    if (t >= TUN_C && t < TUN_D) {
      // phase D: the "eclipse" disc (a white ring, a dark core, a coloured halo) melts, and
      // behind it the NEW world calmly appears (the palette was changed by update)
      const dk = (t - TUN_C) / (TUN_D - TUN_C)
      const er = this.R * (0.5 + dk * 2.4)
      const fade = 1 - dk * dk
      g.circle(0, 0, er * 1.8).fill({ color: accD, alpha: 0.22 * fade })
      g.circle(0, 0, er * 1.35).fill({ color: 0xc060ff, alpha: 0.10 * fade })
      g.circle(0, 0, er).stroke({ width: 16 * (1 - dk * 0.4), color: 0xffffff, alpha: 0.95 * fade })
      g.circle(0, 0, er * 0.82).fill({ color: 0x05060d, alpha: 0.9 * fade })
    }

    if (t >= TUN_D) {
      // phase E: the disc flies in from the side with a bounce (backOut) and settles in place
      this.diskLayer.visible = true
      const ek = Math.min(1, (t - TUN_D) / (TUN_E - TUN_D))
      const be = backOut(ek)
      const px = this.cx + (1 - be) * this.W * 0.55
      const py = this.cy - (1 - be) * this.H * 0.10
      this.diskLayer.position.set(px, py)
      const sc = 0.35 + 0.65 * be
      this.diskLayer.scale.set(sc, sc * (0.72 + 0.28 * be))
      this.diskLayer.rotation = (1 - be) * -0.5
      // the «Мир N» banner — with a spring a bit after the fly-in, holds to the end of the transition
      const bt = (t - TUN_D - 0.28) / 0.4
      this.portalBanner.visible = bt > 0
      if (bt > 0) {
        const bk = Math.min(1, bt)
        const bb = backOut(bk)
        this.portalBanner.alpha = Math.min(1, bk * 2)
        this.portalBanner.scale.set(0.6 + 0.4 * bb)
        this.portalBanner.position.set(0, -this.R * 1.7)
      }
    }
  }

  private renderSplash(dt: number) {
    const pl = 1 + 0.04 * Math.sin(this.t * 2.4)
    this.splashPlay.scale.set(pl)
    // THE MENU is a shop window, the beauty is at maximum right away.
    // The wings breathe around Play: intensity = 1, hush = 0 (in battle the same wings grow
    // with the streak — there we change nothing). To roll back, remove this block entirely
    // (up to the «сообщение врат…» line) — the splash returns to its previous look.
    const wR = this.splashR || this.R
    // the tip of a wing goes ~2.3R from the centre: in a 360px portrait that is off the
    // screen edge, and the feather was cut off by a straight line. We shrink the LAYER (in
    // landscape the multiplier = 1 — everything fits there and nothing changes).
    const wFit = Math.min(1, (this.cx - 8) / (wR * 2.32))
    this.splashWings.position.set(this.cx, this.cy)
    this.splashWings.scale.set(pl * wFit)
    drawWings(this.splashWings, {
      R: wR, t: this.t, intensity: 1, hush: 0,
      pulsePhase: this.pulsePhase, accent: hexNum(this.level.palette[2]),
      detail: quality.knobs.wings, // quality
    })
    // the gate message matters more than the «продолжить» button — they share one slot.
    // An unfinished run is also a reason to show «продолжить», even if the player is still on
    // the first level (savedLevel = 0): he already has a score
    const contVisible = (this.savedLevel >= 1 || !!this.resumeSnap) && !this.splashGateMsg
    this.splashContinue.visible = contVisible
    // a tight screen: if the lines came closer than 26px — we show ONE of them
    // («продолжить» matters more: it is the way back into the game, while the hint about
    // tapping is duplicated by the Play button itself). Otherwise they overlapped
    this.splashSub.visible = !((contVisible || !!this.splashGateMsg) && this.splashRowGap < 26)
    // for an interrupted run the line also carries the SCORE — so the player sees that the
    // points have not gone anywhere, before he even presses
    const snap = this.resumeSnap
    if (snap) this.splashContinue.text = `продолжить: ${this.levelTag(snap.levelIdx)} · счёт ${snap.score}`
    else if (this.savedLevel >= 1) this.splashContinue.text = `продолжить: ${this.levelTag(this.savedLevel)}`

    // «Привет, {имя}! Удачной игры!» — his splash canon.
    // On a low landscape the line does not fit between the title and the ball — there we hide
    // it (see splashGreetFits in updateMetrics)
    const greet = this.playerName ? `Привет, ${this.playerName}! Удачной игры!` : ''
    if (this.splashGreet.text !== greet) this.splashGreet.text = greet
    this.splashGreet.visible = this.splashGreetFits && !!greet

    // the star piggy bank in the corner
    const showStars = this.totalCache > 0
    this.splashStarsG.visible = this.splashStarsText.visible = showStars
    if (showStars) {
      this.splashStarsG.clear()
      this.drawStar(this.splashStarsG, 0, 0, 11, 0xffd54a)
      const st = String(this.totalCache)
      if (this.splashStarsText.text !== st) this.splashStarsText.text = st
    }

    // satellites: they live on the orbit around Play and sway a little;
    // hover/tap — a response in scale (a spring) + a sound on a tap
    const orbitR = this.satOrbitR
    // ⚠ the ∞ satellite lives at the angle π, and «звук» stood at 0.88π — the arc between
    // them was ~0.12π, i.e. less than the diameter of a circle, and on 390×844 they were DRAWN
    // ON TOP OF EACH OTHER. We lay the FOUR of them out evenly and symmetrically about the
    // bottom (0.5π): ∞ 0.94π · sound 0.70π · info 0.30π · records 0.06π — a step of 0.24π.
    // Bonus: there is nobody at 0.5π any more, and the hint under the ball can breathe.
    const baseAngs = [Math.PI * 0.70, Math.PI * 0.30, Math.PI * 0.06]
    this.sats.forEach((s, i) => {
      const ang = baseAngs[i] + Math.sin(this.t * 0.5 + i * 2.1) * 0.045
      s.x = this.cx + Math.cos(ang) * orbitR
      s.y = this.cy + Math.sin(ang) * orbitR
      const hov = Math.hypot(this.mouse.x - s.x, this.mouse.y - s.y) < s.r + 8
      const target = hov ? 1.14 : 1
      s.scale += (target - s.scale) * Math.min(1, dt * 10)
      s.c.position.set(s.x, s.y)
      s.c.scale.set(s.scale * (1 + 0.02 * Math.sin(this.t * 2 + i * 1.7)))
    })
    this.skinBtn.visible = this.skinsUI && hasMilestone(8)
    if (this.splashWorldSel >= 0) this.splashWorldSelT += dt
    this.renderWorldsRow()
    // the gate message (after being blocked by the portal) — it softly pulses
    this.splashGateText.visible = !!this.splashGateMsg
    if (this.splashGateMsg) {
      if (this.splashGateText.text !== this.splashGateMsg) this.splashGateText.text = this.splashGateMsg
      this.splashGateText.alpha = 0.8 + 0.2 * Math.sin(this.t * 3)
    }
    this.renderEndlessSat(dt)
    this.renderDailyLine()
    // all the splash lines are kept within the screen bounds. The key is by text, so that we
    // do not measure the same thing every frame (the texts here change rarely)
    const fitKey = `${this.W}|${this.splashGreet.text}|${this.splashGateText.text}|${this.splashContinue.text}|${this.dailyText.text}`
    if (fitKey !== this.splashFitKey) { this.splashFitKey = fitKey; this.fitSplashTexts() }
  }
  private splashFitKey = ''

  /** the ∞ satellite — a fourth circle on the orbit to the left of Play (the symbol is drawn with curves) */
  private renderEndlessSat(dt: number) {
    const orbitR = this.satOrbitR
    // 0.94π — the leftmost of the four (a step of 0.24π, see baseAngs above)
    const ang = Math.PI * 0.94 + Math.sin(this.t * 0.5 + 3.3) * 0.045
    const x = this.cx + Math.cos(ang) * orbitR
    const y = this.cy + Math.sin(ang) * orbitR
    const sr = Math.max(24, this.splashR * 0.21)
    this.endlessHit = { x, y, r: sr }
    const open = this.endlessUnlocked()
    const hov = Math.hypot(this.mouse.x - x, this.mouse.y - y) < sr + 8
    this.endlessSat.position.set(x, y)
    this.endlessSat.scale.set((hov ? 1.12 : 1) * (1 + 0.02 * Math.sin(this.t * 2 + 4)))
    const g = this.endlessSatG
    g.clear()
    const { wall, core, accent } = this.glassTones()
    // glass in the spirit of the other satellites (a locked one is the same glass, but extinguished)
    for (const [k, al] of [[1.6, 0.035], [1.42, 0.045], [1.22, 0.055]] as [number, number][]) {
      g.circle(0, 0, sr * k).fill({ color: open ? accent : 0x2a2f44, alpha: al })
    }
    g.circle(0, 0, sr).fill({ color: open ? wall : 0x0c0e1e, alpha: 0.95 })
    if (open) g.circle(0, 0, sr * 0.6).fill({ color: core, alpha: 0.5 })
    this.glassCrescent(g, 0, 0, sr * 0.84, Math.max(1.5, sr * 0.09), open ? 0.26 : 0.10)
    g.circle(0, 0, sr).stroke({ width: 3, color: open ? accent : 0x3c4258, alpha: open ? 0.9 : 0.8 })
    // the ∞ symbol — two lemniscate loops, drawn with curves (NOT a text glyph)
    const col = open ? 0xffffff : 0x6b7290
    const a = sr * 0.62
    const N = 40
    let first = true
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * TAU
      const den = 1 + Math.sin(th) * Math.sin(th)
      const px = (a * Math.cos(th)) / den
      const py = (a * Math.sin(th) * Math.cos(th)) / den
      if (first) { g.moveTo(px, py); first = false } else g.lineTo(px, py)
    }
    g.stroke({ width: Math.max(2.5, sr * 0.11), color: col, alpha: open ? 1 : 0.85, cap: 'round', join: 'round' })
    if (!open) {
      // locked: the «пройди мир 1» caption is shown as a gate message on a tap;
      // here — just dimness
      g.circle(0, sr * 0.02, sr * 0.9).stroke({ width: 1.5, color: 0x555a70, alpha: 0.5 })
    } else {
      // unlocked: a soft pulsing rim — it "calls you to play"
      g.circle(0, 0, sr + 4 + Math.sin(this.t * 2.5)).stroke({ width: 1.5, color: accent, alpha: 0.45 })
    }
  }

  /** the «число дня: {дата}» line under the gates: an invitation or "already played" */
  private renderDailyLine() {
    const seed = dateSeedUTC(this.dailyDate())
    const done = this.readDailyDone(seed)
    const label = done >= 0
      ? `число дня ${dateLabelUTC(this.dailyDate())} сыграно · счёт ${done}`
      : `число дня: ${dateLabelUTC(this.dailyDate())} — тапни, вызов дня`
    if (this.dailyText.text !== label) this.dailyText.text = label
    this.dailyText.style.fill = done >= 0 ? '#8890a8' : '#9adfff'
    this.dailyText.alpha = 0.7 + 0.15 * Math.sin(this.t * 2.2)
    // ⚠ A BUG FOUND ON A 390×844 RUN.
    // The zone was a CIRCLE of radius max(120, width/2+16). The line is wide (316px on a
    // phone) — so the circle came out with a radius of 174px and covered half the screen up
    // and down: the row of worlds and — most importantly — the «продолжить» line (it stands
    // 86px higher). And in press() the «число дня» is handled BEFORE «продолжить», so a tap
    // on «продолжить» on a phone started the NUMBER OF THE DAY: the player pressed "back into
    // my run" and landed in someone else's level with a zero score.
    // Exactly what the author complained about («предлагает первый уровень»).
    // The line is single and flat — and the zone is flat now too: a rectangle along the line
    // with a margin up to 44px in height (a finger), no more.
    this.dailyHit = {
      x: this.cx, y: this.dailyText.y,
      w: Math.max(200, this.dailyText.width + 32),
      h: Math.max(44, this.dailyText.height + 12),
    }
  }

  /**
   * The row of world gates under Play: glass circles in the world's palette.
   * Unlocked — coloured, with the world number; locked — dark, with the «N ★» threshold inside
   */
  private renderWorldsRow() {
    const g = this.worldsG
    g.clear()
    const curWorld = LEVELS[Math.max(0, Math.min(this.savedLevel, LEVELS.length - 1))].worldIdx
    // the selected circle grows with a spring (backOut ~0.22s) — "you are sort of choosing"
    const selGrow = 1 + 0.34 * backOut(clamp01(this.splashWorldSelT / 0.22))
    for (let w = 0; w < WORLD_COUNT; w++) {
      const { x, y } = this.worldHits[w]
      const sel = w === this.splashWorldSel
      const r = this.worldHits[w].r * (sel ? selGrow : 1)
      const open = this.totalCache >= worldGateStars(w)
      const pal = worldPalette(w)
      // the disc outfit does not affect the gate circles: this is a preview of ANOTHER world
      const { wall, core, accent } = this.glassTones(pal, false)
      const label = this.worldLabels[w]
      if (open) {
        // glass in the colour of ITS OWN world: a gate circle = a preview of the world's palette
        for (const [k, al] of [[1.55, 0.04], [1.38, 0.05], [1.2, 0.06]] as [number, number][]) {
          g.circle(x, y, r * k).fill({ color: accent, alpha: al })
        }
        g.circle(x, y, r).fill({ color: wall, alpha: 0.96 })
        g.circle(x, y, r * 0.6).fill({ color: core, alpha: 0.5 })
        this.glassCrescent(g, x, y, r * 0.84, Math.max(1.4, r * 0.09), 0.24)
        g.circle(x, y, r).stroke({ width: 2.5, color: accent, alpha: 0.9 })
        // a pulsing ring on the world where the progress currently is
        if (this.savedLevel >= 0 && w === curWorld) {
          g.circle(x, y, r + 5 + Math.sin(this.t * 2.5)).stroke({ width: 1.5, color: accent, alpha: 0.5 })
        }
        const s = String(w + 1)
        if (label.text !== s) label.text = s
        label.style.fill = 0xffffff
        label.position.set(x, y)
        label.alpha = 1
      } else {
        // locked: dark glass with the star threshold inside (the star is Graphics, no emoji)
        g.circle(x, y, r).fill({ color: 0x0c0e1e, alpha: 0.92 })
        g.circle(x, y, r).stroke({ width: 2, color: 0x3c4258, alpha: 0.9 })
        const s = String(worldGateStars(w))
        if (label.text !== s) label.text = s
        label.style.fill = 0x8890a8
        label.position.set(x - 6, y)
        label.alpha = 0.9
        this.drawStar(g, x + 9, y, 6.5, 0x555a70)
      }
      // SELECTED: a bright ring halo — visible even under a finger, and the world's number
      // grows together with the circle
      if (sel) {
        const halo = open ? accent : 0x9adfff
        g.circle(x, y, r + 6).stroke({ width: 2.5, color: halo, alpha: 0.85 })
        g.circle(x, y, r + 11 + Math.sin(this.t * 4) * 1.6)
          .stroke({ width: 1.5, color: halo, alpha: 0.4 })
        label.scale.set(selGrow)
      } else if (label.scale.x !== 1) label.scale.set(1)
    }
  }

  /** the level results screen: stars with a bounce → the score count-up → «лучший!» → milestone toasts */
  private renderResults() {
    const t = this.resultsT, R = this.R

    // the scene backdrop: it floats in over ~0.5s, the world dims — the gold of the stars,
    // the soft wings and the score lines stop drowning in a bright frame
    this.resultsVeil.alpha = 0.46 * clamp01(t / 0.5)

    // the title drives in from above
    const tu = clamp01(t / 0.35)
    this.resultsTitle.alpha = tu
    this.resultsTitle.position.set(0, -R * 2.45 - (1 - backOut(tu)) * 26)

    // three outline slots + the earned stars fly in with a bounce 1-2-3
    const g = this.resultsStarsG
    g.clear()
    // the stars land ABOVE the disc (they used to lie right on it)
    const sy = -R * 1.62, gap = R * 0.80, ss = R * 0.26
    for (let i = 0; i < 3; i++) {
      this.starPath(g, (i - 1) * gap, sy, ss)
      g.stroke({ width: 2.5, color: 0x555a70, alpha: 0.55 })
    }
    for (let i = 0; i < this.starsEarned; i++) {
      const u = clamp01((t - this.starsAt(i)) / 0.45)
      if (u <= 0) continue
      const k = backOut(u)
      const scale = 2.0 - 1.0 * k // from afar → landed → sprung back
      const x = (i - 1) * gap, a = Math.min(1, u * 2.5)
      g.circle(x, sy, ss * 1.7 * scale).fill({ color: 0xffd54a, alpha: 0.10 * a })
      g.circle(x, sy, ss * 1.35 * scale).fill({ color: 0xffd54a, alpha: 0.16 * a })
      this.starPath(g, x, sy, ss * scale)
      g.fill({ color: 0xffd54a, alpha: a })
      this.starPath(g, x, sy - ss * 0.08 * scale, ss * 0.45 * scale)
      g.fill({ color: 0xfff6d8, alpha: 0.75 * a })
    }

    // THE BOTTOM OF THE RESULTS — a stack FROM THE BOTTOM UP.
    // It used to be: every line stood at its own «R·N», and «всего звёзд» at H/2−96; the
    // milestone toasts (0-3 of them, arriving dynamically) lay on «всего звёзд» and were cut
    // off by the phone's bottom edge.
    // Now: the anchor is the bottom of the safe zone, the stack grows upwards and knows about
    // the toasts.
    const nT = this.resultsToastTexts.length
    const toastStep = 62, toastHalf = 28
    let stackY = this.resultsBottom
    let toastsY = 0
    if (nT) {
      toastsY = stackY - toastHalf - (nT - 1) * toastStep
      stackY = toastsY - toastHalf - 10
    }
    // on a low screen (a phone in landscape) the toasts are guests over the whole bottom: by
    // the time they arrive the score lines have been read, and there is nowhere for them to overlap
    const yieldToToasts = this.shortH && nT > 0
    const totY = stackY - 8
    const bestY = totY - 22
    const scoreY = bestY - 30
    const lblY = scoreY - 32

    // the score count-up with ticks
    const c0 = this.starsAt(this.starsEarned - 1) + COUNT_LAG
    const cDur = COUNT_DUR
    const cu = clamp01((t - c0) / cDur)
    const toastFade = yieldToToasts ? 1 - clamp01((t - (this.resultsEndT - 0.45)) / 0.35) : 1
    this.resultsScoreLbl.position.set(0, lblY)
    this.resultsScoreText.position.set(0, scoreY)
    this.resultsScoreLbl.alpha = 0.9 * clamp01((t - c0 + 0.2) / 0.3) * toastFade
    this.resultsScoreText.alpha = clamp01((t - c0 + 0.1) / 0.3) * toastFade
    const val = Math.round(this.resultsLevelScore * cu)
    const vs = String(val)
    if (this.resultsScoreText.text !== vs) this.resultsScoreText.text = vs
    // a pop at the end of the count-up
    const donePop = t > c0 + cDur ? Math.max(0, 1 - (t - c0 - cDur) / 0.25) : 0
    this.resultsScoreText.scale.set(1 + 0.22 * donePop)

    // «лучший результат уровня» — a THIN line (the author's correction: it used to be a bold
    // half-screen poster and it argued with the stars)
    const bestAt = c0 + cDur + 0.12
    const showBest = this.resultsNewBest && t >= bestAt
    this.resultsBestText.visible = showBest
    if (showBest) {
      const bu = clamp01((t - bestAt) / 0.3)
      this.resultsBestText.alpha = 0.85 * bu * toastFade
      this.resultsBestText.scale.set(1)
      this.resultsBestText.position.set(0, bestY - (1 - backOut(bu)) * 8)
    }

    // the piggy bank: total stars — the top line of the bottom stack
    const totShow = clamp01((t - c0) / 0.4)
    this.resultsTotalG.alpha = this.resultsTotalText.alpha = 0.9 * totShow * toastFade
    const totStr = `всего звёзд: ${this.totalCache}`
    if (this.resultsTotalText.text !== totStr) this.resultsTotalText.text = totStr
    const rowW = 30 + this.resultsTotalText.width
    this.resultsTotalG.clear()
    this.drawStar(this.resultsTotalG, -rowW / 2 + 10, totY, 11, 0xffd54a)
    this.resultsTotalText.position.set(-rowW / 2 + 30, totY)

    // milestone toasts: they float up with a spring, the stack is pressed to the bottom of the safe zone
    const toastAt = this.resultsEndT - 0.45
    const tShow = nT ? clamp01((t - toastAt) / 0.35) : 0
    this.resultsToasts.visible = tShow > 0
    if (tShow > 0) {
      this.resultsToasts.alpha = tShow
      const kk = backOut(tShow)
      this.resultsToasts.position.set(0, toastsY + (1 - kk) * 30)
      this.resultsToasts.scale.set(0.85 + 0.15 * kk)
    }

    // the hint at the bottom — very quiet. In the campaign the scene leaves by itself, so it
    // says not «тапни» but an honest «летим дальше…»
    const done = t >= this.resultsEndT
    // the milestone toasts occupy the same bottom — while they are on screen the hint stays silent
    this.resultsHint.visible = !this.resultsToasts.visible
    const hint = done ? this.resultsFinalHint : 'тап — быстрее'
    if (this.resultsHint.text !== hint) this.resultsHint.text = hint
    // 0.18 is "barely readable" even on a dark background; quiet, but visible
    this.resultsHint.alpha = done ? 0.50 + 0.20 * Math.sin(this.t * 4) : 0.42
  }

  /**
   * THE OSCILLOSCOPE (Andrey: «может там где осциллограммы показывать»).
   * A circular wave around the disc: radius = base + sample·amplitude. The data comes from
   * the analyser on the master in sound.ts, so the line hears BOTH music engines and all the
   * SFX equally: a tap makes the wave twitch by itself.
   * Delicacy: its own radius (R·1.70 — outside the timer ring R+14 and the orbit of the
   * lights R·1.32), at rest it barely trembles, in the storm it dances. The number is untouched.
   */
  private renderOsc() {
    const g = this.oscG
    g.clear()
    const on = this.phase === 'play' || this.phase === 'intro' || this.phase === 'results'
    if (!on) return
    const buf = this.sound.waveform()
    // the ring comes alive on the first answers (wake), while the SWING grows further along
    // the long storm curve — at combo 100 it dances at full width
    const storm = Math.max(this.wake * 0.35, clamp01(this.intensity))
    const baseR = this.R * 1.70
    // at rest — an almost even ring, in the storm it dances; a tap adds the glow's move
    const amp = this.R * (0.045 + 0.24 * storm) * (1 + this.glow * 0.55)
    const alpha = (this.phase === 'results' ? 0.20 : 0.13 + 0.32 * storm)
    if (alpha < 0.02) return
    const accent = hexNum(this.level.palette[2])
    // exactly as many points as are visible: at rest the wave is almost flat — no need to
    // push 96 segments; in the storm the detail is needed
    const N = storm > 0.35 ? 96 : 64
    const half = N / 2
    const SAMP = buf ? Math.min(buf.length, 512) : 0
    // AGC like a real oscilloscope: the scale is led by a slowly decaying peak envelope with
    // a floor. Without it the wave is unreadable — the master is quiet (measured: the master
    // peak is ~0.03 at MASTER_VOL 0.5), and the ring looked like an even circle.
    // The "rest/storm" contrast is carried not by the gain but by the radius AMPLITUDE (amp).
    let gain = 1
    if (buf) {
      let peak = 0
      for (let i = 0; i < SAMP; i += 4) { const v = Math.abs(buf[i]); if (v > peak) peak = v }
      this.oscEnv = Math.max(peak, this.oscEnv * 0.97)
      gain = 0.8 / Math.max(0.03, this.oscEnv)
    }
    // MIRRORED sweep: the second half of the circle repeats the first one backwards.
    // That way the seam at 0° is invisible (start === end) and the amplitude is not damped by a window.
    const val = (i: number): number => {
      const j = i <= half ? i : N - i
      const u = j / half
      if (buf) return Math.max(-1.7, Math.min(1.7, buf[Math.round(u * (SAMP - 1))] * gain))
      // the audio is not open yet (no gesture) or muted — we draw a calm ripple, so that the
      // ring does not look like a dead circle
      return 0.22 * Math.sin(u * TAU * 2.5 + this.uiT * 1.7)
        + 0.13 * Math.sin(u * TAU * 4 - this.uiT * 2.3)
    }
    const pts: number[] = []
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU - Math.PI / 2
      const rr = baseR + val(i) * amp
      pts.push(Math.cos(a) * rr, Math.sin(a) * rr)
    }
    // two passes: a soft glow underlay and a thin hot line.
    // At rest we do not draw the underlay at all — one thread is more than enough there
    const passes: [number, number, number][] = storm > 0.2
      ? [[3.5, accent, alpha * 0.45], [1.2, lerpColor(accent, 0xffffff, 0.6), alpha]]
      : [[1.2, lerpColor(accent, 0xffffff, 0.6), alpha]]
    for (const [w, col, al] of passes) {
      g.moveTo(pts[0], pts[1])
      for (let i = 1; i <= N; i++) g.lineTo(pts[i * 2], pts[i * 2 + 1])
      g.stroke({ width: w, color: col, alpha: al, cap: 'round', join: 'round' })
    }
  }

  /** a linear oscillogram in the pause menu — a small pretty detail */
  private renderPauseOsc() {
    const g = this.pauseOscG
    const b = this.pausePanelBox
    g.clear()
    const buf = this.sound.waveform()
    const accent = hexNum(this.level.palette[2])
    // ⚠ the oscillogram's y used to be a rigid b.y + 66 — exactly where the rule block now
    // stands, and the wave crossed out the text. Now it honestly lives UNDER the rule block,
    // in its own strip (see pauseRuleH).
    const x0 = b.x + 30, w = b.w - 60, yc = b.y + 54 + this.pauseRuleH + 17, h = 13
    const N = 64
    const SAMP = buf ? Math.min(buf.length, 512) : 0
    const gain = 0.8 / Math.max(0.03, this.oscEnv) // the same AGC as for the circular one
    g.moveTo(x0, yc)
    for (let i = 0; i <= N; i++) {
      const u = i / N
      const v = buf
        ? Math.max(-1.6, Math.min(1.6, buf[Math.round(u * (SAMP - 1))] * gain))
        : 0.30 * Math.sin(u * TAU * 3 + this.uiT * 2.1) * Math.sin(u * Math.PI)
      g.lineTo(x0 + u * w, yc + v * h)
    }
    g.stroke({ width: 1.4, color: lerpColor(accent, 0xffffff, 0.5), alpha: 0.6, cap: 'round' })
  }

  /** drawing the pause menu: the panel, the rows, the focus (redrawn per frame — it is cheap) */
  private drawPauseMenu() {
    const b = this.pausePanelBox
    const accent = hexNum(this.level.palette[2])
    const g = this.pausePanel
    g.clear()
    g.roundRect(b.x, b.y, b.w, b.h, 26).fill({ color: 0x0b0d24, alpha: 0.95 })
      .stroke({ width: 2, color: accent, alpha: 0.5 })
    this.drawPauseRule(accent)
    this.pauseItems.forEach((it, i) => {
      const label = it.kind === 'resume' ? 'продолжить'
        : it.kind === 'restart' ? 'заново уровень'
          : it.kind === 'menu' ? 'в меню'
            : it.kind === 'encyclopedia' ? 'энциклопедия правил'
              : it.kind === 'quality' ? quality.label() // quality: auto/beautiful/fast
                : it.kind === 'audio' ? quality.audioLabel() // rich/economical
                  : '' // 'sound' — a row with two volume icons, it has its own labels
      if (it.txt.text !== label) {
        it.txt.text = label
        // quality: the label «качество: авто (красиво)» is the longest line of the menu, and
        // on a narrow screen (320-360 px) it would stick out of the rounded row.
        // We fit it ONLY when the text changes: drawPauseMenu spins every frame.
        this.fitTextToWidth(it.txt, 19, b.w - 76)
      }
      const foc = i === this.pauseFocus
      const rx = b.x + 16, ry = it.y - it.h / 2 + 3, rw = b.w - 32, rh = it.h - 6
      g.roundRect(rx, ry, rw, rh, 15).fill({ color: foc ? accent : 0xffffff, alpha: foc ? 0.15 : 0.045 })
      if (foc) g.roundRect(rx, ry, rw, rh, 15).stroke({ width: 1.5, color: accent, alpha: 0.75 })
      it.txt.style.fill = foc ? 0xffffff : 0xcdd6f0
      it.txt.alpha = foc ? 1 : 0.78
      // the «звук» row — TWO separate volume steps, music and sound effects
      if (it.kind === 'sound') this.drawVolumeRow(g, rx, rw, it.y, accent)
    })
    if (this.pauseOscOn) this.renderPauseOsc()
    else this.pauseOscG.clear()
  }

  /**
   * SEPARATE VOLUME WITH ICONS.
   *
   * On the left — a NOTE (music), on the right — a SPEAKER (sound effects), each with three
   * step bars: 0 / 50 / 100 %. A tap on an icon cycles the step, the value lives in
   * localStorage (see setMusicVolume/setSfxVolume in sound.ts). Zero is drawn as a crossed
   * out icon — "off" must read even if the bars cannot be made out.
   *
   * Everything is Graphics: emoji glyphs are forbidden in the game (in headless they give
   * tofu). The global mute (the M key, the menu button) stays a separate knob one level lower
   * in the audio graph — these steps do not touch it and do not get in its way.
   */
  private drawVolumeRow(g: Graphics, rx: number, rw: number, y: number, accent: number) {
    const gx1 = rx + rw * 0.26   // the centre of the «музыка» group
    const gx2 = rx + rw * 0.74   // the centre of the «звуки» group
    const groups: [number, number, boolean][] = [
      [gx1, this.sound.musicVolumeStep, true],
      [gx2, this.sound.sfxVolumeStep, false],
    ]
    for (const [gx, vol, isMusic] of groups) {
      const ix = gx - 36
      const on = vol > 0
      const col = on ? 0xffffff : 0x8890a8
      const al = on ? 0.95 : 0.45
      if (isMusic) {
        // THE NOTE: an oval head, a stem and a flag (bigger than in the first edition —
        // on a 390px screenshot it read as a "stick")
        // on a 390px screenshot it read as a "stick")
        g.ellipse(ix - 4, y + 6, 6, 4.6).fill({ color: col, alpha: al })
        g.moveTo(ix + 2, y + 6).lineTo(ix + 2, y - 9).stroke({ width: 2.4, color: col, alpha: al, cap: 'round' })
        g.moveTo(ix + 2, y - 9).lineTo(ix + 9, y - 6).lineTo(ix + 9, y - 2)
          .stroke({ width: 2.2, color: col, alpha: al, cap: 'round', join: 'round' })
      } else {
        // THE SPEAKER: a trapezoid body (the same silhouette the mute icon had) + an arc
        g.moveTo(ix - 8, y - 3).lineTo(ix - 3, y - 3).lineTo(ix + 2, y - 8)
          .lineTo(ix + 2, y + 8).lineTo(ix - 3, y + 3).lineTo(ix - 8, y + 3)
          .closePath().fill({ color: col, alpha: al })
        if (on) {
          g.moveTo(ix + 6, y - 5).quadraticCurveTo(ix + 9, y, ix + 6, y + 5)
            .stroke({ width: 2, color: col, alpha: al * 0.8, cap: 'round' })
        }
      }
      // three steps: growing bars, the unlit ones are dim
      const step = vol <= 0 ? 0 : vol < 0.9 ? 2 : 3
      for (let s = 0; s < 3; s++) {
        const bh = 6 + s * 5
        const bx = gx - 14 + s * 8
        const lit = s < step
        g.roundRect(bx, y + 8 - bh, 5, bh, 2.5)
          .fill({ color: lit ? accent : 0xffffff, alpha: lit ? 0.95 : 0.15 })
      }
      // off — an honestly crossed out icon
      if (!on) {
        g.moveTo(ix - 10, y + 10).lineTo(ix + 10, y - 10)
          .stroke({ width: 2.4, color: 0xff8080, alpha: 0.9, cap: 'round' })
      }
    }
    // labels and hit zones (the zone is generous: ≥44px for a finger, the rows are narrow)
    this.pauseVolMusicLbl.position.set(gx1 + 13, y + 1)
    this.pauseVolSfxLbl.position.set(gx2 + 13, y + 1)
    this.pauseVolMusicLbl.visible = this.pauseVolSfxLbl.visible = true
    const hr = Math.max(24, rw * 0.22)
    this.volMusicHit = { x: gx1, y, r: hr }
    this.volSfxHit = { x: gx2, y, r: hr }
  }

  /**
   * THE LEVEL'S RULE + A TIP right in the pause menu.
   * The rule is the same condition that stands at the bottom of the battle screen. The tip is
   * the FIRST sentence of the explanation card from terms.ts (the human tricks like «сложи
   * цифры числа» are already written there), cut to one line. We invent nothing: the texts
   * are his, from the cards.
   */
  private drawPauseRule(accent: number) {
    // shown only where there is a rule: in battle and in the level intro
    const inGame = this.phase === 'play' || this.phase === 'intro'
    const show = this.pauseRuleH > 0 && inGame
    this.pauseRuleText.visible = show
    this.pauseHintText.visible = show && this.pauseRuleH >= 48
    if (!show) return
    const b = this.pausePanelBox
    const rule = `жми, когда ${this.level.conditionText}`
    if (this.pauseRuleText.text !== rule) {
      this.pauseRuleText.text = rule
      this.fitTextToWidth(this.pauseRuleText, 17, b.w - 40, 13)
    }
    this.pauseRuleText.style.fill = lerpColor(accent, 0xffffff, 0.55)
    if (this.pauseHintText.visible) {
      const hint = this.pauseHintOf(this.level.term)
      if (this.pauseHintText.text !== hint) {
        this.pauseHintText.text = hint
        this.fitTextToWidth(this.pauseHintText, 13, b.w - 40, 11)
      }
    }
  }

  /** the first (most useful) phrase of the last term's card — the "tip" in one line */
  private pauseHintOf(term: LevelDef['term']): string {
    const cards = termCards(term)
    if (!cards.length) return 'подсказка: смотри на условие внизу экрана'
    // we take the card of the SIMPLEST piece (the first in the order "pieces → the link")
    const body = cards[0].body
    const dot = body.indexOf('. ')
    const first = dot > 0 ? body.slice(0, dot + 1) : body
    return first.length > 92 ? `${first.slice(0, 89)}…` : first
  }

  /**
   * The layout of the new-rule banner: the text is fitted to the screen width, the banner
   * grows from the text, the whole group stands ABOVE the disc (in portrait the disc is
   * raised — there is room). Called when a rule is born and on every resize.
   */
  private layoutRuleBanner() {
    if (!this.ruleBannerText) return
    const maxW = this.W - 40
    this.fitTextToWidth(this.ruleBannerText, this.small ? 22 : 26, maxW)
    const tw = Math.max(this.ruleBannerText.width, this.ruleBannerLbl.width)
    const w = Math.min(this.W - 20, tw + 44)
    const h = 74
    this.ruleBannerG.clear()
    // the backdrop + the rim IN THE RULE'S COLOUR: the colour is the "name" of the new condition
    this.ruleBannerG.roundRect(-w / 2, -h / 2, w, h, 18)
      .fill({ color: 0x080a1c, alpha: 0.92 })
      .stroke({ width: 3, color: this.ruleColor, alpha: 0.95 })
    this.ruleBannerG.roundRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10, 22)
      .stroke({ width: 1.5, color: this.ruleColor, alpha: 0.3 })
    this.ruleBannerLbl.text = 'новое правило'
    this.ruleBannerLbl.style.fill = this.ruleColor
    this.ruleBannerLbl.position.set(0, -h / 2 + 17)
    this.ruleBannerText.style.fill = this.ruleColor
    this.ruleBannerText.position.set(0, 10)
    this.ruleBanner.position.set(this.cx, Math.max(h / 2 + 12, this.cy - this.R * 1.75))
  }

  /**
   * The layout of the combo milestone banner. Built like the rule banner, with two
   * differences: (1) the rim takes the world's colour (a milestone) or warm gold (a record) —
   * a milestone is a REWARD, it speaks the language of the world, not of the condition;
   * (2) when a rule banner is alive at the same time in endless, ours moves up by its height
   * — two banners in one place read as a mess.
   */
  private layoutComboBanner() {
    if (!this.comboBannerText) return
    const gold = 0xffd54a
    const col = this.comboBannerIsRecord ? gold : this.goodFlash()
    this.fitTextToWidth(this.comboBannerText, this.small ? 25 : 30, this.W - 44)
    this.fitTextToWidth(this.comboBannerSub, this.small ? 13 : 15, this.W - 60)
    const tw = Math.max(this.comboBannerText.width, this.comboBannerSub.width)
    const w = Math.min(this.W - 20, tw + 48)
    const h = 76
    this.comboBannerG.clear()
    this.comboBannerG.roundRect(-w / 2, -h / 2, w, h, 20)
      .fill({ color: 0x080a1c, alpha: 0.90 })
      .stroke({ width: 3, color: col, alpha: 0.95 })
    this.comboBannerG.roundRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10, 24)
      .stroke({ width: 1.5, color: col, alpha: 0.32 })
    this.comboBannerText.position.set(0, -6)
    this.comboBannerSub.style.fill = numToHex(lerpColor(col, 0xffffff, 0.45))
    this.comboBannerSub.position.set(0, h / 2 - 17)
    const dodge = this.ruleT > 0 ? 92 : 0 // do not sit on the rule banner
    this.comboBanner.position.set(this.cx,
      Math.max(h / 2 + 12, this.cy - this.R * 1.75 - dodge))
  }

  /** the life of the milestone banner: a fly-in with a bounce, a hold, a soft exit */
  private renderComboBanner() {
    const on = this.comboBannerT > 0 && this.phase === 'play'
    this.comboBanner.visible = on
    if (!on) return
    const age = COMBO_BANNER - this.comboBannerT
    const inK = backOut(clamp01(age / 0.26))
    const outK = clamp01(this.comboBannerT / 0.36)
    // a record breathes more noticeably than a milestone — it is the rarest event of the game
    const amp = this.comboBannerIsRecord ? 0.045 : 0.025
    const pu = 1 + amp * Math.sin(this.t * 7.5)
    this.comboBanner.scale.set((0.7 + 0.3 * inK) * pu)
    this.comboBanner.alpha = Math.min(inK, outK)
  }

  /** the life of the banner: a fly-in with a bounce, a hold, a soft exit */
  private renderRuleBanner() {
    const on = this.ruleT > 0 && this.phase === 'play' && this.mode === 'endless'
    this.ruleBanner.visible = on
    if (!on) return
    const age = RULE_BANNER - this.ruleT
    const inK = backOut(clamp01(age / 0.28))      // flies in with a bounce
    const outK = clamp01(this.ruleT / 0.4)        // leaves softly
    const pu = 1 + 0.03 * Math.sin(this.t * 7)
    this.ruleBanner.scale.set((0.72 + 0.28 * inK) * pu)
    this.ruleBanner.alpha = Math.min(inK, outK)
  }

  private renderHud() {
    const play = this.phase === 'play' || this.phase === 'intro'
    this.hudLayer.visible = play
    if (!play) return
    // «UI УРОВНЯ НЕ ДОЛЖЕН ПУГАТЬ» (Andrey): at rest the HUD is almost dissolved — the
    // screen is empty and quiet, like a Tetris Effect frame; it fills up only with the storm
    const storm = this.wake // streak 0→5: the HUD wakes up (see wake)
    const s = String(this.score)
    if (this.scoreText.text !== s) this.scoreText.text = s
    const lvl = this.mode === 'endless'
      ? `бесконечность · рекорд ${this.endlessBest}`
      : this.mode === 'daily' ? `число дня · ход ${Math.min(this.moveIdx + 1, this.level.countOfMoves)}/${this.level.countOfMoves}`
        : this.levelTag()
    if (this.levelText.text !== lvl) this.levelText.text = lvl
    this.scoreLbl.alpha = 0.28 + 0.16 * storm
    this.scoreText.alpha = 0.62 + 0.30 * storm
    this.levelText.alpha = 0.30 + 0.16 * storm
    this.multiText.visible = this.multiplier > 1
    if (this.multiplier > 1) this.multiText.text = `×${this.multiplier} · серия ${this.streak}`
    // the pause/sound buttons are almost invisible at rest, but the hit zone is always ≥44px
    this.pauseBtn.alpha = this.muteBtn.alpha = 0.55 + 0.35 * storm
    // the skip button is visible only in the game and is also quieter at rest
    this.skipBtn.visible = this.phase === 'play'
    this.skipBtn.alpha = 0.62 + 0.32 * storm
    this.renderLifeBar(storm)
  }

  /**
   * THE PROGRESS BAR TOWARDS THE NEXT LIFE.
   *
   * A life for 1000 points was "unnoticeable" not only at the moment it was given — it was
   * also impossible to WAIT for: the player did not know he was saving up. A thin line under
   * the HUD stack (78×3 px, the same width as «счёт») shows how much of the way is done.
   * Discreetly: almost transparent at rest, it fills up with the storm, and only on the last
   * 10% does it start breathing — "any moment now".
   *
   * The position is computed per frame, not in updateMetrics: the «×N · серия» line comes and
   * goes, and the bar simply stands under the last VISIBLE line of the stack.
   * If the lives are full there is no bar at all (there is nothing to save for, we must not lie).
   */
  private renderLifeBar(storm: number) {
    const g = this.lifeBarG
    g.clear()
    if (this.lives >= this.maxLivesNow) return
    const span = POINTS_PER_LIFE
    const done = clamp01((this.score - (this.nextLifeAt - span)) / span)
    const x = 22, w = 78, h = 3
    const y = this.multiText.visible ? 100 : 78
    const near = done > 0.9 ? (done - 0.9) / 0.1 : 0        // "any moment now" — the last 10%
    const breathe = 1 + 0.35 * near * Math.sin(this.t * 7)
    const celeb = this.lifeCelebT > 0 ? this.lifeCelebT / this.LIFE_CELEB : 0
    g.roundRect(x, y, w, h, h / 2).fill({ color: 0xffffff, alpha: 0.10 + 0.06 * storm })
    if (done > 0.002) {
      g.roundRect(x, y, Math.max(h, w * done), h, h / 2)
        .fill({ color: 0xff6090, alpha: (0.42 + 0.28 * storm) * breathe })
    }
    // at the moment of the celebration the whole bar flashes briefly — "the circle is closed"
    if (celeb > 0) {
      g.roundRect(x - 1, y - 1, w + 2, h + 2, (h + 2) / 2)
        .fill({ color: 0xffd0e0, alpha: 0.55 * celeb })
    }
  }

  private setPhaseVisibility() {
    const p = this.phase
    // entering the menu — we remember the "home" palette of the splash and put level.palette
    // on the live palFade triple. From this moment the fitting room can take the whole splash
    // around the worlds and always knows where to return.
    if (p === 'splash') this.enterMenuPalette()
    // reset the game elements of the disc on non-game phases (otherwise they "leak" under the finale)
    this.numberText.visible = this.numberGlow.visible = p === 'play'
    this.threads.visible = this.timerRing.visible = this.aura.visible = p === 'play'
    this.surpIcon.visible = p === 'play' && !!this.surpKind
    this.condBox.visible = p === 'play'
    this.hintBox.visible = p === 'play' || p === 'intro'
    this.splashLayer.visible = p === 'splash'
    if (p !== 'splash') {
      // leaving the splash — the world selection and its caption must not wait for us to come back
      if (this.splashPanelKind !== 'none') this.closeSplashPanel(true)
      this.splashWorldSel = -1
      this.splashGateMsg = ''
    }
    this.resultsLayer.visible = p === 'results'
    this.portalLayer.visible = p === 'portal'
    // in the tunnel the disc FLIES (phases A and E) — the layer is alive, the phases drive it themselves
    this.diskLayer.visible = p === 'play' || p === 'intro' || p === 'results'
      || p === 'gameover' || p === 'finale'
      || (p === 'portal' && this.portalKind === 'tunnel')
    if (p !== 'portal') this.portalBanner.visible = false
    if (p !== 'play') {
      this.ruleT = 0; this.ruleBanner.visible = false
      this.comboBannerT = 0; this.comboBanner.visible = false
    }
    if (p !== 'play') { this.bolt.clear(); this.flowSprite.visible = false }
    // ⚠ REVISION (found on a gameover screenshot at 360×780): the explanation card is hidden
    //    by renderDisk, and renderDisk is called ONLY in play/intro/results. So on gameover
    //    and finale (and on the splash after going to the menu) the panel kept hanging from
    //    the previous intro — and covered the score «Числа догнали! 13480». We hide it on a
    //    phase change, at the source.
    if (p !== 'intro') {
      this.learnBox.visible = false
      this.learnAt = -1
      this.learnManual = false
    }
    this.overlay.visible = p === 'gameover' || p === 'finale' || p === 'intro'
    this.pauseOverlay.visible = false
    if (p === 'gameover' || p === 'finale') {
      this.overlayTitle.visible = this.overlaySub.visible = this.overlayScore.visible = true
      this.overlayTitle.position.set(0, -this.R * 1.9)
      this.overlaySub.position.set(0, this.R * 1.9)
      this.overlayScore.position.set(0, 0)
      this.overlayScore.text = String(this.score)
      if (p === 'gameover' && this.mode === 'endless') {
        const rec = this.score >= this.endlessBest ? 'новый рекорд!' : `рекорд: ${this.endlessBest}`
        this.overlayTitle.text = 'Числа догнали!'
        this.overlaySub.text = `дожил до числа ${this.currentNumber} · счёт ${this.score}\n${rec} · тапни — ещё раз`
      } else if (p === 'gameover' && this.mode === 'daily') {
        this.overlayTitle.text = 'Число дня'
        this.overlaySub.text = `сегодняшний результат: ${this.score} · тапни — на сплэш`
      } else if (p === 'gameover') { this.overlayTitle.text = 'Ой! Числа победили'; this.overlaySub.text = 'тапни — попробуем этот уровень ещё раз' }
      else {
        this.overlayTitle.text = `Кампания пройдена. «${WORLD_NAMES[4]}»!`
        this.overlaySub.text = 'все 17 уровней твои — спасибо, что дошёл =) тапни — сыграем сначала'
      }
      // the score/title/subtitle — within the bounds of the disc and the screen
      this.fitOverlayTexts()
      // hide the lights / the HUD on the finale
      for (const f of this.fireflies) f.sprite.visible = false
    } else {
      for (const f of this.fireflies) f.sprite.visible = true
    }
    // the React overlay (the name input) listens to the phase — the DOM lives only on the splash
    try { window.dispatchEvent(new CustomEvent('hm-phase', { detail: p })) } catch { /* ok */ }
  }

  // ---------- splash overlays: info and records ----------

  private openSplashPanel(kind: 'info' | 'records') {
    this.splashPanelKind = kind
    const p = this.splashPanel
    p.removeChildren().forEach((c) => c.destroy({ children: true }))
    const accent = hexNum(this.level.palette[2])
    const mk = (text: string, size: number, fill: string, weight: '800' | '900' = '800', alpha = 1) => {
      const t = mkText({ text, style: new TextStyle({ fontFamily: 'Nunito', fontWeight: weight, fontSize: size, fill, align: 'center' }) })
      t.anchor.set(0.5, 0); t.alpha = alpha
      return t
    }
    const rows: { obj: Text; gap: number; star?: number; size: number }[] = []
    if (kind === 'info') {
      rows.push({ obj: mk('как играть', 30, '#ffffff', '900'), gap: 20, size: 30 })
      rows.push({ obj: mk('прилетело число и подходит под условие — тапни диск!', 21, '#e8eeff'), gap: 10, size: 21 })
      rows.push({ obj: mk('не подходит — жми «мимо» (или ПКМ / X)', 21, '#e8eeff'), gap: 10, size: 21 })
      rows.push({ obj: mk('серия без ошибок растит множитель: ×2, ×3…', 21, '#e8eeff'), gap: 10, size: 21 })
      rows.push({ obj: mk('золотые сюрпризы — бери, фиолетовые — обходи стороной', 21, '#e8eeff'), gap: 22, size: 21 })
      rows.push({ obj: mk('игра родилась в 6 классе: мы стояли в кругу\nи хлопали, если число делится…', 18, '#9adfff', '800', 0.8), gap: 22, size: 18 })
      rows.push({ obj: mk('тапни, чтобы вернуться', 16, '#cdd6f0', '800', 0.55), gap: 0, size: 16 })
    } else {
      rows.push({ obj: mk('рекорды', 30, '#ffffff', '900'), gap: 20, size: 30 })
      rows.push({ obj: mk(`лучший счёт: ${this.best}`, 22, '#e8eeff'), gap: 12, size: 22 })
      rows.push({ obj: mk(`звёзд собрано: ${this.totalCache}`, 22, '#ffd54a'), gap: 20, star: 0xffd54a, size: 22 })
      rows.push({ obj: mk('вехи-подарки:', 19, '#cdd6f0', '800', 0.75), gap: 10, size: 19 })
      for (const m of MILESTONES) {
        const got = hasMilestone(m.at)
        rows.push({ obj: mk(m.text, 19, got ? '#ffd54a' : '#8890a8', '800', got ? 1 : 0.8), gap: 8, star: got ? 0xffd54a : 0x555a70, size: 19 })
      }
      rows.push({ obj: mk('тапни, чтобы вернуться', 16, '#cdd6f0', '800', 0.55), gap: 0, size: 16 })
    }
    // ⚠ MOBILE (Andrey: «обрезаются буквы»). The panel shrinks to the screen width (W−60),
    // while the LINES lived at their own font size and shrank nowhere: on 360px «серия без
    // ошибок растит множитель…» and half the milestones stuck out over BOTH screen edges, and
    // the milestone stars ran off the left edge of the panel. We fit every line to the inner
    // width of the panel, and only then lay them out in a column (the line heights change
    // after the fit).
    const panelW = Math.min(this.W - 60, 520)
    const padX = 26                        // the panel margins
    const starW = 34                       // room for the star to the left of the line
    // ⚠ (Andrey: «шрифт местами МЕЛКИЙ», the «как играть» screenshot). The fit was called
    // WITHOUT minSize — which means "shrink the font as much as needed". On 390px the line
    // «золотые сюрпризы — бери, фиолетовые — обходи стороной» sat down to ~11px: formally it
    // fitted, humanly it is unreadable. We give every line a FLOOR font size (80% of the
    // original, but no smaller than 15px) — below it the line wraps by words and stays big.
    // The wrapping mechanism already exists in fitTextToWidth, it just was not used here.
    for (const r of rows) {
      const floorSize = Math.max(15, Math.round(r.size * 0.8))
      this.fitTextToWidth(r.obj, r.size, panelW - padX * 2 - (r.star !== undefined ? starW : 0), floorSize)
    }
    // laying out in a column + a glass backdrop
    let y = 0
    for (const r of rows) { r.obj.position.set(0, y); y += r.obj.height + r.gap }
    const w = Math.min(panelW, Math.max(420, ...rows.map((r) => r.obj.width + 130)))
    const h = y + 64
    const bg = new Graphics()
    bg.roundRect(-w / 2, -32, w, h, 26).fill({ color: 0x0b0d24, alpha: 0.94 })
      .stroke({ width: 2, color: accent, alpha: 0.55 })
    p.addChild(bg)
    for (const r of rows) {
      p.addChild(r.obj)
      if (r.star !== undefined) {
        const sg = new Graphics()
        this.drawStar(sg, -r.obj.width / 2 - 20, r.obj.y + r.obj.height / 2, 10, r.star)
        p.addChild(sg)
      }
    }
    p.position.set(this.cx, this.cy - (h - 32) / 2)
    p.visible = true
  }

  private closeSplashPanel(silent = false) {
    this.splashPanelKind = 'none'
    this.splashPanel.visible = false
    if (!silent) this.sound.ui(0.7)
  }

  // ---------- dev hooks (visual checks through window.__hm) ----------

  /** show the level results: __hm.devResults(3) / (1, 120) — screenshots and debugging */
  devResults(stars: 1 | 2 | 3 = 3, levelScore = 240) {
    if (!this.ready) return
    this.showResults(stars, levelScore)
  }

  /**
   * Bring the disc outfit selector back on screen: __hm.devSkins() / __hm.devSkins(false).
   * The outfit mechanism itself is alive (see glassTones/getSkin/toggleSkin), only the corner
   * switch on the splash is hidden — by the author's word «на хорошие времена».
   */
  devSkins(on = true) {
    this.skinsUI = on
    this.drawStaticUI()
    return this.skinsUI
  }

  /** jump to a level (intro): __hm.devGoLevel(4) — checking the worlds/palettes */
  devGoLevel(idx: number) {
    if (!this.ready) return
    this.beginGame(Math.max(0, Math.min(idx, LEVELS.length - 1)))
  }

  /** instantly "pass" the current level with losses: __hm.devWin(0) → 3 stars */
  devWin(livesLost = 0) {
    if (!this.ready) return
    this.livesLost = livesLost
    this.score = this.levelScoreStart + 10 * this.worldMult * this.level.countOfMoves
    this.enterResults()
  }

  /** wind up stars for the gates: __hm.devGrantStars(15) banks 3★ from the first levels */
  devGrantStars(total: number) {
    let left = total
    for (let i = 0; i < LEVELS.length && left > 0; i++) {
      const s = Math.min(3, left)
      bankStars(i, s)
      left -= s
    }
    this.totalCache = totalStars()
  }

  /** turn on a surprise effect without a move: __hm.devEffect('warp') — screenshots of the debuffs */
  devEffect(kind: SurpriseKind) {
    if (!this.ready) return
    switch (kind) {
      case 'freeze': this.freezeT = 3.5; break
      case 'transfer': this.transferT = 7; this.transferE = 0; break
      case 'warp': this.warpT = 6; break
      case 'colorMusic': this.cmT = 7; this.cmE = 0; break
      case 'inversion': this.inversionT = INV_TOTAL; break
      case 'rotation': this.rotT = 5; break
      case 'slow': this.timeScale = 0.55; this.slowmoT = 8; break
      default: break
    }
  }

  /** show a surprise IN THE DISC without a move: __hm.devSurprise('lifeTrap') — icon screenshots */
  devSurprise(kind: SurpriseKind | null) {
    if (!this.ready) return
    this.surpKind = kind
    this.feedback = null
    this.moveAnim = 1
  }

  /** the celebration of reaching ×3 (the golden wave): __hm.devMult3() */
  devMult3() { if (this.ready) this.celebrateMult3() }

  /**
   * ICON SHEET: all the surprises side by side on a dark background — a readability check
   * "with squinted eyes" (the evil ones are crossed out, the good ones are whole).
   * __hm.devIconSheet() / __hm.devIconSheet(false) — to remove it.
   */
  devIconSheet(on = true) {
    if (this.iconSheet) { this.iconSheet.destroy({ children: true }); this.iconSheet = null }
    if (!on) return
    const rows: SurpriseKind[][] = [
      ['life', 'score', 'slow', 'help', 'explosion', 'freeze'],
      ['lifeTrap', 'scoreTrap', 'fast', 'rotation', 'transfer', 'warp', 'colorMusic', 'inversion'],
    ]
    const sheet = new Container()
    const bg = new Graphics()
    bg.rect(0, 0, this.W, this.H).fill({ color: 0x05060d, alpha: 1 })
    sheet.addChild(bg)
    const ch = (this.H - 60) / rows.length
    const R = Math.min(this.W / 8, ch) * 0.34
    rows.forEach((row, ri) => {
      const cw = this.W / row.length
      row.forEach((k, i) => {
        const cxx = (i + 0.5) * cw, cyy = 60 + (ri + 0.5) * ch
        const g = new Graphics()
        drawSurpriseIcon(g, k, R, 0)
        g.position.set(cxx, cyy)
        sheet.addChild(g)
        const lbl = mkText({
          text: k, style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 15, fill: '#8f98ad' }),
        })
        lbl.anchor.set(0.5); lbl.position.set(cxx, cyy + R * 1.05)
        sheet.addChild(lbl)
      })
    })
    const hdr = mkText({
      text: 'верхний ряд — ДОБРЫЕ (целые, тёплые) · нижний — ЗЛЫЕ (перечёркнуты, холодный фиолет)',
      style: new TextStyle({ fontFamily: 'Nunito', fontWeight: '800', fontSize: 18, fill: '#e8eeff' }),
    })
    hdr.anchor.set(0.5, 0); hdr.position.set(this.W / 2, 22)
    sheet.addChild(hdr)
    this.app.stage.addChild(sheet)
    this.iconSheet = sheet
  }

  /** run the portal from the current level: __hm.devPortal('tunnel') — screenshots of the 5 phases */
  devPortal(kind: PortalKind = 'tunnel') {
    if (!this.ready) return
    this.enterPortal(kind)
  }

  /** the five-layer response without playing: __hm.devJuice(6) — the score stack, lightning, shards */
  devJuice(streak = 6) {
    if (!this.ready || this.phase !== 'play') return
    this.streak = Math.max(0, streak - 1)
    this.feedback = null
    this.tapped = false
    this.resolveGood(true)
  }

  /**
   * Put the world on a given streak INSTANTLY — for screenshots of the scale (10 / 25 / 50 /
   * 100) without a hundred moves of autoplay: __hm.devCombo(100).
   * It sets the streak, the multiplier, the intensity axis and the flow fuel straight to the
   * target, without playing the milestones (for those there is the normal path — devAutoPlay).
   */
  devCombo(streak = 50, fireMilestone = false) {
    if (!this.ready || this.phase !== 'play') return
    this.streak = Math.max(0, Math.round(streak))
    this.multiplier = this.streak >= 10 ? 3 : this.streak >= 5 ? 2 : 1
    this.intensityTarget = comboIntensity(this.streak)
    this.intensity = this.intensityTarget
    this.musicIntensity = Math.min(1, this.streak / 12)
    this.hush = 0
    this.storm.feed(8)
    if (fireMilestone) {
      const at = COMBO_MILESTONES.filter((m) => m <= this.streak).pop() ?? COMBO_MILESTONES[0]
      this.comboMilesHit.delete(at)
      this.celebrateComboMilestone(at)
    }
    return { streak: this.streak, intensity: Number(this.intensity.toFixed(3)) }
  }

  /** show the streak record congratulation for a screenshot/sound */
  devComboRecord(streak = 27) { if (this.ready) this.celebrateComboRecord(streak, 0) }

  /** read the whole scale — a table "streak → intensity" */
  devComboScale(): { streak: number; intensity: number }[] {
    const out: { streak: number; intensity: number }[] = []
    for (const s of [0, 1, 3, 5, 9, 10, 15, 25, 40, 50, 75, 100, 150]) {
      out.push({ streak: s, intensity: Number(comboIntensity(s).toFixed(3)) })
    }
    return out
  }

  // ---------- dev hooks for the modes (endless / number of the day) ----------

  /** enter endless mode (bypassing the gate): __hm.devEndless() */
  devEndless() { if (this.ready) this.beginEndless() }

  /** enter the number of the day; the date can be substituted to check a seed change */
  devDaily(seed?: number) { if (this.ready) this.beginDaily(seed) }

  /** substitute the date of the number of the day (UTC) for a check: __hm.devSetDate('2026-01-15') */
  devSetDate(iso: string | null) {
    this.dailyDateOverride = iso ? new Date(iso + 'T12:00:00Z') : null
  }

  /** unlock world 1 completely (to check the ∞ satellite unlocked) */
  devClearWorld1() {
    for (let i = 0; i < LEVELS.length && LEVELS[i].worldIdx === 0; i++) bankStars(i, 3)
    this.totalCache = totalStars()
    this.drawStaticUI()
  }

  /**
   * GENERATOR HONESTY AUDIT: generate n conditions along a growing stream and return
   * [{text, frac}] — the share of "yes" on the nearest 20 numbers for each.
   * __hm.devAuditGenerator(50) → all frac values must be in [0.30, 0.60].
   */
  devAuditGenerator(n = 50, tier = -1) {
    const stream = new NumberStream(Math.random, 3)
    const out: { text: string; frac: number; tier: number }[] = []
    let numIdx = 0, score = 0
    for (let i = 0; i < n; i++) {
      const tr = tier >= 0 ? tier : tierForScore(score)
      const preview = stream.preview(numIdx, 20)
      const term = genCondition(Math.random, tr, preview)
      out.push({ text: term.text, frac: yesFraction(term, preview), tier: tr })
      numIdx += 12; score += 300 // move the stream and the tier up between conditions
    }
    return out
  }

  /**
   * Forget all the condition explanations and rebuild the cards of the current intro — to
   * look at it "with first-time eyes". __hm.devForgetLessons()
   */
  devForgetLessons() {
    resetTermsLearned()
    if (this.phase === 'intro') this.prepareLearnCards()
  }

  /** open the explanation card by hand (screenshots). __hm.devShowLesson(0) */
  devShowLesson(i = 0) {
    if (this.phase !== 'intro' || !this.learnCards.length) return
    this.learnManual = true
    this.learnAt = Math.max(0, Math.min(i, this.learnCards.length - 1))
  }

  /**
   * Auto-play n moves CORRECTLY (for screenshots / checking a long game without timers):
   * tap on a matching number, «мимо» on a non-matching one, skip a surprise. __hm.devAutoPlay(25)
   */
  devAutoPlay(n = 20) {
    if (!this.ready) return
    if (this.phase === 'intro') { this.phase = 'play'; this.startMove(); this.setPhaseVisibility() }
    for (let i = 0; i < n && this.phase === 'play'; i++) {
      this.tapped = false; this.feedback = null
      if (this.surpKind) this.passSurprise(this.surpKind)
      else if (this.level.test(this.currentNumber)) this.resolveGood(true)
      else this.doSkip()
      this.feedback = null
      this.nextMove()
    }
    this.setPhaseVisibility()
  }

  /** instant death (for a screenshot of the endless results): __hm.devKill() */
  devKill() {
    if (!this.ready || this.phase !== 'play') return
    this.lives = 0; this.feedback = null
    this.nextMove(); this.setPhaseVisibility()
  }

  /** read the state of the mode — for playwright checks */
  devState() {
    return {
      mode: this.mode, phase: this.phase, score: this.score, lives: this.lives,
      moveIdx: this.moveIdx, numIdx: this.numIdx, currentNumber: this.currentNumber,
      condition: this.level.conditionText, endlessBest: this.endlessBest,
      dailySeed: this.dailySeed,
    }
  }

  /** the first k numbers of the number of the day by seed (to check they match for one seed) */
  devDailySequence(seed: number, k = 12): number[] {
    const lvl = buildDaily(seed)
    return (lvl.fixedNumbers || []).slice(0, k)
  }

  // ---------- dev hooks for the promo capture (layers for the hologram) ----------
  // Everything below is touched only by the script scripts/capture-layers.mjs. A normal game
  // does not see these fields: the ticker does not stop, the background does not go transparent.

  /** FRAME-BY-FRAME MODE: stop the common ticker, then move time by hand.
   *  __hm.devStepMode(true) → __hm.devStep(33.3) for each frame → a screenshot. */
  devStepMode(on = true) {
    if (!this.app) return false
    if (on) this.app.ticker.stop()
    else this.app.ticker.start()
    return !this.app.ticker.started
  }

  /** one hand-made frame: move the clock by dtMs and draw it on the GPU */
  devStep(dtMs = 1000 / 30) {
    if (!this.ready) return
    this.frame(dtMs / 1000)
    // the explosion layer separately from the board: we hide the disc and the HUD AFTER the
    // frame is drawn, otherwise setPhaseVisibility would bring them back on the next move
    if (this.holoHideBoard) { this.diskLayer.visible = false; this.hudLayer.visible = false }
    this.app.renderer.render(this.app.stage)
  }

  /** hide the board (the disc + the HUD), keeping the storm/explosions: __hm.devHideBoard(true) */
  devHideBoard(on = true) { this.holoHideBoard = on }

  /** A TRANSPARENT BACKGROUND for the hologram layer: we remove the cosmos backdrop, the
   *  readability protector and the page fill — only the light is left. __hm.devHologram() */
  devHologram(on = true) {
    if (!this.ready) return
    this.app.renderer.background.alpha = on ? 0 : 1
    this.cosmos.setBackdrop(!on)
    this.protector.visible = !on
    const bg = on ? 'transparent' : ''
    document.documentElement.style.background = bg
    document.body.style.background = bg
  }

  /** the world RISES up out of the screen over dur seconds: __hm.devLift(1.4) */
  devLift(dur = 1.4) { this.liftT = 0; this.liftDur = Math.max(0.01, dur) }

  // ---------- shapes ----------
  /** the outline of a five-pointed star: we draw the path, the caller decides on fill/stroke */
  private starPath(g: Graphics, x: number, y: number, s: number) {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? s : s * 0.45
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py)
    }
    g.closePath()
  }

  private drawStar(g: Graphics, x: number, y: number, s: number, color: number) {
    this.starPath(g, x, y, s)
    g.fill(color)
  }

}
