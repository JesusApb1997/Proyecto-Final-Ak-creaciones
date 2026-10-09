/**
 * Controlador de Usuarios
 * Recibe las peticiones HTTP, valida datos y responde en JSON
 */
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { usernameValidationError } = require('../utils/username');
const { sendWelcomeEmail } = require('../services/mailer');

/*
 * Normaliza el rol que llega desde Supabase o el formulario:
 * la BD puede tener "administración" (con tilde) pero la API, el token y el
 * dashboard trabajan con "admin". Sin esto, un admin creado en Supabase
 * entraría como empleado.
 */
function normRole(role) {
  const r = String(role ?? '').trim().toLowerCase();
  if (['admin', 'administracion', 'administración', 'administrador'].includes(r)) return 'admin';
  if (r === 'user') return 'user'; // usuario común registrado desde el login público
  if (isCustomerRole(r)) return 'cliente'; // el panel puede EDITAR clientes sin cambiarles el rol
  return 'empleado';
}

/* Los usuarios comunes (registrados desde el login público: rol 'user', y los
   antiguos 'cliente') no entran al panel, pero el admin SÍ puede verlos y
   eliminarlos desde la vista Usuarios. */
const CUSTOMER_ROLES = ['cliente', 'client', 'customer', 'user'];
const isCustomerRole = (role) => CUSTOMER_ROLES.includes(String(role ?? '').trim().toLowerCase());

const UserController = {
  // PUT /api/users/:id/password  (solo admin)
  // Asigna o restablece la contraseña de cualquier usuario.
  // No requiere la contraseña anterior: es un restablecimiento administrativo.
  async setPassword(req, res) {
    try {
      const { password } = req.body;
      if (!password || String(password).length < 4) {
        return res.status(400).json({
          success: false,
          message: 'Envía "password" con al menos 4 caracteres',
        });
      }

      const hash = await bcrypt.hash(String(password), 10);
      const updated = await User.setPassword(req.params.id, hash);

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: `No existe usuario con id ${req.params.id}`,
        });
      }
      res.json({
        success: true,
        message: `Contraseña asignada a ${updated.name}. Ya puede iniciar sesión.`,
        data: updated,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
  // GET /api/users
  async getAll(req, res) {
    try {
      const users = await User.getAll();
      res.json({
        success: true,
        count: users.length,
        data: users,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/users/:id
  async getById(req, res) {
    try {
      const user = await User.getById(req.params.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: `No existe usuario con id ${req.params.id}`,
        });
      }
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/users
  async create(req, res) {
    try {
      const { name, last_name, email, role, password } = req.body;

      // Validaciones basicas
      if (!name || !email) {
        return res.status(400).json({
          success: false,
          message: 'Los campos "name" y "email" son obligatorios',
        });
      }
      if (password !== undefined && password !== null && String(password).length < 4) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 4 caracteres',
        });
      }

      const ROLE_ALLOWED = ['admin', 'empleado'];
      const finalRole = role ? normRole(role) : 'empleado';
      // El CRUD del panel solo crea staff: un cliente se registra desde el
      // login público (/api/store-auth/register), no desde aquí.
      if (!['admin', 'empleado'].includes(finalRole)) {
        return res.status(400).json({
          success: false,
          message: `Role invalido. Valores permitidos: ${ROLE_ALLOWED.join(', ')}`,
        });
      }

      // Evitar correos duplicados
      const existing = await User.getByEmail(email);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `El email "${email}" ya esta registrado`,
        });
      }

      const passwordHash = password ? await bcrypt.hash(String(password), 10) : null;
      const newUser = await User.create({
        name: String(name).trim(),
        last_name: last_name ? String(last_name).trim() : null,
        email: String(email).trim().toLowerCase(),
        role: finalRole,
        passwordHash,
      });
      // Nunca devolver el hash al cliente
      delete newUser.password_hash;

      /* Correo de bienvenida al usuario registrado (fire-and-forget: no hace
         esperar la respuesta del panel; si el SMTP falla solo se loguea) */
      sendWelcomeEmail({
        to: newUser.email,
        name: newUser.name,
        role: finalRole,
        temporaryPassword: password ? String(password) : null,
        registeredBy: req.user?.name ? `${req.user.name} (panel de administración)` : 'Panel de administración',
      })
        .then((r) => console.log(`📧 Bienvenida a ${newUser.email}: ${r.mode}${r.delivered ? ' ✓' : ' ✗'}`))
        .catch((e) => console.error('✗ Error en correo de bienvenida:', e.message));

      res.status(201).json({ success: true, data: newUser });
    } catch (err) {
      // Violacion de la restriccion UNIQUE de email
      if (err.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'El email ya esta registrado',
        });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // PUT /api/users/:id
  async update(req, res) {
    try {
      const { name, last_name, email, role, password, username } = req.body;

      if (password !== undefined && password !== null && password !== '' && String(password).length < 4) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 4 caracteres',
        });
      }

      if (role) {
        const finalRole = normRole(role);
        if (!['admin', 'empleado', 'cliente', 'user'].includes(finalRole)) {
          return res.status(400).json({
            success: false,
            message: `Role invalido. Valores permitidos: admin, empleado, cliente, user`,
          });
        }
      }

      /* Username opcional (para clientes): único, validado y en minúsculas.
         Cadena vacía = no cambiar. */
      let finalUsername;
      if (username !== undefined && username !== null && String(username).trim() !== '') {
        finalUsername = String(username).trim().toLowerCase();
        const usernameError = usernameValidationError(finalUsername);
        if (usernameError) return res.status(400).json({ success: false, message: usernameError });
        if (await User.usernameTaken(finalUsername, req.params.id)) {
          return res.status(409).json({
            success: false,
            message: `El nombre de usuario "${finalUsername}" ya está en uso`,
          });
        }
      }

      const passwordHash =
        password !== undefined && password !== null && password !== ''
          ? await bcrypt.hash(String(password), 10)
          : undefined;

      const updated = await User.update(req.params.id, {
        name: name !== undefined ? String(name).trim() : undefined,
        last_name: last_name !== undefined ? String(last_name).trim() : undefined,
        email,
        role: role ? normRole(role) : undefined,
        passwordHash,
        username: finalUsername,
      });

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: `No existe usuario con id ${req.params.id}`,
        });
      }
      // Nunca devolver el hash al cliente
      delete updated.password_hash;
      res.json({ success: true, data: updated });
    } catch (err) {
      if (err.code === '23505') {
        const esUsername = /username/i.test(String(err.constraint || err.detail || ''));
        return res.status(409).json({
          success: false,
          message: esUsername ? 'El nombre de usuario ya está en uso' : 'El email ya esta registrado',
        });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // DELETE /api/users/:id  (solo admin)
  // Elimina cualquier usuario registrado: empleados, administradoras y
  // también los clientes inscritos desde el login público de la tienda.
  async remove(req, res) {
    try {
      if (req.user && Number(req.user.id) === Number(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: 'No puedes eliminar tu propia cuenta mientras tienes la sesión abierta',
        });
      }

      const deleted = await User.remove(req.params.id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: `No existe usuario con id ${req.params.id}`,
        });
      }
      delete deleted.password_hash;
      res.json({
        success: true,
        message: isCustomerRole(deleted.role)
          ? `Usuario común "${deleted.name}" eliminado de la base de datos`
          : `Usuario "${deleted.name}" eliminado correctamente`,
        data: deleted,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = UserController;
