import { useEffect, useState } from 'react'
import { money } from '../config.js'
import { storeOrdersApi, storeSession } from '../api/storeAuth.js'

export default function CartPanel({ open, items, total, onClose, onRemove, toast }) {
  /* ¿Hay un cliente con sesión? Su token permite enviarle la factura por correo */
  const [cliente, setCliente] = useState(() => storeSession.get())
  const [sending, setSending] = useState(false)

  /* Si el usuario inicia/cierra sesión con el panel abierto, se refleja aquí */
  useEffect(() => {
    const sync = () => setCliente(storeSession.get())
    window.addEventListener('ak-store-session-changed', sync)
    return () => window.removeEventListener('ak-store-session-changed', sync)
  }, [])

  const handleCheckout = async () => {
    /* ========================================================================
       1) NÚMERO QUE RECIBE EL PEDIDO — edítalo aquí cuando quieras.
          Colócalo con su código de país; se aceptan formatos como:
          '+58 414-2277642', '584142277642' o '+584142277642'
       ======================================================================== */
    const WHATSAPP_PEDIDO = '+58 414-2277642'

    if (!items.length) return // carrito vacío: no abrimos WhatsApp

    // 2) Armar el mensaje con el formato: • Nombre (variante) xCantidad - $precio
    const lineas = items.map((i) => {
      const variante = [i.color, i.size].filter(Boolean).join(' · ')
      return `• ${i.name}${variante ? ` (${variante})` : ''} x${i.qty} - ${money(i.price)}`
    })
    const mensaje = [
      '¡Hola! Quisiera realizar el siguiente pedido:',
      '',
      ...lineas,
      '',
      `*Total a pagar:* ${money(total)}`,
    ].join('\n')

    // 3) Abrir WhatsApp en una pestaña nueva con el mensaje codificado
    const phone = WHATSAPP_PEDIDO.replace(/\D/g, '') // wa.me acepta solo dígitos
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`, '_blank')

    /* 4) Registrar el pedido en el backend con el token del cliente:
          verifica la identidad, recalcula el total en el servidor y envía a su
          correo la factura estilizada con el monto y el detalle del pedido. */
    if (cliente?.token) {
      setSending(true)
      try {
        const res = await storeOrdersApi.create(
          items.map((i) => ({ id: i.id, qty: i.qty, color: i.color, size: i.size }))
        )
        toast?.(
          `🧾 Pedido ${res?.orderNumber ?? ''} registrado — la factura llegó a ${res?.email ?? 'tu correo'}`
        )
      } catch (err) {
        /* Sin sesión válida o error de red: el pedido por WhatsApp ya salió,
           así que solo avisamos que la factura no pudo enviarse. */
        toast?.('✓ WhatsApp abierto — pero no pudimos enviar la factura: ' + (err?.message || 'inicia sesión'))
      } finally {
        setSending(false)
      }
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
          {cliente?.token ? (
            <>
              <button className="btn btn-grad" onClick={handleCheckout} disabled={!items.length || sending}>
                <i className="bi bi-whatsapp"></i>
                {sending ? 'Enviando pedido…' : 'Continuar por WhatsApp'}
              </button>
              <p className="cart-note">
                <i className="bi bi-envelope-check"></i> Te llevamos a WhatsApp y te enviaremos la factura a{' '}
                <strong>{cliente.user?.email}</strong>
              </p>
            </>
          ) : (
            <>
              <button className="btn btn-grad" onClick={handleCheckout} disabled={!items.length}>
                <i className="bi bi-whatsapp"></i> Continuar por WhatsApp
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
    </>
  )
}
