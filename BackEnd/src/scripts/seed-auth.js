/**
 * Script de migración + seed de autenticación
 * Ejecutar con:  npm run seed:auth
 *
 * 1. Agrega columnas de autenticación a la tabla "users":
 *      - last_name     VARCHAR(100)
 *      - password_hash VARCHAR(255)
 * 2. Crea/actualiza la usuaria administradora:
 *      - Keyla Perez  <keylaperez@gmail.com>  role: admin  password: 1234
 */
require('dotenv').config({ override: true });
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const ADMIN = {
  name: 'Keyla',
  last_name: 'Perez',
  email: 'keylaperez@gmail.com',
  role: 'admin',
  password: '1234',
};

async function seedAuth() {
  try {
    console.log('🧩 Agregando columnas de autenticación a "users" (si no existen)...');

    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);`);

    console.log('🔐 Generando hash de la contraseña (bcrypt)...');
    const passwordHash = await bcrypt.hash(ADMIN.password, 10);

    console.log('👑 Creando/actualizando usuaria admin...');
    await pool.query(
      `INSERT INTO users (name, last_name, email, role, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             last_name = EXCLUDED.last_name,
             role = EXCLUDED.role,
             password_hash = EXCLUDED.password_hash,
             updated_at = NOW();`,
      [ADMIN.name, ADMIN.last_name, ADMIN.email, ADMIN.role, passwordHash]
    );

    const { rows } = await pool.query(
      'SELECT id, name, last_name, email, role FROM users WHERE email = $1',
      [ADMIN.email]
    );
    console.log('   ✔ Admin lista:', rows[0]);
    console.log('\n✅ Seed de autenticación completado.');
    console.log(`   Login: ${ADMIN.email} / ${ADMIN.password}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en el seed de autenticación:', err.message);
    process.exit(1);
  }
}

seedAuth();
