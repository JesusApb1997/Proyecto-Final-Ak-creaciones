/**
 * Servicio de correo (nodemailer) — AK Creaciones
 *
 * - Si hay EMAIL_USER/EMAIL_PASS en .env (clave de aplicación de Gmail),
 *   envía el correo real por SMTP (smtp.gmail.com).
 *   También acepta SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_PORT si usas otro proveedor.
 * - Si NO hay SMTP configurado (desarrollo), imprime el correo en la consola
 *   del backend y guarda una copia legible en BackEnd/.mail-out/ para poder
 *   probar el flujo completo sin cuenta de correo.
 *
 * Plantilla de marca: logo del bucket Supabase, hero con el degradado AK,
 * botón CTA grande y tarjeta con el enlace. HTML por tablas + estilos inline
 * (compatible con Gmail/Outlook).
 */
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

/* Clave de aplicación de Gmail (EMAIL_USER + EMAIL_PASS) o SMTP genérico */
const EMAIL_USER = (process.env.EMAIL_USER || '').trim();
const EMAIL_PASS = (process.env.EMAIL_PASS || '').trim();
const SMTP_HOST = process.env.SMTP_HOST || (EMAIL_USER && EMAIL_PASS ? 'smtp.gmail.com' : '');
const SMTP_USER = (process.env.SMTP_USER || EMAIL_USER).trim();
const SMTP_PASS = (process.env.SMTP_PASS || EMAIL_PASS).trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || (SMTP_HOST === 'smtp.gmail.com' ? 465 : 587));
const CONFIGURED_MAIL_FROM = process.env.MAIL_FROM || 'AK Creaciones <no-reply@akcreaciones.com>';
const SMTP_SENDER_EMAIL = (SMTP_USER || EMAIL_USER).trim();
const configuredFromAddress = (CONFIGURED_MAIL_FROM.match(/<([^>]+)>/) || [])[1] || CONFIGURED_MAIL_FROM;
const alignGmailSender =
  SMTP_HOST.toLowerCase() === 'smtp.gmail.com' &&
  SMTP_SENDER_EMAIL.includes('@') &&
  configuredFromAddress.split('@').pop().toLowerCase() !== SMTP_SENDER_EMAIL.split('@').pop().toLowerCase();
const MAIL_FROM = alignGmailSender
  ? `AK Creaciones <${SMTP_SENDER_EMAIL}>`
  : CONFIGURED_MAIL_FROM;

/* Origen del frontend para armar los enlaces (hash router) */
const FRONT_URL = String(process.env.FRONT_URL || 'http://localhost:5173').replace(/\/$/, '');

/* Logo de la marca (bucket público de Supabase — el mismo de la página) */
const LOGO_URL =
  process.env.MAIL_LOGO_URL ||
  'https://ieuoeqdukphibffzqiar.supabase.co/storage/v1/object/public/Imagenes/marca/logo-ak.png';

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  console.log(`📧 Mailer SMTP listo (${SMTP_HOST}:${SMTP_PORT} como ${SMTP_USER})`);
  if (alignGmailSender) {
    console.warn('⚠ MAIL_FROM no coincide con la cuenta SMTP; se usará la cuenta autenticada para alinear el remitente.');
  }
} else {
  console.log('📧 Mailer en modo desarrollo: los correos se imprimen en consola y se guardan en BackEnd/.mail-out/');
}

/**
 * Plantilla de marca AK Creaciones.
 * Table-based + inline styles para máxima compatibilidad de clientes de correo.
 */
