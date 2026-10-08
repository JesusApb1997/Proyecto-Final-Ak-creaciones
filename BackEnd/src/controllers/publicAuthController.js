/**
 * Controlador de Autenticación Pública (clientes de la tienda)
 *
 * Endpoints (montados en /api/store-auth por publicAuthRoutes.js):
 *   POST /register        -> crea un cliente (empleado de la tienda) con contraseña hasheada
 *   POST /login           -> login de cliente con email + password (JWT de 30 días)
 *   POST /google          -> login/registro con Google (Google Identity Services / OAuth)
 *   POST /apple           -> login/registro con Apple (Sign in with Apple: id_token)
 *   GET  /me              -> perfil del token (protegido)
 *
 * Roles: los usuarios comunes registrados desde el login usan role = 'user'
 * (las cuentas antiguas pueden quedar como 'cliente'). La verificación de OAuth valida la
 * firma del id_token contra las llaves públicas (JWKS) del proveedor, así que el
 * backend JAMÁS confía en datos sin verificar. El campo "role" del body nunca se
 * acepta en el registro público: un atacante no puede autoproclamarse admin.
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const pool = require('../config/db');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/auth');
const { sanitizeUsername, usernameValidationError } = require('../utils/username');

const TOKEN_TTL = '30d'; // los clientes permanecen con sesión en su móvil / PC

/* Roles con acceso al panel de administración (los usuarios comunes NO entran al panel) */
const STAFF_ROLES = ['admin', 'empleado'];

/* Roles de usuarios comunes (sin panel). 'user' es el rol de los registros
   nuevos; 'cliente' se conserva por compatibilidad con las cuentas antiguas.
   Cualquier otro rol (p. ej. un rol escrito a mano en Supabase) degrada a
   'cliente': un login público NUNCA puede otorgar un rol con privilegios. */
const COMMON_ROLES = ['user', 'cliente'];

/* -------------------------------------------------------------------------
 * JWKS remotos de Google y Apple (se descargan 1 vez y se cachean; jose los
 * refresca automáticamente si el kid no está). Verifican firma, expiración,
 * emisor y audiencia del id_token devuelto por el proveedor.
 * ---------------------------------------------------------------------- */
const googleJWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleJWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID || '';
}
function appleClientId() {
  // Apple emite el token para el Services ID (web) o el Bundle ID (app)
  return process.env.APPLE_CLIENT_ID || process.env.APPLE_BUNDLE_ID || '';
}

/* Verifica el id_token de Google y devuelve { sub, email, name, picture } */
async function verifyGoogleIdToken(idToken) {
  const { payload } = await jwtVerify(idToken, googleJWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: googleClientId(),
  });
  if (!payload.email) throw new Error('El token de Google no incluye el correo');
  return {
    sub: String(payload.sub),
    email: String(payload.email).toLowerCase(),
    name: payload.given_name || payload.name || null,
    picture: payload.picture || null,
  };
}

/* Verifica el id_token de Apple y devuelve { sub, email, name } */
async function verifyAppleIdToken(idToken) {
  const { payload } = await jwtVerify(idToken, appleJWKS, {
    issuer: 'https://appleid.apple.com',
    audience: appleClientId(),
  });
  if (!payload.email) throw new Error('El token de Apple no incluye el correo');
  return {
    sub: String(payload.sub),
    email: String(payload.email).toLowerCase(),
    name: payload.name || null, // Apple solo lo envía la primera vez
  };
}

