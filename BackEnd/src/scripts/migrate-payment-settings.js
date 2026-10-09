/**
 * Migración: crea la tabla "PaymentSettings" (datos de pago móvil)
 *
 * Es la pestaña "Datos de pago" del dashboard: el admin escribe allí el
 * banco, teléfono, cédula y titular. Esa información es la que ve el cliente
 * en la tienda cuando en el carrito elige "Pagar por Pago Móvil".
 *
 * La tabla guarda UNA sola fila (id = 1): es una configuración, no un listado.
 *
 * Ejecutar con:  npm run migrate:payment-settings
 * (idempotente: se puede correr varias veces sin romper nada)
 */
require('dotenv').config({ override: true });
const pool = require('../config/db');

async function migratePaymentSettings() {
  try {
    console.log('🧩 Creando tabla "PaymentSettings" (si no existe)...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "PaymentSettings" (
        id            INTEGER PRIMARY KEY DEFAULT 1,
        bank_name     VARCHAR(120),
        phone         VARCHAR(40),
        cedula        VARCHAR(40),
        holder_name   VARCHAR(160),
        instructions  TEXT,
        enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
        updated_at    TIMESTAMPTZ  DEFAULT NOW(),
        CONSTRAINT payment_settings_single_row CHECK (id = 1)
      );
    `);

    /* Fila única de configuración con valores de partida (editables en el panel) */
    await pool.query(`
      INSERT INTO "PaymentSettings" (id, bank_name, phone, cedula, holder_name, instructions, enabled)
      VALUES (1, 'Banco de Venezuela', '+58 412 0000000', 'V-00.000.000', 'AK Creaciones', 'Envía el pago móvil y guarda el comprobante.', TRUE)
      ON CONFLICT (id) DO NOTHING;
    `);

    const { rows } = await pool.query('SELECT * FROM "PaymentSettings" WHERE id = 1');
    console.log('✅ Migración completada: datos de pago listos.');
    console.log(`   💳 ${rows[0].bank_name} · ${rows[0].phone} · ${rows[0].cedula} · ${rows[0].holder_name}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en la migración de datos de pago:', err.message);
    process.exit(1);
  }
}

migratePaymentSettings();
