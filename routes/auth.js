const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { welcomeEmail } = require('../lib/email');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const emailOK = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function publicUser(u) {
  const isAdmin = !!process.env.ADMIN_EMAIL && u.email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
  return { id: u.id, name: u.name, email: u.email, isAdmin };
}

router.post('/signup', (req, res) => {
  const { name, email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();

  if (cleanName.length < 2) return res.status(400).json({ field: 'name', error: 'Enter the name you want on your orders.' });
  if (!emailOK(cleanEmail)) return res.status(400).json({ field: 'email', error: 'That email address looks incomplete.' });
  if (String(password || '').length < 6) return res.status(400).json({ field: 'password', error: 'Use at least six characters.' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) return res.status(409).json({ field: 'email', error: 'An account already uses that email. Sign in instead.' });

  const user = { id: uuid(), name: cleanName, email: cleanEmail, created_at: Date.now() };
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)')
    .run(user.id, user.name, user.email, hash, user.created_at);

  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
  welcomeEmail(user).catch(() => {}); // fire-and-forget, after the response is already sent
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
  if (!user) return res.status(401).json({ field: 'email', error: 'No account uses that email yet.' });

  const ok = bcrypt.compareSync(String(password || ''), user.password_hash);
  if (!ok) return res.status(401).json({ field: 'password', error: 'That password does not match this account.' });

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  res.json({ user: publicUser(user) });
});

router.patch('/me', requireAuth, (req, res) => {
  const name = String((req.body || {}).name || '').trim();
  if (name.length < 2) return res.status(400).json({ field: 'name', error: 'Enter the name you want on your orders.' });
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

router.post('/me/password', requireAuth, (req, res) => {
  const { current, next } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(String(current || ''), user.password_hash)) {
    return res.status(400).json({ field: 'current', error: 'That is not your current password.' });
  }
  if (String(next || '').length < 6) {
    return res.status(400).json({ field: 'next', error: 'Use at least six characters.' });
  }
  const hash = bcrypt.hashSync(next, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
