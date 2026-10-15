const pool = require('../config/db');
const { deductStock, ProductStockError } = require('../services/productStock');

const toJsonParam = (value) => JSON.stringify(value ?? null);

async function resolveStockItems(client, items) {
  const parsed = Array.isArray(items) ? items : [];
  const unresolvedNames = [...new Set(parsed
    .filter((item) => !Number.isInteger(Number(item.product_id ?? item.id)))
    .map((item) => String(item.name || '').trim())
    .filter(Boolean))];
  const nameToId = new Map();
  for (const name of unresolvedNames) {
    const { rows } = await client.query(
      'SELECT id FROM products WHERE LOWER(name) = LOWER($1) ORDER BY id LIMIT 2',
      [name]
    );
    if (rows.length !== 1) {
      throw new ProductStockError(`No se pudo identificar de forma única el producto "${name}" en este pedido.`);
    }
    nameToId.set(name.toLowerCase(), Number(rows[0].id));
  }
  return parsed.map((item) => {
    const id = Number(item.product_id ?? item.id) || nameToId.get(String(item.name || '').trim().toLowerCase());
    return { product_id: id, qty: Number(item.qty) };
  });
}

const StoreOrder = {
  async create({
    order_number,
    user_id,
    customer_name,
    customer_email,
    payment_method,
    status,
    items,
    total,
    payment_details,
    payer_phone,
    payer_bank,
    reported_amount,
    reference_number,
    receipt_name,
    receipt_mime,
    receipt_data,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO store_orders
         (order_number, user_id, customer_name, customer_email, payment_method, status,
          items, total, payment_details, payer_phone, payer_bank, reported_amount,
          reference_number, receipt_name, receipt_mime, receipt_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id, order_number, status`,
      [
        order_number,
        user_id,
        customer_name,
        customer_email,
        payment_method,
        status,
        toJsonParam(items),
        total,
        toJsonParam(payment_details),
        payer_phone || null,
        payer_bank || null,
        reported_amount ?? null,
        reference_number || null,
        receipt_name || null,
        receipt_mime || null,
        receipt_data || null,
      ]
    );
    return rows[0];
  },

  async getAll() {
    const { rows } = await pool.query(
      `SELECT id, order_number, user_id, customer_name, customer_email, payment_method,
              status, items, total, payment_details, payer_phone, payer_bank,
              reported_amount, reference_number, receipt_name,
              (receipt_data IS NOT NULL) AS has_receipt, verified_at, created_at
       FROM store_orders ORDER BY created_at DESC, id DESC`
    );
    return rows;
  },

  async getReceipt(id) {
    const { rows } = await pool.query(
      'SELECT receipt_name, receipt_mime, receipt_data FROM store_orders WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  },

  async updateStatus(id, status) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT id, order_number, status, items, verified_at FROM store_orders WHERE id = $1 FOR UPDATE',
        [id]
      );
      const order = rows[0];
      if (!order) {
        await client.query('ROLLBACK');
        return null;
      }
      if (order.status === status) {
        await client.query('COMMIT');
        return { id: order.id, order_number: order.order_number, status: order.status, verified_at: order.verified_at };
      }
      if (!['reportado', 'pendiente'].includes(order.status)) {
        const error = new Error('Este pedido ya fue procesado y no se puede cambiar de estado.');
        error.code = 'ORDER_STATUS_CONFLICT';
        throw error;
      }
      if (status === 'verificado') {
        const stockItems = await resolveStockItems(client, order.items);
        await deductStock(client, stockItems);
      }
      const updated = await client.query(
        `UPDATE store_orders
         SET status = $1::varchar,
             verified_at = CASE WHEN $1::varchar = 'verificado' THEN NOW() ELSE NULL END,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, order_number, status, verified_at`,
        [status, id]
      );
      await client.query('COMMIT');
      return updated.rows[0] || null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = StoreOrder;