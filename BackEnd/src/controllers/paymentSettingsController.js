/**
 * Controlador de Datos de Pago (Pago Móvil)
 *
 *   GET  /api/payment-settings  -> público: es lo que ve el cliente en el
 *                                  carrito al elegir "Pagar por Pago Móvil".
 *   PUT  /api/payment-settings  -> solo admin: la pestaña "Datos de pago"
 *                                  del dashboard guarda aquí los cambios.
 */
const PaymentSettings = require('../models/PaymentSettings');

const paymentSettingsController = {
  // GET /api/payment-settings
  async get(req, res) {
    try {
      const data = await PaymentSettings.get();
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // PUT /api/payment-settings
  async update(req, res) {
    try {
      const { bank_name, phone, cedula, holder_name, instructions, enabled } = req.body || {};

      if (bank_name !== undefined && !String(bank_name).trim()) {
        return res.status(400).json({ success: false, message: 'El nombre del banco es obligatorio' });
      }
      if (phone !== undefined && !String(phone).trim()) {
        return res.status(400).json({ success: false, message: 'El teléfono de pago móvil es obligatorio' });
      }
      if (cedula !== undefined && !String(cedula).trim()) {
        return res.status(400).json({ success: false, message: 'La cédula / RIF del titular es obligatoria' });
      }

      const data = await PaymentSettings.update({
        bank_name,
        phone,
        cedula,
        holder_name,
        instructions,
        enabled,
      });
      res.json({ success: true, message: 'Datos de pago actualizados', data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = paymentSettingsController;
