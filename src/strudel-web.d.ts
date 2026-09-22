// @strudel/web ships no types: a narrow declaration for our experiment.
// We pull the module in via dynamic import() only behind the ?music=strudel flag,
// so strict types are not needed: naming what we actually call is enough.
declare module '@strudel/web' {
  export function initStrudel(options?: Record<string, unknown>): Promise<unknown>
  export function initAudio(options?: Record<string, unknown>): Promise<void>
  export function setAudioContext(ctx: AudioContext): AudioContext
  export function getAudioContext(): AudioContext
  export function getSuperdoughAudioController(): {
    output: { destinationGain: GainNode | null; channelMerger: AudioNode | null }
  }
  export function evaluate(code: string): Promise<unknown>
  export function hush(): void
  const _default: unknown
  export default _default
}
