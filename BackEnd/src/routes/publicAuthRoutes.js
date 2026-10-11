/**
 * Rutas de Autenticación Pública (clientes de la tienda)
 * Montadas en /api/store-auth — todas públicas excepto /me.
 */
const { Router } = require('express');
const publicAuthController = require('../controllers/publicAuthController');
const { verifyToken } = require('../middleware/auth');

const router = Router();

// POST /api/store-auth/register -> registro de cliente con email + contraseña
router.post('/register', publicAuthController.register);

// POST /api/store-auth/login    -> login de cliente (también staff) con email + contraseña
router.post('/login', publicAuthController.login);

// POST /api/store-auth/google   -> login/registro con Google (id_token o code OAuth)
router.post('/google', publicAuthController.google);

// POST /api/store-auth/apple    -> login/registro con Apple (id_token)
router.post('/apple', publicAuthController.apple);

// POST /api/store-auth/forgot-password  -> envía el enlace de restablecimiento por correo
router.post('/forgot-password', publicAuthController.forgotPassword);

// POST /api/store-auth/reset-password   -> restablece la contraseña con el token del enlace
router.post('/reset-password', publicAuthController.resetPassword);

// GET  /api/store-auth/me       -> perfil del token (protegido)
router.get('/me', verifyToken, publicAuthController.me);

module.exports = router;
