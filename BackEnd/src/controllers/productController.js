/**
 * Controlador de Productos
 * Recibe las peticiones HTTP, valida datos y responde en JSON
 *
 * Permisos:
 *   - GET (listar/ver): público
 *   - POST / PUT / DELETE: solo admin (protegido en las rutas con verifyToken + requireRole)
 */
const Product = require('../models/Product');

const CAT_ALLOWED = ['zarcillos', 'collares', 'pulseras', 'anillos', 'sets'];
const TAG_ALLOWED = ['nuevo', 'oferta'];

const ProductController = {
  // GET /api/products
  async getAll(req, res) {
    try {
      const products = await Product.getAll();
      res.json({
        success: true,
        count: products.length,
        data: products,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/products/:id
  async getById(req, res) {
    try {
      const product = await Product.getById(req.params.id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `No existe producto con id ${req.params.id}`,
        });
      }
      res.json({ success: true, data: product });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/products (solo admin)
  async create(req, res) {
    try {
      const { name, cat, price, oldPrice, old_price, desc, img, tag, color } = req.body;

      // Validaciones basicas
      if (!name || price === undefined || !desc) {
        return res.status(400).json({
          success: false,
          message: 'Los campos "name", "price" y "desc" son obligatorios',
        });
      }
      if (Number.isNaN(Number(price)) || Number(price) < 0) {
        return res.status(400).json({
          success: false,
          message: '"price" debe ser un numero mayor o igual a 0',
        });
      }
      const finalCat = cat ? String(cat).toLowerCase() : 'zarcillos';
      if (!CAT_ALLOWED.includes(finalCat)) {
        return res.status(400).json({
          success: false,
          message: `Categoria invalida. Valores permitidos: ${CAT_ALLOWED.join(', ')}`,
        });
      }
      if (tag && !TAG_ALLOWED.includes(String(tag).toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Tag invalido. Valores permitidos: ${TAG_ALLOWED.join(', ')}`,
        });
      }

      const newProduct = await Product.create({
        name: String(name).trim(),
        cat: finalCat,
        price: Number(price),
        oldPrice: oldPrice !== undefined && oldPrice !== null ? Number(oldPrice) : null,
        desc: String(desc).trim(),
        img: img ? String(img).trim() : null,
        tag: tag ? String(tag).toLowerCase() : null,
        color: color ? String(color).trim() : null,
      });

      res.status(201).json({ success: true, data: newProduct });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // PUT /api/products/:id (solo admin)
  async update(req, res) {
    try {
      const { name, cat, price, oldPrice, old_price, desc, img, tag, color } = req.body;

      if (price !== undefined && (Number.isNaN(Number(price)) || Number(price) < 0)) {
        return res.status(400).json({
          success: false,
          message: '"price" debe ser un numero mayor o igual a 0',
        });
      }
      if (cat && !CAT_ALLOWED.includes(String(cat).toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Categoria invalida. Valores permitidos: ${CAT_ALLOWED.join(', ')}`,
        });
      }
      if (tag && !TAG_ALLOWED.includes(String(tag).toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Tag invalido. Valores permitidos: ${TAG_ALLOWED.join(', ')}`,
        });
      }
      if (oldPrice !== undefined && oldPrice !== null && oldPrice !== '' &&
          (Number.isNaN(Number(oldPrice)) || Number(oldPrice) < 0)) {
        return res.status(400).json({
          success: false,
          message: '"oldPrice" debe ser un numero mayor o igual a 0',
        });
      }

      const updated = await Product.update(req.params.id, {
        name: name !== undefined ? (name === null ? null : String(name).trim()) : undefined,
        cat: cat !== undefined ? (cat === null ? null : String(cat).toLowerCase()) : undefined,
        price: price !== undefined ? Number(price) : undefined,
        oldPrice: oldPrice !== undefined ? (oldPrice === null || oldPrice === '' ? null : Number(oldPrice)) : undefined,
        desc: desc !== undefined ? (desc === null ? null : String(desc).trim()) : undefined,
        img: img !== undefined ? (img === null || img === '' ? null : String(img).trim()) : undefined,
        tag: tag !== undefined ? (tag === null || tag === '' ? null : String(tag).toLowerCase()) : undefined,
        color: color !== undefined ? (color === null || color === '' ? null : String(color).trim()) : undefined,
      });

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: `No existe producto con id ${req.params.id}`,
        });
      }
      res.json({ success: true, message: 'Producto actualizado', data: updated });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // DELETE /api/products/:id (solo admin)
  async remove(req, res) {
    try {
      const deleted = await Product.remove(req.params.id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: `No existe producto con id ${req.params.id}`,
        });
      }
      res.json({
        success: true,
        message: `Producto "${deleted.name}" eliminado correctamente`,
        data: deleted,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = ProductController;
