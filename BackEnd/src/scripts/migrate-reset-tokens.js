/**
 * Migración: columnas para recuperación de contraseña por correo
 * Ejecutar con:  npm run migrate:reset-tokens
 *
 * Agrega a la tabla "users":
 *   - reset_token_hash   VARCHAR(64)  -> SHA-256 del token de recuperación (nunca el token en claro)
 *   - reset_token_expires TIMESTAMPTZ -> cuándo expira (30 min)
 *   - password_changed_at TIMESTAMPTZ-> invalida JWTs emitidos antes de este momento
 */
require('dotenv').config({ override: true });
const pool = require('../config/db');

async function migrate() {
  try {
    console.log('🧩 Agregando columnas de recuperación de contraseña a "users"...');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(64);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;`);
    console.log('✅ Migración completada.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en la migración:', err.message);
    process.exit(1);
  }
}

migrate();
