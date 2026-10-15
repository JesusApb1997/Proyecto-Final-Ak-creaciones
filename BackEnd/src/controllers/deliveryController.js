/**
 * Controlador de Pedidos de Delivery (Entrega a domicilio)
 */
const crypto = require('crypto');
const Delivery = require('../models/Delivery');
const { sendDeliveryUpdate } = require('../services/whatsapp');
const { ProductStockError, assertStockAvailable } = require('../services/productStock');
const pool = require('../config/db');

const deliveryController = {
  // GET /api/delivery
  async getAll(req, res) {
    try {
      const deliveries = await Delivery.getAll();
      res.json({ success: true, count: deliveries.length, data: deliveries });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/delivery/user/:userId
  async getByUserId(req, res) {
    try {
      const deliveries = await Delivery.getByUserId(req.params.userId);
      res.json({ success: true, count: deliveries.length, data: deliveries });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/delivery/:id
  async getById(req, res) {
    try {
      const delivery = await Delivery.getById(req.params.id);
      if (!delivery) {
        return res.status(404).json({ success: false, message: `No existe pedido con id ${req.params.id}` });
      }
      res.json({ success: true, data: delivery });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/delivery
  async create(req, res) {
    try {
      const { name, last_name, phone, address, localidad, maps_url, items, total, notes } = req.body;

      if (!name || !last_name || !phone || (!address && !maps_url)) {
        return res.status(400).json({
          success: false,
          message: 'Nombre, apellido, teléfono y dirección escrita o enlace de Maps son obligatorios.',
        });
      }

      if (maps_url && !/^https?:\/\/(maps\.app\.goo\.gl|www\.google\.com\/maps|maps\.google\.com)\//i.test(String(maps_url).trim())) {
        return res.status(400).json({ success: false, message: 'El enlace debe ser una URL válida de Google Maps.' });
      }

      if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
        return res.status(400).json({ success: false, message: 'El pedido debe incluir productos válidos.' });
      }
      const requestedItems = items.map((item) => ({
        id: Number(item?.id),
        qty: Number(item?.qty),
        color: item?.color ? String(item.color).slice(0, 60) : null,
        size: item?.size ? String(item.size).slice(0, 60) : null,
      }));
      if (requestedItems.some((item) => !Number.isInteger(item.id) || item.id <= 0 ||
          !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99)) {
        return res.status(400).json({ success: false, message: 'El pedido contiene productos o cantidades inválidas.' });
      }
      const productIds = [...new Set(requestedItems.map((item) => item.id))];
      const { rows: products } = await pool.query(
        'SELECT id, name, price FROM products WHERE id = ANY($1::int[])',
        [productIds]
      );
      const productsById = new Map(products.map((product) => [Number(product.id), product]));
      const verifiedItems = requestedItems.map((item) => {
        const product = productsById.get(item.id);
        if (!product) return null;
        return {
          product_id: item.id,
          name: product.name,
          variante: [item.color, item.size].filter(Boolean).join(' · '),
          qty: item.qty,
          price: Number(product.price),
        };
      });
      if (verifiedItems.some((item) => !item)) {
        return res.status(400).json({ success: false, message: 'Uno de los productos del pedido ya no existe.' });
      }
      await assertStockAvailable(verifiedItems);
      const verifiedTotal = verifiedItems.reduce((sum, item) => sum + item.price * item.qty, 0);

      const orderNumber = `DLV-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const invoiceNumber = `FAC-${orderNumber}`;

      const newDelivery = await Delivery.create({
        name: String(name).trim(),
        last_name: last_name ? String(last_name).trim() : null,
        phone: String(phone).trim(),
        address: address ? String(address).trim() : 'Ubicación compartida por Google Maps',
        localidad: localidad ? String(localidad).trim() : null,
        maps_url: maps_url ? String(maps_url).trim() : null,
        items: verifiedItems,
        total: verifiedTotal,
        status: 'pendiente',
        notes: notes ? String(notes).trim() : null,
        user_id: req.user.id,
        order_number: orderNumber,
        invoice_number: invoiceNumber,
      });

      res.status(201).json({ success: true, data: newDelivery });
    } catch (err) {
      if (err instanceof ProductStockError) {
        return res.status(409).json({ success: false, message: err.message });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // PATCH /api/delivery/:id/dispatch — asigna conductor y avisa al cliente
  async dispatch(req, res) {
    try {
      const { driver_name, driver_phone, location_confirmed } = req.body || {};
      if (!String(driver_name || '').trim() || !String(driver_phone || '').trim() || location_confirmed !== true) {
        return res.status(400).json({ success: false, message: 'Completa conductor, teléfono y confirma la ubicación antes de despachar.' });
      }
      const delivery = await Delivery.assignDriver(req.params.id, {
        driver_name: String(driver_name).trim(),
        driver_phone: String(driver_phone).trim(),
        location_confirmed: true,
      });
      if (!delivery) return res.status(404).json({ success: false, message: 'Pedido de delivery no encontrado.' });

      const notification = await sendDeliveryUpdate(delivery);
      const updated = await Delivery.setWhatsAppStatus(
        delivery.id,
        notification.sent ? 'enviado' : 'manual',
        notification.sent ? new Date() : null
      );
      res.json({
        success: true,
        data: updated,
        whatsapp: { sent: notification.sent, mode: notification.mode, url: notification.url || null },
      });
    } catch (err) {
      console.error('✗ Error despachando el delivery:', err);
      if (err instanceof ProductStockError || err.code === 'DELIVERY_STATUS_CONFLICT') {
        return res.status(409).json({ success: false, message: err.message });
      }
      res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
          ? 'No se pudo asignar el conductor. Revisa los registros del backend.'
          : `No se pudo asignar el conductor: ${err.message}`,
      });
    }
  },

  // PUT /api/delivery/:id
  async update(req, res) {
    try {
      const updated = await Delivery.update(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ success: false, message: `No existe pedido con id ${req.params.id}` });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // PATCH /api/delivery/:id/status
  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ success: false, message: 'El campo "status" es obligatorio' });
      }
      const updated = await Delivery.updateStatus(req.params.id, String(status).trim().toLowerCase());
      if (!updated) {
        return res.status(404).json({ success: false, message: `No existe pedido con id ${req.params.id}` });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      if (err.code === 'DELIVERY_STATUS_CONFLICT') {
        return res.status(409).json({ success: false, message: err.message });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // DELETE /api/delivery/:id
  async remove(req, res) {
    try {
      const deleted = await Delivery.remove(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: `No existe pedido con id ${req.params.id}` });
      }
      res.json({ success: true, data: deleted });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = deliveryController;
