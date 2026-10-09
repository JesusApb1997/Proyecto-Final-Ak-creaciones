import { useState } from 'react'
import { storeSession } from '../api/storeAuth.js'
import { deliveryApi } from '../api/client.js'

export default function DeliveryForm({ open, items, total, onClose, toast }) {
  const cliente = storeSession.get()
  const [form, setForm] = useState({
    name: cliente?.user?.name || '',
    last_name: cliente?.user?.lastName || '',
    phone: '',
    address: '',
    localidad: '',
    notes: '',
  })
  const [sending, setSending] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.phone || !form.address) {
      toast?.('✗ Completa nombre, teléfono y dirección')
      return
    }

    setSending(true)
    try {
      const payload = {
        ...form,
        user_id: cliente?.user?.id,
        total: total,
        items: items.map((i) => ({
          id: i.id,
          name: i.name,
          qty: i.qty,
          price: i.price,
          variante: [i.color, i.size].filter(Boolean).join(' · '),
        })),
      }
      await deliveryApi.create(payload, cliente?.token)
      toast?.('✓ Pedido de delivery enviado! El admin lo verá en el dashboard.')
      onClose()
      setForm({ name: cliente?.user?.name || '', last_name: cliente?.user?.lastName || '', phone: '', address: '', localidad: '', notes: '' })
    } catch (err) {
      toast?.('✗ ' + (err?.message || 'No se pudo enviar el pedido'))
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal show" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: '500px' }}>
        <button className="btn-icon modal-close" onClick={onClose} aria-label="Cerrar">
          <i className="bi bi-x-lg"></i>
        </button>
        <p className="kicker">Delivery a tu localidad</p>
        <h3>Datos para la entrega</h3>

        <form onSubmit={submit} className="product-form">
          <div className="ff-row">
            <div className="ff">
              <label>Nombre *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="ff">
              <label>Apellido</label>
              <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>

          <div className="ff">
            <label>Teléfono *</label>
            <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+58 412 1234567" />
          </div>

          <div className="ff">
            <label>Dirección de entrega *</label>
            <textarea required rows="2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Calle, número, referencia..." />
          </div>

          <div className="ff">
            <label>Localidad</label>
            <input value={form.localidad} onChange={(e) => setForm({ ...form, localidad: e.target.value })} placeholder="Ciudad / Urbanización" />
          </div>

          <div className="ff">
            <label>Notas adicionales</label>
            <textarea rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Indicaciones para el delivery..." />
          </div>

          <div style={{ background: 'var(--bg)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border)' }}>
            <strong>Total: ${Number(total || 0).toFixed(2)}</strong> • {items.length} producto(s)
          </div>

          <button type="submit" className="btn btn-grad btn-block" disabled={sending}>
            {sending ? 'Enviando...' : 'Enviar pedido de delivery'}
          </button>
        </form>
      </div>
    </div>
  )
}
