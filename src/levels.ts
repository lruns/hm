// Level model + the CAMPAIGN: 17 levels, 4 worlds with character + the finale.
// Assembled from ДИЗАЙН-кампании.md (level literals, difficulty curve, world gates by
// stars). The goals are terms from terms.ts (a port of his 2018 library).
// The surprises are all 9 classes of the old game.
//
// Rhythm of the original: timeStep (seconds per number) + timeAfterStep (the REST PAUSE
// after every move) - that cushion is why the original felt softer. Andrey: «скорость
// большеватая даже для меня», so we keep the tempo ceiling at ~1.35, no lower.

import {
  Term, divisibility, lastNumeral, additionNumerals, multiplicationNumerals,
  simple, squareNumber, arithmeticProgression, geometricProgression, or, and, not,
} from './terms'

/** surprise kinds - all 9 classes of the original (surprises/ of the old game) */
export type SurpriseKind =
  | 'life'       // + a life (his SUPER_LIFE, a heart)
  | 'score'      // + points (his SUPER_SCORE, a gift)
  | 'lifeTrap'   // - a life (his DEBUF_LIFE, a broken heart)
  | 'scoreTrap'  // - points (his DEBUF_SCORE)
  | 'slow'       // time slows down (his ChangeSpeedTime < 1, a good one)
  | 'fast'       // time speeds up (his ChangeSpeedTime > 1, a nasty one)
  | 'help'       // hints for 3 moves (his HelpSurprise)
  | 'rotation'   // the circle rotates (his Rotation, a nasty one)
  | 'explosion'  // an explosion of numbers - moves are skipped (his Explosion, a celebration)
  | 'freeze'     // time FULLY frozen + fullscreen ice (his FullFreezing, a kind breather)
  | 'transfer'   // the disc slides around the screen (his Transference, a nasty one)
  | 'warp'       // disc distortion - the shape wobbles (his WarpSurprise, a nasty one)
  | 'colorMusic' // color music: the screen shimmers softly through the spectrum (his ScreenEffects t1, a nasty one)
  | 'inversion'  // fullscreen color inversion, ~3s (his ScreenEffects t2, the canonical debuff)

export interface LevelDef {
  /** the goal: tap when true */
  test: (n: number) => boolean
  /** the goal text, short and human */
  conditionText: string
  firstNumber: number
  deltaNumbers: number
  countOfMoves: number
  /** seconds per number */
  timeStep: number
  /** speedup: how many times timeStep shrinks by the end of the level */
  endSpeedup: number
  /** REST PAUSE after a move, seconds - the rhythm cushion of the original (it was softer!) */
  timeAfterStep: number
  /** palette of the living background [deep, mid, accent] */
  palette: [string, string, string]
  /** tap / do not tap hints on the first moves */
  hintMoves: number
  /** on which moves a surprise appears instead of a number (his listOfPlacesSurp) */
  places?: number[]
  /** which ones - parallel to places */
  surprises?: SurpriseKind[]
  /** world 0..3, 4 = the finale (background palette, character, intro caption) */
  worldIdx: number
  /** gate: how many banked stars are needed to unlock the level */
  starsRequired: number
  /** countdown: the numbers GO DOWN (deltaNumbers < 0), the ring spins backwards */
  countdown?: boolean
  /** a prepared list of numbers instead of first+delta (the chaos of world 4) */
  fixedNumbers?: number[]
  /** surprises may arrive OUTSIDE the places schedule (as in the original 4.x) */
  outOfOrder?: boolean
  /**
   * The term itself, not only its test: from it the engine takes the EXPLANATION CARDS
   * (terms.ts `termCards`) and shows them in the intro on the first appearance of a
   * goal kind. Optional: the endless mode and the number of the day build their levels
   * on the fly, without cards.
   */
  term?: Term
}

// ! WORLD NAMES are proposals from the design doc, Andrey has NOT approved them yet.
// Renaming is one line here: the names live nowhere else.
export const WORLD_NAMES = ['Тёплый Счёт', 'Иней', 'Вихрь', 'Разлом', 'Ясность']
export const WORLD_COUNT = WORLD_NAMES.length

