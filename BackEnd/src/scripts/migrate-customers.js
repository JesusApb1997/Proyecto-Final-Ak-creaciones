/**
 * Migración: agrega las columnas del login público de clientes
 *
 *   provider     VARCHAR(20)  -> 'email' | 'google' | 'apple'
 *   provider_id  VARCHAR(255) -> id del usuario en el proveedor (sub de Google/Apple)
 *   username     VARCHAR(32)  -> nombre de usuario único (login con correo O usuario)
 *
 * Ejecutar con:  npm run migrate:customers
 * (idempotente: se puede correr varias veces sin romper nada)
 */
require('dotenv').config({ override: true });
const pool = require('../config/db');

/* Convierte cualquier texto en un username válido: minúsculas, sin tildes,
   solo letras, números, punto, guion y guion bajo (3 a 24 caracteres). */
function sanitizeUsername(raw) {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 24);
}

async function migrateCustomers() {
  try {
    console.log('🧩 Agregando columnas del login público a "users" (si no existen)...');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'email';`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(32);`);
    // Username único entre los que lo tengan (los NULL no cuentan: los clientes
    // sociales aún pueden quedar sin usuario hasta que lo usen)
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username) WHERE username IS NOT NULL;`
    );

    // El CHECK de rol antiguo solo permitía admin/empleado: los clientes de la
    // tienda (role = 'cliente') y los usuarios comunes registrados desde el
    // login (role = 'user') necesitan estar permitidos en la BD.
    await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;`);
    await pool.query(
      `ALTER TABLE users ADD CONSTRAINT users_role_check
       CHECK (role IN ('admin', 'empleado', 'cliente', 'user'));`
    );

    /* Backfill: a los usuarios sin username se les propone uno derivado del
       correo; si está ocupado se prueba con sufijos numéricos. Si nada queda
       libre, se deja NULL (el admin puede asignarlo desde el panel). */
    const { rows: sinUsername } = await pool.query(
      `SELECT id, email, name FROM users WHERE username IS NULL ORDER BY id ASC`
    );
    let asignados = 0;
    for (const u of sinUsername) {
      const base = sanitizeUsername(u.email?.split('@')[0] || u.name || '');
      if (base.length < 3) continue;
      let candidato = base;
      for (let n = 1; n <= 20; n++) {
        const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [candidato]);
        if (!rows[0]) break;
        candidato = `${base}${n}`.slice(0, 24);
      }
      if (candidato.length < 3) continue;
      try {
        await pool.query('UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2', [candidato, u.id]);
        asignados++;
      } catch {
        /* colisión de carrera: se deja NULL sin romper la migración */
      }
    }

    console.log('✅ Migración completada: provider, provider_id y username listas.');
    if (asignados) console.log(`   🏷️  Se propuso username automático a ${asignados} usuario(s) existente(s).`);
    console.log('   Los clientes que se registren con Google/Apple quedarán guardados con su proveedor.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en la migración de clientes:', err.message);
    process.exit(1);
  }
}

migrateCustomers();
