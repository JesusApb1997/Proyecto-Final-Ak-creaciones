/**
 * Rutas de pedidos de la tienda (clientes logueados)
 * Montadas en /api/store-orders — requieren token JWT del cliente.
 *
 * El token verifica la identidad del comprador: es lo que permite enviarle la
 * factura a SU correo con la seguridad de que es realmente ese usuario.
 */
const { Router } = require('express');
const multer = require('multer');
const storeOrderController = require('../controllers/storeOrderController');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = Router();
const receiptUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024, files: 1 },
	fileFilter(_req, file, callback) {
		const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
		if (!allowed.includes(file.mimetype)) return callback(new Error('Adjunta una imagen JPG, PNG, WEBP o GIF.'));
		callback(null, true);
	},
}).single('receipt');

function parseReceipt(req, res, next) {
	receiptUpload(req, res, (err) => {
		if (err) {
			const message = err.code === 'LIMIT_FILE_SIZE'
				? 'La captura no puede superar 5 MB.'
				: err.message;
			return res.status(400).json({ success: false, message });
		}
		next();
	});
}

// Los comprobantes y la verificación de pagos son exclusivos del admin.
router.get('/', verifyToken, requireRole('admin'), storeOrderController.getAll);
router.get('/:id/receipt', verifyToken, requireRole('admin'), storeOrderController.getReceipt);
router.patch('/:id/status', verifyToken, requireRole('admin'), storeOrderController.updateStatus);

// POST /api/store-orders -> registra el pedido y envía la factura por correo
router.post('/', verifyToken, storeOrderController.create);

// POST /api/store-orders/pago-movil -> el cliente pagó por Pago Móvil:
// registra el pedido y le envía al correo la confirmación con el monto total
router.post('/pago-movil', verifyToken, parseReceipt, storeOrderController.createMobilePayment);

module.exports = router;