// ═══ WORLD PALETTES ════════════════════════════════════════════════════════
// Andrey's verdict on the first attempt: «вырви глаз» - and the reference to aim at is
// Tetris Effect. The rules by which all five [deep, mid, accent] triples are built:
//  1. DEEP - dark but COLORED and clean: blue-violet / turquoise gamut, lightness
//     ~7-12%, high saturation. No brown haze: world 1 used to be '#2a1206' (coffee
//     sludge), world 3 '#0e2418' (a swamp).
//  2. MID - the same hue family as the deep one (analogous harmony), lightness ~40-50%:
//     this is the "horizon" of the gradient and the color of the nebulae.
//  3. ACCENT - glowing, lightness 70-85%: in warm worlds it is COMPLEMENTARY to the
//     deep one (indigo <-> gold), in cold ones it continues the gamut (analogy).
//     The accent drives particles, threads, rings and sparks - it is the light of the world.
// Mud check: every color has a clearly dominant channel, none sits in the R~G~B (gray)
// zone and none is R>G>B with low lightness (brown).
//
// Andrey on an earlier version: «миры 2,3,4 — офигенные, мир 1 — гавняненько». World 1
// was indigo + ROSE + gold - three DIFFERENT hue families. The mid tone drives both the
// background (bottom of the gradient) and the gem body (wall = mix(deep, mid, .62)), so
// the world read as a pink pearl with a golden ring on a dusty pink background instead
// of a dawn. Worlds 2/3/4 (his reference) are built differently: mid and accent are ONE
// family, the deep one holds the night. World 1 is built the same way now:
//   deep   - the night before dawn (indigo, top of the gradient);
//   mid    - the pre-dawn sky (bottom of the gradient = horizon, the gem body);
//   accent - the golden light of dawn (rings, particles, sparks, rim, glows).
//
// WHY THE MID TONE IS NOT AMBER (checked with screenshots, three variants): the mid tone
// goes not only into the background but into the GLASS - the gem body
// `mix(deep, mid, .62)` and the menu glass `lerp(deep, mid, .46)`. Any orange-amber mid
// gives BROWN in a dark mix (dark orange IS brown): '#f0a441' and '#c17915' produced
// exactly the coffee sludge Andrey forbade - the menu Play button turned brown.
//
// Andrey's decision for world 1: «фон ТЁМНО-СИНИЙ рассветный (не тёплый), ВСЁ тепло в
// свете — золотой самоцвет-солнце, янтарные огоньки (синий+золото комплементарно,
// бурость невозможна)».
// What that means in engine terms: the mid tone stays BLUE (the pre-dawn sky), and all
// the warmth is carried by the ACCENT - gold goes into the gem rim, the rings, the
// caustics, the life sparks, the particles, the glows. Blue 228 degrees and gold 43 are
// almost exact complements, their mix cannot turn brown (the amber-MID experiment gave
// coffee sludge precisely because the mid itself went brown). The gem reads as a sun not
// by its body but by its LIGHT: a blue lens in a golden rim with a golden inner glow -
// a dawn sun in a blue sky.
const P_DAWN: [string, string, string] = ['#0d1038', '#2f4bb0', '#ffc247']

// ── ARCHIVE OF WORLD 1 PALETTES, kept for future stages (Andrey: do NOT delete) ──
// Both variants work and differ only in the character of the world; to bring one back,
// uncomment its line and use it instead of P_DAWN above.
//   "rose": indigo-violet + rose + gold. The world read as a pink pearl - a pink MID
//   made the glass pink as well.
// const P_DAWN_ROSE: [string, string, string] = ['#1b1147', '#c4467e', '#ffc247']
//   "wine": indigo night + pre-dawn wine red + the gold of dawn. The gem is a garnet
//   with a golden rim; warm, but not dawn-blue.
// const P_DAWN_WINE: [string, string, string] = ['#140f3c', '#a83048', '#ffd166']
const P_FROST: [string, string, string] = ['#071a3d', '#2b7fc4', '#a8ecff']
const P_WHIRL: [string, string, string] = ['#052a33', '#12908a', '#5df2c8']
const P_RIFT: [string, string, string] = ['#220641', '#9b2fbe', '#ff6fd8']
const P_CLARITY: [string, string, string] = ['#0e1436', '#5f6ee6', '#ffeec2']

