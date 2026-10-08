import { WHATSAPP_NUMBER, INSTAGRAM_URL, cdn } from '../config.js'

export default function Footer({ onJump }) {
  return (
    <footer className="footer" id="footer">
      <div className="container footer-grid">
        <div>
          <a className="brand" href="#inicio">
            <img src={cdn('/assets/brand/logo-ak.png')} alt="Logo AK Creaciones" />
            <span className="brand-name">AK <em>Creaciones</em></span>
          </a>
          <p className="footer-tag">Bisutería artesanal única, hecha a mano con amor.</p>
          <div className="social">
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener" aria-label="Instagram"><i className="bi bi-instagram"></i></a>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener" aria-label="WhatsApp"><i className="bi bi-whatsapp"></i></a>
            <a href="https://tiktok.com/@akcreaciones" target="_blank" rel="noopener" aria-label="TikTok"><i className="bi bi-tiktok"></i></a>
          </div>
        </div>
        <div>
          <h3>Tienda</h3>
          <ul>
            <li><a href="#catalogo">Catálogo</a></li>
            <li><a href="#catalogo" onClick={(e) => { e.preventDefault(); onJump('zarcillos') }}>Zarcillos</a></li>
            <li><a href="#catalogo" onClick={(e) => { e.preventDefault(); onJump('collares') }}>Collares</a></li>
            <li><a href="#catalogo" onClick={(e) => { e.preventDefault(); onJump('pulseras') }}>Pulseras</a></li>
          </ul>
        </div>
        <div>
          <h3>Ayuda</h3>
          <ul>
            <li><a href="#contacto">Contacto</a></li>
            <li><a href="#ubicacion">Ubicación</a></li>
            <li><a href="#nosotros">Nosotros</a></li>
            <li><a href="#footer">Envíos y devoluciones</a></li>
          </ul>
        </div>
        <div>
          <h3>Métodos de pago</h3>
          <div className="pay">
            <span><i className="bi bi-cash-coin"></i> Efectivo</span>
            <span><i className="bi bi-credit-card"></i> Pago Móvil</span>
            <span><i className="bi bi-shield-check"></i> Zelle</span>
          </div>
        </div>
      </div>
      <div className="footer-bar">
        <div className="container footer-bar-inner">
          <p>© 2026 AK Creaciones — Bisutería y accesorios artesanales.</p>
          <p className="footer-bar-extra">
            <a href="#/login" className="staff-access-link">
              <i className="bi bi-shield-lock"></i> Acceso personal
            </a>
            <span className="foot-sep" aria-hidden="true">·</span>
            Hecho con <i className="bi bi-heart-fill"></i> y mucho brillo ✦
          </p>
        </div>
      </div>
    </footer>
  )
}
