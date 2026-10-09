/**
 * Modelo de Datos de Pago (Pago Móvil)
 * Contiene las consultas SQL a la tabla "PaymentSettings"
 *
 * Es una fila única de configuración (id = 1): el admin la edita desde la
 * pestaña "Datos de pago" del dashboard y el cliente la ve en el carrito.
 */
const pool = require('../config/db');

/* Fila por defecto si la migración aún no se ha ejecutado */
const DEFAULTS = {
  id: 1,
  bank_name: '',
  phone: '',
  cedula: '',
  holder_name: '',
  instructions: '',
  enabled: true,
};

const PaymentSettings = {
  // Devuelve la configuración (crea la fila por defecto si no existe)
  async get() {
    const result = await pool.query('SELECT * FROM "PaymentSettings" WHERE id = 1');
    if (result.rows[0]) return result.rows[0];

    // La tabla existe pero está vacía: sembrar la fila única
    const insert = await pool.query(
      `INSERT INTO "PaymentSettings" (id, bank_name, phone, cedula, holder_name, instructions, enabled)
       VALUES (1, '', '', '', '', '', TRUE)
       ON CONFLICT (id) DO NOTHING
       RETURNING *`
    );
    return insert.rows[0] || { ...DEFAULTS };
  },

  // Actualiza la configuración (solo los campos enviados)
  async update(fields) {
    await this.get(); // asegura que la fila exista

    const COLS = ['bank_name', 'phone', 'cedula', 'holder_name', 'instructions', 'enabled'];
    const sets = [];
    const values = [];
    for (const key of COLS) {
      const value = fields[key];
      if (value === undefined) continue;
      sets.push(`"${key}" = $${values.length + 1}`);
      values.push(key === 'enabled' ? Boolean(value) : value === null ? null : String(value).trim());
    }
    if (sets.length === 0) return this.get();

    const result = await pool.query(
      `UPDATE "PaymentSettings" SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      values
    );
    return result.rows[0];
  },
};

module.exports = PaymentSettings;
