/** Agrega el stock de productos terminados. Las existencias iniciales se cargan desde el panel. */
require('dotenv').config({ override: true });
const pool = require('../config/db');

async function migrateProductStock() {
  try {
    await pool.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0
      CHECK (stock >= 0)
    `);
    console.log('✅ Columna products.stock lista. Los productos existentes empiezan en 0; cárgalos desde el panel.');
  } catch (err) {
    console.error('❌ Error agregando stock a productos:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrateProductStock();
