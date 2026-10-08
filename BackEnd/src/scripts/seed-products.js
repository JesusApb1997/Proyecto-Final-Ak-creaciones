/**
 * Script para crear la tabla "products" e insertar los 9 productos del catalogo
 * Ejecutar con:  npm run seed:products
 */
require('dotenv').config({ override: true });
const { publicUrl } = require('../config/storage');

/* Las imágenes viven en Supabase Storage (bucket público) */
const IMG = (archivo) => publicUrl('productos/' + archivo);
const pool = require('../config/db');

const INITIAL_PRODUCTS = [
  { name: 'Zarcillo Vino Real',    cat: 'zarcillos', price: 12.00, oldPrice: null,  desc: 'Soutache bordado a mano en tonos vino con cristales ahumados y mostacillas doradas.', img: IMG('zarcillo-vino.jpeg'),      tag: null },
  { name: 'Zarcillo Noche Dorada', cat: 'zarcillos', price: 14.00, oldPrice: 17.00, desc: 'Espiral de soutache negro con hilos dorados y cristal central; elegancia para la noche.', img: IMG('zarcillo-negro-oro.jpeg'), tag: 'oferta' },
  { name: 'Zarcillo Azul Royal',   cat: 'zarcillos', price: 15.00, oldPrice: null,  desc: 'Cristales azul zafiro enmarcados en soutache bordado con mostacillas azul electrico.', img: IMG('zarcillo-azul-royal.jpeg'), tag: null },
  { name: 'Zarcillo Turquesa',     cat: 'zarcillos', price: 15.00, oldPrice: null,  desc: 'Gota central turquesa con bordado azul rey y detalles dorados; frescura tropical.', img: IMG('zarcillo-turquesa.jpeg'),  tag: null },
  { name: 'Zarcillo Esmeralda',    cat: 'zarcillos', price: 16.00, oldPrice: null,  desc: 'Cristal verde esmeralda con capas gris perla y mostacillas verdes tejidas a mano.', img: IMG('zarcillo-esmeralda.jpeg'), tag: null },
  { name: 'Zarcillo Menta',        cat: 'zarcillos', price: 14.00, oldPrice: null,  desc: 'Espiral menta con cristal opalina; un diseno suave y luminoso para el dia.', img: IMG('zarcillo-menta.jpeg'),     tag: 'nuevo' },
  { name: 'Zarcillo Zafiro',       cat: 'zarcillos', price: 18.00, oldPrice: null,  desc: 'Tres cristales azul profundo con capeado dorado; pieza statement de gala.', img: IMG('zarcillo-zafiro.jpeg'),    tag: 'nuevo' },
  { name: 'Zarcillo Fiesta',       cat: 'zarcillos', price: 20.00, oldPrice: null,  desc: 'Soutache multicolor en espirales vibrantes con cristal fucsia; pura alegria.', img: IMG('zarcillo-fiesta.jpeg'),    tag: 'nuevo' },
  { name: 'Zarcillo Ambar',        cat: 'zarcillos', price: 13.00, oldPrice: null,  desc: 'Espirales cafe con cristal ambar central; calido, versatil y hecho a mano.', img: IMG('zarcillo-ambar.jpeg'),     tag: null },
];

async function seedProducts() {
  try {
    console.log('📦 Creando tabla "products" (si no existe)...');

    // Tabla con restriccion CHECK para aceptar solo categorias conocidas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        cat VARCHAR(30) NOT NULL DEFAULT 'zarcillos'
          CHECK (cat IN ('zarcillos', 'collares', 'pulseras', 'anillos', 'sets')),
        price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
        old_price NUMERIC(10, 2) CHECK (old_price IS NULL OR old_price >= 0),
        "desc" TEXT NOT NULL,
        img VARCHAR(255),
        tag VARCHAR(20)
          CHECK (tag IS NULL OR tag IN ('nuevo', 'oferta')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log('🛍️  Insertando productos iniciales...');

    const { rows: existingRows } = await pool.query('SELECT name FROM products');
    const existingNames = new Set(existingRows.map((r) => r.name));

    for (const p of INITIAL_PRODUCTS) {
      if (existingNames.has(p.name)) {
        console.log(`   ↷ ${p.name.padEnd(24)} | ya existe, se omite`);
        continue;
      }
      await pool.query(
        `INSERT INTO products (name, cat, price, old_price, "desc", img, tag)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [p.name, p.cat, p.price, p.oldPrice, p.desc, p.img, p.tag]
      );
      console.log(`   ✔ ${p.name.padEnd(24)} | $${p.price.toFixed(2)} | ${p.cat}`);
    }

    const { rows } = await pool.query('SELECT COUNT(*) FROM products');
    console.log(`\n✅ Seed completado. Total de productos en la base: ${rows[0].count}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en el seed de productos:', err.message);
    process.exit(1);
  }
}

seedProducts();
