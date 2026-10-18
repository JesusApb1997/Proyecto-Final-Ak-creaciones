/**
 * Modelo de Delivery (Pedidos a domicilio/localidad)
 * Contiene todas las consultas SQL a la tabla "Delivery"
 */
const pool = require('../config/db');
const { deductStock, resolveStockItems } = require('../services/productStock');

/* Columnas editables */
const EDITABLE_COLS = ['name', 'last_name', 'phone', 'address', 'localidad', 'maps_url', 'items', 'total', 'status', 'notes', 'user_id'];

/* La columna items es JSONB: pg serializa arrays de JS como arrays de
   Postgres ({...}) y eso rompe la inserción. Hay que enviar una cadena JSON. */
function toJsonParam(value) {
  if (value === undefined || value === null) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

const Delivery = {
  // Obtener todos los pedidos de delivery
  async getAll() {
    const result = await pool.query('SELECT * FROM "Delivery" ORDER BY id DESC');
    return result.rows;
  },

  // Obtener todos los pedidos de delivery de un usuario específico
  async getByUserId(user_id) {
    const result = await pool.query('SELECT * FROM "Delivery" WHERE user_id = $1 ORDER BY id DESC', [user_id]);
    return result.rows;
  },

  // Obtener un pedido por su ID
  async getById(id) {
    const result = await pool.query('SELECT * FROM "Delivery" WHERE id = $1', [id]);
    return result.rows[0];
  },

  // Crear un nuevo pedido de delivery
  async create({ name, last_name, phone, address, localidad, maps_url, items, total, status = 'pendiente', notes, user_id, order_number, invoice_number }) {
    const result = await pool.query(
      `INSERT INTO "Delivery" (name, last_name, phone, address, localidad, maps_url, items, total, status, notes, user_id, order_number, invoice_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        name,
        last_name ?? null,
        phone,
        address,
        localidad ?? null,
        maps_url ?? null,
        toJsonParam(items),
        total ?? 0,
        status,
        notes ?? null,
        user_id ?? null,
        order_number ?? null,
        invoice_number ?? null,
      ]
    );
    return result.rows[0];
  },

  async assignDriver(id, { driver_name, driver_phone, location_confirmed }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT id, items, status, stock_deducted_at FROM "Delivery" WHERE id = $1 FOR UPDATE',
        [id]
      );
      const delivery = rows[0];
      if (!delivery) {
        await client.query('ROLLBACK');
        return null;
      }
      if (delivery.status === 'cancelado') {
        const error = new Error('No se puede despachar un delivery cancelado.');
        error.code = 'DELIVERY_STATUS_CONFLICT';
        throw error;
      }
      if (!delivery.stock_deducted_at) {
        const rawItems = Array.isArray(delivery.items) ? delivery.items : [];
        const stockItems = await resolveStockItems(client, rawItems);
        await deductStock(client, stockItems);
      }
      const result = await client.query(
        `UPDATE "Delivery"
         SET driver_name = $1, driver_phone = $2, location_confirmed = $3,
             status = 'en_camino', whatsapp_status = 'pendiente',
             stock_deducted_at = COALESCE(stock_deducted_at, NOW()), updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [driver_name, driver_phone, location_confirmed, id]
      );
      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Finalizar una venta de delivery: asegura el descuento de stock de los productos vendidos y marca status como 'entregado'
  async finalizeSale(id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT * FROM "Delivery" WHERE id = $1 FOR UPDATE',
        [id]
      );
      const delivery = rows[0];
      if (!delivery) {
        await client.query('ROLLBACK');
        return null;
      }
      if (delivery.status === 'cancelado') {
        const error = new Error('No se puede finiquitar una venta que fue cancelada.');
        error.code = 'DELIVERY_STATUS_CONFLICT';
        throw error;
      }

      // Si no se había descontado el stock previamente, descontarlo ahora atómicamente
      if (!delivery.stock_deducted_at) {
        const rawItems = Array.isArray(delivery.items) ? delivery.items : [];
        const stockItems = await resolveStockItems(client, rawItems);
        await deductStock(client, stockItems);
      }

      const result = await client.query(
        `UPDATE "Delivery"
         SET status = 'entregado',
             stock_deducted_at = COALESCE(stock_deducted_at, NOW()),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );
      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async setWhatsAppStatus(id, status, sentAt = null) {
    const result = await pool.query(
      `UPDATE "Delivery" SET whatsapp_status = $1, whatsapp_sent_at = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, sentAt, id]
    );
    return result.rows[0];
  },

  // Actualizar un pedido de delivery
  async update(id, fields) {
    const sets = [];
    const values = [];
    for (const [key, value] of Object.entries(fields)) {
      if (!EDITABLE_COLS.includes(key) || value === undefined) continue;
      sets.push(`"${key}" = $${sets.length + 1}`);
      values.push(key === 'items' ? toJsonParam(value) : value);
    }
    if (sets.length === 0) return this.getById(id);

    values.push(id);
    const result = await pool.query(
      `UPDATE "Delivery" SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  // Eliminar un pedido de delivery
  async remove(id) {
    const result = await pool.query('DELETE FROM "Delivery" WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },

  // Actualizar estado del pedido
  async updateStatus(id, status) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT status, stock_deducted_at FROM "Delivery" WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      if (['en_camino', 'entregado'].includes(status) && !rows[0].stock_deducted_at) {
        const error = new Error('Despacha el pedido y asigna un conductor antes de marcarlo en camino o entregado.');
        error.code = 'DELIVERY_STATUS_CONFLICT';
        throw error;
      }
      const result = await client.query(
        'UPDATE "Delivery" SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, id]
      );
      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = Delivery;
