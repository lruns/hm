import type { CapacitorConfig } from '@capacitor/cli'

// Happy Math — Capacitor wrapper for Google Play.
// WARNING: appId can only be changed before the first publication in the console;
// after publishing it is nailed down forever.
const config: CapacitorConfig = {
  appId: 'ru.neyvan.hm',
  appName: 'Happy Math',
  webDir: 'dist',

  android: {
    // dark webview background: no white flash on rotation or startup
    backgroundColor: '#0a0a18',
    // Webview DevTools: needed while testing on a phone. For a release build use
    // `npm run sync:release` — it sets HM_RELEASE=1 and turns debugging off.
    webContentsDebuggingEnabled: process.env.HM_RELEASE !== '1',
    allowMixedContent: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: false, // hidden by hand, once the engine is really ready to draw
      launchFadeOutDuration: 350,
      backgroundColor: '#0a0a18',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
}

export default config
