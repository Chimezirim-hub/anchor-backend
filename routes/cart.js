const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function cartFor(userId) {
  return db.prepare(`
    SELECT c.product_id AS id, c.qty, p.name, p.price, p.stock, p.art, p.c1, p.c2
    FROM cart_items c JOIN products p ON p.id = c.product_id
    WHERE c.user_id = ?
  `).all(userId);
}

router.get('/', (req, res) => {
  res.json({ cart: cartFor(req.user.id) });
});

// Body: { productId, qty }  — qty is the amount to ADD (use a negative number, or DELETE, to remove)
router.post('/', (req, res) => {
  const { productId, qty } = req.body || {};
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const existing = db.prepare('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?').get(req.user.id, productId);
  const nextQty = (existing ? existing.qty : 0) + Number(qty || 1);

  if (nextQty <= 0) {
    db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, productId);
    return res.json({ cart: cartFor(req.user.id) });
  }
  if (nextQty > product.stock) {
    return res.status(409).json({ error: `Only ${product.stock} left in stock.` });
  }
  if (existing) {
    db.prepare('UPDATE cart_items SET qty = ? WHERE user_id = ? AND product_id = ?').run(nextQty, req.user.id, productId);
  } else {
    db.prepare('INSERT INTO cart_items (user_id, product_id, qty) VALUES (?,?,?)').run(req.user.id, productId, nextQty);
  }
  res.json({ cart: cartFor(req.user.id) });
});

router.put('/:productId', (req, res) => {
  const qty = Number((req.body || {}).qty);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (qty <= 0) {
    db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
  } else {
    if (qty > product.stock) return res.status(409).json({ error: `Only ${product.stock} left in stock.` });
    db.prepare(`
      INSERT INTO cart_items (user_id, product_id, qty) VALUES (?,?,?)
      ON CONFLICT(user_id, product_id) DO UPDATE SET qty = excluded.qty
    `).run(req.user.id, req.params.productId, qty);
  }
  res.json({ cart: cartFor(req.user.id) });
});

router.delete('/:productId', (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
  res.json({ cart: cartFor(req.user.id) });
});

module.exports = router;
