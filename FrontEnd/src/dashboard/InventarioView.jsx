import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { inventarioApi, uploadsApi } from '../api/client.js'
import { INVENTARIO_IMAGES, cdn } from '../config.js'

/* ==========================================================================
   Vista: Inventario (solo admin) — materiales para fabricar los productos
   Edita: cantidad + unidad (cm / m / unidades), color, tipo, imagen y notas
   ========================================================================== */

const TIPOS = ['soutache', 'perlas', 'cristales', 'mostacillas', 'canteras', 'hilos', 'herrajes', 'otros']
const UNIDADES = ['cm', 'm', 'unidades']
const IMAGENES_INV = INVENTARIO_IMAGES

const UNIDAD_LARGA = { cm: 'centímetros', m: 'metros', unidades: 'unidades' }

/* Ajusta la cantidad al cambiar de unidad (m ↔ cm). Unidades no se convierte. */
const convertir = (cantidad, de, a) => {
  const n = Number(cantidad)
  if (Number.isNaN(n)) return n
  if (de === a) return n
  if (de === 'm' && a === 'cm') return Math.round(n * 100 * 100) / 100
  if (de === 'cm' && a === 'm') return Math.round(n / 100 * 100) / 100
  return n // hacia/desde 'unidades': se mantiene el número
}

const tipoIcon = (t) =>
  ({
    soutache: 'bi-vector-pen',
    perlas: 'bi-circle-fill',
    cristales: 'bi-gem',
    mostacillas: 'bi-grid-3x3-gap-fill',
    canteras: 'bi-diamond-half',
    hilos: 'bi-thread',
    herrajes: 'bi-nut-fill',
    otros: 'bi-box-seam',
  })[t] || 'bi-box-seam'

/* ---------- Badge de stock bajo ---------- */
const lowStock = (item) => {
  if (item.unidad === 'unidades') return item.cantidad < 20
  return item.cantidad < 5 // cm o m
}

/* ==========================================================
   Modal: crear / editar material
   ========================================================== */
