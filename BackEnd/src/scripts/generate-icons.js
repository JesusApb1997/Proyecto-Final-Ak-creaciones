/**
 * generate-icons.js — Genera los iconos PWA de AK Creaciones a partir del
 * logo de la marca (alojado en Supabase Storage) y los deja listos para el
 * manifest en FrontEnd/public/pwa/.
 *
 *   npm run gen:icons      (en BackEnd/ — requiere sharp como devDependency)
 *
 * Genera:
 *   pwa/icon-192.png        icono estándar 192×192 (fondo cream de la marca)
 *   pwa/icon-512.png        icono estándar 512×512
 *   pwa/maskable-512.png    icono "maskable" 512×512 con el degradado AK
 *                           (Android recorta círculos/máscaras sin perder el logo)
 *   pwa/apple-touch-icon.png  180×180 para iOS (pantalla de inicio)
 *
 * Además los sube al bucket (marca/pwa/…) como respaldo si hay credenciales.
 */
require('dotenv').config({ override: true });

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { storageEnabled, uploadBuffer } = require('../config/storage');

const LOGO_URL =
  process.env.PWA_LOGO_URL ||
  'https://ieuoeqdukphibffzqiar.supabase.co/storage/v1/object/public/Imagenes/marca/logo-ak.png';

const OUT_DIR = path.join(__dirname, '..', '..', '..', 'FrontEnd', 'public', 'pwa');

/* Colores de marca (mismos tokens de FrontEnd/src/styles.css) */
const CREAM = { r: 255, g: 249, b: 244, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const GRADIENT_SVG = (size) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0"    stop-color="#1FA2C7"/>
      <stop offset="0.35" stop-color="#3EC6E0"/>
      <stop offset="0.78" stop-color="#F58BB8"/>
      <stop offset="1"    stop-color="#FFA9A0"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
</svg>`);

/** Icono con fondo sólido cream y el logo centrado al `pct`% del lienzo */
async function iconOnCream(buffer, size, pct = 0.86) {
  const inner = Math.round(size * pct);
  const logo = await sharp(buffer)
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
    .png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: CREAM } })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer();
}

/** Icono maskable: degradado AK a sangre completa + logo al 78% (zona segura) */
async function iconMaskable(buffer, size = 512) {
  const inner = Math.round(size * 0.78);
  const logo = await sharp(buffer)
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
    .png().toBuffer();
  return sharp(GRADIENT_SVG(size))
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer();
}

async function main() {
  console.log(`⬇️  Descargando logo de marca: ${LOGO_URL}`);
  const res = await fetch(LOGO_URL);
  if (!res.ok) throw new Error(`El logo respondió ${res.status}`);
  const logo = Buffer.from(await res.arrayBuffer());
  console.log(`✓ Logo descargado (${(logo.length / 1024).toFixed(1)} KB)`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const jobs = [
    ['icon-192.png', await iconOnCream(logo, 192)],
    ['icon-512.png', await iconOnCream(logo, 512)],
    ['maskable-512.png', await iconMaskable(logo, 512)],
    ['apple-touch-icon.png', await iconOnCream(logo, 180)],
  ];

  const uploaded = [];
  for (const [name, buffer] of jobs) {
    fs.writeFileSync(path.join(OUT_DIR, name), buffer);
    console.log(`✓ FrontEnd/public/pwa/${name}  (${(buffer.length / 1024).toFixed(1)} KB)`);
    uploaded.push({ name, buffer });
  }

  if (storageEnabled) {
    for (const { name, buffer } of uploaded) {
      try {
        const url = await uploadBuffer(buffer, `marca/pwa/${name}`, 'image/png');
        console.log(`☁️  Respaldo en bucket: ${url}`);
      } catch (err) {
        console.log(`⚠ No se pudo subir ${name} al bucket: ${err.message}`);
      }
    }
  }

  console.log('\nLos iconos locales los referencia el manifest (/pwa/…) — misma origen,');
  console.log('requisito para que el instalador de la PWA los acepte siempre.');
}

main().catch((err) => {
  console.error('✗ Error generando los iconos PWA:', err.message);
  process.exit(1);
});
