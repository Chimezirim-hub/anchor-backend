const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT product_id AS id FROM notify_list WHERE user_id = ?').all(req.user.id);
  res.json({ notify: rows.map(r => r.id) });
});

router.post('/:productId', (req, res) => {
  const existing = db.prepare('SELECT 1 FROM notify_list WHERE user_id = ? AND product_id = ?').get(req.user.id, req.params.productId);
  if (existing) {
    db.prepare('DELETE FROM notify_list WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
    return res.json({ tracking: false });
  }
  db.prepare('INSERT INTO notify_list (user_id, product_id) VALUES (?,?)').run(req.user.id, req.params.productId);
  res.json({ tracking: true });
});

module.exports = router;
