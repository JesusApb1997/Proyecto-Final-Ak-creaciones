/**
 * Migración: crea la tabla "Delivery" (pedidos de entrega a domicilio)
 *
 * La usan los clientes registrados desde la tienda cuando eligen
 * "Delivery a mi localidad" en el carrito: guardan nombre, apellido,
 * teléfono, dirección y localidad, y el pedido queda visible para el
 * admin y los empleados en el dashboard (#/dashboard/delivery).
 *
 * Ejecutar con:  npm run migrate:delivery
 * (idempotente: se puede correr varias veces sin romper nada)
 */
require('dotenv').config({ override: true });
const pool = require('../config/db');

async function migrateDelivery() {
  try {
    console.log('🧩 Creando tabla "Delivery" (si no existe)...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Delivery" (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(120) NOT NULL,
        last_name   VARCHAR(120),
        phone       VARCHAR(40)  NOT NULL,
        address     TEXT         NOT NULL,
        localidad   VARCHAR(160),
        maps_url    TEXT,
        items       JSONB,
        total       NUMERIC(12,2) DEFAULT 0,
        status      VARCHAR(20)  DEFAULT 'pendiente',
        notes       TEXT,
        order_number VARCHAR(50),
        invoice_number VARCHAR(60),
        driver_name VARCHAR(120),
        driver_phone VARCHAR(40),
        location_confirmed BOOLEAN NOT NULL DEFAULT false,
        whatsapp_status VARCHAR(24) NOT NULL DEFAULT 'pendiente',
        whatsapp_sent_at TIMESTAMPTZ,
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ  DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  DEFAULT NOW()
      );
    `);

    await pool.query('ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS maps_url TEXT');
    await pool.query('ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS order_number VARCHAR(50)');
    await pool.query('ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(60)');
    await pool.query('ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS driver_name VARCHAR(120)');
    await pool.query('ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(40)');
    await pool.query('ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS location_confirmed BOOLEAN NOT NULL DEFAULT false');
    await pool.query('ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS whatsapp_status VARCHAR(24) NOT NULL DEFAULT \'pendiente\'');
    await pool.query('ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ');
    await pool.query('ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS stock_deducted_at TIMESTAMPTZ');
    await pool.query(`
      UPDATE "Delivery"
      SET stock_deducted_at = COALESCE(updated_at, created_at, NOW())
      WHERE stock_deducted_at IS NULL AND status IN ('en_camino', 'entregado')
    `);

    /* Estado controlado por la app (coincide con los pills del dashboard) */
    await pool.query(`
      ALTER TABLE "Delivery" DROP CONSTRAINT IF EXISTS delivery_status_check;
    `);
    await pool.query(`
      ALTER TABLE "Delivery" ADD CONSTRAINT delivery_status_check
      CHECK (status IN ('pendiente', 'en_proceso', 'en_camino', 'entregado', 'cancelado'));
    `);

    /* Consultas del dashboard (más recientes primero) y por usuario */
    await pool.query(`CREATE INDEX IF NOT EXISTS delivery_created_idx ON "Delivery" (created_at DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS delivery_user_idx ON "Delivery" (user_id);`);

    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM "Delivery"');
    console.log('✅ Migración completada: tabla "Delivery" lista.');
    console.log(`   📦 Pedidos guardados actualmente: ${rows[0].n}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en la migración de Delivery:', err.message);
    process.exit(1);
  }
}

migrateDelivery();
