/**
 * Script para crear la tabla "users" e insertar los 5 usuarios iniciales
 * Ejecutar con:  npm run seed
 *
 * Usuarios:
 *  - Rossana Perez  -> empleado
 *  - Jesus Perez    -> empleado
 *  - Alex Ribeiro   -> empleado
 *  - Albert Ribeiro -> empleado
 *  - Keyla Perez    -> admin
 */
require('dotenv').config({ override: true });
const pool = require('../config/db');

const INITIAL_USERS = [
  { name: 'Rossana Perez', email: 'rossana.perez@ak.com', role: 'empleado' },
  { name: 'Jesus Perez', email: 'jesus.perez@ak.com', role: 'empleado' },
  { name: 'Alex Ribeiro', email: 'alex.ribeiro@ak.com', role: 'empleado' },
  { name: 'Albert Ribeiro', email: 'albert.ribeiro@ak.com', role: 'empleado' },
  { name: 'Keyla Perez', email: 'keyla.perez@ak.com', role: 'admin' },
];

async function seed() {
  try {
    console.log('📦 Creando tabla "users" (si no existe)...');

    // Tabla con restriccion CHECK para aceptar solo "admin" o "empleado"
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        role VARCHAR(20) NOT NULL DEFAULT 'empleado'
          CHECK (role IN ('admin', 'empleado')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log('👤 Insertando usuarios iniciales...');

    for (const user of INITIAL_USERS) {
      await pool.query(
        `INSERT INTO users (name, email, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING`,
        [user.name, user.email, user.role]
      );
      console.log(`   ✔ ${user.role.padEnd(8)} | ${user.name} <${user.email}>`);
    }

    const { rows } = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`\n✅ Seed completado. Total de usuarios en la base: ${rows[0].count}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en el seed:', err.message);
    process.exit(1);
  }
}

seed();
