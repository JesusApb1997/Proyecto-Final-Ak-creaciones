/**
 * Controlador de Inventario
 * CRUD de materiales. Las rutas se protegen con verifyToken + requireRole('admin'),
 * así que solo las administradoras (ej. Keyla) pueden entrar.
 */
const Inventario = require('../models/Inventario');

const InventarioController = {
  // GET /api/inventario
  async getAll(_req, res) {
    try {
      const data = await Inventario.getAll();
      res.json({ success: true, count: data.length, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/inventario/:id
  async getById(req, res) {
    try {
      const item = await Inventario.getById(req.params.id);
      if (!item) {
        return res.status(404).json({ success: false, message: `No existe material con id ${req.params.id}` });
      }
      res.json({ success: true, data: item });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/inventario
  async create(req, res) {
    try {
      const { nombre, tipo, color, cantidad, unidad, img, notas } = req.body;

      if (!nombre || String(nombre).trim() === '') {
        return res.status(400).json({ success: false, message: 'El campo "nombre" es obligatorio' });
      }
      if (cantidad === undefined || Number.isNaN(Number(cantidad)) || Number(cantidad) < 0) {
        return res.status(400).json({ success: false, message: '"cantidad" debe ser un número mayor o igual a 0' });
      }
      const finalTipo = tipo ? String(tipo).toLowerCase().trim() : 'otros';
      if (!Inventario.TIPOS.includes(finalTipo)) {
        return res.status(400).json({ success: false, message: `Tipo inválido. Valores permitidos: ${Inventario.TIPOS.join(', ')}` });
      }
      const finalUnidad = unidad ? String(unidad).toLowerCase().trim() : 'unidades';
      if (!Inventario.UNIDADES.includes(finalUnidad)) {
        return res.status(400).json({ success: false, message: `Unidad inválida. Valores permitidos: ${Inventario.UNIDADES.join(', ')}` });
      }

      const dup = await Inventario.getByNombre(String(nombre).trim());
      if (dup) {
        return res.status(409).json({ success: false, message: `Ya existe un material llamado "${nombre}"` });
      }

      const item = await Inventario.create({
        nombre: String(nombre).trim(),
        tipo: finalTipo,
        color: color ? String(color).trim() : null,
        cantidad: Number(cantidad),
        unidad: finalUnidad,
        img: img ? String(img).trim() : null,
        notas: notas ? String(notas).trim() : null,
      });
      res.status(201).json({ success: true, data: item });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // PUT /api/inventario/:id
  async update(req, res) {
    try {
      const { nombre, tipo, color, cantidad, unidad, img, notas } = req.body;

      if (cantidad !== undefined && (Number.isNaN(Number(cantidad)) || Number(cantidad) < 0)) {
        return res.status(400).json({ success: false, message: '"cantidad" debe ser un número mayor o igual a 0' });
      }
      if (tipo !== undefined && !Inventario.TIPOS.includes(String(tipo).toLowerCase().trim())) {
        return res.status(400).json({ success: false, message: `Tipo inválido. Valores permitidos: ${Inventario.TIPOS.join(', ')}` });
      }
      if (unidad !== undefined && !Inventario.UNIDADES.includes(String(unidad).toLowerCase().trim())) {
        return res.status(400).json({ success: false, message: `Unidad inválida. Valores permitidos: ${Inventario.UNIDADES.join(', ')}` });
      }

      const updated = await Inventario.update(req.params.id, {
        nombre: nombre !== undefined ? String(nombre).trim() : undefined,
        tipo: tipo !== undefined ? String(tipo).toLowerCase().trim() : undefined,
        color: color !== undefined ? (color === null || color === '' ? null : String(color).trim()) : undefined,
        cantidad: cantidad !== undefined ? Number(cantidad) : undefined,
        unidad: unidad !== undefined ? String(unidad).toLowerCase().trim() : undefined,
        img: img !== undefined ? (img === null || img === '' ? null : String(img).trim()) : undefined,
        notas: notas !== undefined ? (notas === null || notas === '' ? null : String(notas).trim()) : undefined,
      });

      if (!updated) {
        return res.status(404).json({ success: false, message: `No existe material con id ${req.params.id}` });
      }
      res.json({ success: true, message: 'Material actualizado', data: updated });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // DELETE /api/inventario/:id
  async remove(req, res) {
    try {
      const deleted = await Inventario.remove(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: `No existe material con id ${req.params.id}` });
      }
      res.json({ success: true, message: `Material "${deleted.nombre}" eliminado`, data: deleted });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = InventarioController;
