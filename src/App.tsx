import { useEffect, useRef, useState } from 'react'
import { HappyMath } from './engine'
import { initNative } from './native'

// Soft DOM name input over the splash, following the original game, which greeted
// the player by name: on the first launch we ask «как тебя зовут? =)», and it can be
// skipped. The name goes to localStorage, the engine listens for the 'hm-name' event
// and greets right away.

const K_NAME = 'hm2.name'
const K_ASKED = 'hm2.nameAsked'

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<HappyMath | null>(null)
  const [phase, setPhase] = useState('splash')
  const [asked, setAsked] = useState(() => {
    try { return !!localStorage.getItem(K_ASKED) } catch { return true }
  })
  const [name, setName] = useState('')

  useEffect(() => {
    const game = new HappyMath(hostRef.current!)
    gameRef.current = game
    // Google Play wrapper: fullscreen, Back -> pause, hide the splash (no-op on the web)
    void initNative(game)
    const onPhase = (e: Event) => setPhase(String((e as CustomEvent).detail))
    window.addEventListener('hm-phase', onPhase)
    return () => { window.removeEventListener('hm-phase', onPhase); game.destroy() }
  }, [])

  // Pixi only listens to window.resize (ResizePlugin), but on itch the game sits in
  // an iframe: the fullscreen button and a phone rotation change the SIZE of that
  // frame, and the window event sometimes arrives before the layout settles - the
  // canvas then keeps its old size. So we relay real host size changes
  // (ResizeObserver + visualViewport + fullscreenchange) into the same window.resize.
  // No loop: the host is fixed inset:0, the canvas size does not affect it.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let raf = 0
    const ping = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
    }
    const ro = new ResizeObserver(ping)
    ro.observe(host)
    const vv = window.visualViewport
    vv?.addEventListener('resize', ping)
    document.addEventListener('fullscreenchange', ping)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      vv?.removeEventListener('resize', ping)
      document.removeEventListener('fullscreenchange', ping)
    }
  }, [])

  const submit = (value: string) => {
    const v = value.trim().slice(0, 16)
    // The player's very first gesture is almost always a button of THIS form, not the
    // canvas. Under the autoplay policy an AudioContext only starts inside a gesture
    // handler (inside the itch iframe the policy is even stricter), so we wake the sound
    // up right here - otherwise the music stays silent until the second click and the
    // game feels soundless.
    try { (gameRef.current as unknown as { sound?: { unlock?: () => void } })?.sound?.unlock?.() } catch { /* ok */ }
    try {
      localStorage.setItem(K_ASKED, '1')
      if (v) localStorage.setItem(K_NAME, v)
    } catch { /* ok */ }
    window.dispatchEvent(new CustomEvent('hm-name', { detail: v }))
    setAsked(true)
  }

  const showAsk = !asked && phase === 'splash'

  // the engine appends the canvas into host itself, so the form lives OUTSIDE the host
  // div - React must not diff a container that holds a foreign DOM node
  return (
    <>
      <div ref={hostRef} style={{ position: 'fixed', inset: 0 }} />
      {showAsk && (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(name) }}
          style={{
            // centered over the splash: at 390x844 a bottom placement covered the gate
            // and the "number of the day"; a modal is honest, it is a one-time question
            position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
            display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center',
            maxWidth: 'min(90vw, 340px)', boxSizing: 'border-box',
            background: 'rgba(10, 13, 34, 0.88)', border: '1px solid rgba(56, 192, 255, 0.45)',
            borderRadius: 24, padding: '12px 16px',
            fontFamily: 'Nunito, sans-serif', zIndex: 10,
            boxShadow: '0 6px 30px rgba(0, 0, 0, 0.45)',
          }}
        >
          <label htmlFor="hm-name" style={{ flexBasis: '100%', textAlign: 'center', color: '#cdd6f0', fontWeight: 800, fontSize: 15 }}>
            как тебя зовут? =)
          </label>
          <input
            id="hm-name"
            value={name}
            maxLength={16}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            style={{
              flex: '1 1 120px', minWidth: 0, maxWidth: 150,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(154, 223, 255, 0.35)', borderRadius: 16,
              padding: '7px 12px', color: '#ffffff', fontFamily: 'inherit',
              fontWeight: 800, fontSize: 16, outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              background: 'rgba(56, 192, 255, 0.25)', border: '1px solid rgba(56, 192, 255, 0.7)',
              borderRadius: 16, padding: '7px 16px', color: '#ffffff', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 800, fontSize: 15,
            }}
          >
            готово
          </button>
          <button
            type="button"
            onClick={() => submit('')}
            style={{
              background: 'none', border: 'none', color: '#8890a8', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 800, fontSize: 14, padding: '7px 8px',
            }}
          >
            потом
          </button>
        </form>
      )}
    </>
  )
}
