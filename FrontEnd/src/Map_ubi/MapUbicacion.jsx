/* ==========================================================================
   src/Map_ubi/MapUbicacion.jsx — Sección "Ubicación" con Google Maps
   Mapa interactivo (embed oficial de Google, sin API key) + tarjeta lateral
   con la dirección y botones de navegación. Estilo: el de la página
   (variables CSS globales + clases .btn / .kicker / .section-title).
   ========================================================================== */
import { useState } from 'react'
import {
  UBICACION,
  UBICACION_EMBED_SRC,
  UBICACION_DIRECCIONES_URL,
  UBICACION_MAPS_URL,
  UBICACION_WAZE_URL,
  WHATSAPP_NUMBER,
} from '../config.js'

export default function MapUbicacion() {
  const [copied, setCopied] = useState(false)

  const copyCoords = async () => {
    try {
      await navigator.clipboard?.writeText(`${UBICACION.lat}, ${UBICACION.lng}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      /* clipboard no disponible */
    }
  }

  return (
    <section className="section container" id="ubicacion">
      <p className="kicker">Ubicación</p>
      <h2 className="section-title">Lugar principal de entregas</h2>
      <p className="section-sub">
        <strong className="accent mapa-sub-accent">Centro Comercial San Ignacio</strong> — explora el
        mapa, toca para hacer zoom o abrirlo en tu app de navegación favorita.
      </p>

      <div className="mapa-grid">
        {/* ===== Mapa interactivo (Google Maps embed) ===== */}
        <div className="mapa-frame">
          <iframe
            title="Mapa de ubicación de AK Creaciones en Google Maps"
            src={UBICACION_EMBED_SRC}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>

        {/* ===== Tarjeta con la información ===== */}
        <aside className="mapa-card">
          <div className="mapa-card-head">
            <i className="bi bi-geo-alt-fill"></i>
            <h3>AK Creaciones</h3>
          </div>

          <ul className="mapa-detalles">
            <li>
              <i className="bi bi-pin-map-fill"></i>
              <span>
                <strong>Dirección</strong>
                {UBICACION.direccion}
              </span>
            </li>
            <li>
              <i className="bi bi-signpost-split"></i>
              <span>
                <strong>Cómo llegar</strong>
                Centro Comercial San Ignacio, Av. Blandín — Chacao
              </span>
            </li>
            <li>
              <i className="bi bi-train-front"></i>
              <span>
                <strong>Transporte</strong>
                Metro Chacao (Línea 1), a pocos minutos caminando
              </span>
            </li>
          </ul>

          <div className="mapa-botones">
            <a className="btn btn-grad" href={UBICACION_DIRECCIONES_URL} target="_blank" rel="noopener">
              <i className="bi bi-signpost-split"></i> Cómo llegar
            </a>
            <a className="btn btn-ghost" href={UBICACION_MAPS_URL} target="_blank" rel="noopener">
              <i className="bi bi-google"></i> Ver en Google Maps
            </a>
            <a className="btn btn-ghost" href={UBICACION_WAZE_URL} target="_blank" rel="noopener">
              <i className="bi bi-navigation"></i> Abrir en Waze
            </a>
          </div>

          <div className="mapa-extra">
            <button type="button" className="mapa-copiar" onClick={copyCoords}>
              <i className={`bi ${copied ? 'bi-check2' : 'bi-clipboard'}`}></i>
              {copied ? 'Coordenadas copiadas' : 'Copiar coordenadas'}
            </button>
            <a
              className="mapa-wa"
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('¡Hola AK Creaciones! Quiero coordinar una visita ✨')}`}
              target="_blank"
              rel="noopener"
            >
              <i className="bi bi-whatsapp"></i> Coordinar visita por WhatsApp
            </a>
          </div>
        </aside>
      </div>
    </section>
  )
}
