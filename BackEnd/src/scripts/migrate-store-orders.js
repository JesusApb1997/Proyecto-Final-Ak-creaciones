/** Crea el historial persistente de reportes de Pago Móvil del carrito. */
require('dotenv').config({ override: true });
const pool = require('../config/db');

async function migrateStoreOrders() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS store_orders (
        id BIGSERIAL PRIMARY KEY,
        order_number VARCHAR(40) NOT NULL UNIQUE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        customer_name VARCHAR(240) NOT NULL,
        customer_email VARCHAR(320) NOT NULL,
        payment_method VARCHAR(40) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'reportado',
        items JSONB NOT NULL,
        total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
        payment_details JSONB NOT NULL,
        payer_phone VARCHAR(40),
        payer_bank VARCHAR(120),
        reported_amount NUMERIC(12,2) CHECK (reported_amount IS NULL OR reported_amount >= 0),
        reference_number VARCHAR(100),
        receipt_name VARCHAR(255),
        receipt_mime VARCHAR(80),
        receipt_data BYTEA,
        verified_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query('ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS payer_phone VARCHAR(40)');
    await pool.query('ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS payer_bank VARCHAR(120)');
    await pool.query('ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS reported_amount NUMERIC(12,2)');
    await pool.query('ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100)');
    await pool.query('ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS receipt_name VARCHAR(255)');
    await pool.query('ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS receipt_mime VARCHAR(80)');
    await pool.query('ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS receipt_data BYTEA');
    await pool.query('ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ');
    await pool.query('ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ');
    await pool.query('ALTER TABLE store_orders DROP CONSTRAINT IF EXISTS store_orders_status_check');
    await pool.query("ALTER TABLE store_orders ADD CONSTRAINT store_orders_status_check CHECK (status IN ('pendiente', 'reportado', 'verificado', 'rechazado'))");
    await pool.query('CREATE INDEX IF NOT EXISTS store_orders_created_idx ON store_orders (created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS store_orders_user_idx ON store_orders (user_id)');
    console.log('✅ Tabla store_orders lista.');
  } catch (err) {
    console.error('❌ Error creando store_orders:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrateStoreOrders();