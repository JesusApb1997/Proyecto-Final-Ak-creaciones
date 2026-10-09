/**
 * Rutas de Datos de Pago (Pago Móvil)
 * Montadas en /api/payment-settings
 *
 * GET /api/payment-settings -> PÚBLICO: el carrito lo consulta para mostrar
 *                              los datos que el admin configuró.
 * PUT /api/payment-settings -> Solo admin: pestaña "Datos de pago".
 */
const { Router } = require('express');
const paymentSettingsController = require('../controllers/paymentSettingsController');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = Router();

// Público: el cliente ve estos datos en la ventana de Pago Móvil
router.get('/', paymentSettingsController.get);

// Solo el admin puede modificarlos desde el dashboard
router.put('/', [verifyToken, requireRole('admin')], paymentSettingsController.update);

module.exports = router;
