/**
 * Middleware de autenticación JWT
 * Verifica el header "Authorization: Bearer <token>"
 * y adjunta el payload del token a req.user
 */
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion';

async function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token no proporcionado. Inicia sesión.',
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    /* Si el usuario cambió su contraseña después de que este token fue emitido,
       el token queda inválido: cierra sesión en todas las pestañas/dispositivos.
       Nota: iat del JWT tiene precisión de segundos, así que truncamos
       password_changed_at a segundos para no invalidar tokens emitidos
       en el mismo segundo del cambio. */
    const { rows } = await pool.query(
      'SELECT password_changed_at FROM users WHERE id = $1',
      [payload.id]
    );
    const changedAt = rows[0]?.password_changed_at;
    const changedMs = changedAt ? Math.floor(new Date(changedAt).getTime() / 1000) * 1000 : null;
    if (changedMs && changedMs > payload.iat * 1000) {
      return res.status(401).json({
        success: false,
        message: 'Tu contraseña cambió. Inicia sesión de nuevo.',
      });
    }

    req.user = payload; // { id, email, role, name, last_name }
    next();
  } catch (err) {
    const msg =
      err.name === 'TokenExpiredError'
        ? 'Tu sesión expiró. Inicia sesión de nuevo.'
        : 'Token inválido.';
    return res.status(401).json({ success: false, message: msg });
  }
}

/**
 * Middleware opcional: exige un rol específico
 * Uso: router.get('/admin', verifyToken, requireRole('admin'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}`,
      });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole, JWT_SECRET };
