/* ==========================================================================
   src/pwa/pwaInstall.js — Estado compartido de la instalación PWA
   --------------------------------------------------------------------------
   `beforeinstallprompt` se emite UNA vez y el banner no siempre está montado
   cuando llega (p. ej. el usuario navegó al dashboard). Este mini-store
   guarda el evento y notifica a todos los componentes interesados
   (banner InstallPrompt + botón del Header) sin duplicar listeners.
   ========================================================================== */

let deferredPrompt = null
const listeners = new Set()

export function getInstallEvent() {
  return deferredPrompt
}

export function onInstallEvent(cb) {
  listeners.add(cb)
  if (deferredPrompt) cb(deferredPrompt) /* ya llegó antes de suscribirse */
  return () => listeners.delete(cb)
}

export function consumeInstallPrompt() {
  if (!deferredPrompt) return null
  const ev = deferredPrompt
  deferredPrompt = null
  return ev
}

/* index.html captura el evento nativo y llama a estos dos */
export function captureInstallEvent(e) {
  deferredPrompt = e
  listeners.forEach((cb) => cb(e))
}

export function clearInstallEvent() {
  deferredPrompt = null
  listeners.forEach((cb) => cb(null))
}
