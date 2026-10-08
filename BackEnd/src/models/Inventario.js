/**
 * Modelo de Inventario
 * Consultas SQL a la tabla "inventario" (materiales de fabricación)
 */
const pool = require('../config/db');

const UNIDADES = ['cm', 'm', 'unidades'];
const TIPOS = ['soutache', 'perlas', 'cristales', 'mostacillas', 'canteras', 'hilos', 'herrajes', 'otros'];

const Inventario = {
  UNIDADES,
  TIPOS,

  async getAll() {
    const result = await pool.query(
      `SELECT id, nombre, tipo, color, cantidad, unidad, img, notas, creado_en, actualizado_en
       FROM inventario ORDER BY tipo ASC, nombre ASC`
    );
    return result.rows;
  },

  async getById(id) {
    const result = await pool.query('SELECT * FROM inventario WHERE id = $1', [id]);
    return result.rows[0];
  },

  async getByNombre(nombre) {
    const result = await pool.query('SELECT id FROM inventario WHERE lower(nombre) = lower($1)', [nombre]);
    return result.rows[0];
  },

  async create({ nombre, tipo, color, cantidad, unidad, img, notas }) {
    const result = await pool.query(
      `INSERT INTO inventario (nombre, tipo, color, cantidad, unidad, img, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [nombre, tipo, color, cantidad, unidad, img, notas ?? null]
    );
    return result.rows[0];
  },

  // Actualiza solo los campos enviados (undefined = no tocar)
  async update(id, fields) {
    const map = {
      nombre: 'nombre',
      tipo: 'tipo',
      color: 'color',
      cantidad: 'cantidad',
      unidad: 'unidad',
      img: 'img',
      notas: 'notas',
    };
    const sets = [];
    const values = [];
    for (const [key, col] of Object.entries(map)) {
      if (fields[key] === undefined) continue;
      values.push(fields[key]);
      sets.push(`${col} = $${values.length}`);
    }
    if (sets.length === 0) return this.getById(id);

    values.push(id);
    const result = await pool.query(
      `UPDATE inventario SET ${sets.join(', ')}, actualizado_en = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async remove(id) {
    const result = await pool.query('DELETE FROM inventario WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },
};

module.exports = Inventario;
