/**
 * Script de reparación de datos escritos a mano en Supabase
 * Ejecutar con:  npm run fix:passwords
 *
 * 1. Detecta contraseñas guardadas como TEXTO PLANO (ej. "2554", "1234") en la
 *    columna password_hash y las convierte a hash bcrypt (lo que el login espera).
 * 2. Normaliza roles: "administración"/"administrador" -> "admin".
 *
 * Así la BD queda sincronizada con el backend: cualquier dato que la
 * administradora agregue a mano en Supabase será válido al iniciar sesión.
 */
require('dotenv').config({ override: true });
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function fixPasswords() {
  try {
    console.log('🔎 Buscando contraseñas en texto plano en "users"...');

    // Un hash bcrypt real empieza con $2a$, $2b$ o $2y$.
    // Usamos [$] para que Postgres NO trate el $ como ancla de regex.
    const { rows } = await pool.query(
      `SELECT id, email, password_hash, role
       FROM users
       WHERE password_hash IS NOT NULL
         AND password_hash !~ '^[$]2[aby][$]'`
    );

    if (rows.length === 0) {
      console.log('✔ No hay contraseñas en texto plano. Nada por reparar.');
    } else {
      console.log(`🛠  ${rows.length} contraseña(s) en texto plano encontrada(s):`);
      for (const user of rows) {
        const hash = await bcrypt.hash(user.password_hash, 10);
        await pool.query(
          `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
          [hash, user.id]
        );
        console.log(`   ✔ ${user.email}: "${user.password_hash}" -> hash bcrypt`);
      }
    }

    console.log('🔎 Normalizando roles ("administración" -> "admin")...');
    const { rowCount } = await pool.query(
      `UPDATE users
       SET role = 'admin', updated_at = NOW()
       WHERE role IN ('administracion', 'administración', 'administrador')`
    );
    console.log(rowCount ? `✔ ${rowCount} rol(es) normalizados a "admin".` : '✔ Roles ya estaban normalizados.');

    console.log('\n✅ Reparación completada. La base de datos está sincronizada con el backend.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error reparando contraseñas:', err.message);
    process.exit(1);
  }
}

fixPasswords();
