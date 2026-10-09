/**
 * Controlador de Pedidos de Delivery (Entrega a domicilio)
 */
const Delivery = require('../models/Delivery');

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
      const { name, last_name, phone, address, localidad, items, total, notes, user_id } = req.body;

      if (!name || !phone || !address) {
        return res.status(400).json({
          success: false,
          message: 'Los campos "name", "phone" y "address" son obligatorios',
        });
      }

      const newDelivery = await Delivery.create({
        name: String(name).trim(),
        last_name: last_name ? String(last_name).trim() : null,
        phone: String(phone).trim(),
        address: String(address).trim(),
        localidad: localidad ? String(localidad).trim() : null,
        items: items || null,
        total: total || 0,
        status: 'pendiente',
        notes: notes ? String(notes).trim() : null,
        user_id: user_id || req.user?.id || null,
      });

      res.status(201).json({ success: true, data: newDelivery });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
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
