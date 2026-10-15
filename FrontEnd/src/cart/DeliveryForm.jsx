import { lazy, Suspense, useState } from 'react'
import { storeSession } from '../api/storeAuth.js'
import { deliveryApi } from '../api/client.js'
import { WHATSAPP_NUMBER, money } from '../config.js'
import InternationalPhoneInput, { isValidInternationalPhone } from '../components/InternationalPhoneInput.jsx'

const DeliveryLocationPicker = lazy(() => import('./DeliveryLocationPicker.jsx'))

export default function DeliveryForm({ open, items, total, onClose, toast, userSession, onLogin }) {
  const cliente = userSession ?? storeSession.get()
  const [form, setForm] = useState({
    name: cliente?.user?.name || '',
    last_name: cliente?.user?.last_name ?? cliente?.user?.lastName ?? '',
    phone: '',
    address: '',
    maps_url: '',
    localidad: '',
    notes: '',
  })
  const [sending, setSending] = useState(false)
  const [submitted, setSubmitted] = useState(null)
  const [mapPickerOpen, setMapPickerOpen] = useState(false)

  const close = () => {
    setSubmitted(null)
    setMapPickerOpen(false)
    onClose()
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!cliente?.token) {
      onLogin?.()
      return
    }
    if (!form.name.trim() || !form.last_name.trim() || !form.phone.trim() || (!form.address.trim() && !form.maps_url.trim())) {
      toast?.('✗ Completa nombre, apellido, teléfono y una dirección escrita o enlace de Maps')
      return
    }
    if (!isValidInternationalPhone(form.phone)) {
      toast?.('✗ Selecciona el país e ingresa un número de teléfono válido')
      return
    }

    setSending(true)
    try {
      const payload = {
        ...form,
        total: total,
        maps_url: form.maps_url.trim(),
        items: items.map((i) => ({
          id: i.id,
          name: i.name,
          qty: i.qty,
          price: i.price,
          variante: [i.color, i.size].filter(Boolean).join(' · '),
        })),
      }
      const response = await deliveryApi.create(payload, cliente.token)
      const order = response?.data?.data
      const lines = (order?.items || items).map((item) => {
        const variant = item.variante || [item.color, item.size].filter(Boolean).join(' · ')
        return `• ${item.name}${variant ? ` (${variant})` : ''} ×${item.qty} — ${money(Number(item.price) * Number(item.qty))}`
      })
      const message = [
        'Hola AK Creaciones, envié una solicitud de delivery y quiero coordinar el pago.',
        `Pedido: ${order?.order_number || `#${order?.id || ''}`}`,
        `Factura: ${order?.invoice_number || 'Pendiente'}`,
        ...lines,
        `Total: ${money(Number(order?.total ?? total))}`,
        `Entrega: ${form.address || form.maps_url}`,
      ].join('\n')
      setSubmitted({ ...order, whatsappUrl: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}` })
    } catch (err) {
      toast?.('✗ ' + (err?.message || 'No se pudo enviar el pedido'))
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal show" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="modal-box" style={{ maxWidth: '500px' }}>
        <button className="btn-icon modal-close" onClick={close} aria-label="Cerrar">
          <i className="bi bi-x-lg"></i>
        </button>
        <p className="kicker">Delivery a tu localidad</p>
        <h3>{submitted ? 'Solicitud recibida' : 'Datos para la entrega'}</h3>

        {submitted ? (
          <div className="product-form">
            <p className="pm-status"><i className="bi bi-check-circle"></i> Pedido {submitted.order_number} guardado en el dashboard.</p>
            <p className="admin-note">Factura: <strong>{submitted.invoice_number}</strong> · Total: <strong>{money(Number(submitted.total ?? total))}</strong></p>
            <a className="btn btn-grad btn-block" href={submitted.whatsappUrl} target="_blank" rel="noopener noreferrer">
              <i className="bi bi-whatsapp"></i> Contactar para coordinar el pago
            </a>
            <button type="button" className="btn btn-ghost btn-block" onClick={close}>Listo</button>
          </div>
        ) : (
        <form onSubmit={submit} className="product-form">
          <div className="ff-row">
            <div className="ff">
              <label>Nombre *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="ff">
              <label>Apellido *</label>
              <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>

          <div className="ff">
            <label>Teléfono *</label>
            <InternationalPhoneInput
              id="delivery-phone"
              required
              value={form.phone}
              onChange={(phone) => setForm({ ...form, phone })}
            />
          </div>

          <div className="ff">
            <label>Dirección escrita</label>
            <textarea rows="2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Calle, número, referencia..." />
          </div>

          <div className="ff">
            <label>Ubicación de Google Maps (opcional si escribes la dirección)</label>
            <div className="maps-url-control">
              <input type="url" value={form.maps_url} onChange={(e) => setForm({ ...form, maps_url: e.target.value })} placeholder="https://maps.app.goo.gl/..." />
              <button
                type="button"
                className="maps-picker-toggle"
                aria-label={mapPickerOpen ? 'Cerrar selector de Google Maps' : 'Seleccionar ubicación en Google Maps'}
                aria-expanded={mapPickerOpen}
                onClick={() => setMapPickerOpen((isOpen) => !isOpen)}
              >
                <i className="bi bi-geo-alt-fill" aria-hidden="true"></i>
              </button>
            </div>
            {mapPickerOpen && (
              <Suspense fallback={<p className="delivery-map-loading" role="status">Cargando mapa...</p>}>
                <DeliveryLocationPicker
                  onCancel={() => setMapPickerOpen(false)}
                  onSelect={(mapsUrl) => {
                    setForm((current) => ({ ...current, maps_url: mapsUrl }))
                    setMapPickerOpen(false)
                  }}
                />
              </Suspense>
            )}
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
            <strong>Total: {money(total)}</strong>
            {items.map((item, index) => <small key={`${item.key}-${index}`} style={{ display: 'block', color: 'var(--muted)' }}>{item.name} ×{item.qty}{[item.color, item.size].filter(Boolean).length ? ` · ${[item.color, item.size].filter(Boolean).join(' · ')}` : ''}</small>)}
          </div>

          <button type="submit" className="btn btn-grad btn-block" disabled={sending}>
            {sending ? 'Enviando...' : 'Enviar pedido y coordinar por WhatsApp'}
          </button>
        </form>
        )}
      </div>
    </div>
  )
}