/* Pide el id_token a Google con el code de autorización (flujo OAuth clásico) */
async function googleTokenFromCode(code, redirectUri) {
  const body = new URLSearchParams({
    code,
    client_id: googleClientId(),
    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirect_uri: redirectUri || process.env.GOOGLE_REDIRECT_URI || '',
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.id_token) {
    throw new Error(json.error_description || json.error || 'Google rechazó el código de autorización');
  }
  return verifyGoogleIdToken(json.id_token);
}

/*
 * Crea (o devuelve) el cliente de la tienda a partir de una identidad social
 * verificada. El primer login registra la cuenta; los siguientes la reutilizan.
 * `passwordHash` solo se usa en el registro por email (los clientes sociales
 * no tienen contraseña propia).
 */
async function findOrCreateCustomer({ email, name, lastName = null, provider, providerId, passwordHash = null, username = null }) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  let user = rows[0];

  if (!user) {
    /* Login social: proponemos un username derivado del correo (best effort —
       si está ocupado probamos con sufijos; si nada queda libre queda NULL). */
    let finalUsername = username ? String(username).trim().toLowerCase() : null;
    if (!finalUsername) {
      const base = sanitizeUsername(email.split('@')[0]);
      if (base.length >= 3) {
        finalUsername = base;
        for (let n = 1; n <= 20; n++) {
          const { rows: taken } = await pool.query('SELECT id FROM users WHERE username = $1', [finalUsername]);
          if (!taken[0]) break;
          finalUsername = `${base}${n}`.slice(0, 24);
        }
      }
    }

    const inserted = await pool.query(
      `INSERT INTO users (name, last_name, email, role, password_hash, provider, provider_id, username)
       VALUES ($1, $2, $3, 'user', $4, $5, $6, $7)
       RETURNING *`,
      [name || email.split('@')[0], lastName, email, passwordHash, provider, providerId, finalUsername]
    );
    user = inserted.rows[0];
  } else {
    // Cuenta existente (creada a mano o por email): sincroniza la identidad social
    const patch = [];
    const values = [];
    if (provider && user.provider !== provider) { values.push(provider); patch.push(`provider = $${values.length}`); }
    if (providerId && user.provider_id !== providerId) { values.push(providerId); patch.push(`provider_id = $${values.length}`); }
    if (!user.last_name && lastName) { values.push(lastName); patch.push(`last_name = $${values.length}`); }
    /* Si la cuenta vieja no tiene username, se le propone uno derivado del correo */
    if (!user.username) {
      const base = sanitizeUsername(email.split('@')[0]);
      if (base.length >= 3) {
        const { rows: taken } = await pool.query('SELECT id FROM users WHERE username = $1', [base]);
        if (!taken[0]) { values.push(base); patch.push(`username = $${values.length}`); }
      }
    }
    if (patch.length) {
      values.push(user.id);
      const updated = await pool.query(
        `UPDATE users SET ${patch.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
        values
      );
      user = updated.rows[0];
    }
  }

  // Si la cuenta estaba en texto plano (escrita a mano en Supabase), hashearla
  if (user.password_hash && !/^\$2[aby]\$/.test(String(user.password_hash))) {
    const hash = await bcrypt.hash(String(user.password_hash), 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, user.id]);
    user.password_hash = hash;
  }

  return user;
}

/* JWT de sesión con la misma forma que usa el resto del backend.
   El rol que viaja es el rol COMÚN de la cuenta ('user'/'cliente'); cualquier
   otro valor (p. ej. si el correo coincide con una cuenta de personal) degrada
   a 'cliente': este endpoint nunca emite tokens con privilegios de panel. */
function issueToken(user) {
  const r = String(user.role ?? '').trim().toLowerCase();
  const role = COMMON_ROLES.includes(r) ? r : 'cliente';
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role,
      name: user.name,
      last_name: user.last_name,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

const publicAuthController = {
  /* ================================================================
   * POST /api/store-auth/register  (público)
   * Body: { name, last_name?, email, password }
   * Crea el cliente con la contraseña hasheada (bcrypt, 10 rondas).
   * ================================================================ */
  async register(req, res) {
    try {
      const { name, last_name, email, password, username } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Los campos "name", "email" y "password" son obligatorios',
        });
      }
      if (String(password).length < 4) {
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 4 caracteres' });
      }
      const em = String(email).trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(em)) {
        return res.status(400).json({ success: false, message: 'Formato de correo inválido' });
      }

      /* Nombre de usuario único: es opcional — si no llega, findOrCreateCustomer
         propone uno derivado del correo (igual que con Google/Apple). */
      const finalUsername = String(username || '').trim().toLowerCase();
      if (finalUsername) {
        const usernameError = usernameValidationError(finalUsername);
        if (usernameError) return res.status(400).json({ success: false, message: usernameError });
      }

      const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [em]);
      if (rows[0]) {
        return res.status(409).json({ success: false, message: 'Ese correo ya está registrado. Inicia sesión.' });
      }
      if (finalUsername && (await User.usernameTaken(finalUsername))) {
        return res.status(409).json({ success: false, message: `El nombre de usuario "${finalUsername}" ya está en uso. Elige otro.` });
      }

      const user = await findOrCreateCustomer({
        email: em,
        name: String(name).trim(),
        lastName: last_name ? String(last_name).trim() : null,
        provider: 'email',
        passwordHash: await bcrypt.hash(String(password), 10),
        username: finalUsername,
      });

      const token = issueToken(user);
      res.status(201).json({
        success: true,
        message: `¡Bienvenido/a, ${user.name}! Tu cuenta quedó registrada.`,
        token,
        user: { id: user.id, name: user.name, last_name: user.last_name, email: user.email, username: user.username, role: COMMON_ROLES.includes(String(user.role).toLowerCase()) ? user.role : 'user' },
      });
    } catch (err) {
      if (err.code === '23505') {
        const esUsername = /username/i.test(String(err.constraint || err.detail || ''));
        return res.status(409).json({
          success: false,
          message: esUsername
            ? 'Ese nombre de usuario ya está en uso. Elige otro.'
            : 'Ese correo ya está registrado. Inicia sesión.',
        });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /* ================================================================
   * POST /api/store-auth/login  (público)
   * Body: { email, password } — "email" acepta el CORREO o el NOMBRE DE
   * USUARIO único elegido al registrarse.
   * ================================================================ */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Los campos "email" (o usuario) y "password" son obligatorios' });
      }

      const user = await User.getByLogin(email);

      // Mensaje genérico: no revela si el correo existe
      if (!user || !user.password_hash) {
        return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
      }

      const stored = String(user.password_hash);
      let ok;
      if (/^\$2[aby]\$/.test(stored)) {
        ok = await bcrypt.compare(String(password), stored);
      } else {
        // Contraseña en texto plano escrita a mano en la BD: validar y hashearla
        ok = password === stored;
        if (ok) {
          const hash = await bcrypt.hash(String(password), 10);
          await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, user.id]);
        }
      }
      if (!ok) {
        return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
      }

      // Cuentas de personal con panel: se emite el token con SU rol real y
      // vigencia corta (8 h). Los usuarios comunes reciben token largo (30 días)
      // con su rol ('user' o 'cliente'); cualquier otro rol degrada a 'cliente'.
      const rawRole = String(user.role ?? '').trim().toLowerCase();
      const role = STAFF_ROLES.includes(rawRole) ? rawRole : COMMON_ROLES.includes(rawRole) ? rawRole : 'cliente';
      const token = jwt.sign(
        { id: user.id, email: user.email, role, name: user.name, last_name: user.last_name },
        JWT_SECRET,
        { expiresIn: STAFF_ROLES.includes(role) ? '8h' : TOKEN_TTL }
      );

      res.json({
        success: true,
        message: `¡Bienvenido/a, ${user.name}!`,
        token,
        user: { id: user.id, name: user.name, last_name: user.last_name, email: user.email, username: user.username, role },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /* ================================================================
   * POST /api/store-auth/google  (público)
   * Body: { credential } (id_token de Google Identity Services)
   *    o: { code, redirect_uri } (flujo OAuth de autorización)
   * Verifica el token contra los JWKS de Google y registra/al cliente.
   * ================================================================ */
  async google(req, res) {
    try {
      const { credential, code, redirect_uri } = req.body;
      if (!credential && !code) {
        return res.status(400).json({
          success: false,
          message: 'Envía "credential" (id_token de Google) o "code" (OAuth)',
        });
      }

      const identity = code
        ? await googleTokenFromCode(String(code), redirect_uri)
        : await verifyGoogleIdToken(String(credential));

      const user = await findOrCreateCustomer({
        email: identity.email,
        name: identity.name,
        provider: 'google',
        providerId: identity.sub,
      });

      const token = issueToken(user);
      res.json({
        success: true,
        message: `¡Bienvenido/a, ${user.name}! (Google)`,
        token,
        user: { id: user.id, name: user.name, last_name: user.last_name, email: user.email, username: user.username, role: COMMON_ROLES.includes(String(user.role).toLowerCase()) ? user.role : 'cliente' },
      });
    } catch (err) {
      const msg =
        /Unexpected issuer|audience|JWKS|fetch/i.test(err.message)
          ? 'No se pudo verificar el token de Google. Revisa GOOGLE_CLIENT_ID en el backend.'
          : err.message;
      res.status(401).json({ success: false, message: msg });
    }
  },

  /* ================================================================
   * POST /api/store-auth/apple  (público)
   * Body: { id_token | identityToken, name? }
   * Apple solo manda el nombre en el PRIMER consentimiento; el frontend
   * puede reenviarlo aquí para guardar completo el perfil.
   * ================================================================ */
  async apple(req, res) {
    try {
      const { id_token, identityToken, user: appleUser, name } = req.body;
      const rawToken = id_token || identityToken;
      if (!rawToken) {
        return res.status(400).json({ success: false, message: 'Envía "id_token" con el token de Apple' });
      }

      const identity = await verifyAppleIdToken(String(rawToken));

      // Nombre que Apple entregó en el primer consentimiento (o el que el frontend reenvía)
      let lastName = null;
      let firstName = name || null;
      if (!firstName && appleUser?.name) {
        firstName = appleUser.name.firstName ?? null;
        lastName = appleUser.name.lastName ?? null;
      }

      const user = await findOrCreateCustomer({
        email: identity.email,
        name: firstName || identity.name || null,
        lastName,
        provider: 'apple',
        providerId: identity.sub,
      });

      const token = issueToken(user);
      res.json({
        success: true,
        message: `¡Bienvenido/a, ${user.name}! (Apple)`,
        token,
        user: { id: user.id, name: user.name, last_name: user.last_name, email: user.email, username: user.username, role: COMMON_ROLES.includes(String(user.role).toLowerCase()) ? user.role : 'cliente' },
      });
    } catch (err) {
      const msg =
        /audience|issuer|JWKS|fetch/i.test(err.message)
          ? 'No se pudo verificar el token de Apple. Revisa APPLE_CLIENT_ID en el backend.'
          : err.message;
      res.status(401).json({ success: false, message: msg });
    }
  },

  /* ================================================================
   * GET /api/store-auth/me  (requiere token)
   * ================================================================ */
  async me(req, res) {
    try {
      const { rows } = await pool.query(
        'SELECT id, name, last_name, email, username, role, provider, created_at FROM users WHERE id = $1',
        [req.user.id]
      );
      if (!rows[0]) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }
      res.json({ success: true, data: rows[0] });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = publicAuthController;
