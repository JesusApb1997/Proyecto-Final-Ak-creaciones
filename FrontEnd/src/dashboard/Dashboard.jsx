import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { session, authApi } from '../api/auth.js'
import { productsApi, usersApi, uploadsApi, deliveryApi, storeOrdersAdminApi } from '../api/client.js'
import UserNavbar from '../navbar/UserNavbar.jsx'
import InventarioView from './InventarioView.jsx'
import DeliveryView from './DeliveryView.jsx'
import OrdersView from './OrdersView.jsx'
import PaymentSettingsView from './PaymentSettingsView.jsx'
import ReportToolbar, { useReportFilter } from './ReportTools.jsx'
import { money, PRODUCT_CATEGORIES, PRODUCT_IMAGES, cdn } from '../config.js'

/* ==========================================================
   Utilidades
   ========================================================== */
const norm = (row) => ({
  ...row,
  price: Number(row.price),
  oldPrice: row.old_price != null ? Number(row.old_price) : row.oldPrice ?? null,
  img: cdn(row.img), // resuelve URLs del bucket (y deja pasar las absolutas)
})

const PRODUCT_REPORT_FIELDS = [
  { value: 'name', label: 'Nombre', getValue: (product) => product.name },
  { value: 'category', label: 'Categoría', getValue: (product) => product.cat },
  { value: 'price', label: 'Precio', getValue: (product) => product.price },
]

const PRODUCT_REPORT_COLUMNS = [
  { label: 'Producto', getValue: (product) => product.name },
  { label: 'Categoría', getValue: (product) => product.cat },
  { label: 'Precio', getValue: (product) => money(product.price) },
  { label: 'Existencias', getValue: (product) => Number(product.stock ?? 0) },
  { label: 'Precio anterior', getValue: (product) => product.oldPrice ? money(product.oldPrice) : '—' },
  { label: 'Color', getValue: (product) => product.color || '—' },
  { label: 'Etiqueta', getValue: (product) => product.tag || '—' },
]

const NAV = [
  { icon: 'bi-speedometer2', label: 'Resumen', href: '#/dashboard', key: 'resumen' },
  { icon: 'bi-bag', label: 'Productos', href: '#/dashboard/productos', key: 'productos' },
  { icon: 'bi-truck', label: 'Delivery', href: '#/dashboard/delivery', key: 'delivery' },
  { icon: 'bi-bag-check', label: 'Pedidos', href: '#/dashboard/pedidos', key: 'pedidos', adminOnly: true },
  { icon: 'bi-credit-card-2-front', label: 'Datos de pago', href: '#/dashboard/datos-pago', key: 'datos-pago', adminOnly: true },
  { icon: 'bi-boxes', label: 'Inventario', href: '#/dashboard/inventario', key: 'inventario', adminOnly: true },
  { icon: 'bi-people', label: 'Usuarios', href: '#/dashboard/usuarios', key: 'usuarios', adminOnly: true },
]

const sectionFromHash = () => {
  const h = location.hash || '#/dashboard'
  if (h.includes('productos')) return 'productos'
  if (h.includes('delivery')) return 'delivery'
  if (h.includes('pedidos')) return 'pedidos'
  if (h.includes('datos-pago')) return 'datos-pago'
  if (h.includes('inventario')) return 'inventario'
  if (h.includes('usuarios')) return 'usuarios'
  return 'resumen'
}



/* ==========================================================
   Modal de formulario de producto (crear / editar)
   ========================================================== */
