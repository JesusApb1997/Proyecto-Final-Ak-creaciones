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

module.exports = { ProductStockError, assertStockAvailable, deductStock };
