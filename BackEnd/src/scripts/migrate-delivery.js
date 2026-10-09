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
        items       JSONB,
        total       NUMERIC(12,2) DEFAULT 0,
        status      VARCHAR(20)  DEFAULT 'pendiente',
        notes       TEXT,
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ  DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  DEFAULT NOW()
      );
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