function ProductFormModal({ product, onClose, onSaved }) {
  const isEdit = !!product?.id
  const [form, setForm] = useState({
    name: product?.name ?? '',
    cat: product?.cat ?? 'zarcillos',
    price: product?.price ?? '',
    oldPrice: product?.oldPrice ?? '',
    desc: product?.desc ?? '',
    img: product?.img ?? cdn(PRODUCT_IMAGES[0]),
    color: product?.color ?? 'Dorado, Plateado',
    stock: product?.stock ?? 0,
    tag: product?.tag ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => {
    document.body.classList.add('no-scroll')
    return () => document.body.classList.remove('no-scroll')
  }, [])

  /* Sube la imagen elegida y pone la URL devuelta por la API en el formulario */
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const data = await uploadsApi.upload(file)
      // data.url ya es la URL pública en Supabase Storage (o local en dev)
      setForm((f) => ({ ...f, img: data.url }))
      // Auto-guardar en la BD si estamos editando un producto existente
      if (product?.id) {
        try {
          await productsApi.update(product.id, { img: data.url })
          onSaved?.('✓ Imagen subida a Supabase y guardada en la BD')
        } catch {
          onSaved?.('⚠ Imagen subida, pero no se pudo actualizar el producto')
        }
      }
    } catch (err) {
      setError(err?.message || 'No se pudo subir la imagen')
    } finally {
      setUploading(false)
      e.target.value = '' // permite volver a elegir la misma imagen
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        cat: form.cat,
        price: Number(form.price),
        oldPrice: form.oldPrice === '' ? null : Number(form.oldPrice),
        desc: form.desc,
        img: form.img,
        color: form.color,
        stock: Number(form.stock),
        tag: form.tag || null,
      }
      // La imagen ya quedó guardada en Supabase Storage al subirla (uploadsApi);
      // su URL pública se persiste en la columna img de la BD junto con el resto.
      if (isEdit) await productsApi.update(product.id, payload)
      else await productsApi.create(payload)
      onSaved(isEdit ? '✓ Producto actualizado — el catálogo de la tienda ya muestra los cambios' : '✓ Producto creado')
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el producto')
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal admin-modal show" role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box admin-edit-modal product-edit-modal">
        <button className="btn-icon modal-close" onClick={onClose} aria-label="Cerrar">
          <i className="bi bi-x-lg"></i>
        </button>
        <p className="kicker">Productos</p>
        <h3>{isEdit ? `Editar: ${product.name}` : 'Nuevo producto'}</h3>

        <form className="product-form modal-edit-grid" onSubmit={submit}>
          <div className="ff product-edit-name">
            <label>Nombre</label>
            <input required value={form.name} onChange={set('name')} />
          </div>

          <div className="ff-row">
            <div className="ff">
              <label>Categoría</label>
              <select value={form.cat} onChange={set('cat')}>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="ff">
              <label>Etiqueta</label>
              <select value={form.tag ?? ''} onChange={set('tag')}>
                <option value="">— ninguna —</option>
                <option value="nuevo">Nuevo</option>
                <option value="oferta">Oferta</option>
              </select>
            </div>
          </div>

          <div className="ff-row">
            <div className="ff">
              <label>Precio ($)</label>
              <input type="number" min="0" step="0.01" required value={form.price} onChange={set('price')} />
            </div>
            <div className="ff">
              <label>Precio anterior (oferta)</label>
              <input type="number" min="0" step="0.01" placeholder="vacío = sin oferta" value={form.oldPrice ?? ''} onChange={set('oldPrice')} />
            </div>
          </div>

          <div className="ff">
            <label>Existencias del producto terminado</label>
            <input type="number" min="0" step="1" required value={form.stock} onChange={set('stock')} />
            <small>Unidades disponibles para vender. Se descuentan al confirmar el pedido o despacharlo.</small>
          </div>

          <div className="ff product-edit-description">
            <label>Descripción</label>
            <textarea required rows="3" value={form.desc} onChange={set('desc')} />
          </div>

          <div className="ff product-edit-color">
            <label>Color / acabado (separa varios con coma)</label>
            <input value={form.color} onChange={set('color')} placeholder="Dorado, Plateado" />
          </div>

          <div className="ff product-edit-image">
            <label>Imagen</label>
            <div className="ff-img-preview">
              {form.img && <img src={form.img} alt="Vista previa" onError={(e) => { e.currentTarget.style.opacity = 0.25 }} />}
            </div>
            <div className="ff-upload-row">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                style={{ display: 'none' }}
                onChange={handleUpload}
              />
              <button
                type="button"
                className="btn btn-ghost"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <><span className="spinner"></span> Subiendo…</>
                ) : (
                  <><i className="bi bi-upload"></i> Subir imagen</>
                )}
              </button>
              <a
                className="btn btn-ghost product-image-preview"
                href={form.img || undefined}
                target="_blank"
                rel="noreferrer"
                aria-label="Previsualizar imagen en una ventana nueva"
                title="Ver imagen en una ventana nueva"
                aria-disabled={!form.img}
                onClick={(event) => { if (!form.img) event.preventDefault() }}
              >
                <i className="bi bi-eye" aria-hidden="true"></i>
                <span>Previsualizar</span>
              </a>
              <small className="ff-upload-hint">JPG, PNG, WEBP, GIF o AVIF · máx. 5 MB</small>
            </div>
          </div>

          {error && <p className="login-error"><i className="bi bi-exclamation-circle"></i> {error}</p>}

          <button type="submit" className="btn btn-grad btn-block" disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}

