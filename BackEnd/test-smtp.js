/**
 * test-smtp.js — Diagnóstico y prueba de envío SMTP para AK Creaciones
 * Uso: node test-smtp.js
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

const EMAIL_USER = (process.env.EMAIL_USER || '').trim();
const EMAIL_PASS = (process.env.EMAIL_PASS || '').trim();
const COMPANY_EMAIL = process.env.COMPANY_EMAIL || EMAIL_USER || 'yisusalew@gmail.com';

console.log('\n🔍 Diagnóstico SMTP - AK Creaciones');
console.log('─'.repeat(50));
console.log('EMAIL_USER   : ' + (EMAIL_USER || '❌ NO CONFIGURADO'));
console.log('EMAIL_PASS   : ' + (EMAIL_PASS ? '✅ Configurado (' + EMAIL_PASS.length + ' caracteres)' : '❌ NO CONFIGURADO'));
console.log('COMPANY_EMAIL: ' + COMPANY_EMAIL);
console.log('─'.repeat(50));

if (!EMAIL_USER || !EMAIL_PASS) {
  console.error('\n❌ SMTP no puede funcionar: falta EMAIL_USER o EMAIL_PASS en el .env');
  console.log('\n📋 Pasos para configurar Gmail (clave de aplicación):');
  console.log('  1. Ve a: https://myaccount.google.com/security');
  console.log('  2. Activa "Verificación en 2 pasos" si no la tienes');
  console.log('  3. Ve a: https://myaccount.google.com/apppasswords');
  console.log('  4. Crea una nueva contraseña de app -> Correo / Windows');
  console.log('  5. Copia los 16 caracteres generados');
  console.log('  6. Añade en .env:  EMAIL_PASS=xxxx xxxx xxxx xxxx\n');
  process.exit(1);
}

async function testSmtp() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  console.log('\n🔌 Verificando conexión con smtp.gmail.com:465...');
  try {
    await transporter.verify();
    console.log('✅ Conexión SMTP exitosa — autenticación correcta.\n');
  } catch (err) {
    console.error('\n❌ Error de conexión SMTP: ' + err.message);
    if (err.code === 'EAUTH') {
      console.log('\n💡 Error de autenticación. Causas posibles:');
      console.log('   • EMAIL_PASS no es una "Contraseña de aplicación" de Google');
      console.log('   • La cuenta no tiene verificación en 2 pasos activa');
      console.log('   • SMTP desactivado en Gmail');
    }
    process.exit(1);
  }

  console.log('📧 Enviando correo de prueba a ' + COMPANY_EMAIL + '...');
  try {
    const info = await transporter.sendMail({
      from: 'AK Creaciones <' + EMAIL_USER + '>',
      to: COMPANY_EMAIL,
      subject: '✅ Prueba SMTP - AK Creaciones Dashboard',
      html: '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;background:#FFF3EA;border-radius:16px;">'
        + '<h2 style="color:#E85D9E;">✅ ¡SMTP Funcionando!</h2>'
        + '<p style="color:#2B2233;">Este correo confirma que la configuración SMTP de <b>AK Creaciones</b> está correcta.</p>'
        + '<p style="color:#6E6478;font-size:13px;">Enviado desde: <b>' + EMAIL_USER + '</b><br/>Destino: <b>' + COMPANY_EMAIL + '</b><br/>Fecha: <b>' + new Date().toLocaleString('es-VE') + '</b></p>'
        + '<p style="color:#047857;font-weight:bold;">Los correos de venta finiquitada llegarán a esta dirección.</p>'
        + '</div>',
    });
    console.log('\n✅ Correo de prueba enviado correctamente!');
    console.log('   MessageId: ' + info.messageId);
    console.log('   Revisa la bandeja de entrada de ' + COMPANY_EMAIL + '\n');
  } catch (err) {
    console.error('\n❌ Error al enviar: ' + err.message + '\n');
    process.exit(1);
  }
}

testSmtp();
