/**
 * Rutas de Autenticación
 * POST /api/auth/login  -> login con email + password, devuelve JWT
 * GET  /api/auth/me     -> perfil del token (protegido con verifyToken)
 */
const { Router } = require('express');
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

const router = Router();

router.get('/accounts', authController.accounts); // cuentas disponibles para el login
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword); // solicita enlace de recuperación
router.post('/reset-password', authController.resetPassword);   // restablece con el token del enlace
router.get('/me', verifyToken, authController.me);
router.put('/me', verifyToken, authController.updateMe);       // actualizar datos propios
router.put('/password', verifyToken, authController.changePassword); // cambiar contraseña propia

module.exports = router;