function MaterialFormModal({ material, onClose, onSaved }) {
  const isEdit = !!material?.id
  const [form, setForm] = useState({
    nombre: material?.nombre ?? '',
    tipo: material?.tipo ?? 'soutache',
    color: material?.color ?? '',
    cantidad: material?.cantidad ?? '',
    unidad: material?.unidad ?? 'm',
    img: material?.img ?? cdn(IMAGENES_INV[0]),
    notas: material?.notas ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  /* Cambiar unidad convierte la cantidad (m ↔ cm) para no corromper el stock */
  const changeUnidad = (nueva) => {
    if (form.cantidad !== '') {
      setForm({ ...form, unidad: nueva, cantidad: convertir(form.cantidad, form.unidad, nueva) })
    } else {
      setForm({ ...form, unidad: nueva })
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const data = await uploadsApi.upload(file)
      // data.url ya es la URL pública en Supabase Storage (o local en dev)
      setForm((f) => ({ ...f, img: data.url }))
      // Auto-guardar en la BD si estamos editando un material existente
      if (material?.id) {
        try {
          await inventarioApi.update(material.id, { img: data.url })
          onSaved?.('✓ Imagen subida a Supabase y guardada en la BD')
        } catch {
          onSaved?.('⚠ Imagen subida, pero no se pudo actualizar el material')
        }
      }
    } catch (err) {
      setError(err?.message || 'No se pudo subir la imagen')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        nombre: form.nombre,
        tipo: form.tipo,
        color: form.color || null,
        cantidad: Number(form.cantidad),
        unidad: form.unidad,
        img: form.img || null,
        notas: form.notas || null,
      }
      if (isEdit) await inventarioApi.update(material.id, payload)
      else await inventarioApi.create(payload)
      onSaved(isEdit ? '✓ Material actualizado' : '✓ Material agregado al inventario')
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el material')
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
        <p className="kicker">Inventario</p>
        <h3>{isEdit ? `Editar: ${material.nombre}` : 'Nuevo material'}</h3>

        <form className="product-form" onSubmit={submit}>
          <div className="ff">
            <label>Nombre del material</label>
            <input required value={form.nombre} onChange={set('nombre')} placeholder="Ej: Soutache vino" />
          </div>

          <div className="ff-row">
            <div className="ff">
              <label>Tipo</label>
              <select value={form.tipo} onChange={set('tipo')}>
                {TIPOS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className="ff">
              <label>Color</label>
              <input value={form.color} onChange={set('color')} placeholder="Ej: Vino, Dorado…" />
            </div>
          </div>

          {/* Cantidad + unidad (cm / m / unidades) */}
          <div className="ff-row">
            <div className="ff">
              <label>Cantidad</label>
              <input
                type="number" min="0" step="0.01" required
                value={form.cantidad} onChange={set('cantidad')}
                placeholder="0"
              />
            </div>
            <div className="ff">
              <label>Unidad</label>
              <select value={form.unidad} onChange={(e) => changeUnidad(e.target.value)}>
                {UNIDADES.map((u) => <option key={u} value={u}>{UNIDAD_LARGA[u]}</option>)}
              </select>
            </div>
          </div>

          <div className="ff">
            <label>Notas (opcional)</label>
            <textarea rows="2" value={form.notas} onChange={set('notas')}
              placeholder="Ej: proveedor nuevo, ancho 3mm…" />
          </div>

          <div className="ff">
            <label>Imagen</label>
            <div className="ff-img-preview">
              {form.img && <img src={form.img} alt="Vista previa" onError={(e) => { e.currentTarget.style.opacity = 0.25 }} />}
            </div>
            <div className="ff-upload-row">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
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
              <small className="ff-upload-hint">JPG, PNG, WEBP, SVG… · máx. 5 MB</small>
            </div>
            <select value={IMAGENES_INV.some((i) => form.img?.endsWith(i)) ? IMAGENES_INV.find((i) => form.img?.endsWith(i)) : ''} onChange={set('img')}>
              <option value="">— galería de materiales —</option>
              {IMAGENES_INV.map((img) => (
                <option key={img} value={cdn(img)}>{img.replace('/imagenes_prod_inv/', '').replace('.svg', '').replaceAll('-', ' ')}</option>
              ))}
              {!IMAGENES_INV.some((i) => form.img?.endsWith(i)) && form.img && (
                <option value={form.img}>{form.img} (subida / personalizada)</option>
              )}
            </select>
            <input className="ff-custom-url" value={form.img ?? ''} onChange={set('img')}
              placeholder="…o pega una URL / ruta de imagen" />
          </div>

          {error && <p className="login-error"><i className="bi bi-exclamation-circle"></i> {error}</p>}

          <button type="submit" className="btn btn-grad btn-block" disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Agregar material'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}

/* ==========================================================
   Modal: entrada / salida rápida de stock
   ========================================================== */
function StockModal({ material, onClose, onSaved }) {
  const [delta, setDelta] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const aplicar = async (signo) => {
    const n = Number(delta)
    if (!delta || Number.isNaN(n) || n <= 0) {
      setError('Escribe una cantidad mayor que 0')
      return
    }
    setSaving(true)
    setError('')
    const nueva = Math.max(0, Number((material.cantidad + signo * convertir(n, material.unidad, material.unidad)).toFixed(2)))
    try {
      await inventarioApi.update(material.id, { cantidad: nueva })
      onSaved(`✓ ${material.nombre}: ${signo > 0 ? '+' : '−'}${n} ${material.unidad} → ${nueva}`)
    } catch (err) {
      setError(err?.message || 'No se pudo actualizar el stock')
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
        <p className="kicker">Inventario</p>
        <h3>Stock de {material.nombre}</h3>
        <p className="admin-note">
          Actual: <strong>{material.cantidad} {UNIDAD_LARGA[material.unidad]}</strong>
        </p>

        <form className="product-form" onSubmit={(e) => { e.preventDefault(); aplicar(1) }}>
          <div className="ff">
            <label>Cantidad a sumar o restar ({material.unidad})</label>
            <input type="number" min="0" step="0.01" required value={delta}
              onChange={(e) => setDelta(e.target.value)} placeholder="0" autoFocus />
          </div>

          {error && <p className="login-error"><i className="bi bi-exclamation-circle"></i> {error}</p>}

          <div className="dash-actions-cell" style={{ display: 'flex', gap: '.6rem' }}>
            <button type="submit" className="btn btn-grad" disabled={saving} style={{ flex: 1 }}>
              <i className="bi bi-plus-lg"></i> Sumar entrada
            </button>
            <button type="button" className="btn btn-ghost" disabled={saving} style={{ flex: 1 }}
              onClick={() => aplicar(-1)}>
              <i className="bi bi-dash-lg"></i> Restar salida
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

/* ==========================================================
   Vista principal de Inventario
   ========================================================== */
export default function InventarioView({ showToast }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)   // null | 'new' | material
  const [stockItem, setStockItem] = useState(null)
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [query, setQuery] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await inventarioApi.getAll()
      setItems(
        (Array.isArray(data?.data) ? data.data : []).map((m) => ({
          ...m,
          img: cdn(m.img), // resuelve URLs del bucket (y deja pasar las absolutas)
        }))
      )
    } catch (err) {
      setError(err?.message || 'Error cargando inventario')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const remove = async (m) => {
    if (!window.confirm(`¿Eliminar "${m.nombre}" del inventario? Esta acción no se puede deshacer.`)) return
    try {
      await inventarioApi.remove(m.id)
      showToast(`✓ "${m.nombre}" eliminado del inventario`)
      load()
    } catch (err) {
      showToast('✗ ' + (err?.message || 'No se pudo eliminar'))
    }
  }

  /* Filtros */
  const tiposPresentes = ['todos', ...new Set(items.map((i) => i.tipo))]
  const visibles = items.filter((m) => {
    const okTipo = filtroTipo === 'todos' || m.tipo === filtroTipo
    const q = query.trim().toLowerCase()
    const okQuery = !q || `${m.nombre} ${m.color ?? ''} ${m.tipo}`.toLowerCase().includes(q)
    return okTipo && okQuery
  })

  const totalMetros = items
    .filter((i) => i.unidad === 'm')
    .reduce((s, i) => s + Number(i.cantidad), 0)
  const bajos = items.filter(lowStock).length

  return (
    <>
      <div className="dash-toolbar">
        <p className="dash-toolbar-info">
          <i className="bi bi-boxes"></i> Materiales para fabricar los productos. Los cambios se
          guardan en Supabase — este panel solo lo ve la administración.
        </p>
        <button className="btn btn-grad" onClick={() => setEditing('new')}>
          <i className="bi bi-plus-circle"></i> Nuevo material
        </button>
      </div>

      {/* Resumen rápido */}
      <div className="inv-summary">
        <span className="inv-chip"><i className="bi bi-boxes"></i> {items.length} materiales</span>
        <span className="inv-chip"><i className="bi bi-rulers"></i> {totalMetros.toFixed(2)} m de cordón/hilo</span>
        <span className={`inv-chip${bajos ? ' inv-low' : ''}`}>
          <i className="bi bi-exclamation-triangle"></i> {bajos} con stock bajo
        </span>
      </div>

      {/* Filtro por tipo + búsqueda */}
      <div className="inv-filters">
        <div className="filters" style={{ marginBottom: 0 }}>
          {tiposPresentes.map((t) => (
            <button key={t} className={`chip${filtroTipo === t ? ' active' : ''}`} onClick={() => setFiltroTipo(t)}>
              {t === 'todos' ? 'Todos' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="lf-input inv-search">
          <i className="bi bi-search"></i>
          <input placeholder="Buscar material o color…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {loading && <p className="dash-msg"><span className="spinner"></span> Cargando inventario…</p>}
      {error && <p className="login-error"><i className="bi bi-exclamation-circle"></i> {error}</p>}

      {!loading && !error && (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Tipo</th>
                <th>Color</th>
                <th>Cantidad</th>
                <th aria-label="Acciones"></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="dash-prod">
                      <img src={m.img || cdn('/imagenes_prod_inv/cauchos-transparentes.svg')} alt="" loading="lazy"
                        onError={(e) => { e.currentTarget.src = cdn('/imagenes_prod_inv/cauchos-transparentes.svg') }} />
                      <div>
                        <strong>{m.nombre}</strong>
                        {m.notas && <small>{m.notas}</small>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="dash-pill">
                      <i className={`bi ${tipoIcon(m.tipo)}`} style={{ marginRight: '.35rem' }}></i>
                      {m.tipo}
                    </span>
                  </td>
                  <td>{m.color || '—'}</td>
                  <td>
                    {lowStock(m) && (
                      <span className="badge badge-offer" style={{ marginRight: '.4rem' }} title="Stock bajo">¡bajo!</span>
                    )}
                    <strong>{Number(m.cantidad).toLocaleString('es-VE')}</strong>{' '}
                    <small style={{ color: 'var(--muted)' }}>{UNIDAD_LARGA[m.unidad]}</small>
                  </td>
                  <td className="dash-actions-cell">
                    <button className="btn-icon" title="Sumar/restar stock" onClick={() => setStockItem(m)}>
                      <i className="bi bi-plus-slash-minus"></i>
                    </button>
                    <button className="btn-icon" title="Editar material" onClick={() => setEditing(m)}>
                      <i className="bi bi-pencil-square"></i>
                    </button>
                    <button className="btn-icon danger" title="Eliminar" onClick={() => remove(m)}>
                      <i className="bi bi-trash3"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                    No hay materiales con ese criterio… ✨
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <MaterialFormModal
          material={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); showToast(msg); load() }}
        />
      )}

      {stockItem && (
        <StockModal
          material={stockItem}
          onClose={() => setStockItem(null)}
          onSaved={(msg) => { setStockItem(null); showToast(msg); load() }}
        />
      )}
    </>
  )
}
