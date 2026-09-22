// generator.ts - goal generator for the ENDLESS mode and for the NUMBER OF THE DAY.
// Design: ДИЗАЙН-кампании.md sections 4 (endless) and 5 (number of the day).
//
// The core is a fair goal generator: it takes terms from a pool sized by the score
// tier, builds a leaf or a boolean tree, and VALIDATES it on the next ~20 numbers:
// accepted only if the share of "yes" lands in 30-60%. No "all yes" / "all no".
//
// The same code serves the number of the day: instead of Math.random it gets
// mulberry32 seeded from the (UTC) date, so the puzzle is the same for everyone
// in the world on a given day.

import {
  Term, divisibility, lastNumeral, additionNumerals, multiplicationNumerals,
  simple, squareNumber, arithmeticProgression, geometricProgression, or, and, not,
} from './terms'
import type { LevelDef, SurpriseKind } from './levels'
import { worldPalette } from './levels'

export type Rng = () => number

/** deterministic PRNG (mulberry32) - a date seed gives everyone the same challenge */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** UTC date seed: YYYY*10000 + MM*100 + DD - the same worldwide on a given day */
export function dateSeedUTC(d: Date = new Date()): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

/** human-readable UTC date DD.MM.YYYY for the number-of-the-day caption */
export function dateLabelUTC(d: Date = new Date()): string {
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getUTCFullYear()}`
}

// ---------- helpers ----------
const randint = (rng: Rng, a: number, b: number) => a + Math.floor(rng() * (b - a + 1))
const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]

/** share of "yes" of a term over a sample of numbers (0..1) */
export function yesFraction(term: Term, nums: number[]): number {
  if (!nums.length) return 0
  let yes = 0
  for (const n of nums) if (term.test(n)) yes++
  return yes / nums.length
}

const IN_RANGE = (f: number) => f >= 0.30 && f <= 0.60

// ---------- leaves per tier ----------
// The pool grows with the score (design section 4): T0 -> T4. Parameters are picked
// "plausible", but fairness is decided by the validator - bad candidates are dropped.

/** tier by the score earned */
export function tierForScore(score: number): number {
  if (score >= 2500) return 4
  if (score >= 1500) return 3
  if (score >= 800) return 2
  if (score >= 300) return 1
  return 0
}

function leaf(rng: Rng, tier: number): Term {
  // weights are biased to divisibility: it reliably lands in 30-60% on a rising
  // stream; the other terms add variety and pass the validator when they fit
  const bag: (() => Term)[] = []
  // T0 always
  bag.push(() => divisibility(pick(rng, [2, 3])))
  bag.push(() => divisibility(pick(rng, [2, 3])))
  bag.push(() => lastNumeral(randint(rng, 0, 9)))
  if (tier >= 1) {
    bag.push(() => additionNumerals(randint(rng, 5, 13)))
    bag.push(() => squareNumber())
  }
  if (tier >= 2) {
    bag.push(() => simple())
    bag.push(() => arithmeticProgression(randint(rng, 1, 6), randint(rng, 2, 4)))
  }
  if (tier >= 3) {
    bag.push(() => multiplicationNumerals(pick(rng, [6, 8, 12, 18, 24])))
    bag.push(() => geometricProgression(pick(rng, [1, 2]), pick(rng, [2, 3])))
  }
  return pick(rng, bag)()
}

// ---------- operand equality BY MEANING, not only by text ----------
// The bug this fixes: goals like "divisible by 3 OR divisible by 3", "divisible by 2
// AND divisible by 2" - both operands identical. The term text already carries the
// parameter ("divisible by 2" vs "by 3", "ends with 3" vs "with 7"), so a literal text
// comparison catches exactly those cases; on top of that we compare the predicates
// themselves over a wide window of numbers. That also catches the case where two terms
// built DIFFERENTLY test the same thing: "ends with 5 OR progression from 1 step 2" is
// just "odd" (the 1,+2 progression already yields every odd number), and "NOT divisible
// by 2" is "odd" too - by text such a pair looks different, by meaning it is the same
// condition twice.
const EQUIV_RANGE = 500
function sameMeaning(a: Term, b: Term): boolean {
  if (a.text === b.text) return true
  for (let n = 1; n <= EQUIV_RANGE; n++) if (a.test(n) !== b.test(n)) return false
  return true
}

/** second OR/AND operand: reroll up to 6 times while it means the same as the first */
function pickDistinctLeaf(rng: Rng, tier: number, other: Term): Term {
  let t = leaf(rng, tier)
  for (let i = 0; i < 6 && sameMeaning(t, other); i++) t = leaf(rng, tier)
  return t
}

/** build one goal (a leaf or a boolean tree) for the tier */
function makeCondition(rng: Rng, tier: number): Term {
  const r = rng()
  if (tier >= 4 && r < 0.35) {
    // capstone tree (A OR B) AND NOT C - the leaves differ by meaning, AND the whole
    // arm (A OR B) must not mean the same as (NOT C): otherwise the tree is one and the
    // same condition said twice ("ends with 5 OR progression 1,+2" = "odd" = "NOT
    // divisible by 2") and the AND collapses into a tautology
    let orTerm: Term = leaf(rng, tier)
    let notTerm: Term = not(leaf(rng, tier))
    for (let i = 0; i < 6; i++) {
      const a = leaf(rng, tier)
      const b = pickDistinctLeaf(rng, tier, a)
      orTerm = sameMeaning(a, b) ? a : or(a, b)
      let c = leaf(rng, tier)
      for (let j = 0; j < 6 && (sameMeaning(c, a) || sameMeaning(c, b)); j++) c = leaf(rng, tier)
      notTerm = not(c)
      if (!sameMeaning(orTerm, notTerm)) break
    }
    return sameMeaning(orTerm, notTerm) ? orTerm : and(orTerm, notTerm)
  }
  if (tier >= 3 && r < 0.30) return not(leaf(rng, tier))         // NOT
  if (tier >= 2 && r < 0.55) {                                    // AND
    const a = leaf(rng, tier)
    const b = pickDistinctLeaf(rng, tier, a)
    return sameMeaning(a, b) ? a : and(a, b)
  }
  if (tier >= 1 && r < 0.55) {                                    // OR
    const a = leaf(rng, tier)
    const b = pickDistinctLeaf(rng, tier, a)
    return sameMeaning(a, b) ? a : or(a, b)
  }
  return leaf(rng, tier)                                          // single leaf
}

/**
 * Rebuild the text of a composite bottom-up into human form. `terms.ts` gives a NOT
 * term the officialese «НЕ выполняется: X»; the campaign in `levels.ts` writes its NOT
 * goals by hand in human words («НЕ делится на 4», «число СОСТАВНОЕ (НЕ простое)»).
 * This brings the endless / number-of-the-day generator to the same shape: «НЕ <goal>».
 */
function humanize(t: Term): Term {
  if (!t.parts || !t.parts.length) return t
  const parts = t.parts.map(humanize)
  let text: string
  if (t.kind === 'not') text = `НЕ ${parts[0].text}`
  else if (t.kind === 'and') text = `${parts[0].text} И ${parts[1].text}`
  else if (t.kind === 'or') text = `${parts[0].text} ИЛИ ${parts[1].text}`
  else text = t.text
  return { ...t, text, parts }
}

/**
 * FAIR generator: tries candidates until the share of "yes" over `nums` lands in
 * 30-60%. The guaranteed fallback (divisibility by 2/3, "not prime") keeps an unfair
 * goal from being returned - on a rising stream one of those is always in range.
 */
export function genCondition(rng: Rng, tier: number, nums: number[]): Term {
  let best: Term | null = null
  let bestDist = Infinity
  for (let i = 0; i < 200; i++) {
    const t = makeCondition(rng, tier)
    const f = yesFraction(t, nums)
    if (IN_RANGE(f)) return humanize(t)
    const d = Math.abs(f - 0.45)
    if (d < bestDist) { bestDist = d; best = t }
  }
  return humanize(forceInRange(nums) ?? best ?? divisibility(2))
}

/**
 * The guaranteed-fair fallback: when random candidates miss 30-60% (it happens on an
 * awkward window), we build the goal EXPLICITLY from the sample - first single
 * divisors / last digits, then OR/AND to pull the share towards 45%.
 */
function forceInRange(nums: number[]): Term | null {
  const singles: Term[] = []
  for (let d = 2; d <= 7; d++) singles.push(divisibility(d))
  for (let dig = 0; dig <= 9; dig++) singles.push(lastNumeral(dig))
  singles.push(not(simple()), simple())
  const scored = singles.map((t) => ({ t, f: yesFraction(t, nums) }))
  // 1) a single term in range, closest to 0.45
  const inr = scored.filter((s) => IN_RANGE(s.f)).sort((a, b) => Math.abs(a.f - 0.45) - Math.abs(b.f - 0.45))
  if (inr.length) return inr[0].t
  // 2) too rare -> OR raises the share; too frequent -> AND lowers it
  const low = scored.filter((s) => s.f > 0 && s.f < 0.30).sort((a, b) => b.f - a.f)
  for (let i = 0; i < low.length; i++) for (let j = i + 1; j < low.length; j++) {
    const t = or(low[i].t, low[j].t)
    if (IN_RANGE(yesFraction(t, nums))) return t
  }
  const high = scored.filter((s) => s.f > 0.60).sort((a, b) => a.f - b.f)
  for (let i = 0; i < high.length; i++) for (let j = i + 1; j < high.length; j++) {
    const t = and(high[i].t, high[j].t)
    if (IN_RANGE(yesFraction(t, nums))) return t
  }
  return null
}

// ---------- number stream ----------

/**
 * The rising stream of the endless mode with rare bursts of countdown.
 * Keeps an array: numbers are fixed at generation time, so the preview matches the game.
 */
export class NumberStream {
  private nums: number[] = []
  private falling: boolean[] = []
  private cursor: number
  private burstLeft = 0
  private sinceBurst = 0
  constructor(private rng: Rng, start = 2) { this.cursor = start }

  /** extend the stream up to the index (inclusive) */
  private ensure(upto: number) {
    while (this.nums.length <= upto) {
      let fall = false
      if (this.burstLeft > 0) {
        this.burstLeft--; this.sinceBurst = 0; fall = true
        this.cursor = Math.max(4, this.cursor - randint(this.rng, 2, 7))
      } else {
        this.sinceBurst++
        if (this.nums.length > 14 && this.sinceBurst > 26 && this.rng() < 0.06) {
          this.burstLeft = randint(this.rng, 10, 15); fall = true
          this.cursor = Math.max(4, this.cursor - randint(this.rng, 2, 7))
        } else {
          this.cursor += randint(this.rng, 1, 4)
        }
      }
      this.nums.push(this.cursor); this.falling.push(fall)
    }
  }

  at(i: number): number { this.ensure(i); return this.nums[i] }
  isFalling(i: number): boolean { this.ensure(i); return this.falling[i] }
  /** preview of the next `count` numbers from index `from` (for the validator) */
  preview(from: number, count: number): number[] {
    this.ensure(from + count)
    return this.nums.slice(from, from + count)
  }
}

// ---------- NUMBER OF THE DAY ----------

const DAILY_SURPRISES: SurpriseKind[] = [
  'life', 'score', 'help', 'slow', 'explosion', 'rotation', 'warp', 'fast', 'scoreTrap',
]

/**
 * buildDaily(seed): the same 20-move challenge for everyone on a given day.
 * A fixed sequence of numbers + a generated goal (tier T2) + a fixed schedule of
 * surprises. Same seed -> same challenge.
 */
export function buildDaily(seed: number): LevelDef {
  const rng = mulberry32(seed)
  const moves = 20
  // how many surprise moves (3) and where they sit - deterministic
  const places: number[] = []
  const surprises: SurpriseKind[] = []
  const slots = [randint(rng, 3, 5), randint(rng, 8, 11), randint(rng, 13, 16)]
  for (const s of slots) {
    if (!places.includes(s)) { places.push(s); surprises.push(pick(rng, DAILY_SURPRISES)) }
  }
  // numbers: rising, delta 1-4, start 2-9 - 20 numbers plus slack for the surprises
  const nums: number[] = []
  let cur = randint(rng, 2, 9)
  for (let i = 0; i < moves + 6; i++) { nums.push(cur); cur += randint(rng, 1, 4) }
  // a T2 goal, fair over the whole sequence
  const term = genCondition(rng, 2, nums)
  return {
    test: term.test, conditionText: term.text,
    firstNumber: 0, deltaNumbers: 0, countOfMoves: moves,
    fixedNumbers: nums,
    timeStep: 1.9, endSpeedup: 1.25, timeAfterStep: 0.7,
    palette: worldPalette(4), hintMoves: 0,
    places, surprises,
    worldIdx: 4, starsRequired: 0,
  }
}
