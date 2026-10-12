import { useEffect, useRef, useState } from 'react'
import { cdn } from '../config.js'
import InstallButton from './InstallButton.jsx'
import './customerMenu.css'

/* Menú del cliente con sesión abierta (login público #/acceder) */
function CustomerMenu({ customer, onLogout, isStaff }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('click', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const name = customer?.user?.name ?? 'Mi cuenta'
  const email = customer?.user?.email ?? ''
  const role = customer?.user?.role ?? ''
  const provider = customer?.user?.provider
  const providerIcon =
    provider === 'google' ? 'bi-google' : provider === 'apple' ? 'bi-apple' : 'bi-envelope'

  return (
    <div className={`cust-menu-wrap${open ? ' open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className="cust-avatar-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú de mi cuenta"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cust-avatar">{String(name?.[0] ?? 'A').toUpperCase()}</span>
      </button>

      <div className="cust-menu" role="menu" aria-label="Mi cuenta">
        <div className="cust-menu-head">
          <strong>{name}</strong>
          <small>{email}</small>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="cust-provider">
              <i className={`bi ${providerIcon}`}></i>
              {provider === 'google' ? 'Google' : provider === 'apple' ? 'Apple' : 'Correo'}
            </span>
            {isStaff && (
              <span className="cust-provider" style={{ color: '#E85D9E', background: 'rgba(232, 93, 158, 0.12)' }}>
                <i className="bi bi-shield-check"></i>
                {role === 'admin' ? 'Administrador' : 'Trabajador'}
              </span>
            )}
          </div>
        </div>
        {isStaff && (
          <button
            type="button"
            role="menuitem"
            className="cust-menu-item"
            style={{ color: 'var(--turq)', fontWeight: 600 }}
            onClick={() => {
              setOpen(false)
              window.location.hash = '#/dashboard'
            }}
          >
            <i className="bi bi-speedometer2"></i> Ir al Dashboard
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          className="cust-menu-item danger"
          onClick={() => { setOpen(false); onLogout() }}
        >
          <i className="bi bi-box-arrow-right"></i> Cerrar sesión
        </button>
      </div>
    </div>
  )
}

/* Navbar de la tienda. El acceso del cliente es opcional: si no hay sesión
   muestra un botón "Acceder" en el grupo derecho (junto al carrito) que lleva a
   #/acceder, donde están correo, Google y Apple. El personal entra por su propio
   login en #/login (enlace discreto en el pie de página). */
export default function Header({
  query,
  onQueryChange,
  theme,
  onToggleTheme,
  isStaff,
  customer,
  onLogoutCustomer,
  onLoginClick,
  cartCount,
  onOpenCart,
}) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`header${scrolled ? ' scrolled' : ''}`} id="inicio">
      <a className="skip-link" href="#catalogo">Saltar al catálogo</a>
      <div className="container nav-wrap">
        <a className="brand" href="#inicio">
          <img src={cdn('/assets/brand/logo-ak.png')} alt="Logo AK Creaciones" />
          <span className="brand-name">AK <em>Creaciones</em></span>
        </a>

        <form
          className="search"
          role="search"
          onSubmit={(e) => e.preventDefault()}
        >
          <i className="bi bi-search" aria-hidden="true"></i>
          <input
            type="search"
            placeholder="Buscar zarcillos, collares, pulseras…"
            aria-label="Buscar productos"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </form>

        <nav className="nav" aria-label="Principal">
          <a href="#catalogo">Catálogo</a>
          <a href="#nosotros">Nosotros</a>
          <a href="#ubicacion">Ubicación</a>
          <a href="#contacto">Contacto</a>
        </nav>

        <div className="nav-actions">
          <button className="btn-icon" onClick={onToggleTheme} aria-label="Cambiar tema claro/oscuro">
            <i className={`bi ${theme === 'dark' ? 'bi-sun' : 'bi-moon-stars'}`}></i>
          </button>

          {/* Acceso directo al Dashboard para personal (admin y trabajadores) justo al lado del modo nocturno */}
          {isStaff && (
            <button
              className="btn-icon"
              onClick={() => (location.hash = '#/dashboard')}
              aria-label="Abrir panel de administración"
              title="Panel de administración (Dashboard)"
              style={{ color: 'var(--turq)', borderColor: 'color-mix(in srgb, var(--turq) 35%, transparent)' }}
            >
              <i className="bi bi-speedometer2"></i>
            </button>
          )}

          {/* Login opcional del cliente/comprador: correo, Google o Apple */}
          {customer ? (
            <CustomerMenu customer={customer} onLogout={onLogoutCustomer} isStaff={isStaff} />
          ) : (
            <button
              type="button"
              className="access-corner-btn"
              onClick={onLoginClick}
              aria-label="Iniciar sesión o crear cuenta"
              title="Iniciar sesión — correo, Google o Apple"
            >
              <i className="bi bi-person-circle"></i>
              <span className="access-corner-txt">Acceder</span>
            </button>
          )}

          {/* Pestaña de registro de usuario (#/registro): correo · Google · Apple */}
          {!customer && (
            <a
              href="#/registro"
              className="access-corner-btn access-register-btn"
              aria-label="Crear una cuenta nueva"
              title="Regístrate — correo, Google o Apple"
            >
              <i className="bi bi-person-plus"></i>
              <span className="access-corner-txt">Regístrate</span>
            </a>
          )}

          {/* Instalar la PWA: disponible siempre, el usuario elige cuándo */}
          <InstallButton />
          <button className="cart-btn" onClick={onOpenCart} aria-label="Abrir carrito">
            <i className="bi bi-bag"></i>
            <span className="cart-badge" aria-live="polite">{cartCount}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
