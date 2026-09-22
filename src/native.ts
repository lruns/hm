/**
 * Capacitor native glue. In a browser all of this is a silent no-op:
 * Capacitor.isNativePlatform() === false and we just return.
 *
 * Three reasons this module exists:
 *  1) fullscreen - hide the status bar and the nav bar, dark system bar style
 *  2) hardware Back -> pause/menu (instead of dropping straight out of the game)
 *  3) hide the splash BY HAND once the engine has drawn its first frame (otherwise
 *     black flashes between the launch image and the game)
 *
 * Plugin imports are dynamic: on the web their code stays out of the startup chunk.
 */

import { Capacitor } from '@capacitor/core'
import type { HappyMath } from './engine'

export async function initNative(game: HappyMath): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  try {
    const { SystemBars, SystemBarsStyle } = await import('@capacitor/core')
    // DARK = light icons on a dark background - matches our #0a0a18
    await SystemBars.setStyle({ style: SystemBarsStyle.Dark })
    // fullscreen game: the bars slide away, a swipe from the edge brings them back
    await SystemBars.hide()
  } catch (e) {
    console.warn('[native] системные полосы не настроились', e)
  }

  try {
    const { App } = await import('@capacitor/app')

    // Back: pause open -> close it, game running -> pause, otherwise minimize the app
    App.addListener('backButton', () => {
      if (!game.handleBack()) App.minimizeApp()
    })

    // went to background (call, home) -> freeze so the music does not play in a pocket
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) game.suspendForBackground()
    })
  } catch (e) {
    console.warn('[native] слушатели App не встали', e)
  }

  // splash: wait two frames (enough for the engine to draw) and fade it out
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    await SplashScreen.hide({ fadeOutDuration: 350 })
  } catch (e) {
    console.warn('[native] сплэш не спрятался', e)
  }
}
