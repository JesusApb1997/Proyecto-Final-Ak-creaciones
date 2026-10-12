import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { storeOrdersAdminApi } from '../api/client.js'
import { money } from '../config.js'

const STATUS_LABELS = { reportado: 'Pago por verificar', verificado: 'Verificado', rechazado: 'Rechazado' }

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-VE')
}

const readItems = (value) => {
  if (Array.isArray(value)) return value
  try {
    const items = JSON.parse(value || '[]')
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

const readPayment = (value) => {
  if (value && typeof value === 'object') return value
  try { return JSON.parse(value || '{}') } catch { return {} }
}

export default function OrdersView() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [receiptUrl, setReceiptUrl] = useState('')
  const [receiptError, setReceiptError] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)

  useEffect(() => {
    let active = true
    storeOrdersAdminApi.getAll()
      .then(({ data }) => {
        if (active) setOrders(Array.isArray(data?.data) ? data.data : [])
      })
      .catch((err) => {
        if (active) setError(err?.message || 'No se pudieron cargar los pedidos')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selected?.has_receipt) {
      setReceiptUrl('')
      return undefined
    }
    let active = true
    let objectUrl = ''
    setReceiptUrl('')
    setReceiptError('')
    storeOrdersAdminApi.getReceipt(selected.id)
      .then(({ data }) => {
        objectUrl = URL.createObjectURL(data)
        if (active) setReceiptUrl(objectUrl)
        else URL.revokeObjectURL(objectUrl)
      })
      .catch((err) => {
        if (active) setReceiptError(err?.message || 'No se pudo cargar la captura')
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [selected?.id, selected?.has_receipt])

  const updateStatus = async (status) => {
    if (!selected || savingStatus) return
    setSavingStatus(true)
    setError('')
    try {
      const { data } = await storeOrdersAdminApi.updateStatus(selected.id, status)
      setOrders((current) => current.map((order) => order.id === selected.id ? { ...order, ...data.data } : order))
      setSelected((current) => current ? { ...current, ...data.data } : current)
    } catch (err) {
      setError(err?.message || 'No se pudo actualizar el estado del pago')
    } finally {
      setSavingStatus(false)
    }
  }

  return (
    <>
      <div className="dash-toolbar">
        <p className="dash-toolbar-info">
          <i className="bi bi-bag-check"></i> Reportes de Pago Móvil enviados desde el carrito
        </p>
      </div>

      {loading && <p className="dash-msg"><span className="spinner"></span> Cargando pedidos…</p>}
      {error && <p className="login-error"><i className="bi bi-exclamation-circle"></i> {error}</p>}

      {!loading && !error && (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Productos</th>
                <th>Total</th>
                <th>Pago reportado</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th aria-label="Acciones"></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
                    Aún no hay pagos móviles reportados
                  </td>
                </tr>
              ) : orders.map((order) => (
                <tr key={order.id}>
                  <td><strong>{order.order_number}</strong></td>
                  <td>
                    <strong>{order.customer_name}</strong>
                    <small style={{ display: 'block', color: 'var(--muted)' }}>{order.customer_email}</small>
                  </td>
                  <td>
                    {readItems(order.items).map((item, index) => (
                      <div key={`${order.id}-${index}`}>
                        {item.name} ×{item.qty}
                        {item.variante && <small style={{ display: 'block', color: 'var(--muted)' }}>{item.variante}</small>}
                      </div>
                    ))}
                  </td>
                  <td><strong>{money(order.total)}</strong></td>
                  <td>
                    <strong>{order.payer_bank || readPayment(order.payment_details).payer_bank || '—'}</strong>
                    <small style={{ display: 'block', color: 'var(--muted)' }}>
                      {order.reference_number || readPayment(order.payment_details).reference_number || 'Sin referencia'}
                    </small>
                  </td>
                  <td><span className={`dash-pill${order.status === 'verificado' ? '' : ' no-pass'}`}>{STATUS_LABELS[order.status] || order.status}</span></td>
                  <td><small>{formatDate(order.created_at)}</small></td>
                  <td className="dash-actions-cell">
                    <button className="btn-icon" title="Ver pago y comprobante" onClick={() => setSelected(order)}>
                      <i className="bi bi-eye"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && createPortal(
        <div className="modal admin-modal show" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
          <div className="modal-box" style={{ maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto' }}>
            <button className="btn-icon modal-close" onClick={() => setSelected(null)} aria-label="Cerrar">
              <i className="bi bi-x-lg"></i>
            </button>
            <p className="kicker">Pago móvil reportado</p>
            <h3>Pedido {selected.order_number}</h3>
            <p className="admin-note">
              {selected.customer_name} · {selected.customer_email} · {formatDate(selected.created_at)}
            </p>

            <div className="ff-row">
              <div className="ff"><label>Teléfono del pagador</label><strong>{selected.payer_phone || '—'}</strong></div>
              <div className="ff"><label>Banco emisor</label><strong>{selected.payer_bank || '—'}</strong></div>
              <div className="ff"><label>Monto reportado</label><strong>{selected.reported_amount == null ? '—' : money(selected.reported_amount)}</strong></div>
              <div className="ff"><label>Número de referencia</label><strong>{selected.reference_number || '—'}</strong></div>
            </div>

            <div className="ff" style={{ marginTop: '1rem' }}>
              <label>Productos del pedido · total {money(selected.total)}</label>
              {readItems(selected.items).map((item, index) => (
                <div key={`${selected.id}-detail-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '.35rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span>{item.name}{item.variante ? ` · ${item.variante}` : ''} ×{item.qty}</span>
                  <strong>{money(Number(item.price) * Number(item.qty))}</strong>
                </div>
              ))}
            </div>

            {selected.has_receipt && (
              <div className="ff" style={{ marginTop: '1rem' }}>
                <label>Captura del comprobante</label>
                {receiptError && <p className="login-error">{receiptError}</p>}
                {!receiptUrl && !receiptError && <p className="dash-msg"><span className="spinner"></span> Cargando captura…</p>}
                {receiptUrl && <img src={receiptUrl} alt={`Comprobante ${selected.order_number}`} style={{ display: 'block', maxWidth: '100%', maxHeight: '460px', objectFit: 'contain', border: '1px solid var(--border)', borderRadius: '8px' }} />}
              </div>
            )}
            {!selected.has_receipt && <p className="pm-note">No se adjuntó captura; revisa los datos de referencia antes de verificar.</p>}

            <div className="pm-actions" style={{ marginTop: '1.2rem' }}>
              {selected.status === 'reportado' ? (
                <>
                  <button className="btn btn-ghost" onClick={() => updateStatus('rechazado')} disabled={savingStatus}>
                    Rechazar reporte
                  </button>
                  <button className="btn btn-grad" onClick={() => updateStatus('verificado')} disabled={savingStatus}>
                    {savingStatus ? 'Guardando…' : <><i className="bi bi-check2-circle"></i> Verificar pago</>}
                  </button>
                </>
              ) : (
                <span className="dash-pill">{STATUS_LABELS[selected.status] || selected.status}</span>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}