function brandTemplate({ kicker, title, titleAccent, intro, bodyHtml = '', ctaLabel, ctaUrl, footerNote }) {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#FFF3EA;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF3EA;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFDF9;border-radius:22px;overflow:hidden;border:1px solid #F6E3EC;">

        <!-- ===== Hero con degradado de la marca + logo ===== -->
        <tr><td style="background:linear-gradient(135deg,#1FA2C7 0%,#3EC6E0 35%,#F58BB8 78%,#FFA9A0 100%);padding:34px 30px 30px;text-align:center;">
          <img src="${LOGO_URL}" width="72" height="72" alt="AK Creaciones" style="display:inline-block;border-radius:16px;background:#FFF9F4;padding:8px;" />
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#FFFFFF;margin-top:10px;">
            AK <span style="font-weight:bold;">Creaciones</span>
          </div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;color:rgba(255,255,255,.92);margin-top:6px;text-transform:uppercase;">
            Bisutería artesanal
          </div>
        </td></tr>

        <!-- ===== Cuerpo ===== -->
        <tr><td style="padding:30px 34px 8px;font-family:Arial,Helvetica,sans-serif;">
          <div style="font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#1FA2C7;font-weight:bold;margin-bottom:8px;">${kicker}</div>
          <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:#2B2233;">
            ${title} <span style="color:#E85D9E;">${titleAccent}</span>
          </h1>
          <p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:#6E6478;">${intro}</p>
          ${bodyHtml}
        </td></tr>

        <!-- ===== Botón CTA ===== -->
        <tr><td align="center" style="padding:0 34px 26px;font-family:Arial,Helvetica,sans-serif;">
          <a href="${ctaUrl}"
             style="display:inline-block;background:linear-gradient(135deg,#1FA2C7 0%,#3EC6E0 35%,#F58BB8 78%,#FFA9A0 100%);color:#ffffff;text-decoration:none;padding:15px 38px;border-radius:999px;font-weight:bold;font-size:15px;box-shadow:0 8px 20px rgba(232,93,158,.35);">
            ${ctaLabel}
          </a>
        </td></tr>

        <!-- ===== Enlace alternativo ===== -->
        <tr><td style="padding:0 34px 26px;font-family:Arial,Helvetica,sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7EE;border:1px dashed #F0C9DC;border-radius:14px;">
            <tr><td style="padding:14px 16px;">
              <p style="margin:0 0 6px;font-size:12px;color:#6E6478;">¿El botón no funciona? Copia y pega este enlace en tu navegador:</p>
              <p style="margin:0;word-break:break-all;font-size:12px;color:#1FA2C7;font-weight:bold;">${ctaUrl}</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- ===== Nota / seguridad ===== -->
        <tr><td style="padding:0 34px 26px;font-family:Arial,Helvetica,sans-serif;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#9B93A5;">${footerNote}</p>
        </td></tr>

        <!-- ===== Footer ===== -->
        <tr><td style="background:#FFF7EE;padding:18px 34px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
          <p style="margin:0;font-size:11px;color:#B4ACBE;">
            Hecho a mano · Piezas únicas · Envíos nacionales e internacionales ✦<br/>
            © ${year} AK Creaciones — Este es un mensaje automático, no respondas a este correo.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Envía (o simula) el correo de recuperación.
 * Devuelve { delivered, mode, previewPath?, url } para que el backend pueda
 * responder con el enlace en desarrollo sin filtrar nada en producción.
 */
async function sendPasswordReset({ to, name, token }) {
  const url = `${FRONT_URL}/#/reset-password?token=${token}`;
  const html = brandTemplate({
    kicker: 'Recuperación de contraseña',
    title: 'Hola' + (name ? ` ${name}` : '') + ', recuperemos tu',
    titleAccent: 'contraseña',
    intro:
      'Recibimos una solicitud para restablecer la contraseña de tu cuenta en <b>AK Creaciones</b>. ' +
      'Toca el botón para crear una nueva: el enlace es de un solo uso y <b>expira en 30 minutos</b>.',
    ctaLabel: 'Crear nueva contraseña',
    ctaUrl: url,
    footerNote: 'Si no fuiste tú quien pidió el cambio, puedes ignorar este correo con tranquilidad — tu contraseña actual seguirá funcionando.',
  });

  if (transporter) {
    try {
      await transporter.sendMail({ from: MAIL_FROM, to, subject: 'Recupera tu contraseña · AK Creaciones', html });
      return { delivered: true, mode: 'smtp', url };
    } catch (err) {
      console.error('✗ Error enviando correo por SMTP:', err.message);
      return { delivered: false, mode: 'smtp-error', url };
    }
  }

  /* -------- Modo desarrollo: consola + archivo -------- */
  const plain = `[AK Creaciones] Recuperación de contraseña\nPara: ${to}\nEnlace (expira en 30 min): ${url}\n`;
  console.log('\n──────────── 📧 CORREO (modo desarrollo) ────────────');
  console.log(plain);
  console.log('─────────────────────────────────────────────────────\n');

  let previewPath;
  try {
    const dir = path.join(__dirname, '..', '..', '.mail-out');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `reset-${Date.now()}.html`);
    fs.writeFileSync(file, html);
    previewPath = file;
  } catch {
    /* si no se puede escribir, con la consola basta */
  }
  return { delivered: true, mode: 'dev', url, previewPath };
}

/* --------------------------------------------------------------------------
 * Factura / confirmación de pedido (correo estilizado de la empresa)
 * Se envía al cliente cuando confirma su pedido del carrito por WhatsApp.
 * El backend verifica el token del usuario y recalcula los precios desde la
 * BD, así que el correo es una fuente confiable del monto total.
 * ----------------------------------------------------------------------- */

