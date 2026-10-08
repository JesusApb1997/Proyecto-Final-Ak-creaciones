import { useEffect, useState } from 'react'
import { onInstallEvent, consumeInstallPrompt, clearInstallEvent } from '../pwa/pwaInstall.js'

/* ==========================================================================
   src/components/InstallPrompt.jsx — Aviso de instalación PWA
   --------------------------------------------------------------------------
   - Banner flotante discreto: aparece cuando el navegador emite
     beforeinstallprompt y SE AUTOCIERRA A LOS 5 SEGUNDOS (no insiste).
   - La instalación sigue disponible siempre desde el botón del header
     (InstallButton), para que el usuario elija cuándo.
   - "No volver a mostrar" oculta el banner para siempre (el botón del header
     sigue disponible).
   - Toast de agradecimiento al instalar (evento appinstalled).
   ========================================================================== */

const LS_NEVER = 'ak-pwa-install-never'
const LS_SNOOZE = 'ak-pwa-install-snooze'
const BANNER_TTL_MS = 5000 /* el aviso dura 5 segundos en pantalla */

const yaInstalada = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true /* iOS Safari */

export default function InstallPrompt() {
  const [evento, setEvento] = useState(null)
  const [visible, setVisible] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const [toastInstalada, setToastInstalada] = useState(false)
  const [toastSaliendo, setToastSaliendo] = useState(false)

  /* ===== Suscripción al evento compartido ===== */
  useEffect(() => {
    if (yaInstalada()) return undefined

    /* ¿Descartado para siempre o en snooze? */
    const nunca = localStorage.getItem(LS_NEVER) === '1'
    const snoozeHasta = Number(localStorage.getItem(LS_SNOOZE) || 0)
    if (nunca || Date.now() < snoozeHasta) return undefined

    return onInstallEvent((ev) => {
      setEvento(ev)
      if (!ev) setVisible(false)
    })
  }, [])

  /* Entra suave tras montar y SE AUTOCIERRA a los 5s */
  useEffect(() => {
    if (!evento) return undefined
    const tIn = setTimeout(() => setVisible(true), 1200)
    const tOut = setTimeout(() => {
      setSaliendo(true)
      setTimeout(() => setVisible(false), 350)
    }, 1200 + BANNER_TTL_MS)
    return () => {
      clearTimeout(tIn)
      clearTimeout(tOut)
    }
  }, [evento])

  /* ===== Agradecimiento al instalar (evento appinstalled) ===== */
  useEffect(() => {
    if (yaInstalada()) return undefined
    const onInstalled = () => {
      if (window.__akInstalledHandled) return /* evita toast duplicado */
      window.__akInstalledHandled = true
      clearInstallEvent()
      setVisible(false)
      setEvento(null)
      localStorage.setItem(LS_NEVER, '1')
      setToastInstalada(true)
      setToastSaliendo(false)
      setTimeout(() => setToastSaliendo(true), 4700)
      setTimeout(() => setToastInstalada(false), 5200)
    }
    window.addEventListener('ak-app-installed', onInstalled)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('ak-app-installed', onInstalled)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  /* ===== Toast de agradecimiento ===== */
  if (toastInstalada) {
    return (
      <div className={`ak-install-toast${toastSaliendo ? ' leaving' : ''}`} role="status" aria-live="polite">
        <img src="/pwa/icon-192.png" alt="" className="ak-install-toast-icon" />
        <div className="ak-install-toast-txt">
          <strong>
            ¡Gracias por instalar <em>AK Creaciones</em>! 💗
          </strong>
          <span>Ya nos tienes en tu pantalla — con acceso directo, sin conexión y como una app más de tu teléfono.</span>
        </div>
      </div>
    )
  }

  if (!evento || !visible) return null

  const descartar = (paraSiempre) => {
    setSaliendo(true)
    if (paraSiempre) localStorage.setItem(LS_NEVER, '1')
    else localStorage.setItem(LS_SNOOZE, String(Date.now() + 7 * 24 * 60 * 60 * 1000))
    setTimeout(() => setVisible(false), 320)
  }

  const instalar = async () => {
    const ev = consumeInstallPrompt()
    if (!ev) return
    ev.prompt()
    await ev.userChoice.catch(() => {})
    /* appinstalled dispara el toast; si el navegador no lo emite, el banner
       se retira igual y la instalación queda disponible en el botón del header */
    descartar(false)
  }

  return (
    <div className={`ak-install${saliendo ? ' bye' : ''}`} role="dialog" aria-label="Instalar AK Creaciones">
      <img src="/pwa/icon-192.png" alt="" className="ak-install-icon" />
      <div className="ak-install-txt">
        <strong>AK Creaciones</strong>
        <span>Instala la app y lleva la tienda contigo, también sin conexión</span>
      </div>
      <div className="ak-install-actions">
        <button type="button" className="ak-install-yes" onClick={instalar}>
          <i className="bi bi-download"></i> Instalar
        </button>
      </div>
      <button type="button" className="ak-install-never" onClick={() => descartar(true)} aria-label="No volver a mostrar">
        No volver a mostrar
      </button>
      <button type="button" className="ak-install-x" onClick={() => descartar(false)} aria-label="Cerrar">
        <i className="bi bi-x-lg"></i>
      </button>
    </div>
  )
}
