/**
 * Libera un puerto matando el proceso que lo ocupa (Windows / macOS / Linux).
 * Uso: node scripts/kill-port.js 5173
 *
 * Reemplaza a `npx kill-port` (que falla en Windows con cmd.exe y a veces se
 * queda colgado descargando el paquete). No tiene dependencias.
 */
const { execSync } = require('child_process');

const port = String(process.argv[2] || '');
if (!port) {
  console.error('Uso: node scripts/kill-port.js <puerto>');
  process.exit(1);
}

const isWindows = process.platform === 'win32';

function pidsEnPuerto() {
  try {
    if (isWindows) {
      // netstat -ano -> última columna: PID; filtramos líneas LISTENING del puerto
      const out = execSync(`netstat -ano | findstr ":${port} "`, { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split('\n')) {
        if (/LISTENING/i.test(line)) {
          const pid = line.trim().split(/\s+/).pop();
          if (pid && /^\d+$/.test(pid)) pids.add(pid);
        }
      }
      return [...pids];
    }
    // Unix: lsof devuelve los PID directamente
    const out = execSync(`lsof -t -iTCP:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
    return out.split('\n').map((s) => s.trim()).filter((s) => /^\d+$/.test(s));
  } catch {
    return []; // sin proceso en ese puerto: no es error
  }
}

const pids = pidsEnPuerto();
if (pids.length === 0) {
  console.log(`ℹ️  Puerto ${port} libre, no hay nada que cerrar.`);
  process.exit(0);
}

for (const pid of pids) {
  try {
    if (isWindows) {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'pipe' });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
    }
    console.log(`✅ Proceso ${pid} (puerto ${port}) terminado.`);
  } catch (err) {
    console.warn(`⚠️  No se pudo terminar el proceso ${pid}: ${err.message}`);
  }
}
console.log(`✓ Puerto ${port} liberado.`);
