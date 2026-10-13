const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')
const qrcode = require('qrcode-terminal')
const { Client, LocalAuth } = require('whatsapp-web.js')

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0'
const ACCESS_TOKEN = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim()
const PHONE_NUMBER_ID = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim()
const TEMPLATE_NAME = (process.env.WHATSAPP_DELIVERY_TEMPLATE_NAME || '').trim()
const TEMPLATE_LANGUAGE = (process.env.WHATSAPP_DELIVERY_TEMPLATE_LANGUAGE || 'es').trim()
const DEFAULT_COUNTRY_CODE = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '58').replace(/\D/g, '')
const WEB_ENABLED = process.env.WHATSAPP_WEB_ENABLED !== 'false'

let webClientReady = false
let webClient = null
let shutdownPromise = null

function closeWhatsAppClient() {
  if (!webClient) return Promise.resolve()
  if (!shutdownPromise) {
    webClientReady = false
    shutdownPromise = webClient.destroy().catch((err) => {
      console.error('✗ No se pudo cerrar limpiamente WhatsApp Web:', err.message)
    })
  }
  return shutdownPromise
}

const shutdownSignals = process.platform === 'win32'
  ? ['SIGINT', 'SIGTERM']
  : ['SIGINT', 'SIGTERM', 'SIGUSR2']

for (const signal of shutdownSignals) {
  process.once(signal, () => {
    closeWhatsAppClient().finally(() => process.kill(process.pid, signal))
  })
}

function systemBrowserCandidates() {
  if (process.platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files'
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'
    const localAppData = process.env.LOCALAPPDATA || ''
    return [
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ]
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge',
  ]
}

function resolveBrowserExecutable() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    ...systemBrowserCandidates(),
  ].filter(Boolean)

  try {
    candidates.push(puppeteer.executablePath())
  } catch (err) {
    console.warn('No se pudo resolver el Chromium empaquetado por Puppeteer:', err.message)
  }

  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}

function initializeWhatsAppClient() {
  if (!WEB_ENABLED || webClient) return
  const browserExecutable = resolveBrowserExecutable()
  if (!browserExecutable) {
    console.error(
      '✗ WhatsApp Web no se inició: no se encontró Chrome/Chromium. ' +
      'Instala Chrome o configura PUPPETEER_EXECUTABLE_PATH en BackEnd/.env.'
    )
    return
  }

  console.log(`🌐 Navegador para WhatsApp Web: ${browserExecutable}`)
  webClient = new Client({
    authStrategy: new LocalAuth({
      clientId: 'ak-creaciones',
      dataPath: path.join(__dirname, '..', '..', '.wwebjs_auth'),
    }),
    puppeteer: {
      headless: true,
      executablePath: browserExecutable,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  })

  webClient.on('qr', (qr) => {
    console.log('\n📱 Escanea este QR desde WhatsApp > Dispositivos vinculados:')
    qrcode.generate(qr, { small: true })
  })
  webClient.on('authenticated', () => console.log('✓ Sesión de WhatsApp Web autenticada'))
  webClient.on('ready', () => {
    webClientReady = true
    console.log('✓ WhatsApp Web listo para enviar avisos de delivery')
  })
  webClient.on('auth_failure', (message) => {
    webClientReady = false
    console.error('✗ Falló la autenticación de WhatsApp Web:', message)
  })
  webClient.on('disconnected', (reason) => {
    webClientReady = false
    console.warn('⚠ WhatsApp Web se desconectó:', reason)
  })
  webClient.initialize().catch((err) => {
    console.error('✗ No se pudo iniciar WhatsApp Web:', err.message)
  })
}

function normalizePhone(value) {
  const raw = String(value || '').trim()
  let digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (raw.startsWith('+')) return digits
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith(DEFAULT_COUNTRY_CODE)) return digits
  if (digits.startsWith('0')) digits = digits.slice(1)
  return `${DEFAULT_COUNTRY_CODE}${digits}`
}

function parseItems(items) {
  if (Array.isArray(items)) return items
  if (typeof items !== 'string') return []
  try {
    const parsed = JSON.parse(items)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

function buildInvoiceLines(delivery) {
  const items = parseItems(delivery.items)
  const lines = items.map((item) => {
    const variant = item.variante ? ` (${item.variante})` : ''
    const quantity = Number(item.qty || 0)
    return `- ${item.name || 'Producto'}${variant} x${quantity}: ${money(Number(item.price || 0) * quantity)}`
  })
  return [...lines, `Total: ${money(delivery.total)}`]
}

function buildMessage(delivery) {
  const location = [delivery.address, delivery.localidad, delivery.maps_url].filter(Boolean).join(' · ')
  return [
    `Hola ${delivery.name}${delivery.last_name ? ` ${delivery.last_name}` : ''}, tu pedido de AK Creaciones va en camino.`,
    `Pedido: ${delivery.order_number}`,
    `Factura: ${delivery.invoice_number}`,
    'Detalle del pedido:',
    ...buildInvoiceLines(delivery),
    `Conductor: ${delivery.driver_name}`,
    `Teléfono del conductor: ${delivery.driver_phone}`,
    `Dirección confirmada: ${location}`,
    'Por favor, contacta al conductor para coordinar la entrega. ¡Gracias por tu compra!',
  ].join('\n')
}

function buildWhatsAppUrl(delivery, message) {
  const to = normalizePhone(delivery.phone)
  return to ? `https://wa.me/${to}?text=${encodeURIComponent(message)}` : null
}

async function sendDeliveryUpdate(delivery) {
  const message = buildMessage(delivery)
  const url = buildWhatsAppUrl(delivery, message)
  const to = normalizePhone(delivery.phone)

  if (webClientReady && to) {
    try {
      await webClient.sendMessage(`${to}@c.us`, message)
      return { sent: true, mode: 'whatsapp-web', url: null }
    } catch (err) {
      console.error('✗ WhatsApp Web no pudo enviar el aviso:', err.message)
    }
  }

  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID || !to) {
    return { sent: false, mode: webClientReady ? 'manual' : 'whatsapp-web-not-ready', url }
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
          `${delivery.invoice_number}\n${buildInvoiceLines(delivery).join('\n')}`,
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

module.exports = { sendDeliveryUpdate, buildMessage, normalizePhone, resolveBrowserExecutable, initializeWhatsAppClient }
