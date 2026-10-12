/**
 * Controlador de Autenticación
 * POST /api/auth/login  -> valida credenciales y devuelve un JWT
 * GET  /api/auth/me     -> devuelve el perfil según el token (protegido)
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');
const { sendPasswordReset } = require('../services/mailer');

const TOKEN_TTL = '8h'; // sesión del staff (panel de administración)
const CUSTOMER_TOKEN_TTL = '30d'; // sesión larga para clientes de la tienda
const RESET_TTL_MIN = 30; // minutos de validez del enlace de recuperación

/*
 * Verifica la contraseña contra el hash guardado.
 *
 * Si la administradora escribió la contraseña directamente en Supabase (texto
 * plano, ej. "2554"), bcrypt.compare fallaría. Para mantener la BD sincronizada
 * con el backend, aquí se detecta ese caso, se valida en claro y —si es correcta—
 * se convierte automáticamente a hash bcrypt en la BD. Así la próxima vez ya se
 * compara contra el hash y no hay que tocar nada a mano.
 */
async function verifyPassword(password, user) {
  const stored = String(user.password_hash ?? '');
  const looksHashed = /^\$2[aby]\$/.test(stored); // $2a$ / $2b$ / $2y$

  if (!looksHashed) {
    // Contraseña en texto plano escrita a mano en la BD
    if (password !== stored) return false;
    // Correcta: hashearla ahora para que quede en el formato que el login espera
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      hash,
      user.id,
    ]);
    user.password_hash = hash;
    return true;
  }

  return bcrypt.compare(password, stored);
}

/*
 * La BD puede tener roles escritos a mano en Supabase ("administración",
 * "administrador", etc.). El panel y los tokens trabajan con "admin"/"empleado",
 * así que normalizamos el rol al hacer login y actualizamos la BD para que
 * quede sincronizada.
 */
function normRole(role) {
  const r = String(role ?? '').trim().toLowerCase();
  if (['admin', 'administracion', 'administración', 'administrador', 'administradora'].includes(r)) return 'admin';
  // Los clientes del login público quedan con rol "cliente" (sin panel);
  // los registros nuevos usan el rol "user" — nunca sube al panel.
  if (r === 'user') return 'user';
  if (String(r) === 'cliente' || String(r) === 'customer' || String(r) === 'client') return 'cliente';
  return 'empleado';
}

