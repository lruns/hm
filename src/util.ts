// Shared numeric helpers (tau, clamp, easing) - one vocabulary for the engine and fx.
// Kept apart from color.ts: color lives there, pure motion math lives here.

export const TAU = Math.PI * 2

/** clamp to 0..1 */
export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x))

/**
 * backOut (Robert Penner): overshoot the target, then settle softly - a little spring.
 * x runs 0->1, the output goes slightly past 1 and comes back. Used all over the
 * engine for arrivals (the number, stars, banner, the disc out of the tunnel).
 */
export const backOut = (x: number): number =>
  1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2)
