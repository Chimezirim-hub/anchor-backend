const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Body: { productId, rating, text }
router.post('/', (req, res) => {
  const { productId, rating, text } = req.body || {};
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const cleanRating = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));
  const cleanText = String(text || '').trim();
  if (cleanText.length < 4) return res.status(400).json({ field: 'text', error: 'Add a few words about the product first.' });

  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
  const id = uuid();
  db.prepare('INSERT INTO reviews (id, product_id, user_id, who, rating, text, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, productId, req.user.id, user.name, cleanRating, cleanText, Date.now());

  res.status(201).json({ review: { who: user.name, rating: cleanRating, text: cleanText, created_at: Date.now() } });
});

module.exports = router;