const authController = {
  // GET /api/auth/accounts
  // Lista las cuentas que pueden iniciar sesión (tienen contraseña asignada).
  // Sirve para el paso "elige tu usuario" del login. No expone hashes ni datos sensibles.
  async accounts(req, res) {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, last_name, email,
                CASE WHEN lower(trim(role)) IN ('admin', 'administracion', 'administración', 'administrador', 'administradora')
                     THEN 'admin' ELSE 'empleado' END AS role
         FROM users
         WHERE password_hash IS NOT NULL
           AND lower(trim(role)) IN ('admin', 'administracion', 'administración', 'administrador', 'administradora',
                                     'empleado', 'empleada', 'employee')
         ORDER BY (CASE WHEN lower(trim(role)) IN ('admin', 'administracion', 'administración', 'administrador', 'administradora')
                        THEN 0 ELSE 1 END), id ASC`
      );
      res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/auth/login
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Los campos "email" y "password" son obligatorios',
        });
      }

      const { rows } = await pool.query(
        `SELECT id, name, last_name, email, role, password_hash
         FROM users
         WHERE email = $1`,
        [String(email).trim().toLowerCase()]
      );
      const user = rows[0];

      // Mensaje genérico para no revelar si el email existe
      if (!user || !user.password_hash) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales incorrectas',
        });
      }

      const ok = await verifyPassword(String(password), user);
      if (!ok) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales incorrectas',
        });
      }

      const role = normRole(user.role);
      if (role !== user.role) {
        // Rol escrito a mano en Supabase: lo alineamos con lo que espera el backend
        await pool.query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [
          role,
          user.id,
        ]);
      }

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role,
          name: user.name,
          last_name: user.last_name,
        },
        JWT_SECRET,
        // Los usuarios comunes (cliente/user) permanecen con sesión larga (30 días); el staff 8 horas
        { expiresIn: ['cliente', 'user'].includes(role) ? CUSTOMER_TOKEN_TTL : TOKEN_TTL }
      );

      res.json({
        success: true,
        message: `¡Bienvenida, ${user.name}!`,
        token,
        user: {
          id: user.id,
          name: user.name,
          last_name: user.last_name,
          email: user.email,
          role,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/auth/me (requiere token)
  async me(req, res) {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, last_name, email, role, created_at
         FROM users WHERE id = $1`,
        [req.user.id]
      );
      if (!rows[0]) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }
      const profileRole = normRole(rows[0].role);
      if (profileRole !== req.user.role) {
        return res.status(403).json({ success: false, message: 'El rol de la cuenta cambió. Inicia sesión de nuevo.' });
      }
      res.json({ success: true, data: { ...rows[0], role: req.user.role } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // PUT /api/auth/me (requiere token)
  // Cada usuario actualiza SOLO sus propios datos (el id sale del token, nunca del body)
  async updateMe(req, res) {
    try {
      const { name, last_name, email } = req.body;
      const sets = [];
      const values = [];

      if (name !== undefined) {
        const n = String(name).trim();
        if (!n) {
          return res.status(400).json({ success: false, message: 'El nombre no puede quedar vacío' });
        }
        values.push(n);
        sets.push(`name = $${values.length}`);
      }

      if (last_name !== undefined) {
        values.push(last_name ? String(last_name).trim() : null);
        sets.push(`last_name = $${values.length}`);
      }

      if (email !== undefined) {
        const em = String(email).trim().toLowerCase();
        if (!/\S+@\S+\.\S+/.test(em)) {
          return res.status(400).json({ success: false, message: 'Formato de correo inválido' });
        }
        values.push(em);
        sets.push(`email = $${values.length}`);
      }

      if (sets.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No enviaste ningún cambio. Campos disponibles: "name", "last_name", "email"',
        });
      }

      values.push(req.user.id);
      const { rows } = await pool.query(
        `UPDATE users SET ${sets.join(', ')}, updated_at = NOW()
         WHERE id = $${values.length}
         RETURNING id, name, last_name, email, role`,
        values
      );

      if (!rows[0]) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }
      res.json({ success: true, message: 'Datos actualizados correctamente', data: rows[0] });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ success: false, message: 'Ese correo ya está registrado por otro usuario' });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // PUT /api/auth/password (requiere token)
  // Cambia la contraseña del usuario del token; exige la contraseña actual
  async changePassword(req, res) {
    try {
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        return res.status(400).json({
          success: false,
          message: 'Los campos "current_password" y "new_password" son obligatorios',
        });
      }
      if (String(new_password).length < 4) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe tener al menos 4 caracteres',
        });
      }

      // El cambio afecta al usuario REAL de la BD (req.user puede venir de un token viejo)
      const owner = await pool.query('SELECT id FROM users WHERE id = $1', [req.user.id]);
      if (!owner.rows[0]) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }

      const { rows } = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id]
      );
      const user = rows[0];

      if (!user) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }
      if (!user.password_hash) {
        return res.status(400).json({
          success: false,
          message: 'Tu cuenta no tiene contraseña asignada. Pide a la administradora que te cree una.',
        });
      }

      const ok = await verifyPassword(String(current_password), { ...user, id: req.user.id });
      if (!ok) {
        return res.status(401).json({ success: false, message: 'La contraseña actual es incorrecta' });
      }

      const hash = await bcrypt.hash(String(new_password), 10);
      // password_changed_at usa el RELOJ LOCAL (igual que el iat de los JWT);
      // NOW() de Postgres es el reloj de Supabase y puede estar desfazado.
      await pool.query(
        `UPDATE users
         SET password_hash = $1,
             updated_at = NOW(),
             reset_token_hash = NULL,
             reset_token_expires = NULL,
             password_changed_at = $3
         WHERE id = $2`,
        [hash, req.user.id, new Date()]
      );

      res.json({ success: true, message: 'Contraseña actualizada correctamente. Inicia sesión de nuevo en esta y otras pestañas.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
  /* ================================================================
   * POST /api/auth/forgot-password  (público)
   * Body: { email }
   * Genera un token de un solo uso (30 min), lo guarda HASHEADO (SHA-256)
   * y envía el enlace por correo. Responde 200 aunque el correo no exista
   * para no revelar qué cuentas están registradas.
   * ================================================================ */
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: 'El campo "email" es obligatorio' });
      }

      const { rows } = await pool.query(
        'SELECT id, name, email FROM users WHERE email = $1',
        [String(email).trim().toLowerCase()]
      );
      const user = rows[0];

      // Sin usuario: misma respuesta para no filtrar cuentas registradas
      if (!user) {
        return res.json({
          success: true,
          message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
        });
      }

      // Token aleatorio de 32 bytes; en la BD solo se guarda su SHA-256
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expires = new Date(Date.now() + RESET_TTL_MIN * 60 * 1000);

      await pool.query(
        `UPDATE users SET reset_token_hash = $1, reset_token_expires = $2, updated_at = NOW() WHERE id = $3`,
        [tokenHash, expires, user.id]
      );

      const mail = await sendPasswordReset({ to: user.email, name: user.name, token });

      const response = {
        success: true,
        message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
      };
      // SOLO en desarrollo sin SMTP: devolvemos el enlace para poder probar el flujo
      if (mail.mode === 'dev') response.dev_reset_url = mail.url;
      res.json(response);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /* ================================================================
   * POST /api/auth/reset-password  (público)
   * Body: { token, password }
   * Valida el token (hasheado, no expirado), cambia la contraseña,
   * limpia el token (un solo uso) e invalida los JWT anteriores.
   * ================================================================ */
  async resetPassword(req, res) {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ success: false, message: 'Los campos "token" y "password" son obligatorios' });
      }
      if (String(password).length < 4) {
        return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 4 caracteres' });
      }

      const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
      const { rows } = await pool.query(
        `SELECT id, name, email, role, reset_token_expires
         FROM users
         WHERE reset_token_hash = $1`,
        [tokenHash]
      );
      const user = rows[0];

      if (!user || !user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'El enlace no es válido o ya expiró. Solicita uno nuevo.',
        });
      }

      const hash = await bcrypt.hash(String(password), 10);
      // password_changed_at con el reloj local (mismo reloj que el iat de los JWT)
      await pool.query(
        `UPDATE users
         SET password_hash = $1,
             reset_token_hash = NULL,
             reset_token_expires = NULL,
             password_changed_at = $3,
             updated_at = NOW()
         WHERE id = $2`,
        [hash, user.id, new Date()]
      );

      res.json({ success: true, message: 'Contraseña restablecida. Ya puedes iniciar sesión con la nueva.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = authController;
