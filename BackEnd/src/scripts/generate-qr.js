/**
 * generate-qr.js — Genera el código QR del WhatsApp del negocio y lo sube
 * a Supabase Storage (bucket "Imagenes", carpeta marca/).
 *
 *   npm run gen:qr
 *
 * - El QR apunta a https://wa.me/<WHATSAPP_NUMBER> (al escanearlo abre el chat).
 * - Usa la API pública de qrserver.com para renderizar el PNG.
 * - Requiere SUPABASE_URL + SUPABASE_SERVICE_ROLE en .env para subirlo;
 *   si faltan, deja la copia local en BackEnd/uploads/ y avisa.
 */
require('dotenv').config({ override: true });

const fs = require('fs');
const path = require('path');
const { storageEnabled, uploadBuffer } = require('../config/storage');

const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '584142277642';
const WA_URL = `https://wa.me/${WHATSAPP_NUMBER}`;
const QR_API = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=12&data=${encodeURIComponent(WA_URL)}`;
const OBJECT_PATH = 'marca/qr-whatsapp.png';

async function main() {
  console.log(`🔗 Generando QR para: ${WA_URL}`);
  const res = await fetch(QR_API);
  if (!res.ok) throw new Error(`qrserver.com respondió ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 500) throw new Error('El PNG recibido parece inválido (muy chico)');
  console.log(`✓ QR generado (${(buffer.length / 1024).toFixed(1)} KB)`);

  // Copia local siempre (respaldo)
  const localPath = path.join(__dirname, '..', '..', 'uploads');
  fs.mkdirSync(localPath, { recursive: true });
  fs.writeFileSync(path.join(localPath, 'qr-whatsapp.png'), buffer);
  console.log(`✓ Copia local: BackEnd/uploads/qr-whatsapp.png`);

  if (!storageEnabled) {
    console.log('⚠ SUPABASE_URL / SUPABASE_SERVICE_ROLE no configurados: no se subió al bucket.');
    return;
  }

  const url = await uploadBuffer(buffer, OBJECT_PATH, 'image/png');
  console.log(`✓ Subido a Supabase: ${url}`);
  console.log('\nEl frontend lo muestra desde esa URL (config.js → WHATSAPP_QR_URL).');
}

main().catch((err) => {
  console.error('✗ Error generando/subiendo el QR:', err.message);
  process.exit(1);
});
