import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { deliveryApi } from '../api/client.js'

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

export default function DeliveryView({ showToast, isAdmin }) {
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

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
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>#</th>
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
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
                    No hay pedidos de delivery aún
                  </td>
                </tr>
              ) : (
                deliveries.map((d) => (
                  <tr key={d.id}>
                    <td><strong>#{d.id}</strong></td>
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
                      <button className="btn-icon" title="Ver detalles" onClick={() => setSelected(d)}>
                        <i className="bi bi-eye"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && createPortal(
        <div className="modal admin-modal show" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div className="modal-box" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <button className="btn-icon modal-close" onClick={() => setSelected(null)} aria-label="Cerrar">
              <i className="bi bi-x-lg"></i>
            </button>
            <p className="kicker">Pedido de Delivery</p>
            <h3>Pedido #{selected.id}</h3>

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

            <div className="ff" style={{ marginBottom: '1rem' }}>
              <label>Estado</label>
              <select
                value={selected.status}
                onChange={(e) => updateStatus(selected.id, e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              >
                <option value="pendiente">Pendiente</option>
                <option value="en_proceso">En proceso</option>
                <option value="en_camino">En camino</option>
                <option value="entregado">Entregado</option>
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
