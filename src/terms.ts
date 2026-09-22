// Terms - a one-to-one port of all 8 goal types of the old game (ru.neyvan.hm.terms,
// 2018). The texts are Andrey's own wordings from Bundle_ru.properties, not invented.
// Terms combine with AND / OR / NOT, as in the original
// (andOperation/orOperation/notOperation).
//
// Andrey: «что за прогрессия, что полный квадрат — даже мне тяжело в голове».
// So every term carries an EXPLANATION CARD: a human wording plus 2-3 examples. The
// engine shows it in the level intro on the FIRST appearance of that goal kind, and
// later on a tap on the goal line. The term tests are untouched; only `kind` and
// `card` were added.

/** goal kind - the key for "explained once" (localStorage via progress.ts) */
export type TermKind =
  | `div:${number}` | 'lastNumeral' | 'simple' | 'square'
  | 'sumDigits' | 'mulDigits' | 'arithProg' | 'geomProg'
  | 'or' | 'and' | 'not'

/** explanation card: a short title + human text with examples */
export interface TermCard {
  kind: string
  title: string
  body: string
}

export interface Term {
  test: (n: number) => boolean
  text: string
  /** goal kind - how the engine remembers what it already explained */
  kind: string
  /** the explanation for a non-mathematician: what it is + examples */
  card: TermCard
  /** what it is built from (for OR/AND/NOT) - so the parts can be explained too */
  parts?: Term[]
}

/** divisibility: each divisor has its own everyday trick, hence its own card */
const DIV_CARD: Record<number, [string, string]> = {
  2: ['Чётное', 'Чётное — это то, что делится на 2 без остатка (два поровну, ничего не осталось). Смотри последнюю цифру: 0, 2, 4, 6, 8 — чётное. 14 — да, 27 — нет.'],
  3: ['Делится на 3', 'Сложи цифры числа. Если сумма делится на 3 — и всё число делится. 27 → 2+7 = 9, да. 51 → 5+1 = 6, да. 25 → 7, нет.'],
  4: ['Делится на 4', 'Хитрость: раздели пополам, и если получилось снова чётное — значит делится на 4. 24 → 12 (чётное), да. 14 → 7 (нечётное), нет.'],
  5: ['Делится на 5', 'Делятся на 5 те, что кончаются на 0 или 5 — больше ничего проверять не надо. 20, 35, 60 — да. 22, 47 — нет.'],
  6: ['Делится на 6', 'Шесть — это два и три сразу: число должно быть чётным И делиться на 3. 24 — чётное, 2+4 = 6, да. 27 — на 3 делится, но нечётное, нет.'],
  9: ['Делится на 9', 'Как с тройкой, только сумма цифр должна делиться на 9. 72 → 7+2 = 9, да. 45 → 9, да. 38 → 11, нет.'],
}

/** divisible by {d} (Divisibility) */
export const divisibility = (d: number): Term => {
  const c = DIV_CARD[d]
  return {
    test: (n) => n % d === 0,
    text: `делится на ${d}`,
    kind: `div:${d}`,
    card: {
      kind: `div:${d}`,
      title: c ? c[0] : `Делится на ${d}`,
      body: c ? c[1]
        : `«Делится на ${d}» — значит делится нацело, без остатка: разложил по ${d} — ничего не осталось. ${d * 3} и ${d * 5} — да, ${d * 3 + 1} — нет.`,
    },
  }
}

/** ends with {digit} (LastNumeral; position: 0 = ones, 1 = tens, ...) */
export const lastNumeral = (digit: number, position = 0): Term => {
  const power = Math.pow(10, position)
  return {
    test: (n) => n >= power && Math.floor(n / power) % 10 === digit,
    text: `оканчивается на ${digit}`,
    kind: 'lastNumeral',
    card: {
      kind: 'lastNumeral',
      title: 'Последняя цифра',
      body: `Смотри ТОЛЬКО на последнюю цифру, остальные не важны — даже у огромного числа. «Кончается на ${digit}»: ${digit === 0 ? 10 : digit}, ${30 + digit}, ${140 + digit} — да; ${digit === 1 ? 32 : 21} — нет.`,
    },
  }
}

/** prime (Simple) */
export const simple = (): Term => ({
  test: (n) => {
    if (n < 2) return false
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false
    return true
  },
  text: 'простое',
  kind: 'simple',
  card: {
    kind: 'simple',
    title: 'Простое число',
    body: 'Простое — которое делится только на 1 и на само себя, больше ни на что. 7 — простое. 9 — нет, потому что 9 = 3×3. 2, 3, 5, 7, 11, 13 — простые; 1 в простые не берут.',
  },
})

/** is a perfect square (SquareNumber) */
export const squareNumber = (): Term => ({
  test: (n) => n >= 0 && Number.isInteger(Math.sqrt(n)),
  text: 'является полным квадратом',
  kind: 'square',
  card: {
    kind: 'square',
    title: 'Полный квадрат',
    body: 'Полный квадрат — это число, умноженное само на себя: 4 = 2×2, 9 = 3×3, 16 = 4×4, 25 = 5×5, 36 = 6×6. А 20 так не получить — значит мимо.',
  },
})

/** digit sum - used for the examples on the card */
const digitSum = (n: number): number => {
  let s = 0
  while (n > 0) { s += n % 10; n = Math.floor(n / 10) }
  return s
}

