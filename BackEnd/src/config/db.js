require('dotenv').config({ override: true });
const { Pool } = require('pg');

// Pool de conexiones a PostgreSQL (Supabase usa SSL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: false }, // Supabase siempre requiere SSL
});

// Verificacion de conexion al iniciar
pool
  .connect()
  .then((client) => {
    console.log('✅ Conectado a PostgreSQL (Supabase)');
    client.release();
  })
  .catch((err) => {
    console.error('❌ Error conectando a la base de datos:', err.message);
  });

module.exports = pool;
