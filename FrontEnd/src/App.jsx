/* ==========================================================================
   src/App.jsx — AK Creaciones
   Carrusel · Catálogo (desde la API) · Carrito · Modales · Búsqueda · Tema · Admin
   ========================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react'

import Header from './components/Header.jsx'
import Carousel from './components/Carousel.jsx'
import ProductCard from './components/ProductCard.jsx'
import ProductModal from './components/ProductModal.jsx'
import AdminModal from './components/AdminModal.jsx'
import CartPanel from './components/CartPanel.jsx'
import Footer from './components/Footer.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import './components/installPrompt.css'

import { productsApi } from './api/client.js'
import { authApi, session } from './api/auth.js'
import { storeAuthApi, storeSession, storeRemember } from './api/storeAuth.js'
import { money, SIZES_BY_CAT, WHATSAPP_NUMBER, WHATSAPP_DISPLAY, WHATSAPP_QR_URL, INSTAGRAM_URL, cdn } from './config.js'
import MapUbicacion from './Map_ubi/MapUbicacion.jsx'
import './Map_ubi/mapa.css'
import LoginPage from './login/LoginPage.jsx'
import StoreLoginPage from './login/StoreLoginPage.jsx'
import ForgotPasswordPage from './login/ForgotPasswordPage.jsx'
import ResetPasswordPage from './login/ResetPasswordPage.jsx'
import Dashboard from './dashboard/Dashboard.jsx'
import './styles.css'
import './dashboard/dashboard.css'

/* Productos de ejemplo: se usan si la API no responde (modo offline) */
/* Roles con panel propio: la administradora y los trabajadores.
   El acceso al inventario de materiales y a la gestión de roles/contraseñas
   sigue reservado al admin dentro de Dashboard.jsx. */
const STAFF_ROLES = ['admin', 'empleado']
const isStaffRole = (user) => STAFF_ROLES.includes(user?.role)

const FALLBACK_PRODUCTS = [
  { id: 1, name: 'Zarcillo Vino Real',    cat: 'zarcillos', price: 12, oldPrice: null,  desc: 'Soutache bordado a mano en tonos vino con cristales ahumados y mostacillas doradas.', img: cdn('/products/zarcillo-vino.jpeg'),      tag: null },
  { id: 2, name: 'Zarcillo Noche Dorada', cat: 'zarcillos', price: 14, oldPrice: 17,    desc: 'Espiral de soutache negro con hilos dorados y cristal central; elegancia para la noche.', img: cdn('/products/zarcillo-negro-oro.jpeg'), tag: 'oferta' },
  { id: 3, name: 'Zarcillo Azul Royal',   cat: 'zarcillos', price: 15, oldPrice: null,  desc: 'Cristales azul zafiro enmarcados en soutache bordado con mostacillas azul eléctrico.', img: cdn('/products/zarcillo-azul-royal.jpeg'), tag: null },
  { id: 4, name: 'Zarcillo Turquesa',     cat: 'zarcillos', price: 15, oldPrice: null,  desc: 'Gota central turquesa con bordado azul rey y detalles dorados; frescura tropical.', img: cdn('/products/zarcillo-turquesa.jpeg'),  tag: null },
  { id: 5, name: 'Zarcillo Esmeralda',    cat: 'zarcillos', price: 16, oldPrice: null,  desc: 'Cristal verde esmeralda con capas gris perla y mostacillas verdes tejidas a mano.', img: cdn('/products/zarcillo-esmeralda.jpeg'), tag: null },
  { id: 6, name: 'Zarcillo Menta',        cat: 'zarcillos', price: 14, oldPrice: null,  desc: 'Espiral menta con cristal opalina; un diseño suave y luminoso para el día.', img: cdn('/products/zarcillo-menta.jpeg'),     tag: 'nuevo' },
  { id: 7, name: 'Zarcillo Zafiro',       cat: 'zarcillos', price: 18, oldPrice: null,  desc: 'Tres cristales azul profundo con capeado dorado; pieza statement de gala.', img: cdn('/products/zarcillo-zafiro.jpeg'),    tag: 'nuevo' },
  { id: 8, name: 'Zarcillo Fiesta',       cat: 'zarcillos', price: 20, oldPrice: null,  desc: 'Soutache multicolor en espirales vibrantes con cristal fucsia; pura alegría.', img: cdn('/products/zarcillo-fiesta.jpeg'),    tag: 'nuevo' },
  { id: 9, name: 'Zarcillo Ámbar',        cat: 'zarcillos', price: 13, oldPrice: null,  desc: 'Espirales café con cristal ámbar central; cálido, versátil y hecho a mano.', img: cdn('/products/zarcillo-ambar.jpeg'),     tag: null },
]

