import '@fontsource/nunito/800.css'
import '@fontsource/nunito/900.css'
// the latin css subsets carry no Cyrillic: without these the Russian text falls back to serif
import '@fontsource/nunito/cyrillic-800.css'
import '@fontsource/nunito/cyrillic-900.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
