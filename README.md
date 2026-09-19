# Anchor backend

A real Node.js + SQLite backend for the Anchor marketplace. Runs entirely on
your own machine — no cloud account, no external database server, and no
C++ compiler needed either.

## What this replaces

The original site kept everything (accounts, cart, orders) in the browser's
`localStorage`. This backend replaces that with:

- **A real database** (SQLite, stored in the single file `anchor.db`), using
  Node's own built-in SQLite driver (`node:sqlite`) — nothing to compile
- **Hashed passwords** (bcrypt) — never stored in plain text
- **Login sessions** via signed tokens (JWT), not a JS variable in the page
- **Server-side stock checks** — two people can't both buy the last unit
- **An API** other apps (a future mobile app, an admin panel) could reuse

## 1. Install prerequisites

You need **Node.js 22.5 or newer** (the built-in SQLite driver this project
uses only exists from that version on). Check what you have:

```
node --version
```

If that's older than v22.5, install a current version from
https://nodejs.org (the "LTS" version is fine).

## 2. Install dependencies

From inside this folder:

```
npm install
```

This downloads Express, bcryptjs, jsonwebtoken and a couple of small
helpers into a `node_modules` folder. None of them need compiling — there's
no Visual Studio / build-tools requirement here, on any OS.

## 3. Configure your secret

```
cp .env.example .env
```

Then open `.env` and replace the placeholder `JWT_SECRET` with a real random
string. You can generate one with:

```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the output into `.env`. This secret is what makes login tokens
un-forgeable — keep it out of any repository you make public.

## 4. Run it

```
npm start
```

You should see:

```
(node:...) ExperimentalWarning: SQLite is an experimental feature and might change at any time
Anchor backend running at http://localhost:3000
API base:            http://localhost:3000/api
```

That warning is expected and harmless — it's Node telling you its built-in
SQLite support is still labeled experimental, not that anything is broken.


Open **http://localhost:3000/anchor.html** in your browser — the storefront
is served by this same server. The database file `anchor.db` is created and
seeded with the full 28-product catalog automatically the first time you run
this.

Use `npm run dev` instead of `npm start` while you're changing backend code —
it restarts the server automatically on every save.

## Important — the frontend isn't wired up to this yet

Right now `public/anchor.html` is the same file as before: it still reads
and writes `localStorage`, not this API. This backend is fully working and
testable on its own (see below), but making the page actually *use* it means
rewriting its data layer to call these endpoints with `fetch` instead of
touching `localStorage` directly. That's the next step — ask and we'll do it
together, function by function, so nothing breaks partway through.

## Testing the API on its own

With the server running, in a second terminal:

```bash
# Create an account
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada Obi","email":"ada@example.com","password":"hunter22"}'

# → returns { "token": "...", "user": {...} }. Copy the token for the next calls.

# List products
curl http://localhost:3000/api/products

# Add something to your cart (replace TOKEN and p3 with a real product id)
curl -X POST http://localhost:3000/api/cart \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"productId":"p3","qty":1}'

# Place an order from that cart
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name":"Ada Obi","phone":"08030001111","addr":"12 Aba Road","city":"Port Harcourt","state":"Rivers","shipChoice":"standard","payChoice":"card"}'

# See your orders
curl http://localhost:3000/api/orders -H "Authorization: Bearer TOKEN"
```

## API reference

| Method | Path                        | Auth? | Purpose |
|--------|-----------------------------|-------|---------|
| POST   | /api/auth/signup            | no    | Create an account |
| POST   | /api/auth/login             | no    | Sign in, get a token |
| GET    | /api/auth/me                | yes   | Current profile |
| PATCH  | /api/auth/me                | yes   | Update your name |
| POST   | /api/auth/me/password       | yes   | Change password |
| GET    | /api/products               | no    | List catalog |
| GET    | /api/products/:id           | no    | One product |
| GET    | /api/products/:id/reviews   | no    | Reviews for a product |
| GET    | /api/addresses              | yes   | List saved addresses |
| POST   | /api/addresses              | yes   | Add an address |
| DELETE | /api/addresses/:id          | yes   | Remove an address |
| POST   | /api/addresses/:id/default  | yes   | Set as default |
| GET    | /api/cart                   | yes   | View your cart |
| POST   | /api/cart                   | yes   | Add/adjust a line (`{productId, qty}`) |
| PUT    | /api/cart/:productId        | yes   | Set exact quantity |
| DELETE | /api/cart/:productId        | yes   | Remove a line |
| GET    | /api/orders                 | yes   | Order history + live delivery stage |
| POST   | /api/orders                 | yes   | Place an order from your cart |
| GET    | /api/wishlist               | yes   | Saved-for-later product ids |
| POST   | /api/wishlist/:productId    | yes   | Toggle save |
| GET    | /api/notify                 | yes   | Out-of-stock alerts you're tracking |
| POST   | /api/notify/:productId      | yes   | Toggle tracking |
| POST   | /api/reviews                | yes   | Post a review (`{productId, rating, text}`) |

Every `yes`-auth route expects `Authorization: Bearer <token>` from
signup/login.

## Where your data lives

Everything is in `anchor.db`, a single file in this folder. Back it up by
copying that file; delete it (server stopped) to start completely fresh —
it will be recreated and reseeded on the next `npm start`.

## Next steps when you're ready

1. **Wire the frontend to this API** — replace the `localStorage` calls in
   `anchor.html` with `fetch()` calls to these endpoints.
2. **Deploy it somewhere reachable** — right now this only runs on your
   laptop. Putting it online means picking a host (Render, Railway, a VPS)
   and, since SQLite is a single file, either accepting it lives on that one
   server's disk or moving to Postgres for a more scalable managed database.
3. **Real payments** — `payChoice` is currently just a label; hooking up
   Paystack or Flutterwave would happen inside `routes/orders.js`.
