import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { deliveryApi } from '../api/client.js'
import InternationalPhoneInput, { isValidInternationalPhone } from '../components/InternationalPhoneInput.jsx'
import ReportToolbar, { useReportFilter } from './ReportTools.jsx'

const STATUS_COLORS = {
  pendiente: 'warning',
  en_proceso: 'info',
  en_camino: 'primary',
  entregado: 'success',
  cancelado: 'danger',
}

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

const DELIVERY_REPORT_FIELDS = [
  { value: 'name', label: 'Nombre del cliente', getValue: (delivery) => `${delivery.name || ''} ${delivery.last_name || ''}` },
  { value: 'date', label: 'Fecha', type: 'date', getValue: (delivery) => delivery.created_at },
]

const DELIVERY_REPORT_COLUMNS = [
  { label: 'Pedido', getValue: (delivery) => delivery.order_number || `#${delivery.id}` },
  { label: 'Factura', getValue: (delivery) => delivery.invoice_number || '—' },
  { label: 'Cliente', getValue: (delivery) => `${delivery.name || ''} ${delivery.last_name || ''}`.trim() },
  { label: 'Teléfono', getValue: (delivery) => delivery.phone || '—' },
  { label: 'Dirección', getValue: (delivery) => [delivery.address, delivery.localidad].filter(Boolean).join(' · ') || '—' },
  { label: 'Total', getValue: (delivery) => `$${Number(delivery.total || 0).toFixed(2)}` },
  { label: 'Estado', getValue: (delivery) => STATUS_LABELS[delivery.status] || delivery.status || '—' },
  { label: 'Fecha', getValue: (delivery) => formatReportDate(delivery.created_at) },
]

function formatReportDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-VE')
}

