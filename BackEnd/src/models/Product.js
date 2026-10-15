/**
 * Modelo de Producto
 * Contiene todas las consultas SQL a la tabla "products"
 */
const pool = require('../config/db');

/* Columnas que el cliente puede enviar en POST/PUT */
const EDITABLE_COLS = ['name', 'cat', 'price', 'old_price', 'desc', 'img', 'tag', 'color', 'stock'];

/* Convierte claves camelCase del frontend a snake_case de la BD */
const toDbKey = (k) => (k === 'oldPrice' ? 'old_price' : k);

function buildUpdate(fields) {
  const sets = [];
  const values = [];
  for (const [rawKey, value] of Object.entries(fields)) {
    const key = toDbKey(rawKey);
    if (!EDITABLE_COLS.includes(key) || value === undefined) continue;
    sets.push(`"${key}" = $${sets.length + 1}`);
    values.push(value);
  }
  return { sets, values };
}

const Product = {
  // Obtener todos los productos
  async getAll() {
    const result = await pool.query('SELECT * FROM products ORDER BY id ASC');
    return result.rows;
  },

  // Obtener un producto por su ID
  async getById(id) {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    return result.rows[0];
  },

  // Crear un nuevo producto
  async create({ name, cat, price, oldPrice, desc, img, tag, color, stock }) {
    const result = await pool.query(
      `INSERT INTO products (name, cat, price, old_price, "desc", img, tag, color, stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, cat, price, oldPrice ?? null, desc, img, tag ?? null, color ?? null, stock ?? 0]
    );
    return result.rows[0];
  },

  // Actualizar un producto (solo los campos enviados; un campo enviado como null sí se guarda como null)
  async update(id, fields) {
    const { sets, values } = buildUpdate(fields);
    if (sets.length === 0) return this.getById(id);

    values.push(id);
    const result = await pool.query(
      `UPDATE products SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  // Eliminar un producto
  async remove(id) {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },
};

module.exports = Product;
