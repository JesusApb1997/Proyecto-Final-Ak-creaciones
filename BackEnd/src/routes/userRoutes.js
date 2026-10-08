/**
 * Rutas de Usuarios
 * Define los endpoints CRUD bajo /api/users
 *
 * Todo el CRUD requiere sesion: solo administradoras (token JWT valido).
 * Sin token -> 401 "Token no proporcionado". Con token de empleado -> 403 "Acceso denegado".
 */
const { Router } = require('express');
const UserController = require('../controllers/userController');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = Router();

// GET    /api/users        -> lista todos los usuarios     (solo admin)
// GET    /api/users/:id    -> obtiene un usuario por ID    (solo admin)
// POST   /api/users        -> crea un usuario              (solo admin)
// PUT    /api/users/:id    -> actualiza un usuario         (solo admin)
// PUT    /api/users/:id/password -> asigna/restablece contraseña (solo admin)
// DELETE /api/users/:id    -> elimina un usuario           (solo admin)

const adminOnly = [verifyToken, requireRole('admin')];

router.get('/', adminOnly, UserController.getAll);
router.get('/:id', adminOnly, UserController.getById);
router.post('/', adminOnly, UserController.create);
router.put('/:id', adminOnly, UserController.update);
router.put('/:id/password', adminOnly, UserController.setPassword);
router.delete('/:id', adminOnly, UserController.remove);

module.exports = router;
