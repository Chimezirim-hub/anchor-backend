require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

if (!process.env.JWT_SECRET) {
  console.error('\nMissing JWT_SECRET.\nCopy .env.example to .env and set a real value before starting the server.\n');
  process.exit(1);
}

// Touching db.js here creates anchor.db and seeds the product catalog on first run.
require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/addresses', require('./routes/addresses'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/notify', require('./routes/notify'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/admin', require('./routes/admin'));

// Serves the frontend (public/anchor.html) at the same origin as the API,
// so the browser never has to deal with cross-origin requests.
app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Anchor backend running at http://localhost:${PORT}`);
  console.log(`API base:            http://localhost:${PORT}/api`);
});
