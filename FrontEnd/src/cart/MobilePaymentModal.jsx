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
export default function MobilePaymentModal({ open, items, total, onClose, toast, onPaid }) {
  const [datos, setDatos] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [copiado, setCopiado] = useState('')

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

  const confirmarPago = async () => {
    if (!items.length) return
    setSending(true)
    try {
      const res = await storeOrdersApi.payMobile(
        items.map((i) => ({ id: i.id, qty: i.qty, color: i.color, size: i.size }))
      )
      toast?.(`💳 ¡Pago registrado! Enviamos la confirmación de ${money(res?.total ?? total)} a ${res?.email ?? 'tu correo'}`)
      onPaid?.()
      onClose()
    } catch (err) {
      toast?.('✗ ' + (err?.message || 'No se pudo registrar el pago'))
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box pm-box">
        <button className="btn-icon modal-close" onClick={onClose} aria-label="Cerrar">
          <i className="bi bi-x-lg"></i>
        </button>

        <p className="kicker">Pago Móvil</p>
        <h3>Datos para tu pago</h3>

        <div className="pm-total">
          <span>Monto a pagar</span>
          <strong>{money(total)}</strong>
        </div>

        {loading && <p className="pm-status"><span className="spinner"></span> Cargando datos de pago…</p>}
        {error && <p className="login-error"><i className="bi bi-exclamation-circle"></i> {error}</p>}

        {!loading && !error && datos && datos.enabled === false && (
          <p className="pm-status">
            <i className="bi bi-info-circle"></i> El pago móvil no está disponible en este momento.
            Escribe por WhatsApp para coordinar tu pago.
          </p>
        )}

        {!loading && !error && datos && datos.enabled !== false && (
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
              <i className="bi bi-envelope-check"></i> Al confirmar, registramos tu pedido y te enviamos
              la confirmación con el monto total a tu correo.
            </p>

            <div className="pm-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={sending}>
                Cancelar
              </button>
              <button type="button" className="btn btn-grad" onClick={confirmarPago} disabled={sending || !items.length}>
                {sending ? 'Registrando…' : <><i className="bi bi-check2-circle"></i> Ya realicé el pago</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
