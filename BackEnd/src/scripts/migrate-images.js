/**
 * Migración de imágenes a Supabase Storage
 * Ejecutar con:  npm run migrate:images
 *
 * 1. Sube al bucket público "imagenes" todas las imágenes que hoy viven en el
 *    frontend: products/ (zarcillos), img/ (carrusel), assets/brand/ (logo)
 *    y public/imagenes_prod_inv/ (materiales de inventario).
 * 2. Actualiza las columnas img de las tablas "products" e "inventario" para
 *    que apunten a las URLs públicas de Supabase (https://...supabase.co/...).
 *
 * Requiere SUPABASE_URL + SUPABASE_SERVICE_ROLE en BackEnd/.env
 */
require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { storageEnabled, uploadBuffer, publicUrl } = require('../config/storage');

const FRONT = path.join(__dirname, '..', '..', '..', 'FrontEnd');

/* [ruta local en FrontEnd/, carpeta destino dentro del bucket, mime] */
const FILES = [
  // Zarcillos de la tienda (products/)
  ...fs.existsSync(path.join(FRONT, 'products'))
    ? fs.readdirSync(path.join(FRONT, 'products'))
        .filter((f) => /\.(jpe?g|png|webp|avif|gif)$/i.test(f))
        .map((f) => [`products/${f}`, 'productos', 'image/jpeg'])
    : [],
  // Carrusel (img/)
  ...fs.existsSync(path.join(FRONT, 'img'))
    ? fs.readdirSync(path.join(FRONT, 'img'))
        .filter((f) => /\.(jpe?g|png|webp|avif|gif)$/i.test(f))
        .map((f) => [`img/${f}`, 'carrusel', 'image/jpeg'])
    : [],
  // Logo de marca
  ...fs.existsSync(path.join(FRONT, 'assets', 'brand'))
    ? fs.readdirSync(path.join(FRONT, 'assets', 'brand'))
        .filter((f) => /\.(jpe?g|png|webp|avif|gif|svg)$/i.test(f))
        .map((f) => [`assets/brand/${f}`, 'marca', f.endsWith('.svg') ? 'image/svg+xml' : 'image/png'])
    : [],
  // Materiales de inventario (public/imagenes_prod_inv/)
  ...fs.existsSync(path.join(FRONT, 'public', 'imagenes_prod_inv'))
    ? fs.readdirSync(path.join(FRONT, 'public', 'imagenes_prod_inv'))
        .filter((f) => /\.(jpe?g|png|webp|avif|gif|svg)$/i.test(f))
        .map((f) => [`public/imagenes_prod_inv/${f}`, 'inventario', 'image/svg+xml'])
    : [],
];

const MIME_BY_EXT = (file) => {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.avif') return 'image/avif';
  return 'image/jpeg';
};

/* Rutas viejas (relativas) -> rutas nuevas en el bucket, para actualizar la BD */
function oldPathsFor(localRel) {
  // products/zarcillo-vino.jpeg -> ['/products/zarcillo-vino.jpeg', 'products/zarcillo-vino.jpeg', ...]
  const base = localRel.replace(/^public\//, '');
  return [`/${base}`, base];
}

async function main() {
  if (!storageEnabled) {
    console.error('❌ Falta SUPABASE_SERVICE_ROLE en BackEnd/.env');
    console.error('   Consíguela en: Panel Supabase → Project Settings → API → service_role');
    console.error('   Agrégala como: SUPABASE_SERVICE_ROLE="eyJ..."');
    process.exit(1);
  }

  console.log(`📤 Subiendo ${FILES.length} imágenes al bucket de Supabase...\n`);

  /* Mapa ruta-vieja -> URL-nueva para actualizar la BD */
  const urlMap = new Map();
  let ok = 0;
  let skip = 0;

  for (const [localRel] of FILES) {
    const abs = path.join(FRONT, localRel);
    if (!fs.existsSync(abs)) { skip++; continue; }

    const folder = localRel.startsWith('products/') ? 'productos'
      : localRel.startsWith('img/') ? 'carrusel'
      : localRel.startsWith('assets/') ? 'marca'
      : 'inventario';

    const destName = path.basename(localRel);
    const objectPath = `${folder}/${destName}`;
    const mime = MIME_BY_EXT(destName);

    try {
      const buffer = fs.readFileSync(abs);
      await uploadBuffer(buffer, objectPath, mime);
      const public = publicUrl(objectPath);

      // Registrar en el mapa: /products/x.jpeg, products/x.jpeg y /imagenes_prod_inv/x.svg etc.
      for (const old of oldPathsFor(localRel)) {
        urlMap.set(old, public);
      }
      ok++;
      process.stdout.write(`   ✔ ${localRel}\n`);
    } catch (err) {
      console.error(`   ✗ ${localRel}: ${err.message}`);
    }
  }

  console.log(`\n☁️  Subidas: ${ok} · omitidas: ${skip}\n`);

  /* ---------- Actualizar la BD (products.img e inventario.img) ---------- */
  console.log('🗄  Actualizando URLs en la base de datos...');
  let updProducts = 0;
  let updInventario = 0;

  const { rows: products } = await pool.query('SELECT id, img FROM products WHERE img IS NOT NULL');
  for (const p of products) {
    const nueva = urlMap.get(p.img) || urlMap.get(String(p.img).replace(/^\//, ''));
    if (nueva && nueva !== p.img) {
      await pool.query('UPDATE products SET img = $1 WHERE id = $2', [nueva, p.id]);
      updProducts++;
    }
  }

  const { rows: inv } = await pool.query('SELECT id, img FROM inventario WHERE img IS NOT NULL');
  for (const i of inv) {
    const nueva = urlMap.get(i.img) || urlMap.get(String(i.img).replace(/^\//, ''));
    if (nueva && nueva !== i.img) {
      await pool.query('UPDATE inventario SET img = $1 WHERE id = $2', [nueva, i.id]);
      updInventario++;
    }
  }

  console.log(`   ✔ products.img actualizados: ${updProducts}`);
  console.log(`   ✔ inventario.img actualizados: ${updInventario}`);
  console.log('\n✅ Migración de imágenes completada. El frontend ahora carga todo desde Supabase.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error en la migración:', err.message);
  process.exit(1);
});
