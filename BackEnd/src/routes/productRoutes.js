/**
 * Rutas de Productos
 * Define los endpoints CRUD bajo /api/products
 *
 * Lectura: pública (el catálogo de la tienda lo consume sin token)
 * Escritura (POST/PUT/DELETE): solo administradoras con token JWT válido
 */
const { Router } = require('express');
const ProductController = require('../controllers/productController');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = Router();

// GET    /api/products        -> lista todos los productos del catalogo (publico)
// GET    /api/products/:id    -> obtiene un producto por ID (publico)
// POST   /api/products        -> crea un producto (solo admin)
// PUT    /api/products/:id    -> actualiza un producto (solo admin)
// DELETE /api/products/:id    -> elimina un producto (solo admin)

const adminOnly = [verifyToken, requireRole('admin')];

router.get('/', ProductController.getAll);
router.get('/:id', ProductController.getById);
router.post('/', adminOnly, ProductController.create);
router.put('/:id', adminOnly, ProductController.update);
router.delete('/:id', adminOnly, ProductController.remove);

module.exports = router;
