/**
 * Seed de inventario: 25 materiales para fabricar los productos de la tienda
 * Ejecutar con:  npm run seed:inventario
 *
 * Las imágenes viven en Supabase Storage (bucket público, carpeta inventario/).
 * Antes de correr este seed en una BD nueva, ejecuta npm run migrate:images
 * para subir las imágenes al bucket.
 */
require('dotenv').config({ override: true });
const { publicUrl } = require('../config/storage');

/* Las imágenes viven en Supabase Storage (bucket público) */
const IMG = (archivo) => publicUrl('inventario/' + archivo);
const pool = require('../config/db');



const MATERIALES = [
  // Soutache (se vende por metros)
  { nombre: 'Soutache vino', tipo: 'soutache', color: 'Vino', cantidad: 12.5, unidad: 'm', img: IMG('soutache-vino.svg') },
  { nombre: 'Soutache negro/oro', tipo: 'soutache', color: 'Negro/Dorado', cantidad: 18, unidad: 'm', img: IMG('soutache-negro-oro.svg') },
  { nombre: 'Soutache azul royal', tipo: 'soutache', color: 'Azul royal', cantidad: 9.75, unidad: 'm', img: IMG('soutache-azul-royal.svg') },
  { nombre: 'Soutache turquesa', tipo: 'soutache', color: 'Turquesa', cantidad: 14.2, unidad: 'm', img: IMG('soutache-turquesa.svg') },
  { nombre: 'Soutache esmeralda', tipo: 'soutache', color: 'Esmeralda', cantidad: 7.5, unidad: 'm', img: IMG('soutache-esmeralda.svg') },
  { nombre: 'Soutache menta', tipo: 'soutache', color: 'Menta', cantidad: 11, unidad: 'm', img: IMG('soutache-menta.svg') },
  { nombre: 'Soutache fucsia', tipo: 'soutache', color: 'Fucsia', cantidad: 16.8, unidad: 'm', img: IMG('soutache-fucsia.svg') },
  { nombre: 'Soutache blanco', tipo: 'soutache', color: 'Blanco', cantidad: 20, unidad: 'm', img: IMG('soutache-blanco.svg') },
  // Perlas y cristales (por unidades)
  { nombre: 'Perlas blancas', tipo: 'perlas', color: 'Blanco marfil', cantidad: 480, unidad: 'unidades', img: IMG('perlas-blancas.svg') },
  { nombre: 'Perlas rosadas', tipo: 'perlas', color: 'Rosado', cantidad: 320, unidad: 'unidades', img: IMG('perlas-rosadas.svg') },
  { nombre: 'Perlas gris perla', tipo: 'perlas', color: 'Gris', cantidad: 260, unidad: 'unidades', img: IMG('perlas-gris.svg') },
  { nombre: 'Perlas doradas', tipo: 'perlas', color: 'Dorado', cantidad: 190, unidad: 'unidades', img: IMG('perlas-doradas.svg') },
  { nombre: 'Mostacillas multicolor', tipo: 'mostacillas', color: 'Multicolor', cantidad: 1200, unidad: 'unidades', img: IMG('mostacillas-multicolor.svg') },
  { nombre: 'Cristal AB iridiscente', tipo: 'cristales', color: 'Iridiscente', cantidad: 150, unidad: 'unidades', img: IMG('cristal-ab.svg') },
  // Canteras / gemas centrales
  { nombre: 'Cantera ámbar', tipo: 'canteras', color: 'Ámbar', cantidad: 24, unidad: 'unidades', img: IMG('cantera-ambar.svg') },
  { nombre: 'Cantera turquesa', tipo: 'canteras', color: 'Turquesa', cantidad: 18, unidad: 'unidades', img: IMG('cantera-turquesa.svg') },
  { nombre: 'Cantera rubí', tipo: 'canteras', color: 'Rubí', cantidad: 12, unidad: 'unidades', img: IMG('cantera-rubi.svg') },
  { nombre: 'Cantera jade', tipo: 'canteras', color: 'Jade', cantidad: 15, unidad: 'unidades', img: IMG('cantera-jade.svg') },
  // Hilos y consumibles (por metros)
  { nombre: 'Hilo soutache dorado', tipo: 'hilos', color: 'Dorado', cantidad: 45, unidad: 'm', img: IMG('hiilo-soutache-oro.svg') },
  { nombre: 'Hilo soutache negro', tipo: 'hilos', color: 'Negro', cantidad: 60, unidad: 'm', img: IMG('hiilo-soutache-negro.svg') },
  { nombre: 'Hilo nervilar transparente', tipo: 'hilos', color: 'Transparente', cantidad: 30.5, unidad: 'm', img: IMG('cauchos-transparentes.svg') },
  // Herrajes (por unidades)
  { nombre: 'Base zarcillo oro', tipo: 'herrajes', color: 'Dorado', cantidad: 85, unidad: 'unidades', img: IMG('base-zarcillo-oro.svg') },
  { nombre: 'Base zarcillo plata', tipo: 'herrajes', color: 'Plateado', cantidad: 110, unidad: 'unidades', img: IMG('base-zarcillo-plata.svg') },
  { nombre: 'Broche criolla plata', tipo: 'herrajes', color: 'Plateado', cantidad: 64, unidad: 'unidades', img: IMG('broches-plata.svg') },
  { nombre: 'Cierre mosquetón oro', tipo: 'herrajes', color: 'Dorado', cantidad: 40, unidad: 'unidades', img: IMG('cierre-oro.svg') },
];

async function seedInventario() {
  try {
    console.log('📦 Insertando materiales en "inventario"...');
    let n = 0;
    for (const m of MATERIALES) {
      await pool.query(
        `INSERT INTO inventario (nombre, tipo, color, cantidad, unidad, img)
         SELECT $1::varchar, $2::varchar, $3::varchar, $4::numeric, $5::varchar, $6::varchar
         WHERE NOT EXISTS (SELECT 1 FROM inventario WHERE nombre = $1::varchar)`,
        [m.nombre, m.tipo, m.color, m.cantidad, m.unidad, m.img]
      );
      n++;
    }
    const { rows } = await pool.query('SELECT COUNT(*) FROM inventario');
    console.log(`   ✔ ${n} materiales procesados. Total en la base: ${rows[0].count}`);
    console.log('✅ Seed de inventario completado.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en el seed de inventario:', err.message);
    process.exit(1);
  }
}

seedInventario();
