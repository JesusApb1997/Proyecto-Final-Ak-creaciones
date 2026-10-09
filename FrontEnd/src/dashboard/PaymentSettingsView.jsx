import { useEffect, useState } from 'react'
import { paymentSettingsApi } from '../api/client.js'

/**
 * Vista "Datos de pago" del dashboard (solo admin).
 *
 * Lo que el admin escriba aquí se guarda en la tabla "PaymentSettings" de
 * Supabase y es exactamente lo que ve el cliente en la ventana de
 * "Pagar por Pago Móvil" del carrito.
 */
export default function PaymentSettingsView({ showToast }) {
  const [form, setForm] = useState({
    bank_name: '',
    phone: '',
    cedula: '',
    holder_name: '',
    instructions: '',
    enabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await paymentSettingsApi.get()
      const d = res?.data ?? {}
      const next = {
        bank_name: d.bank_name ?? '',
        phone: d.phone ?? '',
        cedula: d.cedula ?? '',
        holder_name: d.holder_name ?? '',
        instructions: d.instructions ?? '',
        enabled: d.enabled !== false,
      }
      setForm(next)
      setPreview(next)
    } catch (err) {
      setError(err?.message || 'No se pudieron cargar los datos de pago')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const { data } = await paymentSettingsApi.update(form)
      const d = data?.data ?? form
      setPreview({
        bank_name: d.bank_name ?? '',
        phone: d.phone ?? '',
        cedula: d.cedula ?? '',
        holder_name: d.holder_name ?? '',
        instructions: d.instructions ?? '',
        enabled: d.enabled !== false,
      })
      showToast('✓ Datos de pago guardados — el carrito de la tienda ya los muestra')
    } catch (err) {
      setError(err?.message || 'No se pudieron guardar los datos de pago')
    } finally {
      setSaving(false)
    }
  }

  const filas = [
    { label: 'Banco', valor: preview?.bank_name, icon: 'bi-bank' },
    { label: 'Teléfono', valor: preview?.phone, icon: 'bi-phone' },
    { label: 'Cédula / RIF', valor: preview?.cedula, icon: 'bi-person-vcard' },
    { label: 'Titular', valor: preview?.holder_name, icon: 'bi-person-badge' },
  ].filter((f) => f.valor)

  return (
    <>
      <div className="dash-toolbar">
        <p className="dash-toolbar-info">
          <i className="bi bi-credit-card-2-front"></i> Datos que verá el cliente al elegir
          <strong> “Pagar por Pago Móvil”</strong> en el carrito de la tienda.
        </p>
      </div>

      {loading ? (
        <p className="pm-status"><span className="spinner"></span> Cargando datos de pago…</p>
      ) : (
        <div className="pago-grid">
          {/* ===== Formulario del admin ===== */}
          <form className="pago-card product-form" onSubmit={submit}>
            <div className="pago-card-head">
              <i className="bi bi-pencil-square"></i>
              <h3>Editar datos de pago</h3>
            </div>

            <div className="ff">
              <label>Banco *</label>
              <input required value={form.bank_name} onChange={set('bank_name')} placeholder="Banco de Venezuela" />
            </div>

            <div className="ff-row">
              <div className="ff">
                <label>Teléfono de pago móvil *</label>
                <input required value={form.phone} onChange={set('phone')} placeholder="+58 412 1234567" />
              </div>
              <div className="ff">
                <label>Cédula / RIF del titular *</label>
                <input required value={form.cedula} onChange={set('cedula')} placeholder="V-12.345.678" />
              </div>
            </div>

            <div className="ff">
              <label>Titular de la cuenta</label>
              <input value={form.holder_name} onChange={set('holder_name')} placeholder="AK Creaciones" />
            </div>

            <div className="ff">
              <label>Instrucciones para el cliente</label>
              <textarea
                rows="3"
                value={form.instructions}
                onChange={set('instructions')}
                placeholder="Envía el pago móvil y guarda el comprobante…"
              />
            </div>

            <label className="pago-toggle">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              <span>
                <strong>Pago móvil activo</strong>
                <small>Si lo desactivas, el carrito avisa que no está disponible.</small>
              </span>
            </label>

            {error && <p className="login-error"><i className="bi bi-exclamation-circle"></i> {error}</p>}

            <div className="pago-actions">
              <button type="submit" className="btn btn-grad" disabled={saving}>
                {saving ? 'Guardando…' : <><i className="bi bi-check2"></i> Guardar datos de pago</>}
              </button>
              <button type="button" className="btn btn-ghost" onClick={load} disabled={saving}>
                <i className="bi bi-arrow-counterclockwise"></i> Recargar
              </button>
            </div>
          </form>

          {/* ===== Vista previa (lo que ve el cliente) ===== */}
          <aside className="pago-card pago-preview">
            <div className="pago-card-head">
              <i className="bi bi-eye"></i>
              <h3>Así lo ve el cliente</h3>
            </div>

            <div className="pm-total">
              <span>Monto a pagar</span>
              <strong>$0.00</strong>
            </div>

            {preview?.enabled === false ? (
              <p className="pm-status">
                <i className="bi bi-info-circle"></i> El pago móvil no está disponible ahora mismo.
              </p>
            ) : filas.length === 0 ? (
              <p className="pm-status">
                <i className="bi bi-info-circle"></i> Completa y guarda los datos para verlos aquí.
              </p>
            ) : (
              <ul className="pm-list">
                {filas.map((f) => (
                  <li key={f.label}>
                    <i className={`bi ${f.icon}`}></i>
                    <span className="pm-label">{f.label}</span>
                    <strong className="pm-value">{f.valor}</strong>
                  </li>
                ))}
              </ul>
            )}

            {preview?.instructions && (
              <p className="pm-note"><i className="bi bi-pencil-square"></i> {preview.instructions}</p>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
