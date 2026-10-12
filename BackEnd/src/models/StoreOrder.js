const pool = require('../config/db');

const toJsonParam = (value) => JSON.stringify(value ?? null);

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
    const { rows } = await pool.query(
      `UPDATE store_orders
       SET status = $1,
           verified_at = CASE WHEN $1 = 'verificado' THEN NOW() ELSE NULL END
       WHERE id = $2
       RETURNING id, order_number, status, verified_at`,
      [status, id]
    );
    return rows[0] || null;
  },
};

module.exports = StoreOrder;