// the whole term goes into the level: the engine takes the explanation cards from it
const cond = (t: Term) => ({ test: t.test, conditionText: t.text, term: t })

// ═══════════════════════════════════════════════════════════════════════════
// DIFFICULTY LAYOUT. From a family playtest on the phone, Andrey: «сложные концепции в
// самые последние этапы», «порой скорость безумная, мама страдает и плачет».
//
// PLACEMENT RULE (his words + the cost of each goal, measured in thinking time):
//   worlds 1-2 - only instantly readable goals: even, "ends with", "divisible by";
//   world 3    - properties of a number: prime, perfect square, NOT, digit sum;
//   world 4    - the hardest to UNDERSTAND: both progressions and the digit product;
//   the finale - synthesis (a three-part tree), and this is where AND is introduced.
// Side benefit: on exactly three levels (2.1, 2.3, 4.2) there is NO new concept - those
// are the slots where the novelty is MECHANICAL (help / the first lifeTrap / falling
// numbers), so a new mechanism never lands together with new mathematics.
//
// TIME RULE (his two numbers: a window of at least 1.6s for an instant goal and at
// least 2.5s for an expensive one). Both are the same rule:
//     the window on the LAST move >= 1.2s (reaction) + the cost of the goal + slack,
// where the slack is >= 0.35s. At a cost of 0.05 that gives 1.6s, at 0.9 it gives 2.5s.
// timeStep = the final window x endSpeedup, so expensive levels run at a HIGHER tempo
// than early ones - and that is not a mistake: the measure of difficulty is the SLACK
// (it falls 1.10 -> 0.38 across the campaign), not the timeStep number. A wide window
// costs almost no time to someone who ANSWERS: a move ends with the answer, not with
// the bell.
// ═══════════════════════════════════════════════════════════════════════════
export const LEVELS: LevelDef[] = [

  // ═══ WORLD 1 - «Тёплый Счёт» (worldIdx 0): dawn, the world that teaches ═══
  // Recognition only: look at the digit and answer. No mental arithmetic at all.
  { // 1.1 - rules + divisibility. Clean, no surprises (the original e1l1 is clean too)
    ...cond(divisibility(2)), conditionText: 'число ЧЁТНОЕ (делится на 2)',
    firstNumber: 2, deltaNumbers: 1, countOfMoves: 10,
    // cost 0.05 * slack 1.10 * final window 2.35
    timeStep: 2.70, endSpeedup: 1.15, timeAfterStep: 1.20,
    palette: P_DAWN, hintMoves: 4,
    worldIdx: 0, starsRequired: 0,
  },
  { // 1.2 - NEW: gifts (a heart + a present) and the lastNumeral term.
    // "Divisible by 3" would cost 0.55 here - mental arithmetic on the second level of
    // the game - so it lives on the boss of world 2 instead
    ...cond(lastNumeral(5)), conditionText: 'кончается на 5',
    firstNumber: 5, deltaNumbers: 5, countOfMoves: 12,   // 5,10..50 -> yes on every second one
    // cost 0.10 * slack 0.95 * final window 2.25
    timeStep: 2.66, endSpeedup: 1.18, timeAfterStep: 1.15,
    palette: P_DAWN, hintMoves: 2,
    places: [4, 9], surprises: ['life', 'score'],
    worldIdx: 0, starsRequired: 0,
  },
  { // 1.3 - NEW: divisibility read from the last digit ("by 5 = ends with 0 or 5").
    // This is the bridge from recognizing a digit to divisibility, and the card
    // explains it exactly that way
    ...cond(divisibility(5)), conditionText: 'делится на 5',
    firstNumber: 0, deltaNumbers: 0, countOfMoves: 12,
    // a list, not a series: in a series the "yes" would fall on every other number
    fixedNumbers: [10, 12, 15, 17, 18, 20, 25, 26, 30, 33], // yes: 5/10 = 50%
    // cost 0.15 * slack 0.85 * final window 2.20
    timeStep: 2.64, endSpeedup: 1.20, timeAfterStep: 1.10,
    palette: P_DAWN, hintMoves: 1,
    places: [5, 10], surprises: ['score', 'life'],
    worldIdx: 0, starsRequired: 0,
  },
  { // 1.4 - NEW: boolean OR (the world boss). Original e1l3: LastNumeral(3) OR (5).
    // OR stays here DELIBERATELY: it is not two different concepts stitched together
    // but one ("the last digit") with a list, cost 0.20s - instant. The real stitches
    // (AND, NOT, a tree) live on 3.3 and in the finale
    ...cond(or(lastNumeral(3), lastNumeral(5))),
    conditionText: 'кончается на 3 ИЛИ 5',
    firstNumber: 1, deltaNumbers: 4, countOfMoves: 14,   // 1,5,9..45 -> yes: 5,13,25,33,45
    // cost 0.20 * slack 0.75 * final window 2.15
    timeStep: 2.58, endSpeedup: 1.20, timeAfterStep: 1.10,
    palette: P_DAWN, hintMoves: 0,
    places: [5, 10], surprises: ['score', 'life'],
    worldIdx: 0, starsRequired: 0,
  },

  // ═══ WORLD 2 - «Иней» (worldIdx 1): cold and control, it freezes time itself ══
  // No new concepts either, but the divisibilities now need counting (by 4 and by 3).
  { // 2.1 - NEW: help (hints). The breather of the first level of a world.
    // The novelty here is MECHANICAL (the hint surprise), so the goal is deliberately
    // a familiar one
    ...cond(lastNumeral(6)), conditionText: 'кончается на 6',
    firstNumber: 0, deltaNumbers: 0, countOfMoves: 14,
    fixedNumbers: [6, 16, 19, 26, 30, 36, 41, 46, 56, 60, 66, 73], // yes: 7/12 = 58%
    // cost 0.10 * slack 0.85 * final window 2.15
    timeStep: 2.58, endSpeedup: 1.20, timeAfterStep: 1.05,
    palette: P_FROST, hintMoves: 1,
    places: [4, 9], surprises: ['help', 'life'],
    worldIdx: 1, starsRequired: 6,     // <- GATE OF WORLD 2
  },
  { // 2.2 - NEW: divisibility by 4 + slow (the ice slowdown is a good surprise).
    // The perfect square used to sit here; Andrey named it directly («что полный
    // квадрат — даже мне тяжело») and it moved to world 3. The card for divisibility
    // by 4 gives the everyday trick "halve it" 
    ...cond(divisibility(4)), conditionText: 'делится на 4',
    firstNumber: 0, deltaNumbers: 0, countOfMoves: 16,
    fixedNumbers: [4, 6, 8, 11, 12, 15, 16, 20, 22, 24, 25, 28, 30, 32], // yes: 8/14 = 57%
    // cost 0.50 * slack 0.72 * final window 2.42
    timeStep: 2.95, endSpeedup: 1.22, timeAfterStep: 1.00,
    palette: P_FROST, hintMoves: 0,
    places: [6, 12], surprises: ['slow', 'score'],
    worldIdx: 1, starsRequired: 6,
  },
  { // 2.3 - NEW: freeze (fullscreen ICE) + lifeTrap (the FIRST BITE of the game).
    // The goal is deliberately cheap (the same OR on other digits): on this level the
    // player must notice that surprises can be EVIL, not do arithmetic
    ...cond(or(lastNumeral(2), lastNumeral(8))),
    conditionText: 'кончается на 2 ИЛИ 8',
    firstNumber: 0, deltaNumbers: 0, countOfMoves: 16,
    fixedNumbers: [3, 8, 12, 15, 18, 20, 22, 27, 30, 32, 38, 41, 45], // yes: 6/13 = 46%
    // cost 0.20 * slack 0.66 * final window 2.06
    timeStep: 2.58, endSpeedup: 1.25, timeAfterStep: 0.95,
    palette: P_FROST, hintMoves: 0,
    places: [5, 8, 12], surprises: ['freeze', 'score', 'lifeTrap'],
    worldIdx: 1, starsRequired: 6,
  },
  { // 2.4 - BOSS of world 2: the first real mental arithmetic - the digit sum for 3.
    // It used to be "EVEN AND digit sum = 6" - a boolean stitch plus the digit sum,
    // two heavy concepts at once on the eighth level. AND moved to the finale, the
    // digit sum to world 3.
    // ! A correction to the older difficulty model: it counted 2.4 as cheap because
    // "odd numbers are rejected instantly" - but the stream 6,12,...,108 contains NO
    // odd numbers at all, so that discount never applied. Hence «мама плачет» on the
    // eighth level while the table showed formally zero deaths
    ...cond(divisibility(3)), conditionText: 'делится на 3',
    firstNumber: 0, deltaNumbers: 0, countOfMoves: 18,
    fixedNumbers: [6, 9, 11, 14, 15, 18, 20, 24, 25, 27, 31, 33, 36, 40, 42], // yes: 9/15 = 60%
    // cost 0.55 * slack 0.60 * final window 2.35
    timeStep: 3.01, endSpeedup: 1.28, timeAfterStep: 0.90,
    palette: P_FROST, hintMoves: 0,
    places: [6, 12, 15], surprises: ['freeze', 'slow', 'lifeTrap'],
    worldIdx: 1, starsRequired: 6,
  },

  // ═══ WORLD 3 - «Вихрь» (worldIdx 2): motion knocks the aim off ═════════════
  // The world of number PROPERTIES: prime, square, NOT, digit sum. Each with a card.
  { // 3.1 - NEW: the simple term + scoreTrap. A breather (lighter than boss 2.4)
    ...cond(simple()), conditionText: 'число ПРОСТОЕ',
    firstNumber: 2, deltaNumbers: 1, countOfMoves: 18,   // 2..17 -> yes: 2,3,5,7,11,13,17
    // cost 0.35 * slack 0.70 * final window 2.25
    timeStep: 2.81, endSpeedup: 1.25, timeAfterStep: 0.85,
    palette: P_WHIRL, hintMoves: 1,
    places: [4, 11], surprises: ['scoreTrap', 'life'],
    worldIdx: 2, starsRequired: 15,    // <- GATE OF WORLD 3
  },
  { // 3.2 - NEW: the squareNumber term + rotation.
    // The square came here from world 2 (his words: «даже мне тяжело»). The list is
    // 18 numbers long for this slot; the "yes" are scattered without a period
    ...cond(squareNumber()), conditionText: 'полный квадрат',
    firstNumber: 0, deltaNumbers: 0, countOfMoves: 20,
    fixedNumbers: [4, 9, 12, 16, 20, 25, 28, 36, 40, 44, 49, 56, 60, 64, 72, 81, 90, 100], // yes: 9/18 = 50%
    // cost 0.45 * slack 0.58 * final window 2.23
    timeStep: 2.68, endSpeedup: 1.20, timeAfterStep: 0.80,
    palette: P_WHIRL, hintMoves: 0,
    places: [6, 13], surprises: ['rotation', 'score'],
    worldIdx: 2, starsRequired: 15,
  },
  { // 3.3 - NEW: boolean NOT + transfer/fast. Original e2l3: NOT prime.
    // NOT comes right AFTER "prime": the negation is explained on a property just
    // learned, not on a new one
    ...cond(not(simple())), conditionText: 'число СОСТАВНОЕ (НЕ простое)',
    firstNumber: 2, deltaNumbers: 1, countOfMoves: 20,   // 2..18 -> yes: 10/17 = 59%
    // cost 0.45 * slack 0.52 * final window 2.17
    timeStep: 2.60, endSpeedup: 1.20, timeAfterStep: 0.75,
    palette: P_WHIRL, hintMoves: 0,
    places: [4, 10, 16], surprises: ['fast', 'transfer', 'score'],
    worldIdx: 2, starsRequired: 15,
  },
  { // 3.4 - BOSS of world 3: the digit sum + warp.
    // The numbers are prepared: there are few "yes" numbers with sum 7
    // (7,16,25,34,43,52,61,70) and in an even series they fall on every other move -
    // the list breaks that beat
    ...cond(additionNumerals(7)), conditionText: 'сумма цифр равна 7',
    firstNumber: 0, deltaNumbers: 0, countOfMoves: 22,
    fixedNumbers: [7, 12, 16, 19, 21, 25, 30, 34, 38, 40, 43, 45, 52, 58, 61, 64, 70, 77, 85], // yes: 8/19 = 42%
    // cost 0.60 * slack 0.48 * final window 2.28
    timeStep: 2.74, endSpeedup: 1.20, timeAfterStep: 0.70,
    palette: P_WHIRL, hintMoves: 0,
    places: [7, 13, 19], surprises: ['warp', 'rotation', 'score'],
    worldIdx: 2, starsRequired: 15,
  },

  // ═══ WORLD 4 - «Разлом» (worldIdx 3): chaos of the screen and of the numbers ══
  // The world of the heaviest CONCEPTS: both progressions and the digit product.
  { // 4.1 - NEW: explosion (a joyful one!) + the geometricProgression term. A breather.
    // A plain 1..19 series gave 5/19 = 26% "yes", all of them bunched at the start
    // (the second half was a dry skip). The numbers are prepared instead: the powers
    // of two are scattered across the level and the growth is kept. Now 9/19 = 47%,
    // 5/4 between the halves
    ...cond(geometricProgression(1, 2)),
    conditionText: 'в прогрессии: с 1, ×2',
    firstNumber: 1, deltaNumbers: 1, countOfMoves: 22,
    fixedNumbers: [1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32, 40, 50, 64, 90, 128, 150, 256, 300],
    // cost 0.60 * slack 0.58 * final window 2.38
    timeStep: 2.86, endSpeedup: 1.20, timeAfterStep: 0.60,
    palette: P_RIFT, hintMoves: 1,
    places: [3, 8, 15], surprises: ['score', 'explosion', 'life'],
    // The gate of world 4 used to be 24★ while an honest newcomer arrived with ~23★
    // (measured), so it never opened at all. 20★ now
    worldIdx: 3, starsRequired: 20,    // <- GATE OF WORLD 4
  },
  { // 4.2 - NEW: countdown (the numbers FALL from 284) + colorMusic. Original e3l3.
    // The goal is kept familiar ("divisible by 3" from world 2) because the novelty
    // here is MECHANICAL - falling numbers. But the numbers are THREE digits long, and
    // the digit sum of a three-digit number costs 0.85s: this is the most expensive
    // level of the game in time, with a final window of 2.51s
    ...cond(divisibility(3)), conditionText: 'делится на 3 · числа падают вниз',
    firstNumber: 284, deltaNumbers: -7, countOfMoves: 24, // 284,277..144 -> yes: 7/21 = 33%
    // cost 0.85 * slack 0.46 * final window 2.51
    timeStep: 3.01, endSpeedup: 1.20, timeAfterStep: 0.55,
    palette: P_RIFT, hintMoves: 0,
    countdown: true,
    places: [3, 10, 18], surprises: ['help', 'colorMusic', 'life'],
    worldIdx: 3, starsRequired: 20,   // gate of world 4 (used to be 24★)
  },
  { // 4.3 - NEW: the arithmeticProgression term + fixedNumbers chaos + inversion.
    // The progression came from world 3: Andrey called it heavy outright, so its place
    // is in the last stages. To COMPUTE it is cheap though (step +5 -> "yes" = last
    // digit 0 or 5, 0.15s); the hard part is UNDERSTANDING it - which is exactly why it
    // comes with an explanation card and stands before the boss: the concept is new
    // while the hands rest.
    // The list (10/19 = 53%, no period) is extended to 21 numbers for this slot
    ...cond(arithmeticProgression(5, 5)),
    conditionText: 'член прогрессии: с 5, шаг +5',
    firstNumber: 0, deltaNumbers: 0, countOfMoves: 24,
    fixedNumbers: [5, 7, 13, 15, 20, 22, 25, 30, 34, 38, 40, 43, 45, 50, 53, 56, 60, 63, 70, 74, 80], // yes: 11/21 = 52%
    // cost 0.15 * slack 0.42 * final window 1.77
    timeStep: 2.12, endSpeedup: 1.20, timeAfterStep: 0.50,
    palette: P_RIFT, hintMoves: 0,
    places: [5, 12, 19], surprises: ['inversion', 'rotation', 'inversion'],
    worldIdx: 3, starsRequired: 20,   // gate of world 4 (used to be 24★)
  },
  { // 4.4 - BOSS of world 4: the digit product + outOfOrder. Original e4l4.
    // The numbers are two-digit: three-digit ones killed 86% of the runs.
    // THE OLD THREE-DIGIT LIST (it can be restored as one line, but then a "yes" costs
    // 1.50s and the final window must be ~3.1s, i.e. timeStep ~3.7):
    // [64,12,146,38,55,83,24,138,46,72,183,88,29,346,17,238,231,46,90,634,38,29,64,146,431,183]
    ...cond(multiplicationNumerals(24)), conditionText: 'произведение цифр = 24',
    firstNumber: 0, deltaNumbers: 0, countOfMoves: 26,
    fixedNumbers: [64, 12, 38, 55, 46, 24, 83, 88, 29, 46, 72, 38, 64, 17, 83, 46, 90, 34, 38, 64, 44, 26],
    // cost 0.90 * slack 0.40 * final window 2.50 (Andrey's rule "an expensive goal
    // needs at least 2.5s" asked for more than the model, so the larger value was taken)
    timeStep: 3.00, endSpeedup: 1.20, timeAfterStep: 0.50,
    palette: P_RIFT, hintMoves: 0,
    outOfOrder: true,
    places: [4, 9, 14, 20], surprises: ['freeze', 'warp', 'inversion', 'explosion'],
    worldIdx: 3, starsRequired: 20,   // gate of world 4 (used to be 24★)
  },

  // ═══ FINALE - «Ясность» (worldIdx 4): synthesis, everything at once but sparse ══
  { // 17 - SYNTHESIS: the three-part tree (A|B)&!C + countdown + outOfOrder. Original e3l2.
    // The third branch used to be "NOT divisible by 16" and killed 90% of the runs. The
    // tree was not to blame, the cost of that branch was: checking divisibility by 16 in
    // your head takes ~1.3s on top of the reaction, while the final window was 0.96s.
    // And /16 fired on exactly ONE of the ten candidate numbers (256) - the deepest
    // boolean tree of the game checked a single trap for the whole level.
    // "NOT divisible by 4" is a check of the last two digits (~0.5s) and it works on
    // FIVE candidates out of ten (256, 248, 236, 228, 216): the tree finally lives
    // through all three branches and the capstone becomes beatable.
    // This is also where AND appears for the FIRST time - the most stitching connective
    // is given to the last stage, as Andrey asked. The player knows OR from 1.4 and NOT
    // from 3.3, so exactly one new card pops up in the intro of the finale
    ...cond(and(or(lastNumeral(6), lastNumeral(8)), not(divisibility(4)))),
    conditionText: '(кончается на 6 ИЛИ 8) И НЕ делится на 4',
    firstNumber: 258, deltaNumbers: -2, countOfMoves: 30, // falling: 258,256..210
    // cost of a "yes" 0.62 * slack 0.38 * final window 2.20
    timeStep: 2.64, endSpeedup: 1.20, timeAfterStep: 0.40,
    palette: P_CLARITY, hintMoves: 0,
    countdown: true, outOfOrder: true,
    places: [5, 10, 15, 20, 25],
    surprises: ['freeze', 'rotation', 'colorMusic', 'warp', 'explosion'],
    // The gate of the finale used to be 34★ while an honest newcomer banked ~27★:
    // seven stars short, i.e. it demanded 3★ replays of exactly the levels where he had
    // been losing lives. 28★ now - with the current balance a run banks 28.7★
    worldIdx: 4, starsRequired: 28,    // <- GATE OF THE FINALE
  },
]

/** index of the first level of world w (for the intro caption and the gates) */
export function worldFirstLevelIdx(w: number): number {
  const i = LEVELS.findIndex((l) => l.worldIdx === w)
  return i < 0 ? 0 : i
}

/** star threshold of the gate of world w (= starsRequired of its first level) */
export function worldGateStars(w: number): number {
  return LEVELS[worldFirstLevelIdx(w)].starsRequired
}

/** palette of world w (the palette of its first level) - for the gate circles on the splash */
export function worldPalette(w: number): [string, string, string] {
  return LEVELS[worldFirstLevelIdx(w)].palette
}

export const START_LIVES = 5
export const MAX_LIVES = 7
export const POINTS_PER_LIFE = 1000
