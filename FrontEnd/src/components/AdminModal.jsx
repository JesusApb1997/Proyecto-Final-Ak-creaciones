import { useState } from 'react'
import { PRODUCT_CATEGORIES as CATEGORIES, PRODUCT_IMAGES as IMAGES, cdn } from '../config.js'

/* Solo se muestra el formulario si hay sesión admin (JWT).
   El login real vive en #/login (LoginPage) contra POST /api/auth/login. */
export default function AdminModal({ open, isAdmin, onPublish, onClose }) {
  const [form, setForm] = useState({ name: '', cat: 'zarcillos', price: '', desc: '', img: cdn(IMAGES[0]), color: 'Dorado, Plateado' })
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const submitProduct = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onPublish(form)
      setForm({ name: '', cat: 'zarcillos', price: '', desc: '', img: cdn(IMAGES[0]), color: 'Dorado, Plateado' })
      onClose()
    } catch {
      /* el toast de error ya lo muestra App */
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="modal admin-modal show"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-box">
        <button className="btn-icon modal-close" onClick={onClose} aria-label="Cerrar">
          <i className="bi bi-x-lg"></i>
        </button>

        <p className="kicker">Panel de administración</p>
        <h3>Agregar producto</h3>

        {!isAdmin ? (
          <>
            <p className="admin-note">
              <i className="bi bi-shield-lock"></i> Necesitas una sesión de administrador para
              publicar productos.
            </p>
            <a href="#/login" className="btn btn-grad btn-block">
              <i className="bi bi-box-arrow-in-right"></i> Ir a iniciar sesión
            </a>
          </>
        ) : (
          <>
            <p className="admin-note">
              <i className="bi bi-shield-lock"></i> Sesión iniciada. El producto se guardará en la
              base de datos vía <code>POST /api/products</code>.
            </p>
            <form className="product-form" onSubmit={submitProduct}>
              <div className="ff">
                <label>Nombre</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="ff">
                <label>Categoría</label>
                <select value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="ff">
                <label>Precio ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="ff">
                <label>Descripción</label>
                <input required value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
              </div>
              <div className="ff">
                <label>Color / acabado (separa varios con coma)</label>
                <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Dorado, Plateado" />
              </div>
              <div className="ff">
                <label>Imagen (elige una de la galería)</label>
                <select value={form.img} onChange={(e) => setForm({ ...form, img: e.target.value })}>
                  {IMAGES.map((img) => (
                    <option key={img} value={cdn(img)}>{img.replace('/products/', '').replace('.jpeg', '')}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-grad btn-block" disabled={saving}>
                {saving ? 'Publicando…' : 'Publicar producto'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
