import { useEffect, useState } from 'react'
import { money } from '../config.js'
import { paymentSettingsApi } from '../api/client.js'
import { storeOrdersApi } from '../api/storeAuth.js'

/**
 * Ventana de Pago Móvil del carrito.
 *
 * Los datos (banco, teléfono, cédula y titular) los escribe el admin en la
 * pestaña "Datos de pago" del dashboard y llegan aquí desde
 * GET /api/payment-settings, así que lo que el admin cambie se ve al instante.
 *
 * Al pulsar "Ya realicé el pago", el backend registra el pedido y le envía al
 * correo del cliente la confirmación con el monto total del carrito.
 */
export default function MobilePaymentModal({ open, items, total, userSession, onClose, onLogin, toast, onPaid }) {
  const [datos, setDatos] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [copiado, setCopiado] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [reportError, setReportError] = useState('')
  const [payerPhone, setPayerPhone] = useState('')
  const [payerBank, setPayerBank] = useState('')
  const [reportedAmount, setReportedAmount] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState('')

  useEffect(() => {
    if (!receipt) {
      setReceiptPreview('')
      return undefined
    }
    const url = URL.createObjectURL(receipt)
    setReceiptPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [receipt])

  useEffect(() => {
    if (!open) return
    let activo = true
    setLoading(true)
    setError('')
    paymentSettingsApi
      .get()
      .then((res) => { if (activo) setDatos(res?.data ?? null) })
      .catch((err) => { if (activo) setError(err?.message || 'No se pudieron cargar los datos de pago') })
      .finally(() => { if (activo) setLoading(false) })
    return () => { activo = false }
  }, [open])

  const copiar = async (valor, campo) => {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(campo)
      setTimeout(() => setCopiado(''), 1500)
    } catch {
      /* portapapeles no disponible: no es crítico */
    }
  }

  const finalizarReporte = async (event) => {
    event.preventDefault()
    setReportError('')
    if (!items.length) return
    if (!userSession?.token) {
      onLogin?.()
      return
    }
    const hasCompleteDetails = Boolean(
      payerPhone.trim() && payerBank.trim() && referenceNumber.trim() && reportedAmount.trim()
    )
    if (reportedAmount && (!Number.isFinite(Number(reportedAmount)) || Number(reportedAmount) <= 0)) {
      setReportError('Escribe un monto válido mayor que cero.')
      return
    }
    if (!receipt && !hasCompleteDetails) {
      setReportError('Adjunta la captura o completa teléfono, banco, monto y referencia.')
      return
    }
    setSending(true)
    try {
      const res = await storeOrdersApi.payMobile(
        items.map((i) => ({ id: i.id, qty: i.qty, color: i.color, size: i.size })),
        userSession.token,
        { payerPhone, payerBank, reportedAmount, referenceNumber, receipt }
      )
      toast?.(
        res?.invoice?.delivered
          ? `✓ Reporte ${res?.orderNumber ?? ''} guardado por ${money(res?.total ?? total)}. Enviamos la factura a ${res?.email ?? 'tu correo'}.`
          : `✓ Reporte ${res?.orderNumber ?? ''} guardado por ${money(res?.total ?? total)}. No se pudo enviar la factura por correo.`
      )
      onPaid?.()
      setReportOpen(false)
      onClose()
    } catch (err) {
      setReportError(err?.message || 'No se pudo guardar el reporte de pago.')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  const filas = [
    { label: 'Banco', valor: datos?.bank_name, icon: 'bi-bank' },
    { label: 'Teléfono', valor: datos?.phone, icon: 'bi-phone' },
    { label: 'Cédula / RIF', valor: datos?.cedula, icon: 'bi-person-vcard' },
    { label: 'Titular', valor: datos?.holder_name, icon: 'bi-person-badge' },
  ].filter((f) => f.valor)

  return (
    <div className="modal show" role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !sending) onClose() }}>
      <div className="modal-box pm-box">
        <button className="btn-icon modal-close" onClick={onClose} aria-label="Cerrar" disabled={sending}>
          <i className="bi bi-x-lg"></i>
        </button>

        <p className="kicker">Pago Móvil</p>
        <h3>{reportOpen ? 'Reportar pago realizado' : 'Datos para tu pago'}</h3>

        <div className="pm-total">
          <span>Monto a pagar</span>
          <strong>{money(total)}</strong>
        </div>

        {loading && <p className="pm-status"><span className="spinner"></span> Cargando datos de pago…</p>}
        {error && <p className="login-error"><i className="bi bi-exclamation-circle"></i> {error}</p>}

        {!reportOpen && !loading && !error && datos && datos.enabled === false && (
          <p className="pm-status">
            <i className="bi bi-info-circle"></i> El pago móvil no está disponible en este momento.
            Escribe por WhatsApp para coordinar tu pago.
          </p>
        )}

        {!reportOpen && !loading && !error && datos && datos.enabled !== false && (
          <>
            {/* Si la administración aún no cargó los datos, no mostramos una
                lista vacía: se lo decimos al cliente y lo mandamos a WhatsApp. */}
            {filas.length === 0 ? (
              <p className="pm-status">
                <i className="bi bi-info-circle"></i> La administración todavía no cargó los datos
                del pago móvil. Escríbenos por WhatsApp y coordinamos tu pago.
              </p>
            ) : (
              <ul className="pm-list">
                {filas.map((f) => (
                  <li key={f.label}>
                    <i className={`bi ${f.icon}`}></i>
                    <span className="pm-label">{f.label}</span>
                    <strong className="pm-value">{f.valor}</strong>
                    <button
                      type="button"
                      className="pm-copy"
                      onClick={() => copiar(f.valor, f.label)}
                      title={`Copiar ${f.label}`}
                    >
                      <i className={`bi ${copiado === f.label ? 'bi-check2' : 'bi-clipboard'}`}></i>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {datos.instructions && (
              <p className="pm-note"><i className="bi bi-pencil-square"></i> {datos.instructions}</p>
            )}

            <p className="pm-note">
              <i className="bi bi-envelope-check"></i> Después de pagar, reporta el pago para guardar
              el pedido y enviar la factura a tu correo.
            </p>

            <div className="pm-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={sending}>
                Cancelar
              </button>
              {userSession?.token ? (
                <button type="button" className="btn btn-grad" onClick={() => { setReportError(''); setReportOpen(true) }} disabled={!items.length}>
                  <i className="bi bi-check2-circle"></i> Ya realicé el pago
                </button>
              ) : (
                <button type="button" className="btn btn-grad" onClick={onLogin} disabled={sending}>
                  <i className="bi bi-person-circle"></i> Iniciar sesión para confirmar
                </button>
              )}
            </div>
          </>
        )}

        {reportOpen && (
          <form className="product-form" onSubmit={finalizarReporte}>
            <p className="pm-note">Adjunta la captura del comprobante o completa los cuatro datos del pago.</p>
            <div className="ff">
              <label htmlFor="payment-receipt">Captura del pago (opcional si completas los datos)</label>
              <input
                id="payment-receipt"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  if (file && file.size > 5 * 1024 * 1024) {
                    setReceipt(null)
                    setReportError('La captura no puede superar 5 MB.')
                    event.target.value = ''
                    return
                  }
                  setReportError('')
                  setReceipt(file)
                }}
                disabled={sending}
              />
              {receiptPreview && (
                <div className="ff-img-preview">
                  <img src={receiptPreview} alt="Vista previa del comprobante" />
                </div>
              )}
            </div>
            <div className="ff-row">
              <div className="ff">
                <label htmlFor="payment-phone">Teléfono desde el que pagaste</label>
                <input id="payment-phone" type="tel" value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)} disabled={sending} />
              </div>
              <div className="ff">
                <label htmlFor="payment-bank">Banco emisor</label>
                <input id="payment-bank" value={payerBank} onChange={(e) => setPayerBank(e.target.value)} disabled={sending} />
              </div>
              <div className="ff">
                <label htmlFor="payment-amount">Monto pagado</label>
                <input id="payment-amount" type="number" min="0.01" step="0.01" value={reportedAmount} onChange={(e) => setReportedAmount(e.target.value)} disabled={sending} />
              </div>
              <div className="ff">
                <label htmlFor="payment-reference">Número de referencia</label>
                <input id="payment-reference" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} disabled={sending} />
              </div>
            </div>
            {reportError && <p className="login-error" role="alert"><i className="bi bi-exclamation-circle"></i> {reportError}</p>}
            <div className="pm-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setReportOpen(false)} disabled={sending}>Volver</button>
              <button type="submit" className="btn btn-grad" disabled={sending || !items.length}>
                {sending ? <><span className="spinner"></span> Guardando…</> : <><i className="bi bi-check2-circle"></i> Finalizar</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
