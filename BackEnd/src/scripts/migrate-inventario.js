/**
 * Migración: tabla "inventario" (materiales para fabricar los productos)
 * Ejecutar con:  npm run migrate:inventario
 *
 * Unidades soportadas: 'cm', 'm', 'unidades' (CHECK en la BD).
 * Solo la administración la gestiona (la API lo valida con el rol del JWT).
 */
require('dotenv').config({ override: true });
const pool = require('../config/db');

async function migrate() {
  try {
    console.log('🧩 Creando tabla "inventario" (si no existe)...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventario (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        tipo VARCHAR(80) NOT NULL DEFAULT 'soutache',
        color VARCHAR(80),
        cantidad NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
        unidad VARCHAR(10) NOT NULL DEFAULT 'm' CHECK (unidad IN ('cm', 'm', 'unidades')),
        img VARCHAR(255),
        notas TEXT,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ Migración completada: tabla "inventario" lista.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en la migración:', err.message);
    process.exit(1);
  }
}

migrate();