const FILTERS = [
  { f: 'all', label: 'Todos' },
  { f: 'zarcillos', label: 'Zarcillos' },
  { f: 'collares', label: 'Collares' },
  { f: 'pulseras', label: 'Pulseras' },
  { f: 'anillos', label: 'Anillos' },
  { f: 'sets', label: 'Sets' },
  { f: 'ofertas', label: 'Ofertas' },
]

const readLS = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function Store({ auth, storeAuth: customer, onStoreAuthChange, onLogoutStaff }) {
  /* ---------- Tema ---------- */
  const [theme, setTheme] = useState(() => localStorage.getItem('ak-theme') || 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('ak-theme', theme)
  }, [theme])

  /* ---------- Estado principal ---------- */
  const [products, setProducts] = useState([])   // catálogo desde la API
  const [apiError, setApiError] = useState(false)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState(() => readLS('ak-cart', []))
  const isStaff = isStaffRole(auth?.user)
  const isAdmin = auth?.user?.role === 'admin'

  /* ---------- Modales / carrito ---------- */
  const [productModal, setProductModal] = useState(null) // { product, color, size, qty }
  const [adminOpen, setAdminOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)

  /* ---------- Toast ---------- */
  const [toastMsg, setToastMsg] = useState('')
  const toastTimer = useRef(null)
  const toast = (msg) => {
    setToastMsg(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(''), 2400)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  /* ---------- Carrito en localStorage ---------- */
  useEffect(() => {
    localStorage.setItem('ak-cart', JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    const onCartReset = () => setCart([])
    window.addEventListener('ak-cart-reset', onCartReset)
    return () => window.removeEventListener('ak-cart-reset', onCartReset)
  }, [])

  /* ---------- Cargar catálogo desde la API (axios) ---------- */
  const loadProducts = async () => {
    try {
      const { data } = await productsApi.getAll()
      const rows = Array.isArray(data?.data) ? data.data : []
      if (rows.length === 0) throw new Error('La API no devolvió productos')
      // Normalizar filas de Postgres (old_price -> oldPrice, precios a número)
      const list = rows.map((r) => ({
        ...r,
        price: Number(r.price),
        oldPrice: r.old_price != null ? Number(r.old_price) : r.oldPrice ?? null,
        img: cdn(r.img), // resuelve URLs del bucket (y deja pasar las absolutas)
      }))
      setProducts(list)
      setApiError(false)
    } catch (err) {
      if (products.length === 0) {
        setProducts(FALLBACK_PRODUCTS)
        setApiError(true)
      }
      console.warn('[Catálogo] Usando productos de ejemplo:', err.message)
    }
  }
  useEffect(() => {
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- Filtros y búsqueda ---------- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      const inFilter =
        filter === 'all' || (filter === 'ofertas' ? p.oldPrice : p.cat === filter)
      const inQuery = !q || `${p.name} ${p.desc} ${p.cat}`.toLowerCase().includes(q)
      return inFilter && inQuery
    })
  }, [products, filter, query])

  const jumpToFilter = (f) => {
    const known = FILTERS.some((x) => x.f === f)
    if (known) {
      setFilter(f)
      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })
    } else {
      toast('Esa categoría estará disponible muy pronto ✨')
    }
  }

  /* ---------- Carrito ---------- */
  const addToCart = (p, color = 'Dorado', size = null, qty = 1) => {
    if (!p) return
    const key = `${p.id}|${color}|${size ?? 'std'}`
    setCart((prev) => {
      const found = prev.find((i) => i.key === key)
      if (found) {
        return prev.map((i) => (i.key === key ? { ...i, qty: i.qty + qty } : i))
      }
      return [...prev, { key, id: p.id, name: p.name, img: p.img, price: p.price, color, size, qty }]
    })
    toast(`✓ ${p.name} agregado al carrito`)
  }

  const removeFromCart = (key) => {
    setCart((prev) => prev.filter((i) => i.key !== key))
    toast('Pieza eliminada del carrito')
  }

  /* ---------- Modales ---------- */
  const openProductModal = (p) => {
    // Colores del producto (campo "color" de la BD). Puede traer varios separados por coma:
    // "Dorado, Plateado" -> ['Dorado', 'Plateado']. Si no tiene, se usan los de fábrica.
    const dbColors = String(p.color ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    const colors = dbColors.length ? dbColors : COLORS
    setProductModal({
      product: p,
      colors,
      color: colors[0],
      size: SIZES_BY_CAT[p.cat]?.[0] ?? null,
      qty: 1,
    })
  }

  const closeAllPanels = () => {
    setCartOpen(false)
    setProductModal(null)
    setAdminOpen(false)
  }

  /* ---------- Escape cierra todo ---------- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeAllPanels()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  /* ---------- Bloquear scroll con panel abierto ---------- */
  const anyPanelOpen = cartOpen || !!productModal || adminOpen
  useEffect(() => {
    document.body.classList.toggle('no-scroll', anyPanelOpen)
  }, [anyPanelOpen])

  /* ---------- Admin ---------- */
  const publishProduct = async ({ name, cat, price, desc, img, color }) => {
    try {
      await productsApi.create({ name, cat, price: Number(price), desc, img, color, tag: 'nuevo' })
      await loadProducts()
      toast('✓ Producto publicado en la base de datos')
    } catch (err) {
      toast('✗ ' + err.message)
      throw err
    }
  }

  /* ---------- Contacto / WhatsApp ---------- */
  const openWhatsApp = (text) =>
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, '_blank')

  const copyPhone = async () => {
    try {
      await navigator.clipboard?.writeText('+' + WHATSAPP_NUMBER)
      toast('✓ Código de WhatsApp copiado')
    } catch {
      /* clipboard no disponible */
    }
  }

  /* ================= RENDER ================= */
  return (
    <>
      <div className="topbar" role="note">Hecho a mano · Piezas únicas · Envíos nacionales e internacionales ✦</div>      <Header
        query={query}
        onQueryChange={setQuery}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        isStaff={isStaff}
        staffUser={auth?.user}
        customer={customer}
        onLogoutStaff={onLogoutStaff}
        onLogoutCustomer={() => {
          storeSession.clear()
          storeRemember.clear()
          onStoreAuthChange(null)
          toast('Sesión cerrada. ¡Vuelve pronto! ✨')
        }}
        onLoginClick={() => (location.hash = '#/acceder')}
        cartCount={cart.reduce((s, i) => s + i.qty, 0)}
        onOpenCart={() => setCartOpen(true)}
      />

      <Carousel onJump={jumpToFilter} />

      <main id="catalogo">
        <section className="section container">
          <div className="section-head">
            <div>
              <p className="kicker">Nuestro catálogo</p>
              <h2 className="section-title">
                Productos y modelos · <span className="accent">AK Creaciones</span>
              </h2>
              <p className="section-sub">
                Cada zarcillo se borda a mano con la técnica soutache. Toca una tarjeta para ver los
                detalles, elige color y agrégalos al carrito.
              </p>
            </div>
            {isAdmin && (
              <button className="btn btn-ghost" onClick={() => setAdminOpen(true)}>
                <i className="bi bi-plus-circle"></i> Agregar producto
              </button>
            )}
          </div>

          {apiError && (
            <p className="empty-msg" role="alert">
              ⚠ No pudimos conectar con el servidor (<code>http://localhost:4000</code>). Mostrando el
              catálogo de ejemplo — inicia la API con <code>npm run dev</code> en la carpeta BackEnd.
            </p>
          )}

          <div className="filters" aria-label="Filtrar catálogo">
            {FILTERS.map((c) => (
              <button
                key={c.f}
                className={`chip${filter === c.f ? ' active' : ''}`}
                onClick={() => setFilter(c.f)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="empty-msg">No encontramos piezas con ese criterio… prueba otro filtro o búsqueda. ✨</p>
          ) : (
            <div className="grid">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} onOpen={() => openProductModal(p)} onQuickAdd={() => addToCart(p)} />
              ))}
            </div>
          )}
        </section>

        {/* ===== Nosotros ===== */}
        <section className="section alt" id="nosotros">
          <div className="container about">
            <div className="about-text">
              <p className="kicker">Quiénes somos</p>
              <h2 className="section-title">
                Hecho a mano, <span className="accent">hecho con amor</span>
              </h2>
              <p>
                En <strong>AK Creaciones</strong> diseñamos y fabricamos cada pieza artesanalmente:
                elegimos los materiales, armamos los diseños y cuidamos cada detalle para que llevar
                puesta una joya se sienta especial todos los días.
              </p>
              <ul className="about-list">
                <li><i className="bi bi-gem"></i> Materiales hipoalergénicos y de alta calidad</li>
                <li><i className="bi bi-palette"></i> Diseños personalizados a pedido</li>
                <li><i className="bi bi-globe-americas"></i> Envíos nacionales e internacionales</li>
                <li><i className="bi bi-gift"></i> Empaques para regalo sin costo</li>
              </ul>
            </div>
            <div className="about-media">
              <img src={cdn('/products/zarcillo-fiesta.jpeg')} alt="Zarcillos soutache multicolor hechos a mano" />
            </div>
          </div>
        </section>

        {/* ===== Ubicación (Google Maps) ===== */}
        <MapUbicacion />

        {/* ===== Contacto ===== */}
        <section className="section container" id="contacto">
          <p className="kicker">Contacto</p>
          <h2 className="section-title">Contáctanos por WhatsApp</h2>
          <p className="section-sub">Escanea el código o toca el botón — te respondemos en minutos.</p>
          <div className="contact-grid">
            <div className="qr-card">
              <img
                src={WHATSAPP_QR_URL}
                alt="Código QR de WhatsApp"
                width="180"
                height="180"
                onError={(e) => {
                  /* respaldo: genera el QR en vivo si el del bucket no está disponible */
                  if (!e.currentTarget.src.includes('qrserver.com')) {
                    e.currentTarget.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://wa.me/${WHATSAPP_NUMBER}`)}`
                  }
                }}
              />
              <p onClick={copyPhone} style={{ cursor: 'pointer' }}>
                <i className="bi bi-whatsapp"></i> {WHATSAPP_DISPLAY}
              </p>
              <small>Escanea o toca el número para escribirnos</small>
            </div>
            <div className="contact-actions">
              <a className="btn btn-wa" href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener">
                <i className="bi bi-whatsapp"></i> Escríbenos por WhatsApp
              </a>
              <a className="btn btn-ig" href={INSTAGRAM_URL} target="_blank" rel="noopener">
                <i className="bi bi-instagram"></i> @akcreaciones
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer onJump={jumpToFilter} />

      {/* ===== Botones flotantes de WhatsApp e Instagram ===== */}
      <div className="fab-stack">
        <a
          className="ig-fab"
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener"
          aria-label="Síguenos en Instagram"
        >
          <i className="bi bi-instagram"></i>
        </a>
        <button
          className="wa-fab"
          aria-label="Escríbenos por WhatsApp"
          onClick={() => openWhatsApp('¡Hola AK Creaciones! Quiero información sobre sus piezas ✨')}
        >
          <i className="bi bi-whatsapp"></i>
        </button>
      </div>

      {/* ===== Carrito ===== */}
      <CartPanel
        open={cartOpen}
        items={cart}
        total={cart.reduce((s, i) => s + i.qty * i.price, 0)}
        onClose={() => setCartOpen(false)}
        onRemove={removeFromCart}
        onPaid={() => setCart([])}
        toast={toast}
        userSession={isStaff ? auth : customer}
      />

      {/* ===== Banner discreto de instalación PWA (solo en la tienda) ===== */}
      <InstallPrompt />

      {/* ===== Modal de producto ===== */}
      {productModal && (
        <ProductModal
          data={productModal}
          onClose={() => setProductModal(null)}
          onColor={(color) => setProductModal((s) => ({ ...s, color }))}
          onSize={(size) => setProductModal((s) => ({ ...s, size }))}
          onQty={(qty) => setProductModal((s) => ({ ...s, qty: Math.min(99, Math.max(1, qty)) }))}
          onAdd={() => {
            addToCart(productModal.product, productModal.color, productModal.size, productModal.qty)
            setProductModal(null)
          }}
        />
      )}

      {/* ===== Modal admin ===== */}
      <AdminModal
        open={adminOpen}
        isAdmin={isAdmin}
        onPublish={publishProduct}
        onClose={() => setAdminOpen(false)}
      />

      {/* ===== Toast ===== */}
      <div className={`toast${toastMsg ? ' show' : ''}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </>
  )
}

/* ==========================================================================
   App —   Router mínimo por hash:
     #/                  → Tienda
     #/login             → Login del personal (JWT)
     #/acceder           → Login público de clientes (email · Google · Apple)
     #/forgot-password   → Recuperar contraseña (enlace por correo)
     #/reset-password    → Restablecer contraseña (token del correo)
     #/dashboard         → Dashboard (protegido por token)
   ========================================================================== */
function useHashRoute() {
  const [route, setRoute] = useState(() => location.hash || '#/')
  useEffect(() => {
    const onHash = () => setRoute(location.hash || '#/')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}

export default function App() {
  /* Aplica el tema guardado aunque el primer render sea el login o el dashboard
     (antes solo Store lo hacía: recargar directo en #/login salía en claro) */
  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem('ak-theme') || 'light'
  }, [])
  const route = useHashRoute()
  // localStorage es la fuente de verdad: se re-sincroniza en cada cambio de ruta
  // (el interceptor 401 borra localStorage y salta a #/login, y aquí se refleja)
  const [auth, setAuth] = useState(null)
  const [authStatus, setAuthStatus] = useState('checking')
  // Sesión del cliente de la tienda (login público), también en localStorage
  const [storeAuth, setStoreAuth] = useState(() => storeSession.get())

  /* El rol del panel solo se acepta después de validar el JWT contra la API. */
  useEffect(() => {
    const sa = storeSession.get()
    setStoreAuth(sa)
    let active = true
    const savedSession = session.get()

    if (!savedSession?.token) {
      setAuth(null)
      setAuthStatus('denied')
      if (route.startsWith('#/dashboard')) location.replace('#/login')
      return () => { active = false }
    }

    authApi.me()
      .then((response) => {
        if (!active) return
        const profile = response?.data
        if (!isStaffRole(profile)) {
          session.clear()
          setAuth(null)
          setAuthStatus('denied')
          if (route.startsWith('#/dashboard')) location.replace('#/login')
          return
        }
        storeSession.clear()
        storeRemember.clear()
        setStoreAuth(null)
        setAuth({ token: savedSession.token, user: profile })
        setAuthStatus('verified')
        if (route.startsWith('#/login')) location.replace('#/dashboard')
      })
      .catch((err) => {
        if (!active) return
        if ([401, 403].includes(err?.response?.status)) session.clear()
        setAuth(null)
        setAuthStatus('denied')
        if (route.startsWith('#/dashboard')) location.replace('#/login')
      })

    return () => { active = false }
  }, [route])

  /* ===== Retorno de Google OAuth (redirect flow) =====
     Google devuelve ?code=... a /auth/google; se intercambia por el token del
     backend y se guarda la sesión + credenciales recordadas del cliente. */
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const code = params.get('code')
    if (!params.get('state') || !sessionStorage.getItem('ak-oauth-state')) return
    if (!code || params.get('state') !== sessionStorage.getItem('ak-oauth-state')) {
      sessionStorage.removeItem('ak-oauth-state')
      return
    }
    sessionStorage.removeItem('ak-oauth-state')
    /* Google redirige a /auth/google: vuelve a la raíz para no dejar esa ruta
       pegada en la barra de direcciones. */
    history.replaceState(null, '', `${location.origin}/`)
    location.hash = '#/acceder'
    storeAuthApi
      .google({ code })
      .then((data) => {
        session.clear()
        setAuth(null)
        setAuthStatus('denied')
        storeRemember.saveSocial(data.user, data.token)
        setStoreAuth(storeSession.get())
        location.hash = '#/'
      })
      .catch((err) => {
        console.error('[Google OAuth]', err?.message)
        /* Deja el motivo a la vista: StoreLoginPage lo muestra al abrirse */
        try {
          sessionStorage.setItem('ak-store-oauth-error', err?.message || 'No se pudo continuar con Google')
        } catch {
          /* noop */
        }
        location.hash = '#/acceder'
      })
  }, [])

  // Rutas de recuperación: accesibles sin sesión (y no redirigen al dashboard)
  // Rutas de recuperación del CLIENTE (login público #/acceder):
  // /acceder → olvidé mi contraseña → /reset-password?token=...
  if (route.startsWith('#/forgot-password')) return <ForgotPasswordPage />
  if (route.startsWith('#/reset-password')) return <ResetPasswordPage />

  if (route.startsWith('#/login')) {
    return (
      <LoginPage
        onSuccess={() => {
          setAuth(session.get())
          location.hash = '#/dashboard'
        }}
        /* Registro de usuario común (rol 'user'): la sesión es de la tienda,
           no del panel, así que se guarda como cliente y se va al home */
        onCustomerAuth={() => {
          session.clear()
          setAuth(null)
          setAuthStatus('denied')
          setStoreAuth(storeSession.get())
          location.hash = '#/'
        }}
      />
    )
  }

  /* Pestaña de registro (#/registro): alta de usuario común (correo · Google ·
     Apple) — misma vista del login en modo solo-registro. Al terminar queda la
     sesión de cliente y se va a la tienda. */
  if (route.startsWith('#/registro')) {
    return (
      <LoginPage
        registerOnly
        onSuccess={() => {
          setAuth(session.get())
          location.hash = '#/dashboard'
        }}
        onCustomerAuth={() => {
          session.clear()
          setAuth(null)
          setAuthStatus('denied')
          setStoreAuth(storeSession.get())
          location.hash = '#/'
        }}
      />
    )
  }

  /* Acceso público: el login por correo puede autenticar personal o clientes.
     Solo se promueve una cuenta de personal si su JWT queda verificado. */
  if (route.startsWith('#/acceder')) {
    return (
      <StoreLoginPage
        onSuccess={(data) => {
          if (data?.token) {
            session.save({ token: data.token, user: data.user })
            setAuth(null)
            setAuthStatus('checking')
          } else {
            session.clear()
            setAuth(null)
            setAuthStatus('denied')
          }
          setStoreAuth(storeSession.get())
          location.hash = '#/'
        }}
      />
    )
  }

  if (route.startsWith('#/dashboard')) {
    if (authStatus !== 'verified' || !auth) {
      return <main className="dash-content"><p className="dash-msg" role="status"><span className="spinner"></span> Verificando acceso al panel…</p></main>
    }
    return (
      <Dashboard
        onLogout={() => {
          session.clear()
          setAuth(null)
          setAuthStatus('denied')
          location.hash = '#/login'
        }}
        onGoHome={() => { location.hash = '#/' }}
      />
    )
  }

  return (
    <Store
      auth={auth}
      storeAuth={storeAuth}
      onStoreAuthChange={setStoreAuth}
      onLogoutStaff={() => {
        session.clear()
        setAuth(null)
        setAuthStatus('denied')
        location.hash = '#/login'
      }}
    />
  )
}