/* ==========================================================
   Vista: Productos (catálogo sincronizado con la tienda)
   ========================================================== */
function ProductsView({ showToast, readOnly = false }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | producto
  const report = useReportFilter(products, PRODUCT_REPORT_FIELDS)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await productsApi.getAll()
      setProducts((Array.isArray(data?.data) ? data.data : []).map(norm))
    } catch (err) {
      setError(err?.message || 'Error cargando productos')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const remove = async (p) => {
    if (!window.confirm(`¿Eliminar "${p.name}" de la base de datos? Esta acción no se puede deshacer.`)) return
    try {
      await productsApi.remove(p.id)
      showToast(`✓ "${p.name}" eliminado`)
      load()
    } catch (err) {
      showToast('✗ ' + (err?.message || 'No se pudo eliminar'))
    }
  }

  return (
    <>
      <div className="dash-toolbar">
        <p className="dash-toolbar-info">
          {readOnly ? (
            <>
              <i className="bi bi-eye"></i> Modo consulta: puedes revisar el catálogo, pero solo la
              administración puede hacer cambios.
            </>
          ) : (
            <>
              <i className="bi bi-arrow-repeat"></i> Este catálogo es el mismo que ve la tienda en
              línea — cada cambio se guarda en Supabase y se refleja al instante.
            </>
          )}
        </p>
        {!readOnly && (
          <button className="btn btn-grad" onClick={() => setEditing('new')}>
            <i className="bi bi-plus-circle"></i> Nuevo producto
          </button>
        )}
      </div>

      {loading && <p className="dash-msg"><span className="spinner"></span> Cargando catálogo…</p>}
      {error && <p className="login-error"><i className="bi bi-exclamation-circle"></i> {error}</p>}

      {!loading && !error && (
        <>
        <ReportToolbar title="Reporte de productos" fields={PRODUCT_REPORT_FIELDS} columns={PRODUCT_REPORT_COLUMNS} report={report} />
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th aria-label="Seleccionar productos">
                  <input type="checkbox" aria-label="Seleccionar todos los productos mostrados" checked={report.allVisibleSelected} onChange={report.toggleVisible} disabled={!report.filteredRecords.length} />
                </th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Color</th>
                <th>Precio</th>
                <th>Existencias</th>
                <th>Etiqueta</th>
                {!readOnly && <th aria-label="Acciones"></th>}
              </tr>
            </thead>
            <tbody>
              {report.filteredRecords.length === 0 ? (
                <tr><td colSpan={readOnly ? 7 : 8} className="report-empty">No hay productos que coincidan con la búsqueda.</td></tr>
              ) : report.filteredRecords.map((p) => (
                <tr key={p.id}>
                  <td><input type="checkbox" aria-label={`Seleccionar ${p.name}`} checked={report.selectedIds.has(String(p.id))} onChange={() => report.toggleRow(p.id)} /></td>
                  <td>
                    <div className="dash-prod">
                      <img src={p.img} alt="" loading="lazy"
                        onError={(e) => { e.currentTarget.src = cdn('/products/zarcillo-vino.jpeg') }} />
                      <div>
                        <strong>{p.name}</strong>
                        <small>{p.desc}</small>
                      </div>
                    </div>
                  </td>
                  <td><span className="dash-pill">{p.cat}</span></td>
                  <td>{p.color || '—'}</td>
                  <td>
                    {p.oldPrice ? <s>{money(p.oldPrice)}</s> : null} <strong>{money(p.price)}</strong>
                  </td>
                  <td><strong>{Number(p.stock ?? 0)}</strong></td>
                  <td>
                    {p.tag === 'nuevo' && <span className="badge badge-new">Nuevo</span>}
                    {p.tag === 'oferta' && <span className="badge badge-offer">Oferta</span>}
                    {!p.tag && '—'}
                  </td>
                  {!readOnly && (
                    <td className="dash-actions-cell">
                      <button className="btn-icon" title="Editar" onClick={() => setEditing(p)}>
                        <i className="bi bi-pencil-square"></i>
                      </button>
                      <button className="btn-icon danger" title="Eliminar" onClick={() => remove(p)}>
                        <i className="bi bi-trash3"></i>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {editing && (
        <ProductFormModal
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); showToast(msg); load() }}
        />
      )}
    </>
  )
}

/* ==========================================================
   Acceso denegado — el usuario existe pero no tiene un rol
   con acceso al panel (ni admin ni empleado)
   ========================================================== */
function AccessDenied({ user, onLogout }) {
  return (
    <div className="denied-page">
      <div className="denied-card">
        <i className="bi bi-shield-x"></i>
        <h1>Acceso restringido</h1>
        <p className="denied-msg">
          <strong>Solo administrador.</strong> Tu cuenta ({user?.email}) tiene el rol{' '}
          <strong>{user?.role ?? 'sin rol'}</strong> y no tiene permisos para entrar al panel de
          administración.
        </p>
        <p className="denied-hint">
          Si deberías tener acceso, contacta a la administradora de la tienda.
        </p>
        <div className="denied-actions">
          <a className="btn btn-ghost" href="#/">← Volver a la tienda</a>
          <button className="btn btn-grad" onClick={onLogout}>
            <i className="bi bi-box-arrow-right"></i> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

/* ==========================================================
   Vista: Usuarios (CRUD, solo admin)
   ========================================================== */
function UserFormModal({ user, onClose, onSaved }) {
  const isEdit = !!user?.id
  const esCliente = ['cliente', 'user'].includes(user?.role ?? '') // las cuentas de la tienda editan sin cambiar de rol
  const [form, setForm] = useState({
    name: user?.name ?? '',
    last_name: user?.last_name ?? '',
    email: user?.email ?? '',
    username: user?.username ?? '',
    role: user?.role ?? 'empleado',
    password: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.body.classList.add('no-scroll')
    return () => document.body.classList.remove('no-scroll')
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        // En edición, solo enviar la contraseña si se escribió una nueva
        const { password, ...rest } = form
        await usersApi.update(user.id, password ? { ...rest, password } : rest)
      } else {
        await usersApi.create(form)
      }
      onSaved(
        isEdit
          ? esCliente ? '✓ Cuenta de la tienda actualizada' : '✓ Usuario actualizado'
          : '✓ Usuario creado'
      )
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el usuario')
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal admin-modal show" role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <button className="btn-icon modal-close" onClick={onClose} aria-label="Cerrar">
          <i className="bi bi-x-lg"></i>
        </button>
        <p className="kicker">Usuarios</p>
        <h3>{isEdit ? `Editar: ${user.name}` : 'Nuevo usuario'}</h3>

        <form className="product-form" onSubmit={submit}>
          <div className="ff-row">
            <div className="ff">
              <label>Nombre</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="ff">
              <label>Apellido</label>
              <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>
          <div className="ff">
            <label>Correo electrónico</label>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          {/* Nombre de usuario único (solo se asigna/edita; vacío = sin cambios) */}
          <div className="ff">
            <label>Nombre de usuario (único, opcional — vacío: sin cambios)</label>
            <input
              placeholder="p.ej. maria.gomez"
              autoComplete="off"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>

          <div className="ff">
            <label>Rol</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {user?.role === 'user' && <option value="user">Usuario (tienda)</option>}
              {user?.role === 'cliente' && <option value="cliente">Cliente (tienda)</option>}
              <option value="empleado">Empleado</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          {!isEdit && (
            <div className="ff">
              <label>Contraseña inicial (opcional, mín. 4 caracteres)</label>
              <input
                type="password"
                minLength="4"
                autoComplete="new-password"
                placeholder="sin contraseña = no puede iniciar sesión"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          )}

          {error && <p className="login-error"><i className="bi bi-exclamation-circle"></i> {error}</p>}

          <button type="submit" className="btn btn-grad btn-block" disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}

/* ==========================================================
   Modal: asignar / restablecer contraseña (solo admin)
   ========================================================== */
function PasswordModal({ user, onClose, onSaved }) {
  const [pass, setPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.body.classList.add('no-scroll')
    return () => document.body.classList.remove('no-scroll')
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await usersApi.setPassword(user.id, pass)
      onSaved(`✓ Contraseña asignada a ${user.name}. Ya puede iniciar sesión.`)
    } catch (err) {
      setError(err?.message || 'No se pudo asignar la contraseña')
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal admin-modal unav-modal show" role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <button className="btn-icon modal-close" onClick={onClose} aria-label="Cerrar">
          <i className="bi bi-x-lg"></i>
        </button>
        <p className="kicker">Usuarios</p>
        <h3>Contraseña de {user.name}</h3>
        <p className="admin-note">
          {user.tiene_pass
            ? 'Este usuario ya tiene acceso. Escribe una nueva contraseña para restablecerla.'
            : 'Este usuario no puede iniciar sesión todavía. Asígnale una contraseña para darle acceso al panel.'}
        </p>

        <form className="product-form" onSubmit={submit}>
          <div className="ff">
            <label>Nueva contraseña (mín. 4 caracteres)</label>
            <input type="password" required minLength="4" autoComplete="new-password"
              value={pass} onChange={(e) => setPass(e.target.value)} />
          </div>
          {error && <p className="login-error"><i className="bi bi-exclamation-circle"></i> {error}</p>}
          <button type="submit" className="btn btn-grad btn-block" disabled={saving}>
            {saving ? 'Guardando…' : 'Asignar contraseña'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}

function UsersView({ showToast, me }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [passUser, setPassUser] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'staff' | 'clientes'

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await usersApi.getAll()
      setUsers(Array.isArray(data?.data) ? data.data : [])
    } catch (err) {
      setError(err?.message || 'Error cargando usuarios')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  /* Cuentas sin panel: usuarios comunes registrados desde la tienda (rol 'user'
     y los antiguos 'cliente') */
  const esComun = (u) => ['cliente', 'user'].includes(u?.role)

  const remove = async (u) => {
    if (u.id === me?.id) return showToast('✗ No puedes eliminar tu propia cuenta')
    const esCliente = esComun(u)
    const msg = esCliente
      ? `¿Eliminar al usuario "${u.name}" (${u.email}) de la base de datos? Ya no podrá iniciar sesión en la tienda.`
      : `¿Eliminar al usuario "${u.name}"?`
    if (!window.confirm(msg)) return
    try {
      await usersApi.remove(u.id)
      showToast(`✓ ${esCliente ? 'Usuario de la tienda' : 'Usuario'} "${u.name}" eliminado`)
      load()
    } catch (err) {
      showToast('✗ ' + (err?.message || 'No se pudo eliminar'))
    }
  }

  /* Filtro simple: todo · personal del panel · usuarios comunes de la tienda */
  const filtered = users.filter((u) =>
    filter === 'all' ? true : filter === 'clientes' ? esComun(u) : !esComun(u)
  )
  const clientesCount = users.filter(esComun).length

  return (
    <>
      <div className="dash-toolbar">
        <p className="dash-toolbar-info">
          <i className="bi bi-shield-lock"></i> Personal del panel y usuarios registrados desde la
          tienda. Como admin puedes eliminar cualquier cuenta de la base de datos.
        </p>
        <button className="btn btn-grad" onClick={() => setEditing('new')}>
          <i className="bi bi-person-plus"></i> Nuevo usuario
        </button>
      </div>

      <div className="filters" aria-label="Filtrar usuarios" style={{ marginBottom: '1rem' }}>
        <button className={`chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          Todos ({users.length})
        </button>
        <button className={`chip${filter === 'staff' ? ' active' : ''}`} onClick={() => setFilter('staff')}>
          Personal ({users.length - clientesCount})
        </button>
        <button className={`chip${filter === 'clientes' ? ' active' : ''}`} onClick={() => setFilter('clientes')}>
          Usuarios comunes ({clientesCount})
        </button>
      </div>

      {loading && <p className="dash-msg"><span className="spinner"></span> Cargando usuarios…</p>}
      {error && <p className="login-error"><i className="bi bi-exclamation-circle"></i> {error}</p>}

      {!loading && !error && (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th aria-label="Acciones"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="dash-prod">
                      <span className="dash-avatar dash-avatar-sm">
                        {`${u.name?.[0] ?? ''}${u.last_name?.[0] ?? ''}`.toUpperCase() || '—'}
                      </span>
                      <div>
                        <strong>{u.name} {u.last_name ?? ''}</strong>
                        {u.username && <small style={{ display:'block', color:'var(--muted)' }}>@{u.username}</small>}
                      </div>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`dash-pill${u.role === 'admin' ? ' admin' : ''}`}>
                      {u.role === 'admin' ? 'Administrador' : u.role === 'cliente' ? 'Cliente' : u.role === 'user' ? 'Usuario' : 'Empleado'}
                    </span>
                    {!esComun(u) && (
                      <span className={`dash-pill${u.tiene_pass ? '' : ' no-pass'}`}>
                        {u.tiene_pass ? 'Con acceso' : 'Sin acceso'}
                      </span>
                    )}
                    {esComun(u) && (
                      <span className="dash-pill no-pass">
                        <i className={`bi bi-${u.provider === 'google' ? 'google' : u.provider === 'apple' ? 'apple' : 'envelope'}`}></i>
                        {' '}{u.provider === 'google' ? 'Google' : u.provider === 'apple' ? 'Apple' : 'Correo'}
                      </span>
                    )}
                  </td>
                  <td className="dash-actions-cell">
                    <button className="btn-icon" title="Asignar/restablecer contraseña" onClick={() => setPassUser(u)}>
                      <i className="bi bi-key"></i>
                    </button>
                    <button className="btn-icon" title="Editar" onClick={() => setEditing(u)}>
                      <i className="bi bi-pencil-square"></i>
                    </button>
                    <button className="btn-icon danger" title="Eliminar" onClick={() => remove(u)}>
                      <i className="bi bi-trash3"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <UserFormModal
          user={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); showToast(msg); load() }}
        />
      )}

      {passUser && (
        <PasswordModal
          user={passUser}
          onClose={() => setPassUser(null)}
          onSaved={(msg) => { setPassUser(null); showToast(msg); load() }}
        />
      )}
    </>
  )
}

/* ==========================================================
   Dashboard principal
   ========================================================== */
export default function Dashboard({ onLogout, onGoHome }) {
  const user = session.getUser() ?? {}
  const [profile, setProfile] = useState(null)
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('ak-dash-collapsed') === '1')
  const [springing, setSpringing] = useState(false)
  const [chevBounce, setChevBounce] = useState(false)
  const [chevBeat, setChevBeat] = useState(false)
  const [entered, setEntered] = useState(false) // libera .dash-enter-sidebar tras el mount
  const [menuOpen, setMenuOpen] = useState(false)
  const [section, setSection] = useState(sectionFromHash())
  const [counts, setCounts] = useState({ products: '…', users: '…' })
  const [toastMsg, setToastMsg] = useState('')
  const menuRef = useRef(null)
  const springT = useRef(null)
  const bounceT = useRef(null)
  const beatT = useRef(null)

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2600)
  }

  /* Valida el token contra la API al entrar (si expiró, el interceptor manda a login) */
  useEffect(() => {
    authApi.me().then((d) => setProfile(d.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  /* Persiste el sidebar colapsado entre visitas */
  useEffect(() => {
    localStorage.setItem('ak-dash-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  /* ===== Interacción llamativa del colapso =====
     Muelle del panel + chevron con rebote 360° y latido de marca.
     Cada animación se limpia sola al terminar (animationend). */
  const toggleCollapsed = () => {
    setSpringing(true)
    setChevBounce(true)
    setChevBeat(true)
    setCollapsed((v) => !v)
    /* Respaldo a prueba de balas: si animationend no llega (elemento oculto
       por un media query, pestaña en segundo plano…), las clases se limpian
       por timeout — la animación nunca queda pegada. */
    clearTimeout(springT.current)
    clearTimeout(bounceT.current)
    clearTimeout(beatT.current)
    springT.current = setTimeout(() => setSpringing(false), 700)
    bounceT.current = setTimeout(() => setChevBounce(false), 800)
    beatT.current = setTimeout(() => setChevBeat(false), 1100)
  }

  /* Cierra el menú del navbar al hacer clic fuera o con Escape */
  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('click', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  /* Conteos para las tarjetas de resumen (usuarios solo para admin: la API lo exige) */
  useEffect(() => {
    productsApi.getAll().then(({ data }) => setCounts((c) => ({ ...c, products: data?.count ?? 0 }))).catch(() => setCounts((c) => ({ ...c, products: '—' })))
    if (session.getUser()?.role === 'admin') {
      usersApi.getAll().then(({ data }) => setCounts((c) => ({ ...c, users: data?.count ?? 0 }))).catch(() => setCounts((c) => ({ ...c, users: '—' })))
    }
  }, [])

  const u = profile ?? user
  const isAdmin = u.role === 'admin'
  const isEmpleado = u.role === 'empleado'

  /* ===== Guard: solo admin y empleado tienen panel ===== */
  if (!isAdmin && !isEmpleado) return <AccessDenied user={u} onLogout={onLogout} />

  /* Los empleados solo ven Resumen y Productos (modo consulta) */
  const nav = NAV.filter((item) => !item.adminOnly || isAdmin)

  const initials = `${u.name?.[0] ?? 'A'}${u.last_name?.[0] ?? u.lastName?.[0] ?? ''}`.toUpperCase()
  const isActive = (item) =>
    section === item.key || (item.key === 'resumen' && !nav.some((x) => x.key === section && x.key !== 'resumen'))

  return (
    <div className={`dash${collapsed ? ' collapsed' : ''}`}>
      {/* ===== Sidebar ===== */}
      <aside
        className={`dash-sidebar${!entered ? ' dash-enter-sidebar' : ''}${open ? ' open' : ''}${springing ? ' springing' : ''}`}
        onAnimationEnd={(e) => {
          if (e.animationName === 'dashSlideRight') setEntered(true) /* la entrada ya corrió: no interfiere con el muelle */
          if (e.animationName === 'dashSpring') setSpringing(false)
        }}
      >
        <div className="dash-brand">
          <img src={cdn('/assets/brand/logo-ak.png')} alt="Logo AK Creaciones" />
          <span className="brand-name">AK <em>Creaciones</em></span>
        </div>

        <button
          type="button"
          className={`dash-collapse${chevBounce ? ' bounce' : ''}${chevBeat ? ' beat' : ''}`}
          onClick={toggleCollapsed}
          onAnimationEnd={(e) => {
            if (e.animationName === 'collapseSpin') setChevBounce(false)
            if (e.animationName === 'collapseBeat') setChevBeat(false)
          }}
          aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          <i className="bi bi-chevron-double-left"></i>
        </button>

        <nav className="dash-nav" aria-label="Panel">
          {nav.map((item) => (
            <a key={item.href} href={item.href}
              className={`dash-link${isActive(item) ? ' active' : ''}`}
              data-tip={item.label}
              onClick={() => setOpen(false)}>
              <i className={`bi ${item.icon}`}></i>
              <span className="lbl">{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="dash-user">
          <span className="dash-avatar">{initials}</span>
          <div className="dash-user-info">
            <strong>{u.name} {u.last_name ?? u.lastName}</strong>
            <small>{u.role === 'admin' ? 'Administradora' : u.role}</small>
          </div>
          <button className="btn-icon" onClick={onGoHome} aria-label="Volver a la página principal" title="Volver a la página principal">
            <i className="bi bi-house-door"></i>
          </button>
        </div>
      </aside>

      {open && <div className="dash-overlay" onClick={() => setOpen(false)}></div>}

      {/* ===== Contenido ===== */}
      <div className="dash-main">
        <header className="dash-navbar dash-enter-navbar">
          <button className="btn-icon dash-burger" onClick={() => setOpen(!open)} aria-label="Abrir menú">
            <i className="bi bi-list"></i>
          </button>
          <h1 className="dash-title">Panel de administración</h1>
          <div className="dash-actions">
            <span className="dash-chip-role">
              <i className={`bi ${isAdmin ? 'bi-shield-check' : 'bi-person-badge'}`}></i>
              {isAdmin ? 'Admin' : 'Empleado'}
            </span>

            {/* ===== Menú desplegable del navbar ===== */}
            <div className={`dash-menu-wrap${menuOpen ? ' open' : ''}`} ref={menuRef}>
              <button
                type="button"
                className="dash-menu-btn"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <i className="bi bi-grid"></i> Menú <i className="bi bi-chevron-down chev"></i>
              </button>
              <div className="dash-menu" role="menu">
                <p className="dash-menu-label">Secciones</p>
                {nav.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    className={`dash-menu-item${isActive(item) ? ' active' : ''}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <i className={`bi ${item.icon}`}></i> {item.label}
                  </a>
                ))}
                <hr className="dash-menu-sep" />
                <button
                  type="button"
                  role="menuitem"
                  className="dash-menu-item"
                  onClick={() => { setMenuOpen(false); onGoHome?.() }}
                >
                  <i className="bi bi-house-door"></i> Volver a la página principal
                </button>
              </div>
            </div>

            <UserNavbar
              user={u}
              onUpdated={(updated) => setProfile(updated)}
              onLogout={onLogout}
            />
          </div>
        </header>

        <main className="dash-content dash-enter-content">
          {section === 'resumen' && (
            <>
              <div className="dash-welcome">
                <p className="kicker">Resumen</p>
                <h2>¡Hola, <span className="accent">{u.name}</span>! 👋</h2>
                <p className="dash-lead">
                  Sesión iniciada como <strong>{u.email}</strong> con rol{' '}
                  <strong>{isAdmin ? 'Administradora' : 'Empleado'}</strong>.
                  {profile ? ' Token validado contra la API ✓' : ''}
                </p>
              </div>

              <div className="dash-cards dash-enter-cards">
                <a className="dash-card" href="#/dashboard/productos">
                  <i className="bi bi-bag"></i>
                  <div>
                    <h3>Productos ({counts.products})</h3>
                    <p>{isAdmin ? 'Editar precios, imágenes, colores y descripciones' : 'Consultar el catálogo (solo lectura)'}</p>
                  </div>
                </a>
                {isAdmin && (
                  <a className="dash-card" href="#/dashboard/inventario">
                    <i className="bi bi-boxes"></i>
                    <div>
                      <h3>Inventario</h3>
                      <p>Materiales: soutache, perlas, cristales y herrajes (solo admin)</p>
                    </div>
                  </a>
                )}
                {isAdmin && (
                  <a className="dash-card" href="#/dashboard/usuarios">
                    <i className="bi bi-people"></i>
                    <div>
                      <h3>Usuarios ({counts.users})</h3>
                      <p>CRUD de empleados y administradoras</p>
                    </div>
                  </a>
                )}
                <a className="dash-card" href="#/dashboard/delivery">
                  <i className="bi bi-truck"></i>
                  <div>
                    <h3>Pedidos Delivery</h3>
                    <p>Ver pedidos a domicilio de clientes registrados</p>
                  </div>
                </a>
                {isAdmin && (
                  <a className="dash-card" href="#/dashboard/datos-pago">
                    <i className="bi bi-credit-card-2-front"></i>
                    <div>
                      <h3>Datos de pago</h3>
                      <p>Banco, teléfono y cédula del pago móvil que ve el cliente</p>
                    </div>
                  </a>
                )}
              </div>
            </>
          )}

          {section === 'productos' && <ProductsView showToast={showToast} readOnly={!isAdmin} />}
          {section === 'delivery' && <DeliveryView showToast={showToast} isAdmin={isAdmin} />}
          {section === 'pedidos' && <OrdersView />}
          {section === 'datos-pago' &&
            (isAdmin ? (
              <PaymentSettingsView showToast={showToast} />
            ) : (
              // Un empleado que escriba la URL cae aquí: catálogo de solo lectura
              <ProductsView showToast={showToast} readOnly />
            ))}
          {section === 'inventario' &&
            (isAdmin ? (
              <InventarioView showToast={showToast} />
            ) : (
              // Un empleado que escribe la URL de inventario cae aquí: catálogo de solo lectura
              <ProductsView showToast={showToast} readOnly />
            ))}
          {section === 'usuarios' &&
            (isAdmin ? (
              <UsersView showToast={showToast} me={profile} />
            ) : (
              // Un empleado que escribe la URL de usuarios cae aquí: catálogo de solo lectura
              <ProductsView showToast={showToast} readOnly />
            ))}
        </main>
      </div>

      {/* ===== Toast ===== */}
      <div className={`toast${toastMsg ? ' show' : ''}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </div>
  )
}
