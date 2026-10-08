import { useEffect, useRef, useState } from 'react'
import { onInstallEvent, consumeInstallPrompt, clearInstallEvent } from '../pwa/pwaInstall.js'
import './installButton.css'

/* ==========================================================================
   src/components/InstallButton.jsx — Botón "Instalar app" en el header
   --------------------------------------------------------------------------
   Vive junto al carrito y permite instalar la PWA cuando el usuario quiera
   (el aviso flotante solo dura 5s). Muestra un breve popover con los
   beneficios de instalar. Se oculta cuando la app ya está instalada.
   ========================================================================== */

const LS_NEVER = 'ak-pwa-install-never'

const yaInstalada = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

const BENEFICIOS = [
  { icon: 'bi-phone', txt: 'Ícono directo en tu teléfono, como una app más' },
  { icon: 'bi-wifi-off', txt: 'Navega el catálogo incluso sin conexión' },
  { icon: 'bi-lightning-charge', txt: 'Abre al instante, sin teclear la dirección' },
  { icon: 'bi-bag-heart', txt: 'Tu carrito y tus favoritos siempre a mano' },
]

export default function InstallButton() {
  const [hayEvento, setHayEvento] = useState(false) // evento disponible ahora
  const [huboEvento, setHuboEvento] = useState(false) // llegó en esta sesión
  const [open, setOpen] = useState(false)
  const [instalada, setInstalada] = useState(yaInstalada())
  const wrapRef = useRef(null)

  useEffect(() => {
    if (instalada) return undefined
    return onInstallEvent((ev) => {
      setHayEvento(!!ev)
      if (ev) setHuboEvento(true)
      else setOpen(false)
    })
  }, [instalada])

  /* appinstalled → ocultar el botón */
  useEffect(() => {
    if (instalada) return undefined
    const onInstalled = () => {
      clearInstallEvent()
      setInstalada(true)
      setOpen(false)
    }
    window.addEventListener('ak-app-installed', onInstalled)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('ak-app-installed', onInstalled)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [instalada])

  /* Cierra el popover al hacer clic fuera o con Escape */
  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  /* Sin evento (o descartado para siempre en el banner): nada que ofrecer */
  if (instalada || (!hayEvento && !huboEvento)) return null
  if (localStorage.getItem(LS_NEVER) === '1' && !hayEvento) return null

  const instalar = async () => {
    const ev = consumeInstallPrompt()
    if (!ev) {
      setOpen(false)
      return
    }
    ev.prompt()
    const { outcome } = await ev.userChoice.catch(() => ({ outcome: 'dismissed' }))
    setOpen(false)
    /* Respaldo: si el navegador no llega a emitir appinstalled (algunos
       WebViews), lo sintetizamos para que aparezca el toast de agradecimiento.
       La guarda evita duplicarlo cuando Chrome ya lo emitió. */
    if (outcome === 'accepted') {
      setTimeout(() => {
        if (!window.__akInstalledHandled && !yaInstalada()) {
          window.dispatchEvent(new Event('appinstalled'))
        }
      }, 600)
    }
  }

  return (
    <div className={`install-wrap${open ? ' open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className="btn-icon install-btn"
        aria-label="Instalar la app de AK Creaciones"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Instalar la app"
        onClick={() => setOpen((v) => !v)}
      >
        <i className="bi bi-download"></i>
      </button>

      <div className="ib-pop" role="dialog" aria-label="Beneficios de instalar la app">
        <div className="ib-pop-head">
          <img src="/pwa/icon-192.png" alt="" />
          <div>
            <strong>Instalar AK Creaciones</strong>
            <small>Gratis · ocupa muy poco espacio</small>
          </div>
        </div>
        <ul className="ib-pop-list">
          {BENEFICIOS.map((b) => (
            <li key={b.icon}>
              <i className={`bi ${b.icon}`}></i> {b.txt}
            </li>
          ))}
        </ul>
        <button type="button" className="ib-pop-cta" onClick={instalar}>
          <i className="bi bi-download"></i> Instalar ahora
        </button>
      </div>
    </div>
  )
}
