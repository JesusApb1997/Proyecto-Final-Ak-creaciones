/**
 * Rutas de pedidos de la tienda (clientes logueados)
 * Montadas en /api/store-orders — requieren token JWT del cliente.
 *
 * El token verifica la identidad del comprador: es lo que permite enviarle la
 * factura a SU correo con la seguridad de que es realmente ese usuario.
 */
const { Router } = require('express');
const storeOrderController = require('../controllers/storeOrderController');
const { verifyToken } = require('../middleware/auth');

const router = Router();

// POST /api/store-orders -> registra el pedido y envía la factura por correo
router.post('/', verifyToken, storeOrderController.create);

// POST /api/store-orders/pago-movil -> el cliente pagó por Pago Móvil:
// registra el pedido y le envía al correo la confirmación con el monto total
router.post('/pago-movil', verifyToken, storeOrderController.createMobilePayment);

module.exports = router;
