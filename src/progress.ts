// progress.ts - the player's progress piggy bank (localStorage, survives a restart).
//
// Star economy. Andrey: «звёзды дают бонусы».
// A level awards QUALITY stars (3 - no losses, 2 - one life lost, 1 - finished);
// the bank keeps the BEST result per level. totalStars = sum of the bests.
// Milestone gifts are permanent: taken once, works forever.
//
// Milestone grid 8/20/33/45/51 - stretched across all 51 stars, the biggest prize at 51.
// +Life sits at 20 stars, not at 5, so the early game does not get too easy.
//
// Note: milestone 20★ COINCIDES with the gate of world 4 (levels.ts, starsRequired
// 6/15/20/28). Harmless, but the design idea is that milestones are independent of
// gates: to decouple them, move the world 4 gate to 21★ (an honest run banks ~24★).

import { LEVELS } from './levels'

const K_STARS = 'hm2.stars'      // JSON number[] - best stars per level
const K_LVLBEST = 'hm2.lvlbest'  // JSON number[] - best score PER level
const K_MILES = 'hm2.milestones' // JSON number[] - milestones taken (8/20/33/45/51)
const K_NAME = 'hm2.name'        // name for «Привет, {имя}!» (the 2016 splash canon)
const K_SKIN = 'hm2.skin'        // disc skin: 0 classic, 1 aurora (8★), 2 emerald (45★)
const K_BEST = 'hm2.best'        // best score for one run (campaign)
const K_VER = 'hm2.progressv'    // data version (migrations between releases)
const K_LEARNED = 'hm2.learned'  // JSON string[] - which goal kinds the game already explained
const K_SESSION = 'hm2.session'  // JSON SessionSnapshot - an UNFINISHED run (see below)

export interface Milestone { at: number; text: string }

// ── SNAPSHOT OF THE LIVE RUN (blocker: «отвлёкся — очки пропали») ────────────
// Andrey minimized the game on his phone, came back - the score was zero and the game
// offered level one. Not a game bug: Android kills the WebView of a background tab at
// any moment and the whole in-memory run (score, lives, level index) disappears.
// localStorage only held `hm2.level` - "how far you got" - without score or lives, so
// "continue" sent the player back to the start of the campaign.
//
// The honest, simple cure: on every meaningful event (end of a move, pause, going to
// background, pagehide) we write a small snapshot of the RUN to localStorage. On start,
// if a snapshot exists, the splash offers to continue, and the run is restored FROM THE
// BEGINNING OF THE CURRENT LEVEL - with all the banked score and lives. Mid-level is
// deliberately not resurrected: half a level with someone else's timer and half-eaten
// surprises is both unfair and hard; the start of the level is fair.
//
// The snapshot is DELETED when the run is over (game over, finale, leaving the results
// screen to the splash) - otherwise the game would offer to continue an already lived run.

/** snapshot format version: a foreign or old snapshot is silently dropped */
const SESSION_V = 1
/** the snapshot expires in a day: nobody wants to continue yesterday's run */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000

export interface SessionSnapshot {
  v: number
  /** run mode: only the campaign is restored (see loadSession) */
  mode: 'campaign' | 'endless' | 'daily'
  levelIdx: number
  score: number
  lives: number
  /** threshold of the next +1 life, otherwise a restore would grant the life again */
  nextLifeAt: number
  moveIdx: number
  /** seed / seed of the day for the generated modes (written now, read later) */
  seed: number
  /** write timestamp (TTL) */
  ts: number
}

/** store the run snapshot (quietly, never throws: private mode is a valid guest) */
export function saveSession(s: Omit<SessionSnapshot, 'v' | 'ts'>) {
  try {
    localStorage.setItem(K_SESSION, JSON.stringify({ ...s, v: SESSION_V, ts: Date.now() }))
  } catch { /* ok */ }
}

/** the unfinished run snapshot, or null (expired / foreign / broken count as null) */
export function loadSession(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(K_SESSION)
    if (!raw) return null
    const s = JSON.parse(raw) as SessionSnapshot
    if (!s || s.v !== SESSION_V) return null
    if (!Number.isFinite(s.score) || !Number.isFinite(s.levelIdx)) return null
    if (Date.now() - (s.ts || 0) > SESSION_TTL_MS) return null
    // only the CAMPAIGN is restored: endless lives by its record, the number of the day
    // by one attempt per day - resurrecting those mid-run would be cheating
    if (s.mode !== 'campaign') return null
    if (s.lives <= 0) return null // the run is already over, nothing to offer
    return s
  } catch { return null }
}

export function clearSession() {
  try { localStorage.removeItem(K_SESSION) } catch { /* ok */ }
}

/** milestone gifts: reach it once, keep it forever */
export const MILESTONES: Milestone[] = [
  { at: 8, text: '8 звёзд: наряд диска «аврора»!' },
  { at: 20, text: '20 звёзд: +1 к жизням навсегда!' },
  { at: 33, text: '33 звезды: добрые сюрпризы чаще!' },
  { at: 45, text: '45 звёзд: наряд диска «изумруд»!' },
  { at: 51, text: '51 звезда: все до единой!' },
]

function readArr(key: string): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(v) ? v.map((x) => Number(x) || 0) : []
  } catch { return [] }
}
function writeArr(key: string, arr: number[]) {
  try { localStorage.setItem(key, JSON.stringify(arr)) } catch { /* ok */ }
}

export function starsByLevel(): number[] { return readArr(K_STARS) }

// ── Explanation cards for goal kinds ────────────────────────────────────────
// Andrey: «что за прогрессия, что полный квадрат — даже мне тяжело в голове».
// Every KIND of goal is explained once, in the intro of the level where it first
// appears; after that the card is available by tapping the goal line. This section
// only stores "what has already been explained".

