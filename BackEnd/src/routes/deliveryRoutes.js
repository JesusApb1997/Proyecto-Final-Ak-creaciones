/**
 * Rutas de Pedidos de Delivery (Entrega a domicilio)
 * 
 * GET /api/delivery        -> Todos los pedidos (solo staff: admin/empleado)
 * GET /api/delivery/:id    -> Un pedido (solo staff)
 * POST /api/delivery       -> Crear pedido (autenticado - cliente registrado)
 * PUT /api/delivery/:id    -> Actualizar pedido (solo staff)
 * PATCH /api/delivery/:id/status -> Cambiar estado (solo staff)
 * DELETE /api/delivery/:id -> Eliminar (solo admin)
 * GET /api/delivery/user/:userId -> Pedidos de un usuario (autenticado o staff)
 */
const { Router } = require('express');
const deliveryController = require('../controllers/deliveryController');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = Router();

// Crear pedido - puede ser creado por cliente autenticado
router.post('/', verifyToken, deliveryController.create);

// Obtener pedidos de un usuario específico
router.get('/user/:userId', verifyToken, deliveryController.getByUserId);

// Rutas solo para staff (admin y empleado)
const staffOnly = [verifyToken, requireRole('admin', 'empleado')];
router.get('/', staffOnly, deliveryController.getAll);
router.get('/:id', staffOnly, deliveryController.getById);
router.put('/:id', staffOnly, deliveryController.update);
router.patch('/:id/status', staffOnly, deliveryController.updateStatus);
router.patch('/:id/dispatch', [verifyToken, requireRole('admin')], deliveryController.dispatch);

// Solo admin puede eliminar
router.delete('/:id', [verifyToken, requireRole('admin')], deliveryController.remove);

module.exports = router;
