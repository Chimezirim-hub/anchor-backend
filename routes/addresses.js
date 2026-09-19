const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, rowid ASC').all(req.user.id);
  res.json({ addresses: rows });
});

router.post('/', (req, res) => {
  const { name, phone, addr, city, state } = req.body || {};
  if (!name || String(name).trim().length < 2) return res.status(400).json({ field: 'name', error: 'Who should the rider ask for?' });
  if (!phone || String(phone).replace(/\D/g, '').length < 10) return res.status(400).json({ field: 'phone', error: 'Enter a phone number the rider can call.' });
  if (!addr || String(addr).trim().length < 6) return res.status(400).json({ field: 'addr', error: 'Add a street and landmark.' });
  if (!city || String(city).trim().length < 2) return res.status(400).json({ field: 'city', error: 'Which city?' });

  const existingCount = db.prepare('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?').get(req.user.id).n;
  const id = uuid();
  db.prepare(`INSERT INTO addresses (id,user_id,name,phone,addr,city,state,is_default) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, req.user.id, name.trim(), phone.trim(), addr.trim(), city.trim(), state || '', existingCount === 0 ? 1 : 0);

  res.status(201).json({ address: db.prepare('SELECT * FROM addresses WHERE id = ?').get(id) });
});

router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Address not found.' });
  db.prepare('DELETE FROM addresses WHERE id = ?').run(req.params.id);
  if (row.is_default) {
    const next = db.prepare('SELECT id FROM addresses WHERE user_id = ? LIMIT 1').get(req.user.id);
    if (next) db.prepare('UPDATE addresses SET is_default = 1 WHERE id = ?').run(next.id);
  }
  res.json({ ok: true });
});

router.post('/:id/default', (req, res) => {
  const row = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Address not found.' });
  db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);
  db.prepare('UPDATE addresses SET is_default = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
