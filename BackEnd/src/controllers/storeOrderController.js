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
 *   4) guarda el pedido pendiente para confirmación administrativa y envía al
 *      correo del usuario la factura con productos y precios recalculados;
 *   5) responde con el pedido confirmado por el servidor para abrir WhatsApp.
 *
 * La variante /pago-movil hace exactamente lo mismo, pero el correo incluye
 * los datos del pago móvil configurados por el admin y el monto total del
 * carrito, que es lo que el cliente acaba de pagar.
 */
const pool = require('../config/db');
const { sendOrderInvoice, sendCompanyFinalSaleEmail } = require('../services/mailer');
const PaymentSettings = require('../models/PaymentSettings');
const StoreOrder = require('../models/StoreOrder');
const { ProductStockError, assertStockAvailable } = require('../services/productStock');

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
  const pedidos = items.map((it) => ({
    id: Number(it?.id),
    qty: Number(it?.qty),
    color: it?.color ? String(it.color).slice(0, 60) : null,
    size: it?.size ? String(it.size).slice(0, 60) : null,
  }));
  if (pedidos.some((item) => !Number.isInteger(item.id) || item.id <= 0 ||
      !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99)) {
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
    if (!prod) return { error: 'Uno de los productos del pedido ya no existe' };
    const variante = [p.color, p.size].filter(Boolean).join(' · ');
    itemsFinales.push({ product_id: p.id, name: prod.name, variante, qty: p.qty, price: Number(prod.price) });
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
  async getAll(req, res) {
    try {
      const rows = await StoreOrder.getAll();
      res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
      console.error('✗ Error cargando pedidos de la tienda:', err.message);
      res.status(500).json({ success: false, message: 'No se pudieron cargar los pedidos.' });
    }
  },

  async getReceipt(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'Pedido inválido.' });
      }
      const receipt = await StoreOrder.getReceipt(id);
      if (!receipt?.receipt_data) {
        return res.status(404).json({ success: false, message: 'Este pedido no tiene captura adjunta.' });
      }
      const safeName = String(receipt.receipt_name || 'comprobante').replace(/[\r\n"\\]/g, '_');
      res.set('Cache-Control', 'private, no-store');
      res.set('Content-Type', receipt.receipt_mime || 'application/octet-stream');
      res.set('Content-Disposition', `inline; filename="${safeName}"`);
      res.send(receipt.receipt_data);
    } catch (err) {
      console.error('✗ Error cargando comprobante:', err.message);
      res.status(500).json({ success: false, message: 'No se pudo cargar el comprobante.' });
    }
  },

  async updateStatus(req, res) {
    try {
      const { status } = req.body || {};
      if (!['verificado', 'rechazado'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Estado de pedido inválido.' });
      }
      const order = await StoreOrder.updateStatus(Number(req.params.id), status);
      if (!order) return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });

      if (status === 'verificado') {
        try {
          const fullOrder = await StoreOrder.getById(Number(req.params.id));
          if (fullOrder) {
            const rawItems = Array.isArray(fullOrder.items) ? fullOrder.items : [];
            await sendCompanyFinalSaleEmail({
              orderType: 'Pedido Web',
              orderId: fullOrder.id,
              orderNumber: fullOrder.order_number,
              customerName: fullOrder.customer_name,
              customerPhone: fullOrder.customer_email,
              customerAddress: 'Tienda Online AK Creaciones',
              items: rawItems,
              total: Number(fullOrder.total || 0),
            });
          }
        } catch (mailErr) {
          console.error('✗ Error enviando correo de venta finiquitada para pedido:', mailErr.message);
        }
      }

      res.json({ success: true, data: order });
    } catch (err) {
      console.error('✗ Error actualizando estado de Pago Móvil:', err.message);
      if (err instanceof ProductStockError || err.code === 'ORDER_STATUS_CONFLICT') {
        return res.status(409).json({ success: false, message: err.message });
      }
      res.status(500).json({ success: false, message: 'No se pudo actualizar el estado.' });
    }
  },

  async create(req, res) {
    try {
      const { itemsFinales, total, error } = await recalcularPedido(req.body?.items);
      if (error) return res.status(400).json({ success: false, message: error });
      await assertStockAvailable(itemsFinales);

      const user = await cargarUsuario(req.user.id);
      if (!user) {
        return res.status(401).json({ success: false, message: 'El usuario del token ya no existe' });
      }

      const orderNumber = generateOrderNumber();
      const order = await StoreOrder.create({
        order_number: orderNumber,
        user_id: user.id,
        customer_name: [user.name, user.last_name].filter(Boolean).join(' '),
        customer_email: user.email,
        payment_method: 'Pedido WhatsApp',
        status: 'pendiente',
        items: itemsFinales,
        total,
        payment_details: { method: 'Pedido WhatsApp' },
      });
      let mail;
      try {
        mail = await sendOrderInvoice({
          to: user.email,
          name: user.name,
          orderNumber,
          items: itemsFinales,
          total,
        });
      } catch (mailError) {
        console.error(`✗ Pedido ${orderNumber} guardado, pero falló el envío de factura:`, mailError.message);
        mail = { delivered: false, mode: 'error' };
      }

      console.log(
        `🧾 Pedido ${orderNumber} de ${user.email} — ${itemsFinales.length} artículo(s), total $${total.toFixed(2)} — pedido #${order.id} — correo: ${mail.mode}`
      );

      res.status(201).json({
        success: true,
        message: mail.delivered
          ? `¡Pedido registrado, ${user.name}! Enviamos la factura a ${user.email}`
          : `¡Pedido registrado, ${user.name}! No pudimos enviar la factura por correo.`,
        orderNumber,
        id: order.id,
        total,
        items: itemsFinales,
        email: user.email,
        status: order.status,
        invoice: { delivered: mail.delivered, mode: mail.mode },
      });
    } catch (err) {
      console.error('✗ Error registrando el pedido:', err.message);
      if (err instanceof ProductStockError) {
        return res.status(409).json({ success: false, message: err.message });
      }
      res.status(500).json({ success: false, message: 'No se pudo registrar el pedido. Intenta de nuevo.' });
    }
  },

  /* POST /api/store-orders/pago-movil
     El cliente ya realizó el pago móvil: registramos el pedido y le enviamos
     al correo la confirmación con el MONTO TOTAL del carrito. */
  async createMobilePayment(req, res) {
    try {
      let rawItems = req.body?.items;
      if (typeof rawItems === 'string') {
        try {
          rawItems = JSON.parse(rawItems);
        } catch {
          return res.status(400).json({ success: false, message: 'El carrito no tiene un formato válido.' });
        }
      }
      const { itemsFinales, total, error } = await recalcularPedido(rawItems);
      if (error) return res.status(400).json({ success: false, message: error });
      await assertStockAvailable(itemsFinales);

      const user = await cargarUsuario(req.user.id);
      if (!user) {
        return res.status(401).json({ success: false, message: 'El usuario del token ya no existe' });
      }

      /* Datos de pago que configuró el admin (van impresos en el correo) */
      const datosPago = await PaymentSettings.get();
      const orderNumber = generateOrderNumber();
      const payerPhone = String(req.body?.payer_phone || '').trim().slice(0, 40);
      const payerBank = String(req.body?.payer_bank || '').trim().slice(0, 120);
      const referenceNumber = String(req.body?.reference_number || '').trim().slice(0, 100);
      const amountInput = String(req.body?.reported_amount || '').trim();
      const reportedAmount = amountInput ? Number(amountInput) : null;
      if (amountInput && (!Number.isFinite(reportedAmount) || reportedAmount <= 0)) {
        return res.status(400).json({ success: false, message: 'El monto reportado no es válido.' });
      }
      const completeDetails = Boolean(payerPhone && payerBank && referenceNumber && reportedAmount !== null);
      if (!req.file && !completeDetails) {
        return res.status(400).json({
          success: false,
          message: 'Adjunta la captura del pago o completa teléfono, banco, monto y referencia.',
        });
      }
      const payment = {
        method: 'Pago Móvil',
        bank_name: datosPago.bank_name,
        phone: datosPago.phone,
        cedula: datosPago.cedula,
        holder_name: datosPago.holder_name,
        payer_phone: payerPhone,
        payer_bank: payerBank,
        reported_amount: reportedAmount,
        reference_number: referenceNumber,
      };
      const order = await StoreOrder.create({
        order_number: orderNumber,
        user_id: user.id,
        customer_name: [user.name, user.last_name].filter(Boolean).join(' '),
        customer_email: user.email,
        payment_method: 'Pago Móvil',
        status: 'reportado',
        items: itemsFinales,
        total,
        payment_details: payment,
        payer_phone: payerPhone,
        payer_bank: payerBank,
        reported_amount: reportedAmount,
        reference_number: referenceNumber,
        receipt_name: req.file?.originalname,
        receipt_mime: req.file?.mimetype,
        receipt_data: req.file?.buffer,
      });

      const mail = await sendOrderInvoice({
        to: user.email,
        name: user.name,
        orderNumber,
        items: itemsFinales,
        total,
        payment,
      });

      console.log(
        `💳 Pago Móvil ${orderNumber} de ${user.email} — total $${total.toFixed(2)} — pedido #${order.id} — correo: ${mail.mode}`
      );

      res.status(201).json({
        success: true,
        message: `¡Gracias, ${user.name}! Recibimos tu reporte de pago y enviamos el comprobante a ${user.email}`,
        id: order.id,
        orderNumber,
        total,
        email: user.email,
        status: order.status,
        invoice: { delivered: mail.delivered, mode: mail.mode },
      });
    } catch (err) {
      console.error('✗ Error registrando el pago móvil:', err.message);
      if (err instanceof ProductStockError) {
        return res.status(409).json({ success: false, message: err.message });
      }
      res.status(500).json({ success: false, message: 'No se pudo registrar el pago. Intenta de nuevo.' });
    }
  },
};

module.exports = storeOrderController;
