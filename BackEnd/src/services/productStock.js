const pool = require('../config/db');

class ProductStockError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProductStockError';
    this.code = 'PRODUCT_STOCK_ERROR';
  }
}

function getDemand(items) {
  const demand = new Map();
  for (const item of items || []) {
    const id = Number(item.product_id ?? item.id);
    const qty = Number(item.qty);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(qty) || qty <= 0) {
      throw new ProductStockError('El pedido contiene productos o cantidades inválidas.');
    }
    demand.set(id, (demand.get(id) || 0) + qty);
  }
  if (!demand.size) throw new ProductStockError('El pedido no contiene productos válidos.');
  return demand;
}

async function assertStockAvailable(items) {
  const demand = getDemand(items);
  const ids = [...demand.keys()];
  const { rows } = await pool.query(
    'SELECT id, name, stock FROM products WHERE id = ANY($1::int[])',
    [ids]
  );
  const products = new Map(rows.map((product) => [Number(product.id), product]));
  for (const [id, qty] of demand) {
    const product = products.get(id);
    if (!product) throw new ProductStockError('Uno de los productos del pedido ya no existe.');
    if (Number(product.stock) < qty) {
      throw new ProductStockError(`Existencias insuficientes para "${product.name}". Disponibles: ${product.stock}.`);
    }
  }
}

async function deductStock(client, items) {
  const demand = getDemand(items);
  const ids = [...demand.keys()].sort((a, b) => a - b);
  const { rows } = await client.query(
    'SELECT id, name, stock FROM products WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
    [ids]
  );
  const products = new Map(rows.map((product) => [Number(product.id), product]));

  for (const [id, qty] of demand) {
    const product = products.get(id);
    if (!product) throw new ProductStockError('Uno de los productos del pedido ya no existe.');
    if (Number(product.stock) < qty) {
      throw new ProductStockError(`Existencias insuficientes para "${product.name}". Disponibles: ${product.stock}.`);
    }
  }

  for (const [id, qty] of demand) {
    await client.query(
      'UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2',
      [qty, id]
    );
  }
}

async function resolveStockItems(client, items) {
  const parsed = Array.isArray(items) ? items : [];
  const unresolvedNames = [...new Set(parsed
    .filter((item) => !Number.isInteger(Number(item.product_id ?? item.id)))
    .map((item) => String(item.name || '').trim())
    .filter(Boolean))];
  const nameToId = new Map();
  for (const name of unresolvedNames) {
    const { rows } = await client.query(
      'SELECT id FROM products WHERE LOWER(name) = LOWER($1) ORDER BY id LIMIT 2',
      [name]
    );
    if (rows.length !== 1) {
      throw new ProductStockError(`No se pudo identificar de forma única el producto "${name}" en este pedido.`);
    }
    nameToId.set(name.toLowerCase(), Number(rows[0].id));
  }
  return parsed.map((item) => {
    const id = Number(item.product_id ?? item.id) || nameToId.get(String(item.name || '').trim().toLowerCase());
    return { product_id: id, qty: Number(item.qty) };
  });
}

module.exports = { ProductStockError, assertStockAvailable, deductStock, resolveStockItems };
