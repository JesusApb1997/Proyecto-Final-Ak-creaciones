/**
 * Modelo de Usuario
 * Contiene todas las consultas SQL a la tabla "users"
 */
const pool = require('../config/db');

const User = {
  // Columnas seguras para exponer (NUNCA password_hash)
  SAFE_COLS: 'id, name, last_name, email, username, role, provider, created_at, updated_at',

  // Obtener todos los usuarios (tiene_pass indica si puede iniciar sesión; nunca expone el hash)
  async getAll() {
    const result = await pool.query(
      `SELECT ${this.SAFE_COLS}, (password_hash IS NOT NULL) AS tiene_pass
       FROM users ORDER BY id ASC`
    );
    return result.rows;
  },

  // Obtener un usuario por su ID
  async getById(id) {
    const result = await pool.query(
      `SELECT ${this.SAFE_COLS} FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  },

  // Obtener un usuario por su email
  async getByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  },

  // Obtener un usuario por su nombre de usuario (único, guardado en minúsculas)
  async getByUsername(username) {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [String(username || '').trim().toLowerCase()]
    );
    return result.rows[0];
  },

  // Obtener un usuario por login: acepta correo O nombre de usuario
  async getByLogin(identifier) {
    const id = String(identifier || '').trim().toLowerCase();
    const result = await pool.query(
      'SELECT * FROM users WHERE lower(trim(email)) = $1 OR lower(trim(username)) = $1 LIMIT 1',
      [id]
    );
    return result.rows[0];
  },

  // Saber si un username ya está ocupado (excludeId: no contar al propio usuario)
  async usernameTaken(username, excludeId = null) {
    const result = await pool.query(
      `SELECT id FROM users WHERE username = $1${excludeId ? ' AND id <> $2' : ''}`,
      excludeId ? [String(username || '').trim().toLowerCase(), excludeId] : [String(username || '').trim().toLowerCase()]
    );
    return Boolean(result.rows[0]);
  },

  // Crear un nuevo usuario (passwordHash es opcional)
  async create({ name, last_name, email, role, passwordHash, username }) {
    const result = await pool.query(
      `INSERT INTO users (name, last_name, email, role, password_hash, username)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, last_name ?? null, email, role, passwordHash ?? null, username ?? null]
    );
    return result.rows[0];
  },

  // Actualizar un usuario existente
  async update(id, { name, last_name, email, role, passwordHash, username }) {
    const result = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           last_name = COALESCE($2, last_name),
           email = COALESCE($3, email),
           role = COALESCE($4, role),
           password_hash = COALESCE($5, password_hash),
           username = COALESCE($6, username),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [name, last_name, email, role, passwordHash, username, id]
    );
    return result.rows[0];
  },

  // Asignar/restablecer la contraseña de un usuario (lo hace la administración)
  async setPassword(id, passwordHash) {
    const result = await pool.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, last_name, email, role`,
      [passwordHash, id]
    );
    return result.rows[0];
  },

  // Eliminar un usuario (cualquier rol: admin, empleado o cliente)
  async remove(id) {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  },
};

module.exports = User;
