/**
 * Controlador de pedidos de la tienda (clientes logueados)
 *
 * POST /api/store-orders              (requiere token JWT del cliente)
 * POST /api/store-orders/pago-movil   (requiere token JWT del cliente)
 * Body: { items: [{ id, qty, color?, size? }] }
 *
 * Flujo: el cliente confirma su carrito → el frontend envía el pedido aquí
 * con SU token. El backend:
 *   1) verifica el token (middleware verifyToken) — así sabemos que es
 *      realmente ese usuario y no un impostor;
 *   2) recalcula los precios desde la base de datos (no confía en los que
 *      manda el navegador);
 *   3) genera un número de pedido (AK-YYYYMMDD-XXXX);
 *   4) envía al correo del usuario la factura estilizada con el monto y el
 *      detalle de todo lo que pidió;
 *   5) responde { orderNumber, total, email }.
 *
 * La variante /pago-movil hace exactamente lo mismo, pero el correo incluye
 * los datos del pago móvil configurados por el admin y el monto total del
 * carrito, que es lo que el cliente acaba de pagar.
 */
const pool = require('../config/db');
const { sendOrderInvoice } = require('../services/mailer');
const PaymentSettings = require('../models/PaymentSettings');

/* Genera un número de pedido legible: AK-20261004-7392 */
function generateOrderNumber() {
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AK-${fecha}-${rand}`;
}

/**
 * Valida los artículos que llegan del navegador y recalcula sus precios
 * contra la BD (el cliente no dicta precios).
 * Devuelve { itemsFinales, total } o { error } si nada es válido.
 */
async function recalcularPedido(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'El pedido no tiene artículos' };
  }
  if (items.length > 100) {
    return { error: 'Demasiados artículos en un solo pedido' };
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
    return { error: 'Artículos inválidos en el pedido' };
  }

  /* Recalcular precios desde la BD */
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
    return { error: 'Los productos del pedido ya no existen' };
  }

  const total = itemsFinales.reduce((s, it) => s + it.price * it.qty, 0);
  return { itemsFinales, total };
}

/* Datos del usuario verificado por el token (middleware) */
async function cargarUsuario(userId) {
  const { rows } = await pool.query(
    'SELECT id, name, last_name, email, username, role FROM users WHERE id = $1',
    [userId]
  );
  return rows[0];
}

const storeOrderController = {
  async create(req, res) {
    try {
      const { itemsFinales, total, error } = await recalcularPedido(req.body?.items);
      if (error) return res.status(400).json({ success: false, message: error });

      const user = await cargarUsuario(req.user.id);
      if (!user) {
        return res.status(401).json({ success: false, message: 'El usuario del token ya no existe' });
      }

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

  /* POST /api/store-orders/pago-movil
     El cliente ya realizó el pago móvil: registramos el pedido y le enviamos
     al correo la confirmación con el MONTO TOTAL del carrito. */
  async createMobilePayment(req, res) {
    try {
      const { itemsFinales, total, error } = await recalcularPedido(req.body?.items);
      if (error) return res.status(400).json({ success: false, message: error });

      const user = await cargarUsuario(req.user.id);
      if (!user) {
        return res.status(401).json({ success: false, message: 'El usuario del token ya no existe' });
      }

      /* Datos de pago que configuró el admin (van impresos en el correo) */
      const datosPago = await PaymentSettings.get();

      const orderNumber = generateOrderNumber();
      const mail = await sendOrderInvoice({
        to: user.email,
        name: user.name,
        orderNumber,
        items: itemsFinales,
        total,
        payment: {
          method: 'Pago Móvil',
          bank_name: datosPago.bank_name,
          phone: datosPago.phone,
          cedula: datosPago.cedula,
          holder_name: datosPago.holder_name,
        },
      });

      console.log(
        `💳 Pago Móvil ${orderNumber} de ${user.email} — total $${total.toFixed(2)} — correo: ${mail.mode}`
      );

      res.status(201).json({
        success: true,
        message: `¡Pago registrado, ${user.name}! Enviamos la confirmación a ${user.email}`,
        orderNumber,
        total,
        email: user.email,
        invoice: { delivered: mail.delivered, mode: mail.mode },
      });
    } catch (err) {
      console.error('✗ Error registrando el pago móvil:', err.message);
      res.status(500).json({ success: false, message: 'No se pudo registrar el pago. Intenta de nuevo.' });
    }
  },
};

module.exports = storeOrderController;