/* Formato de dinero idéntico al de la tienda (money() en el frontend) */
function fmtMoney(n) {
  return '$' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function sendOrderInvoice({ to, name, orderNumber, items = [], total = 0, payment = null }) {
  const fecha = new Date().toLocaleString('es-VE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  /* ---------- Bloque de Pago Móvil (solo si el pedido se pagó así) ---------- */
  const esPagoMovil = Boolean(payment);
  const filaPago = (label, value) =>
    value
      ? `<tr>
      <td style="padding:10px 16px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#9B93A5;font-family:Arial,Helvetica,sans-serif;">${label}</td>
      <td align="right" style="padding:10px 16px;font-size:13px;font-weight:bold;color:#2B2233;font-family:Arial,Helvetica,sans-serif;">${value}</td>
    </tr>`
      : '';

  const pagoHtml = esPagoMovil
    ? `
  <!-- ===== Datos del Pago Móvil (los configura el admin) ===== -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border:1px solid #F6E3EC;border-radius:16px;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#1FA2C7 0%,#3EC6E0 35%,#F58BB8 78%,#FFA9A0 100%);padding:11px 18px;">
      <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#FFFFFF;">💳 ${payment.method || 'Pago Móvil'}</span>
    </td></tr>
    <tr><td style="padding:4px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${filaPago('Banco', payment.bank_name)}
        ${filaPago('Teléfono', payment.phone)}
        ${filaPago('Cédula / RIF', payment.cedula)}
        ${filaPago('Titular', payment.holder_name)}
        ${filaPago('Banco emisor reportado', payment.payer_bank)}
        ${filaPago('Teléfono pagador', payment.payer_phone)}
        ${filaPago('Monto reportado', payment.reported_amount != null ? fmtMoney(payment.reported_amount) : null)}
        ${filaPago('Referencia', payment.reference_number)}
      </table>
    </td></tr>
  </table>`
    : '';

  const notaIntro = esPagoMovil
    ? `Gracias por tu compra. Recibimos tu reporte de <b>Pago Móvil</b> por <b>${fmtMoney(total)}</b>; verificaremos el pago y coordinaremos contigo la entrega.`
    : 'Recibimos tu pedido: en breve continuaremos la coordinación de <b>pago y envío</b> por WhatsApp.';

  /* Tabla de artículos (HTML por tablas + estilos inline, compatible Gmail/Outlook) */
  const filas = items
    .map(
      (it, i) => `
    <tr style="background:${i % 2 ? '#FFF9F4' : '#FFFFFF'};">
      <td style="padding:12px 14px;border-bottom:1px solid #F6E3EC;font-size:13px;color:#2B2233;font-family:Arial,Helvetica,sans-serif;">
        <b>${it.name}</b>${it.variante ? `<br/><span style="font-size:11px;color:#6E6478;">${it.variante}</span>` : ''}
      </td>
      <td align="center" style="padding:12px 8px;border-bottom:1px solid #F6E3EC;font-size:13px;color:#2B2233;font-family:Arial,Helvetica,sans-serif;">×${it.qty}</td>
      <td align="right" style="padding:12px 14px;border-bottom:1px solid #F6E3EC;font-size:13px;color:#2B2233;font-family:Arial,Helvetica,sans-serif;">${fmtMoney(it.price)}</td>
      <td align="right" style="padding:12px 14px;border-bottom:1px solid #F6E3EC;font-size:13px;font-weight:bold;color:#2B2233;font-family:Arial,Helvetica,sans-serif;">${fmtMoney(it.price * it.qty)}</td>
    </tr>`
    )
    .join('');

  const invoiceHtml = `
  <!-- ===== Tarjeta de pedido estilo factura ===== -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border:1px solid #F6E3EC;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#FFF7EE;padding:14px 18px;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6E6478;">Pedido</td>
          <td align="right" style="font-size:15px;font-weight:bold;color:#1FA2C7;font-family:Arial,Helvetica,sans-serif;">${orderNumber}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#9B93A5;font-family:Arial,Helvetica,sans-serif;">Fecha</td>
          <td align="right" style="font-size:12px;color:#6E6478;font-family:Arial,Helvetica,sans-serif;">${fecha}</td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <thead>
          <tr style="background:#FFF3EA;">
            <th align="left" style="padding:10px 14px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#E85D9E;font-family:Arial,Helvetica,sans-serif;">Pieza</th>
            <th align="center" style="padding:10px 8px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#E85D9E;font-family:Arial,Helvetica,sans-serif;">Cant.</th>
            <th align="right" style="padding:10px 14px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#E85D9E;font-family:Arial,Helvetica,sans-serif;">Precio</th>
            <th align="right" style="padding:10px 14px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#E85D9E;font-family:Arial,Helvetica,sans-serif;">Subtotal</th>
          </tr>
        </thead>
        ${filas}
        <tr>
          <td colspan="3" align="right" style="padding:16px 14px;background:#FFF7EE;font-size:13px;font-weight:bold;color:#2B2233;font-family:Arial,Helvetica,sans-serif;">Total a pagar</td>
          <td align="right" style="padding:16px 14px;background:#FFF7EE;background-image:linear-gradient(135deg,#1FA2C7 0%,#F58BB8 100%);-webkit-background-clip:text;font-size:20px;font-weight:bold;color:#E85D9E;font-family:Arial,Helvetica,sans-serif;">${fmtMoney(total)}</td>
        </tr>
      </table>
    </td></tr>
  </table>

  ${pagoHtml}

  <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#6E6478;font-family:Arial,Helvetica,sans-serif;">
    <i style="color:#1FA2C7;">✦</i> ${notaIntro}
  </p>
  ${esPagoMovil ? `<p style="margin:0 0 22px;font-size:12px;line-height:1.6;color:#6E6478;font-family:Arial,Helvetica,sans-serif;">¿Necesitas coordinar la entrega? <a href="${FRONT_URL}/#contacto" style="color:#1FA2C7;font-weight:bold;">Contáctanos</a>.</p>` : ''}
  <p style="margin:0 0 22px;font-size:12px;line-height:1.6;color:#9B93A5;font-family:Arial,Helvetica,sans-serif;">
    Este correo es el comprobante de recepción de tu solicitud — consérvalo como referencia de tu pedido.
  </p>`;

  const html = brandTemplate({
    kicker: esPagoMovil ? 'Pago móvil reportado' : 'Confirmación de pedido',
    title: '¡Gracias' + (name ? `, ${name}` : '') + '! Tu',
    titleAccent: esPagoMovil ? 'pedido fue recibido' : 'pedido está listo',
    intro: esPagoMovil
      ? 'Registramos tu pago móvil. Aquí tienes los datos del pago y el detalle de todo lo que pediste, con el monto total:'
      : 'Guardamos tu solicitud y la enviamos a nuestro WhatsApp. Aquí tienes el detalle de todo lo que pediste, con el monto total:',
    bodyHtml: invoiceHtml,
    ctaLabel: 'Ver la tienda',
    ctaUrl: `${FRONT_URL}/#/`,
    footerNote: esPagoMovil
      ? 'Si tú no realizaste este pago, alguien pudo usar tu sesión — te recomendamos cambiar tu contraseña y escribirnos por WhatsApp.'
      : 'Si tú no realizaste este pedido, alguien pudo usar tu sesión — te recomendamos cambiar tu contraseña y escribirnos por WhatsApp.',
  });

  const subject = esPagoMovil
    ? `Pago Móvil recibido · ${fmtMoney(total)} · ${orderNumber} · AK Creaciones`
    : `Pedido ${orderNumber} · ${fmtMoney(total)} · AK Creaciones`;

  if (transporter) {
    try {
      await transporter.sendMail({ from: MAIL_FROM, to, subject, html });
      return { delivered: true, mode: 'smtp', orderNumber };
    } catch (err) {
      console.error('✗ Error enviando la factura por SMTP:', err.message);
      return { delivered: false, mode: 'smtp-error', orderNumber, error: err.message };
    }
  }

  /* -------- Modo desarrollo: consola + archivo -------- */
  const plain =
    `[AK Creaciones] ${esPagoMovil ? 'Pago Móvil confirmado' : 'Factura del pedido'} ${orderNumber}\nPara: ${to}\n` +
    (esPagoMovil && payment
      ? `Pago Móvil: ${payment.bank_name || '—'} · ${payment.phone || '—'} · ${payment.cedula || '—'} · ${payment.holder_name || '—'}\n`
      : '') +
    items.map((it) => `  · ${it.name}${it.variante ? ` (${it.variante})` : ''} x${it.qty} — ${fmtMoney(it.price * it.qty)}`).join('\n') +
    `\nTOTAL: ${fmtMoney(total)}\n`;
  console.log('\n──────────── 📧 FACTURA (modo desarrollo) ────────────');
  console.log(plain);
  console.log('──────────────────────────────────────────────────────\n');

  let previewPath;
  try {
    const dir = path.join(__dirname, '..', '..', '.mail-out');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${esPagoMovil ? 'pago-movil' : 'invoice'}-${orderNumber}.html`);
    fs.writeFileSync(file, html);
    previewPath = file;
  } catch {
    /* si no se puede escribir, con la consola basta */
  }
  return { delivered: true, mode: 'dev', orderNumber, previewPath };
}

/* -------------------------------------------------------------------------
 * Bienvenida — se envía cuando se crea una cuenta:
 *   · desde el Dashboard del Admin (POST /api/users)  -> con la contraseña
 *     inicial que el Admin definió (si fue él quien la puso).
 *   · desde el registro público (#/registro, POST /api/store-auth/register).
 * Devuelve { delivered, mode, previewPath? } igual que el resto del mailer.
 * ---------------------------------------------------------------------- */
async function sendWelcomeEmail({ to, name, role = 'user', loginUrl, temporaryPassword = null, registeredBy = null }) {
  const firstName = String(name || '').split(' ')[0] || 'a new';
  const esStaff = ['admin', 'empleado'].includes(String(role).toLowerCase());
  const url = loginUrl || (esStaff ? `${FRONT_URL}/#/login` : `${FRONT_URL}/#/acceder`);

  const filas = [];
  filas.push(`
    <tr>
      <td style="padding:10px 16px;font-size:12px;color:#9B93A5;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:1px;">Cuenta</td>
      <td align="right" style="padding:10px 16px;font-size:13px;font-weight:bold;color:#2B2233;font-family:Arial,Helvetica,sans-serif;">${to}</td>
    </tr>`);
  if (temporaryPassword) {
    filas.push(`
    <tr>
      <td style="padding:10px 16px;font-size:12px;color:#9B93A5;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:1px;">Contraseña inicial</td>
      <td align="right" style="padding:10px 16px;font-size:13px;font-weight:bold;color:#E85D9E;font-family:Arial,Helvetica,sans-serif;">${temporaryPassword}</td>
    </tr>`);
  }
  if (registeredBy) {
    filas.push(`
    <tr>
      <td style="padding:10px 16px;font-size:12px;color:#9B93A5;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:1px;">Creada por</td>
      <td align="right" style="padding:10px 16px;font-size:13px;color:#6E6478;font-family:Arial,Helvetica,sans-serif;">${registeredBy}</td>
    </tr>`);
  }

  const bodyHtml = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #F6E3EC;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#FFF7EE;padding:6px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas.join('')}</table>
    </td></tr>
  </table>`;

  const html = brandTemplate({
    kicker: 'Bienvenido/a a AK Creaciones',
    title: 'Hola' + (name ? ` ${firstName}` : '') + ', tu cuenta',
    titleAccent: 'está lista',
    intro:
      (registeredBy
        ? `El equipo de <b>AK Creaciones</b> creó tu cuenta para que disfrutes de la tienda. `
        : 'Tu registro en <b>AK Creaciones</b> se completó con éxito. ') +
      'Entra con tu correo y contraseña — o con Google/Apple si así te registraste.',
    bodyHtml,
    ctaLabel: 'Iniciar sesión',
    ctaUrl: url,
    footerNote:
      'Nunca compartas tu contraseña con nadie del equipo: nunca te la pediremos por correo ni por WhatsApp. ' +
      'Si no reconoces esta cuenta, responde a este mensaje para que la revisemos.',
  });

  const subject = 'Tu cuenta está lista · AK Creaciones';

  if (!transporter) {
    console.error('✗ Bienvenida no enviada: SMTP no está configurado.');
    return { delivered: false, mode: 'smtp-unconfigured' };
  }

  const text = [
    `Hola ${firstName}, tu cuenta de AK Creaciones está lista.`,
    `Correo: ${to}`,
    temporaryPassword ? `Contraseña inicial: ${temporaryPassword}` : '',
    `Inicia sesión aquí: ${url}`,
    'Nunca compartas tu contraseña con nadie del equipo.',
  ].filter(Boolean).join('\n\n');

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await transporter.sendMail({
        from: MAIL_FROM,
        to,
        replyTo: SMTP_SENDER_EMAIL || undefined,
        subject,
        text,
        html,
      });
      return { delivered: true, mode: 'smtp' };
    } catch (err) {
      lastError = err;
      const permanent = err.code === 'EAUTH' || Number(err.responseCode) >= 500;
      if (permanent || attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }

  console.error('✗ Error enviando la bienvenida por SMTP:', lastError?.message || 'Error SMTP');
  return { delivered: false, mode: 'smtp-error', error: lastError?.message };
}

module.exports = { sendPasswordReset, sendOrderInvoice, sendWelcomeEmail, FRONT_URL };