/** digit sum equals {ideal} (AdditionNumerals) */
export const additionNumerals = (ideal: number): Term => {
  // two "yes" examples and one "no", found by brute force so the text never lies
  // for any ideal (the endless generator uses 5..13)
  const hits: number[] = []
  for (let n = 10; n < 1000 && hits.length < 2; n++) if (digitSum(n) === ideal) hits.push(n)
  const [yes1, yes2] = [hits[0] ?? 10, hits[1] ?? 20]
  let no1 = yes1 + 1
  while (digitSum(no1) === ideal) no1++
  return {
    test: (n) => digitSum(n) === ideal,
    text: `сумма цифр равна ${ideal}`,
    kind: 'sumDigits',
    card: {
      kind: 'sumDigits',
      title: 'Сумма цифр',
      body: `Просто сложи цифры числа. «Сумма цифр = ${ideal}»: ${yes1} → ${String(yes1).split('').join('+')} = ${ideal}, да. ${yes2} → ${String(yes2).split('').join('+')} = ${ideal}, да. ${no1} → ${digitSum(no1)}, мимо.`,
    },
  }
}

/** digit product equals {ideal} (MultiplicationNumerals) */
export const multiplicationNumerals = (ideal: number): Term => ({
  test: (n) => {
    let m = 1
    while (n > 0) { m *= n % 10; n = Math.floor(n / 10) }
    return m === ideal
  },
  text: `произведение цифр равно ${ideal}`,
  kind: 'mulDigits',
  card: {
    kind: 'mulDigits',
    title: 'Произведение цифр',
    body: `Тут цифры не складываем, а ПЕРЕМНОЖАЕМ. «Произведение цифр = ${ideal}»${ideal === 24 ? ': 38 → 3×8 = 24, да. 46 → 4×6 = 24, да. 35 → 15, мимо.' : ': перемножь цифры и сравни с ' + ideal + '.'} Хитрость: если в числе есть 0 или 5 — почти всегда мимо, можно не считать.`,
  },
})

/** belongs to the arithmetic progression from {first} with step {diff} (ArithmeticProgression) */
export const arithmeticProgression = (first: number, diff: number): Term => ({
  test: (n) => n >= first && (n - first) % diff === 0,
  text: `в прогрессии: с ${first}, шаг +${diff}`,
  kind: 'arithProg',
  card: {
    kind: 'arithProg',
    title: 'Прогрессия (лесенка)',
    body: `Прогрессия — это лесенка с ровным шагом: начали с ${first} и всё время прибавляем ${diff}. Получается ${first}, ${first + diff}, ${first + diff * 2}, ${first + diff * 3}, ${first + diff * 4}…${first % diff === 0 && diff === 5 ? ' Проще всего так: подходит всё, что кончается на 0 или 5.' : ` Число из этого ряда — жми, между ступеньками (${first + 1}, ${first + diff + 1}) — мимо.`}`,
  },
})

/** belongs to the geometric progression from {first} with ratio {ratio} (GeometricProgression) */
export const geometricProgression = (first: number, ratio: number): Term => ({
  test: (n) => {
    let a = first
    while (a < n) a *= ratio
    return a === n
  },
  text: `в прогрессии: с ${first}, ×${ratio}`,
  kind: 'geomProg',
  card: {
    kind: 'geomProg',
    title: 'Прогрессия с умножением',
    body: `Эта лесенка не прибавляет, а УМНОЖАЕТ: каждая ступенька в ${ratio} раза больше прошлой. С ${first}, ×${ratio}: ${first}, ${first * ratio}, ${first * ratio * ratio}, ${first * ratio ** 3}, ${first * ratio ** 4}, ${first * ratio ** 5}… ${first * ratio ** 3 + 1} между ступенек — мимо.`,
  },
})

// --- combinators (the original and/or/notOperation) ---
export const or = (a: Term, b: Term): Term => ({
  test: (n) => a.test(n) || b.test(n),
  text: `${a.text} ИЛИ ${b.text}`,
  kind: 'or',
  parts: [a, b],
  card: {
    kind: 'or',
    title: 'ИЛИ — хватит одного',
    body: 'Тут два условия, но выполниться должно ХОТЬ ОДНО. Подошло первое — жми. Подошло второе — тоже жми. Не подошло ни одно — мимо.',
  },
})
export const and = (a: Term, b: Term): Term => ({
  test: (n) => a.test(n) && b.test(n),
  text: `${a.text} И ${b.text}`,
  kind: 'and',
  parts: [a, b],
  card: {
    kind: 'and',
    title: 'И — нужны оба',
    body: 'Тут должны сойтись ОБА условия сразу. Одно есть, второго нет — мимо. Проверяй сначала то, что считается быстрее: не сошлось — дальше можно не думать.',
  },
})
export const not = (a: Term): Term => ({
  test: (n) => !a.test(n),
  text: `НЕ выполняется: ${a.text}`,
  kind: 'not',
  parts: [a],
  card: {
    kind: 'not',
    title: 'НЕ — наоборот',
    body: 'Всё как обычно, только наизнанку: жми там, где условие НЕ выполняется. «НЕ простое» — значит составное: 9 подходит (9 = 3×3), а 7 нет.',
  },
})

/**
 * All cards of a goal, ordered "parts first, then the connective": for
 * "(ends with 6 OR 8) AND NOT divisible by 4" that is last digit -> OR ->
 * divisibility -> NOT -> AND. Duplicates by `kind` collapse.
 */
export function termCards(t: Term | undefined): TermCard[] {
  const out: TermCard[] = []
  const seen = new Set<string>()
  const walk = (x: Term) => {
    for (const p of x.parts || []) walk(p)
    if (!seen.has(x.card.kind)) { seen.add(x.card.kind); out.push(x.card) }
  }
  if (t) walk(t)
  return out
}
