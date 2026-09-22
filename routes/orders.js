const express = require('express');
const { v4: uuid } = require('uuid');
const { orderConfirmationEmail } = require('../lib/email');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const SHIP_DAYS = { standard: 4, express: 1, pickup: 2 };
const SHIP_LABELS = { standard: 'Standard, 2–5 days', express: 'Express, next day', pickup: 'Pick up at a hub' };
const PAY_LABELS = { card: 'Debit card (Paystack)', transfer: 'Bank transfer', cod: 'Pay on delivery' };

function stageFor(order) {
  if (!order.eta_at) return 4;
  const span = order.eta_at - order.placed_at;
  const frac = span > 0 ? (Date.now() - order.placed_at) / span : 1;
  if (frac >= 1) return 4;
  if (frac >= 0.72) return 3;
  if (frac >= 0.22) return 2;
  return 1;
}

// Independently confirms a Paystack transaction with Paystack's own servers,
// using our secret key. Never trust a reference the browser hands you without this.
async function verifyPaystackPayment(reference) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    const err = new Error('Card payments are not configured on this server yet.');
    err.status = 503;
    throw err;
  }
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.status || !data.data || data.data.status !== 'success') {
    const err = new Error('That payment could not be verified as successful.');
    err.status = 402;
    throw err;
  }
  return data.data; // includes .amount (kobo), .reference, .currency, etc.
}

router.get('/', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY placed_at DESC').all(req.user.id);
  const withItems = orders.map(o => ({
    id: o.id, at: o.placed_at, etaAt: o.eta_at, total: o.total,
    stage: stageFor(o),
    ship: { name: o.ship_name, phone: o.ship_phone, addr: o.ship_addr, city: o.ship_city, state: o.ship_state },
    shipLabel: o.ship_label, payLabel: o.pay_label,
    items: db.prepare('SELECT product_id AS id, name, price, qty FROM order_items WHERE order_id = ?').all(o.id)
  }));
  res.json({ orders: withItems });
});

// Places an order from the caller's current server-side cart.
// Body: { name, phone, addr, city, state, shipChoice, payChoice, promo?, paystackReference? }
// paystackReference is required when payChoice === 'card', and is independently verified below.
router.post('/', async (req, res) => {
  const cart = db.prepare(`
    SELECT c.product_id AS id, c.qty, p.name, p.price, p.stock
    FROM cart_items c JOIN products p ON p.id = c.product_id
    WHERE c.user_id = ?
  `).all(req.user.id);

  if (!cart.length) return res.status(400).json({ error: 'Your cart is empty.' });

  for (const item of cart) {
    if (item.qty > item.stock) {
      return res.status(409).json({ error: `${item.name} only has ${item.stock} left in stock.` });
    }
  }

  const { name, phone, addr, city, state, shipChoice = 'standard', payChoice = 'card', promo, paystackReference } = req.body || {};
  if (!name || !phone || !addr || !city) {
    return res.status(400).json({ error: 'A complete delivery address is required.' });
  }

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  let discount = 0;
  if (promo === 'ANCHOR10') discount = Math.round(subtotal * 0.10);
  else if (promo === 'NEWBIE') discount = Math.min(2000, subtotal);
  const shipFee = promo === 'FREESHIP' ? 0 : ({ standard: 1500, express: 3500, pickup: 0 }[shipChoice] ?? 1500);
  const total = Math.max(0, subtotal - discount) + shipFee;

  // Card payments must carry a Paystack reference, which we verify server-side
  // before creating anything — the client's word alone is never trusted.
  if (payChoice === 'card') {
    if (!paystackReference) {
      return res.status(400).json({ error: 'Missing payment reference.' });
    }
    const already = db.prepare('SELECT id FROM orders WHERE paystack_reference = ?').get(paystackReference);
    if (already) {
      return res.status(409).json({ error: 'This payment has already been used for an order.' });
    }
    let verified;
    try {
      verified = await verifyPaystackPayment(paystackReference);
    } catch (err) {
      return res.status(err.status || 402).json({ error: err.message });
    }
    const expectedKobo = Math.round(total * 100);
    if (verified.amount !== expectedKobo || (verified.currency && verified.currency !== 'NGN')) {
      return res.status(402).json({ error: 'The verified payment amount does not match this order.' });
    }
  }

  const orderId = 'AN-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 90 + 10);
  const placedAt = Date.now();
  const etaAt = placedAt + (SHIP_DAYS[shipChoice] ?? 4) * 86400000;

  // Everything below happens in one transaction: if any stock check fails, nothing is written.
  const placeOrder = db.transaction(() => {
    for (const item of cart) {
      const fresh = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.id);
      if (item.qty > fresh.stock) throw new Error(`STOCK:${item.name}`);
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.qty, item.id);
    }
    db.prepare(`
      INSERT INTO orders (id,user_id,placed_at,eta_at,total,ship_name,ship_phone,ship_addr,ship_city,ship_state,ship_label,pay_label,paystack_reference)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(orderId, req.user.id, placedAt, etaAt, total, name, phone, addr, city, state || '', SHIP_LABELS[shipChoice] || shipChoice, PAY_LABELS[payChoice] || payChoice, payChoice === 'card' ? paystackReference : null);

    const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES (?,?,?,?,?)');
    for (const item of cart) insertItem.run(orderId, item.id, item.name, item.price, item.qty);

    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
  });

  try {
    placeOrder();
  } catch (err) {
    if (String(err.message).startsWith('STOCK:')) {
      return res.status(409).json({ error: `${err.message.slice(6)} sold out while you were checking out.` });
    }
    return res.status(500).json({ error: 'Could not place the order. Please try again.' });
  }

  res.status(201).json({ orderId, total, etaAt });

  // Fire-and-forget: an email failure should never affect an already-placed order.
  const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(req.user.id);
  orderConfirmationEmail(user, {
    id: orderId, total,
    items: cart.map(i => ({ name: i.name, price: i.price, qty: i.qty })),
    ship: { addr, city, state: state || '' }
  }).catch(() => {});
});

module.exports = router;
