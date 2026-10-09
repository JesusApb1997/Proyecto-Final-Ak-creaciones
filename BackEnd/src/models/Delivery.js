/**
 * Modelo de Delivery (Pedidos a domicilio/localidad)
 * Contiene todas las consultas SQL a la tabla "Delivery"
 */
const pool = require('../config/db');

/* Columnas editables */
const EDITABLE_COLS = ['name', 'last_name', 'phone', 'address', 'localidad', 'items', 'total', 'status', 'notes', 'user_id'];

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
  async create({ name, last_name, phone, address, localidad, items, total, status = 'pendiente', notes, user_id }) {
    const result = await pool.query(
      `INSERT INTO "Delivery" (name, last_name, phone, address, localidad, items, total, status, notes, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        name,
        last_name ?? null,
        phone,
        address,
        localidad ?? null,
        toJsonParam(items),
        total ?? 0,
        status,
        notes ?? null,
        user_id ?? null,
      ]
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
    const result = await pool.query(
      'UPDATE "Delivery" SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0];
  },
};

module.exports = Delivery;
