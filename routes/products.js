const express = require('express');
const db = require('../db');

const router = express.Router();

function shape(row) {
  const reviewRows = db.prepare('SELECT rating FROM reviews WHERE product_id = ?').all(row.id);
  const liveCount = row.base_reviews + reviewRows.length;
  const liveRating = reviewRows.length
    ? (row.rating * row.base_reviews + reviewRows.reduce((a, r) => a + r.rating, 0)) / liveCount
    : row.rating;
  return {
    id: row.id, name: row.name, brand: row.brand, cat: row.cat, art: row.art,
    price: row.price, was: row.was, stock: row.stock, c1: row.c1, c2: row.c2,
    desc: row.desc, bullets: JSON.parse(row.bullets),
    rating: Math.round(liveRating * 10) / 10, reviewCount: liveCount
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM products').all();
  res.json({ products: rows.map(shape) });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  res.json({ product: shape(row) });
});

router.get('/:id/reviews', (req, res) => {
  const rows = db.prepare('SELECT who, rating, text, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ reviews: rows });
});

module.exports = router;