export default function DeliveryView({ showToast, isAdmin }) {
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [dispatchForm, setDispatchForm] = useState({ driver_name: '', driver_phone: '', location_confirmed: false })
  const [dispatching, setDispatching] = useState(false)
  const [dispatchError, setDispatchError] = useState('')
  const [whatsappResult, setWhatsappResult] = useState(null)
  const report = useReportFilter(deliveries, DELIVERY_REPORT_FIELDS)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await deliveryApi.getAll()
      setDeliveries(Array.isArray(data?.data) ? data.data : [])
    } catch (err) {
      setError(err?.message || 'Error cargando pedidos de delivery')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const updateStatus = async (id, status) => {
    try {
      await deliveryApi.updateStatus(id, status)
      showToast(`✓ Estado actualizado a ${STATUS_LABELS[status] || status}`)
      load()
      setSelected(null)
    } catch (err) {
      showToast('✗ ' + (err?.message || 'No se pudo actualizar el estado'))
    }
  }

  const openDelivery = (delivery) => {
    setSelected(delivery)
    setDispatchForm({
      driver_name: delivery.driver_name || '',
      driver_phone: isValidInternationalPhone(delivery.driver_phone) ? delivery.driver_phone : '',
      location_confirmed: Boolean(delivery.location_confirmed),
    })
    setDispatchError('')
    setWhatsappResult(null)
  }

  const dispatchDelivery = async (event) => {
    event.preventDefault()
    if (!selected || dispatching) return
    if (!isValidInternationalPhone(dispatchForm.driver_phone)) {
      setDispatchError('Selecciona el país e ingresa un teléfono válido para el conductor.')
      return
    }
    setDispatching(true)
    setDispatchError('')
    setWhatsappResult(null)
    try {
      const { data } = await deliveryApi.dispatch(selected.id, dispatchForm)
      setSelected(data.data)
      setDeliveries((current) => current.map((item) => item.id === selected.id ? data.data : item))
      setWhatsappResult(data.whatsapp)
      if (data.whatsapp?.sent) showToast('✓ Delivery asignado y aviso enviado por WhatsApp')
      else showToast('✓ Delivery guardado. Abre el enlace para enviar el aviso por WhatsApp')
    } catch (err) {
      setDispatchError(err?.message || 'No se pudo asignar el conductor')
    } finally {
      setDispatching(false)
    }
  }

  const remove = async (d) => {
    if (!window.confirm(`¿Eliminar pedido #${d.id} de ${d.name} ${d.last_name || ''}?`)) return
    try {
      await deliveryApi.remove(d.id)
      showToast(`✓ Pedido #${d.id} eliminado`)
      load()
      setSelected(null)
    } catch (err) {
      showToast('✗ ' + (err?.message || 'No se pudo eliminar'))
    }
  }

  const formatDate = (date) => {
    if (!date) return '-'
    try {
      return new Date(date).toLocaleString('es-VE')
    } catch {
      return date
    }
  }

  const parseItems = (items) => {
    if (!items) return []
    try {
      if (typeof items === 'string') return JSON.parse(items)
      return Array.isArray(items) ? items : []
    } catch {
      return []
    }
  }

  return (
    <>
      <div className="dash-toolbar">
        <p className="dash-toolbar-info">
          <i className="bi bi-truck"></i> Pedidos de entrega a domicilio registrados por clientes
        </p>
      </div>

      {loading && <p className="dash-msg"><span className="spinner"></span> Cargando pedidos de delivery...</p>}
      {error && <p className="login-error"><i className="bi bi-exclamation-circle"></i> {error}</p>}

      {!loading && !error && (
        <>
        <ReportToolbar title="Reporte de delivery" fields={DELIVERY_REPORT_FIELDS} columns={DELIVERY_REPORT_COLUMNS} report={report} />
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th aria-label="Seleccionar deliveries">
                  <input type="checkbox" aria-label="Seleccionar todos los deliveries mostrados" checked={report.allVisibleSelected} onChange={report.toggleVisible} disabled={!report.filteredRecords.length} />
                </th>
                <th>Pedido / factura</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Dirección</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th aria-label="Acciones"></th>
              </tr>
            </thead>
            <tbody>
              {report.filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="9" className="report-empty">{deliveries.length ? 'No hay deliveries que coincidan con la búsqueda.' : 'No hay pedidos de delivery aún.'}</td>
                </tr>
              ) : (
                report.filteredRecords.map((d) => (
                  <tr key={d.id}>
                    <td><input type="checkbox" aria-label={`Seleccionar pedido ${d.order_number || d.id}`} checked={report.selectedIds.has(String(d.id))} onChange={() => report.toggleRow(d.id)} /></td>
                    <td>
                      <strong>{d.order_number || `#${d.id}`}</strong>
                      {d.invoice_number && <small style={{ display: 'block', color: 'var(--muted)' }}>{d.invoice_number}</small>}
                    </td>
                    <td>
                      <div>
                        <strong>{d.name} {d.last_name || ''}</strong>
                        {d.user_id && <small style={{ display: 'block', color: 'var(--muted)' }}>Usuario ID: {d.user_id}</small>}
                      </div>
                    </td>
                    <td>{d.phone || '-'}</td>
                    <td>
                      <div style={{ maxWidth: '250px' }}>
                        <small>{d.address || '-'}</small>
                        {d.localidad && <small style={{ display: 'block', color: 'var(--muted)' }}>{d.localidad}</small>}
                        {d.maps_url && <a href={d.maps_url} target="_blank" rel="noreferrer" style={{ display: 'block', color: 'var(--turq)' }}>Abrir ubicación</a>}
                      </div>
                    </td>
                    <td><strong>${Number(d.total || 0).toFixed(2)}</strong></td>
                    <td>
                      <span className={`dash-pill status-${STATUS_COLORS[d.status] || 'secondary'}`}>
                        {STATUS_LABELS[d.status] || d.status}
                      </span>
                    </td>
                    <td><small>{formatDate(d.created_at)}</small></td>
                    <td className="dash-actions-cell">
                      <button className="btn-icon" title="Ver detalles" onClick={() => openDelivery(d)}>
                        <i className="bi bi-eye"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </>
      )}

      {selected && createPortal(
        <div className="modal admin-modal show" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div className="modal-box admin-edit-modal delivery-edit-modal">
            <button className="btn-icon modal-close" onClick={() => setSelected(null)} aria-label="Cerrar">
              <i className="bi bi-x-lg"></i>
            </button>
            <p className="kicker">Pedido de Delivery</p>
            <h3>Pedido {selected.order_number || `#${selected.id}`}</h3>
            <p className="admin-note">Factura: <strong>{selected.invoice_number || '—'}</strong></p>

            <div className="ff-row" style={{ marginBottom: '1rem' }}>
              <div className="ff">
                <label>Cliente</label>
                <div style={{ padding: '0.5rem', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <strong>{selected.name} {selected.last_name || ''}</strong>
                </div>
              </div>
              <div className="ff">
                <label>Teléfono</label>
                <div style={{ padding: '0.5rem', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {selected.phone || '-'}
                </div>
              </div>
            </div>

            <div className="ff-row" style={{ marginBottom: '1rem' }}>
              <div className="ff">
                <label>Dirección</label>
                <div style={{ padding: '0.5rem', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {selected.address || '-'}
                </div>
              </div>
              <div className="ff">
                <label>Localidad</label>
                <div style={{ padding: '0.5rem', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {selected.localidad || '-'}
                </div>
              </div>
            </div>

            {selected.maps_url && (
              <p className="pm-note"><a href={selected.maps_url} target="_blank" rel="noreferrer">Abrir ubicación de Google Maps</a></p>
            )}

            <div className="ff" style={{ marginBottom: '1rem' }}>
              <label>Estado</label>
              <select
                value={selected.status}
                onChange={(e) => updateStatus(selected.id, e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              >
                <option value="pendiente">Pendiente</option>
                <option value="en_proceso">En proceso</option>
                <option value="en_camino" disabled={!selected.stock_deducted_at && selected.status !== 'en_camino'}>En camino (requiere despacho)</option>
                <option value="entregado" disabled={!selected.stock_deducted_at}>Entregado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            {selected.notes && (
              <div className="ff" style={{ marginBottom: '1rem' }}>
                <label>Notas</label>
                <div style={{ padding: '0.5rem', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {selected.notes}
                </div>
              </div>
            )}

            <div className="ff-row" style={{ marginBottom: '1rem' }}>
              <div className="ff">
                <label>Conductor asignado</label>
                <div style={{ padding: '0.5rem', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {selected.driver_name || 'Sin asignar'}
                </div>
              </div>
              <div className="ff">
                <label>Teléfono del conductor</label>
                <div style={{ padding: '0.5rem', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {selected.driver_phone || '—'}
                </div>
              </div>
              <div className="ff">
                <label>Ubicación del cliente</label>
                <div style={{ padding: '0.5rem', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {selected.location_confirmed ? 'Confirmada' : 'Pendiente de confirmar'}
                </div>
              </div>
              <div className="ff">
                <label>Notificación WhatsApp</label>
                <div style={{ padding: '0.5rem', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {selected.whatsapp_status === 'enviado' ? 'Enviada automáticamente' : selected.whatsapp_status === 'manual' ? 'Pendiente de envío manual' : 'Pendiente'}
                </div>
              </div>
            </div>

            {isAdmin && (
              <form className="product-form" onSubmit={dispatchDelivery}>
                <p className="kicker">Asignación y despacho</p>
                <div className="ff-row">
                  <div className="ff">
                    <label>Nombre del conductor *</label>
                    <input required value={dispatchForm.driver_name} onChange={(e) => setDispatchForm({ ...dispatchForm, driver_name: e.target.value })} disabled={dispatching} />
                  </div>
                  <div className="ff">
                    <label>Teléfono del conductor *</label>
                    <InternationalPhoneInput
                      id="delivery-driver-phone"
                      required
                      value={dispatchForm.driver_phone}
                      onChange={(phone) => setDispatchForm({ ...dispatchForm, driver_phone: phone })}
                      disabled={dispatching}
                    />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '.55rem' }}>
                  <input type="checkbox" checked={dispatchForm.location_confirmed} onChange={(e) => setDispatchForm({ ...dispatchForm, location_confirmed: e.target.checked })} disabled={dispatching} />
                  Confirmé la ubicación con el cliente
                </label>
                {dispatchError && <p className="login-error" role="alert">{dispatchError}</p>}
                {whatsappResult?.sent && <p className="pm-status"><i className="bi bi-check-circle"></i> Aviso enviado automáticamente por WhatsApp.</p>}
                {whatsappResult?.url && <p className="pm-status">WhatsApp automático no está conectado. <a href={whatsappResult.url} target="_blank" rel="noreferrer">Abrir mensaje con factura en WhatsApp</a></p>}
                <button type="submit" className="btn btn-grad btn-block" disabled={dispatching}>
                  {dispatching ? 'Guardando y notificando…' : 'Verificar, asignar y avisar al cliente'}
                </button>
              </form>
            )}

            {parseItems(selected.items).length > 0 && (
              <div className="ff" style={{ marginBottom: '1rem' }}>
                <label>Productos</label>
                <div style={{ padding: '0.75rem', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {parseItems(selected.items).map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.9rem' }}>
                      <span>{item.name} {item.variante ? `(${item.variante})` : ''} x{item.qty}</span>
                      <span>${(Number(item.price || 0) * Number(item.qty || 0)).toFixed(2)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>Total</span>
                    <span>${Number(selected.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '1rem' }}>
              Creado: {formatDate(selected.created_at)}
              {selected.updated_at && <> • Actualizado: {formatDate(selected.updated_at)}</>}
            </div>

            {isAdmin && (
              <button className="btn btn-danger btn-block" onClick={() => remove(selected)} style={{ background: '#dc3545', color: 'white', border: 'none' }}>
                <i className="bi bi-trash3"></i> Eliminar pedido
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
