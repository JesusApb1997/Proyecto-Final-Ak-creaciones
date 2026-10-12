const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0'
const ACCESS_TOKEN = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim()
const PHONE_NUMBER_ID = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim()
const TEMPLATE_NAME = (process.env.WHATSAPP_DELIVERY_TEMPLATE_NAME || '').trim()
const TEMPLATE_LANGUAGE = (process.env.WHATSAPP_DELIVERY_TEMPLATE_LANGUAGE || 'es').trim()

function buildMessage(delivery) {
  const location = [delivery.address, delivery.localidad, delivery.maps_url].filter(Boolean).join(' · ')
  return [
    `Hola ${delivery.name}${delivery.last_name ? ` ${delivery.last_name}` : ''}, tu pedido de AK Creaciones va en camino.`,
    `Pedido: ${delivery.order_number}`,
    `Factura: ${delivery.invoice_number}`,
    `Conductor: ${delivery.driver_name}`,
    `Teléfono del conductor: ${delivery.driver_phone}`,
    `Dirección confirmada: ${location}`,
    'Si necesitas coordinar algún detalle, responde a este mensaje. ¡Gracias por tu compra!',
  ].join('\n')
}

function buildWhatsAppUrl(delivery, message) {
  const to = String(delivery.phone || '').replace(/\D/g, '')
  return to ? `https://wa.me/${to}?text=${encodeURIComponent(message)}` : null
}

async function sendDeliveryUpdate(delivery) {
  const message = buildMessage(delivery)
  const url = buildWhatsAppUrl(delivery, message)
  const to = String(delivery.phone || '').replace(/\D/g, '')

  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID || !to) {
    return { sent: false, mode: 'manual', url }
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
  }

  if (TEMPLATE_NAME) {
    payload.type = 'template'
    payload.template = {
      name: TEMPLATE_NAME,
      language: { code: TEMPLATE_LANGUAGE },
      components: [{
        type: 'body',
        parameters: [
          delivery.name,
          delivery.order_number,
          delivery.invoice_number,
          delivery.driver_name,
          delivery.driver_phone,
          [delivery.address, delivery.localidad].filter(Boolean).join(' · '),
          delivery.maps_url || 'Ubicación confirmada con el cliente',
        ].map((text) => ({ type: 'text', text: String(text || '—') })),
      }],
    }
  } else {
    payload.type = 'text'
    payload.text = { preview_url: true, body: message }
  }

  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      console.error('✗ WhatsApp Cloud API rechazó la notificación:', result?.error?.code || response.status)
      return { sent: false, mode: 'cloud-api-error', url }
    }
    return { sent: true, mode: 'cloud-api', url: null }
  } catch (err) {
    console.error('✗ No se pudo contactar WhatsApp Cloud API:', err.message)
    return { sent: false, mode: 'cloud-api-error', url }
  }
}

module.exports = { sendDeliveryUpdate }
