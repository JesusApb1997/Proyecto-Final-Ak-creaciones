import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { captureInstallEvent, clearInstallEvent } from './pwa/pwaInstall.js'

/* Conecta el capturador temprano de index.html con el store compartido */
window.__akPwaCapture = captureInstallEvent
window.__akPwaClear = clearInstallEvent

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