function readStrArr(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(v) ? v.map((x) => String(x)) : []
  } catch { return [] }
}

/** has this goal kind already been explained (kind from terms.ts) */
export function isTermLearned(kind: string): boolean {
  return readStrArr(K_LEARNED).includes(kind)
}

/** remember that these goal kinds have been shown to the player */
export function markTermsLearned(kinds: string[]) {
  if (!kinds.length) return
  const have = readStrArr(K_LEARNED)
  const fresh = kinds.filter((k) => !have.includes(k))
  if (!fresh.length) return
  try { localStorage.setItem(K_LEARNED, JSON.stringify([...have, ...fresh])) } catch { /* ok */ }
}

/** goal kinds the player has unlocked - the contents of the rules encyclopedia */
export function learnedTerms(): string[] { return readStrArr(K_LEARNED) }

/** forget every explanation - for screenshots and first-time-eyes checks */
export function resetTermsLearned() {
  try { localStorage.removeItem(K_LEARNED) } catch { /* ok */ }
}

export function totalStars(): number {
  return starsByLevel().reduce((s, x) => s + x, 0)
}

/**
 * Progress migration to the current format (called once on engine start):
 * 1) milestones are recomputed from totalStars against the 8/20/33/45/51 grid -
 *    nothing earned is lost: everything the star count covers counts as taken
 *    (and the other way round: the old 5★ milestone != the new 20★ one, so the
 *    bonus honestly waits for its threshold);
 * 2) score records are converted to the 10xWORLD formula (Andrey's canon: 10 per
 *    episode): the old 10xlevel inflated late records - we rescale so that new
 *    records stay reachable instead of being a monument to inflation.
 */
export function migrateProgress() {
  try {
    if (localStorage.getItem(K_VER) === '2') return
    // milestones: recomputed from the star total (no toasts, they were earned earlier)
    const total = totalStars()
    writeArr(K_MILES, MILESTONES.filter((m) => total >= m.at).map((m) => m.at))
    // level records: the multiplier was (level+1), now it is (world+1)
    const lb = readArr(K_LVLBEST)
    if (lb.length) {
      writeArr(K_LVLBEST, lb.map((v, i) =>
        Math.round(v * ((LEVELS[i]?.worldIdx ?? 0) + 1) / (i + 1))))
    }
    // run record: ratio of the perfect campaign totals new/old = 24380/84920 ~ 0.29
    const best = Number(localStorage.getItem(K_BEST) || 0)
    if (best > 0) localStorage.setItem(K_BEST, String(Math.round(best * 0.29)))
    localStorage.setItem(K_VER, '2')
  } catch { /* ok */ }
}

/** bank the stars for a level; true if the previous best was beaten */
export function bankStars(levelIdx: number, stars: number): boolean {
  const arr = starsByLevel()
  if ((arr[levelIdx] || 0) >= stars) return false
  arr[levelIdx] = stars
  writeArr(K_STARS, arr)
  return true
}

/** bank the score for a level; true if the level best was beaten */
export function bankLevelScore(levelIdx: number, score: number): boolean {
  const arr = readArr(K_LVLBEST)
  if ((arr[levelIdx] || 0) >= score) return false
  arr[levelIdx] = score
  writeArr(K_LVLBEST, arr)
  return true
}

export function hasMilestone(at: number): boolean { return readArr(K_MILES).includes(at) }

/** mark freshly reached milestones and return them (for the celebration toasts) */
export function claimMilestones(total: number): Milestone[] {
  const claimed = readArr(K_MILES)
  const fresh = MILESTONES.filter((m) => total >= m.at && !claimed.includes(m.at))
  if (fresh.length) writeArr(K_MILES, [...claimed, ...fresh.map((m) => m.at)])
  return fresh
}

export function getName(): string {
  try { return localStorage.getItem(K_NAME) || '' } catch { return '' }
}

/** disc skins: 0 classic; 1 aurora (milestone 8★); 2 emerald (milestone 45★) */
function skinUnlocked(skin: number): boolean {
  if (skin === 1) return hasMilestone(8)
  if (skin === 2) return hasMilestone(45)
  return skin === 0
}

export function getSkin(): number {
  try {
    const s = Number(localStorage.getItem(K_SKIN) || 0)
    return skinUnlocked(s) ? s : 0 // a locked skin quietly falls back to classic
  } catch { return 0 }
}

/** cycle through the unlocked skins: classic -> aurora -> emerald -> ... */
export function toggleSkin(): number {
  let next = getSkin()
  for (let i = 0; i < 3; i++) {
    next = (next + 1) % 3
    if (skinUnlocked(next)) break
  }
  try { localStorage.setItem(K_SKIN, String(next)) } catch { /* ok */ }
  return next
}

// ── BEST STREAK (COMBO) ─────────────────────────────────────────────────────
// Andrey: «если был максимум комбо — как-то поздравить с новым рекордом, тем
// красивым бассом Bejeweled 2, говорить incredible».
// This personal record lives apart from all other progress: it is not about stars or
// score, it is about how many times in a row you were right. Own key, a single number,
// so that migrations never touch it.
const K_COMBOBEST = 'hm2.combobest'

/** the all-time best streak (0 if the player never played) */
export function bestCombo(): number {
  try { return Math.max(0, Number(localStorage.getItem(K_COMBOBEST) || 0) || 0) }
  catch { return 0 }
}

/** bank a streak; true if the personal record was beaten (the engine celebrates) */
export function bankCombo(streak: number): boolean {
  if (!(streak > bestCombo())) return false
  try { localStorage.setItem(K_COMBOBEST, String(Math.round(streak))) } catch { /* ok */ }
  return true
}
