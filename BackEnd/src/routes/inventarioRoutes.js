/**
 * Rutas de Inventario (solo administradoras)
 * Todo el CRUD exige token JWT válido con rol "admin".
 * Un empleado (ej. Jesús) recibe 403 "Acceso denegado. Se requiere rol: admin".
 */
const { Router } = require('express');
const inventarioController = require('../controllers/inventarioController');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = Router();

const adminOnly = [verifyToken, requireRole('admin')];

router.get('/', adminOnly, inventarioController.getAll);
router.get('/:id', adminOnly, inventarioController.getById);
router.post('/', adminOnly, inventarioController.create);
router.put('/:id', adminOnly, inventarioController.update);
router.delete('/:id', adminOnly, inventarioController.remove);

module.exports = router;
