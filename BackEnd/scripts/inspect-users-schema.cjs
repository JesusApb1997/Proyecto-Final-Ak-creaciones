require('dotenv').config({ override: true });
const pool = require('../src/config/db');

async function main() {
  // columnas
  const { rows: cols } = await pool.query(
    `SELECT column_name, data_type, character_maximum_length, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'
     ORDER BY ordinal_position`
  );
  console.log('=== COLUMNAS users ===');
  if (cols.length === 0) {
    console.log('TABLA users NO existe o no hay columnas visibles');
    process.exit(0);
  }
  cols.forEach((c) =>
    console.log(`${c.column_name}\t${c.data_type}${c.character_maximum_length ? '(' + c.character_maximum_length + ')' : ''}\tnullable=${c.is_nullable}`)
  );

  // constraints
  const { rows: cons } = await pool.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'users'::regclass ORDER BY conname`
  );
  console.log('\n=== CONSTRAINTS (users) ===');
  if (cons.length === 0) {
    console.log('No hay constraints visibles en users');
  } else {
    cons.forEach((c) => console.log(c.conname + ': ' + c.def));
  }

  // roles que realmente existen
  const { rows: roles } = await pool.query(
    `SELECT DISTINCT role FROM users ORDER BY role NULLS LAST`
  );
  console.log('\n=== ROLES reales en users ===');
  const present = roles
    .filter((r) => r.role != null)
    .map((r) => r.role);
  if (present.length === 0) console.log('sin registros con rol asignado, o la columna role no existe');
  else console.log(present.join(', '));
  // cuantas hay de cada rol
  const { rows: counts } = await pool.query(
    `SELECT role, count(*)::int as n FROM users GROUP BY role ORDER BY role NULLS LAST`
  );
  console.log('\n=== CONTEO por rol ===');
  counts.forEach((c) => console.log(c.role ? c.role + ': ' + c.n : '(NULL): ' + c.n));
  await pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
