import { useEffect, useState } from 'react'
import { money } from '../config.js'
import { storeOrdersApi, storeSession } from '../api/storeAuth.js'
import DeliveryForm from '../cart/DeliveryForm.jsx'
import MobilePaymentModal from '../cart/MobilePaymentModal.jsx'

export default function CartPanel({ open, items, total, onClose, onRemove, onPaid, toast, userSession }) {
  /* ¿Hay un cliente con sesión? Su token permite enviarle la factura por correo */
  const [cliente, setCliente] = useState(() => storeSession.get())
  const activeSession = userSession ?? cliente
  const paymentSession = activeSession
  const [sending, setSending] = useState(false)
  /* Formulario "Delivery a mi localidad": se abre sobre el carrito */
  const [deliveryOpen, setDeliveryOpen] = useState(false)
  /* Ventana de Pago Móvil: muestra los datos que configuró el admin */
  const [pagoOpen, setPagoOpen] = useState(false)

  /* Si el usuario inicia/cierra sesión con el panel abierto, se refleja aquí */
  useEffect(() => {
    const sync = () => setCliente(storeSession.get())
    window.addEventListener('ak-store-session-changed', sync)
    window.addEventListener('ak-session-cleared', sync)
    return () => {
      window.removeEventListener('ak-store-session-changed', sync)
      window.removeEventListener('ak-session-cleared', sync)
    }
  }, [])

  const handleCheckout = async () => {
    /* ========================================================================
       1) NÚMERO QUE RECIBE EL PEDIDO — edítalo aquí cuando quieras.
          Colócalo con su código de país; se aceptan formatos como:
          '+58 414-2277642', '584142277642' o '+584142277642'
       ======================================================================== */
    const WHATSAPP_PEDIDO = '+58 414-2277642'

    if (!items.length) return // carrito vacío: no abrimos WhatsApp

    if (activeSession?.token) {
      const whatsappWindow = window.open('about:blank', '_blank')
      setSending(true)
      try {
        const res = await storeOrdersApi.create(
          items.map((i) => ({ id: i.id, qty: i.qty, color: i.color, size: i.size })),
          activeSession.token
        )
        const orderItems = Array.isArray(res?.items) ? res.items : []
        const lineas = orderItems.map((item) =>
          `• ${item.name}${item.variante ? ` (${item.variante})` : ''} x${item.qty} - ${money(item.price)}`
        )
        const mensaje = [
          '¡Hola! Quisiera realizar el siguiente pedido:',
          '',
          ...lineas,
          '',
          `*Total a pagar:* ${money(res.total)}`,
          `Pedido: ${res.orderNumber}`,
        ].join('\n')
        const phone = WHATSAPP_PEDIDO.replace(/\D/g, '')
        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`
        if (whatsappWindow) whatsappWindow.location.href = whatsappUrl
        const orderToast = res?.invoice?.delivered
          ? `🧾 Pedido ${res?.orderNumber ?? ''} guardado, pendiente de confirmación. Factura: ${res?.email ?? 'correo registrado'}`
          : `🧾 Pedido ${res?.orderNumber ?? ''} guardado, pendiente de confirmación; no se pudo entregar la factura por correo.`
        toast?.(`${orderToast}${whatsappWindow ? '' : ' El navegador bloqueó la ventana de WhatsApp.'}`)
      } catch (err) {
        whatsappWindow?.close()
        toast?.('No se registró el pedido y no se abrió WhatsApp: ' + (err?.message || 'inicia sesión'))
      } finally {
        setSending(false)
      }
    } else {
      location.hash = '#/acceder'
    }
  }

  return (
    <>
      <aside className={`cart-panel${open ? ' open' : ''}`} aria-label="Carrito de compras" aria-hidden={!open}>
        <div className="cart-head">
          <h3><i className="bi bi-bag"></i> Tu carrito</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar carrito">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="cart-body">
          {items.length === 0 ? (
            <div className="cart-empty">
              <i className="bi bi-bag"></i>
              Tu carrito está vacío.<br />¡Agrega algo brillante! ✨
            </div>
          ) : (
            items.map((i) => (
              <div className="ci" key={i.key}>
                <img src={i.img} alt={i.name} />
                <div>
                  <h4>{i.name}</h4>
                  <small>{i.color}{i.size ? ' · ' + i.size : ''} · x{i.qty}</small>
                </div>
                <div className="ci-right">
                  <span className="ci-price">{money(i.price * i.qty)}</span>
                  <button className="ci-remove" onClick={() => onRemove(i.key)} aria-label={`Quitar ${i.name}`}>
                    <i className="bi bi-trash3"></i>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cart-foot">
          <div className="cart-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>

          {/* Cliente con sesión: la factura llega a su correo tras confirmar */}
          {activeSession?.token ? (
            <>
              {/* ===== Delivery a su localidad =====
                  El cliente anexa teléfono, nombre, apellido y dirección;
                  al enviar, el pedido se guarda en la tabla Delivery y el
                  admin/empleados lo ven en el dashboard. */}
              <button
                className="btn btn-delivery"
                onClick={() => setDeliveryOpen(true)}
                disabled={!items.length}
              >
                <i className="bi bi-truck"></i> Delivery a mi localidad
              </button>

              {/* ===== Pago Móvil =====
                  Abre la ventana con los datos que el admin guardó en
                  "Datos de pago"; al confirmar, el pedido se registra y
                  llega al correo del cliente con el monto total. */}
              <button
                className="btn btn-pago-movil"
                onClick={() => setPagoOpen(true)}
                disabled={!items.length}
              >
                <i className="bi bi-credit-card-2-front"></i> Pagar por Pago Móvil
              </button>

              <button className="btn btn-grad" onClick={handleCheckout} disabled={!items.length || sending}>
                <i className="bi bi-whatsapp"></i>
                {sending ? 'Enviando pedido…' : 'Continuar por WhatsApp'}
              </button>
              <p className="cart-note">
                <i className="bi bi-envelope-check"></i> Te llevamos a WhatsApp y te enviaremos la factura a{' '}
                <strong>{activeSession.user?.email}</strong>
              </p>
            </>
          ) : (
            <>
              <button className="btn btn-delivery" onClick={() => (location.hash = '#/acceder')} disabled={!items.length}>
                <i className="bi bi-truck"></i> Delivery a mi localidad
              </button>

              {/* Sin sesión no hay correo al que enviar la confirmación:
                  el botón lleva al login de la tienda. */}
              <button
                className="btn btn-pago-movil"
                onClick={() => setPagoOpen(true)}
                disabled={!items.length}
              >
                <i className="bi bi-credit-card-2-front"></i> Pagar por Pago Móvil
              </button>

              <button className="btn btn-grad" onClick={() => (location.hash = '#/acceder')} disabled={!items.length}>
                <i className="bi bi-person-check"></i> Inicia sesión para realizar el pedido
              </button>
              <p className="cart-note">
                <i className="bi bi-person"></i>{' '}
                <a href="#/acceder" style={{ color: 'var(--turq)', fontWeight: 600 }}>Inicia sesión</a>{' '}
                y te enviaremos la factura de tu pedido a tu correo.
              </p>
            </>
          )}
        </div>
      </aside>
      <div className={`overlay${open ? ' show' : ''}`} onClick={onClose}></div>

      {/* ===== Modal de datos de delivery ===== */}
      <DeliveryForm
        open={deliveryOpen && !!activeSession?.token}
        items={items}
        total={total}
        userSession={activeSession}
        onClose={() => setDeliveryOpen(false)}
        onLogin={() => { setDeliveryOpen(false); location.hash = '#/acceder' }}
        toast={toast}
      />

      {/* ===== Ventana de Pago Móvil ===== */}
      <MobilePaymentModal
        open={pagoOpen}
        items={items}
        total={total}
        userSession={paymentSession}
        onClose={() => setPagoOpen(false)}
        onLogin={() => { setPagoOpen(false); location.hash = '#/acceder' }}
        onPaid={onPaid}
        toast={toast}
      />
    </>
  )
}
