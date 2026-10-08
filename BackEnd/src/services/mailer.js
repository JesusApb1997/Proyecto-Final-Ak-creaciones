/**
 * Servicio de correo (nodemailer) — AK Creaciones
 *
 * - Si hay SMTP_HOST/SMTP_USER/SMTP_PASS en .env, envía el correo real por SMTP.
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

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || 'AK Creaciones <no-reply@akcreaciones.com>';

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
  console.log(`📧 Mailer SMTP listo (${SMTP_HOST}:${SMTP_PORT})`);
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

async function sendOrderInvoice({ to, name, orderNumber, items = [], total = 0 }) {
  const fecha = new Date().toLocaleString('es-VE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

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

  <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#6E6478;font-family:Arial,Helvetica,sans-serif;">
    <i style="color:#1FA2C7;">✦</i> Recibimos tu pedido: en breve continuaremos la coordinación de <b>pago y envío</b> por WhatsApp.
  </p>
  <p style="margin:0 0 22px;font-size:12px;line-height:1.6;color:#9B93A5;font-family:Arial,Helvetica,sans-serif;">
    Este correo es la confirmación de tu solicitud — consérvalo como comprobante de tu pedido.
  </p>`;

  const html = brandTemplate({
    kicker: 'Confirmación de pedido',
    title: '¡Gracias' + (name ? `, ${name}` : '') + '! Tu',
    titleAccent: 'pedido está listo',
    intro: 'Guardamos tu solicitud y la enviamos a nuestro WhatsApp. Aquí tienes el detalle de todo lo que pediste, con el monto total:',
    bodyHtml: invoiceHtml,
    ctaLabel: 'Ver la tienda',
    ctaUrl: `${FRONT_URL}/#/`,
    footerNote: 'Si tú no realizaste este pedido, alguien pudo usar tu sesión — te recomendamos cambiar tu contraseña y escribirnos por WhatsApp.',
  });

  const subject = `Pedido ${orderNumber} · ${fmtMoney(total)} · AK Creaciones`;

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
    `[AK Creaciones] Factura del pedido ${orderNumber}\nPara: ${to}\n` +
    items.map((it) => `  · ${it.name}${it.variante ? ` (${it.variante})` : ''} x${it.qty} — ${fmtMoney(it.price * it.qty)}`).join('\n') +
    `\nTOTAL: ${fmtMoney(total)}\n`;
  console.log('\n──────────── 📧 FACTURA (modo desarrollo) ────────────');
  console.log(plain);
  console.log('──────────────────────────────────────────────────────\n');

  let previewPath;
  try {
    const dir = path.join(__dirname, '..', '..', '.mail-out');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `invoice-${orderNumber}.html`);
    fs.writeFileSync(file, html);
    previewPath = file;
  } catch {
    /* si no se puede escribir, con la consola basta */
  }
  return { delivered: true, mode: 'dev', orderNumber, previewPath };
}

module.exports = { sendPasswordReset, sendOrderInvoice, FRONT_URL };
