/**
 * Controlador de pedidos de la tienda (clientes logueados)
 *
 * POST /api/store-orders  (requiere token JWT del cliente)
 * Body: { items: [{ id, qty, color?, size? }] }
 *
 * Flujo: el cliente confirma su carrito por WhatsApp → el frontend envía el
 * pedido aquí con SU token. El backend:
 *   1) verifica el token (middleware verifyToken) — así sabemos que es
 *      realmente ese usuario y no un impostor;
 *   2) recalcula los precios desde la base de datos (no confía en los que
 *      manda el navegador);
 *   3) genera un número de pedido (AK-YYYYMMDD-XXXX);
 *   4) envía al correo del usuario la factura estilizada de la empresa con el
 *      monto y el detalle de todo lo que pidió;
 *   5) responde { orderNumber, total, email } para que el frontend continúe
 *      hacia WhatsApp inmediatamente después.
 */
const pool = require('../config/db');
const { sendOrderInvoice } = require('../services/mailer');

/* Genera un número de pedido legible: AK-20261004-7392 */
function generateOrderNumber() {
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AK-${fecha}-${rand}`;
}

const storeOrderController = {
  async create(req, res) {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];

      if (items.length === 0) {
        return res.status(400).json({ success: false, message: 'El pedido no tiene artículos' });
      }
      if (items.length > 100) {
        return res.status(400).json({ success: false, message: 'Demasiados artículos en un solo pedido' });
      }

      /* Cantidad válida por artículo (1..99) y solo las claves seguras */
      const pedidos = items
        .map((it) => ({
          id: Number(it?.id),
          qty: Math.min(99, Math.max(1, Math.floor(Number(it?.qty) || 1))),
          color: it?.color ? String(it.color).slice(0, 60) : null,
          size: it?.size ? String(it.size).slice(0, 60) : null,
        }))
        .filter((it) => Number.isInteger(it.id) && it.id > 0);

      if (pedidos.length === 0) {
        return res.status(400).json({ success: false, message: 'Artículos inválidos en el pedido' });
      }

      /* 2) Recalcular precios desde la BD (el frontend no dicta precios) */
      const ids = [...new Set(pedidos.map((p) => p.id))];
      const { rows: productos } = await pool.query(
        'SELECT id, name, price FROM products WHERE id = ANY($1::int[])',
        [ids]
      );
      const byId = new Map(productos.map((p) => [Number(p.id), p]));

      const itemsFinales = [];
      for (const p of pedidos) {
        const prod = byId.get(p.id);
        if (!prod) continue; // el producto ya no existe: se omite
        const variante = [p.color, p.size].filter(Boolean).join(' · ');
        itemsFinales.push({ name: prod.name, variante, qty: p.qty, price: Number(prod.price) });
      }

      if (itemsFinales.length === 0) {
        return res.status(400).json({ success: false, message: 'Los productos del pedido ya no existen' });
      }

      const total = itemsFinales.reduce((s, it) => s + it.price * it.qty, 0);

      /* Datos del usuario verificado por el token (middleware) */
      const { rows } = await pool.query(
        'SELECT id, name, last_name, email, username, role FROM users WHERE id = $1',
        [req.user.id]
      );
      const user = rows[0];
      if (!user) {
        return res.status(401).json({ success: false, message: 'El usuario del token ya no existe' });
      }

      /* 3) Número de pedido + 4) factura al correo del usuario */
      const orderNumber = generateOrderNumber();
      const mail = await sendOrderInvoice({
        to: user.email,
        name: user.name,
        orderNumber,
        items: itemsFinales,
        total,
      });

      console.log(
        `🧾 Pedido ${orderNumber} de ${user.email} — ${itemsFinales.length} artículo(s), total $${total.toFixed(2)} — correo: ${mail.mode}`
      );

      /* 5) El frontend abre WhatsApp apenas recibe esta respuesta */
      res.status(201).json({
        success: true,
        message: `¡Pedido registrado, ${user.name}! Enviamos la factura a ${user.email}`,
        orderNumber,
        total,
        email: user.email,
        invoice: { delivered: mail.delivered, mode: mail.mode },
      });
    } catch (err) {
      console.error('✗ Error registrando el pedido:', err.message);
      res.status(500).json({ success: false, message: 'No se pudo registrar el pedido. Intenta de nuevo.' });
    }
  },
};

module.exports = storeOrderController;
