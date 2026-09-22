// db.js — opens (and if needed, creates + seeds) the SQLite database file.
// Uses Node's built-in `node:sqlite` (Node 22.5+): a real SQLite database
// with zero native compilation and nothing extra to install.

const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// In production (e.g. Render), set DB_PATH to a file on your persistent disk
// (e.g. /data/anchor.db) so the database survives deploys and restarts.
// Locally, it defaults to a file right next to this script.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'anchor.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// better-sqlite3-style helper: db.transaction(fn) returns a function that
// runs fn wrapped in BEGIN/COMMIT, rolling back on any thrown error.
db.transaction = function (fn) {
  return (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
};

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  cat TEXT NOT NULL,
  art TEXT NOT NULL,
  price INTEGER NOT NULL,
  was INTEGER,
  rating REAL NOT NULL,
  base_reviews INTEGER NOT NULL,
  stock INTEGER NOT NULL,
  c1 TEXT NOT NULL,
  c2 TEXT NOT NULL,
  desc TEXT NOT NULL,
  bullets TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  addr TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cart_items (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL,
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS wishlist (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS notify_list (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  placed_at INTEGER NOT NULL,
  eta_at INTEGER,
  total INTEGER NOT NULL,
  ship_name TEXT NOT NULL,
  ship_phone TEXT NOT NULL,
  ship_addr TEXT NOT NULL,
  ship_city TEXT NOT NULL,
  ship_state TEXT NOT NULL,
  ship_label TEXT NOT NULL,
  pay_label TEXT NOT NULL,
  paystack_reference TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  who TEXT NOT NULL,
  rating INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);

// ---- seed products on first run only ----
const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
if (count === 0) {
  const P = (id,name,brand,cat,art,price,was,rating,reviews,stock,c1,c2,desc,bullets)=>({id,name,brand,cat,art,price,was,rating,reviews,stock,c1,c2,desc,bullets});
  const PRODUCTS = [
  P('p1','Sonari H7 noise-cancelling headphones','Sonari','Electronics','headphones',89500,112000,4.6,214,14,'#1E2A78','#E0A526','Forty hours of playback and a quiet mode that actually silences a generator two compounds away.',['40-hour battery, 10-minute fast charge','Adaptive noise cancelling with transparency mode','Folds flat into a hard travel case']),
  P('p2','Lumo 14" ThinBook laptop, 16GB','Lumo','Electronics','laptop',742000,829000,4.4,98,6,'#0F7A55','#9FE3C4','A light aluminium laptop that handles spreadsheets, Figma and thirty browser tabs without warming up.',['Ryzen 7 processor, 16GB RAM, 512GB SSD','14" matte display, comfortable in daylight','Charges over USB-C from a power bank']),
  P('p3','Kano X5 Pro 5G, 256GB','Kano','Phones','phone',398000,null,4.7,512,22,'#2B3C9E','#C9D3FF','Flagship camera, three-day battery, and dual SIM for the two numbers everybody carries.',['108MP main camera with night mode','5,000mAh battery, 67W charging','Dual SIM + microSD expansion']),
  P('p4','Kano A3 budget smartphone, 128GB','Kano','Phones','phone',119500,138000,4.2,864,40,'#5C3A9E','#DCC9FF','The dependable second phone: big battery, big screen, small price.',['6.6" display, 90Hz refresh','5,000mAh battery lasts two days','Android 14 with three years of updates']),
  P('p5','Zuri smartwatch, 46mm','Zuri','Electronics','watch',67000,84000,4.1,176,9,'#D9452F','#FFD9CF','Tracks steps, sleep and heart rate, and survives a full week between charges.',['7-day battery life','Heart rate, SpO₂ and sleep tracking','Swim-proof to 50 metres']),
  P('p6','Bassline Roam portable speaker','Bassline','Electronics','speaker',48500,null,4.5,341,31,'#0F7A55','#BFF0DC','Loud enough for a rooftop, small enough for a backpack, waterproof enough for the rain.',['IPX7 waterproof housing','16 hours at half volume','Pair two for stereo sound']),
  P('p7','Optika M200 mirrorless camera','Optika','Electronics','camera',985000,null,4.8,64,3,'#1E2A78','#F2C75C','A 24MP mirrorless body for people who have outgrown their phone camera.',['24MP APS-C sensor','4K/60 video with in-body stabilisation','Kit 18–55mm lens included']),
  P('p8','Halogen 55" 4K smart TV','Halogen','Electronics','tv',489000,565000,4.3,207,7,'#141A2E','#8E9AC4','Four HDMI ports, a remote that survives children, and apps that load before you sit down.',['55" 4K HDR display','Built-in streaming apps and browser','Two-year manufacturer warranty']),
  P('p9','Breeze 18" standing fan','Breeze','Home','fan',42500,49000,4.4,398,26,'#0F7A55','#CCEDDF','Quiet on low, serious on high, and it remembers its setting after a power cut.',['Three speeds with oscillation','Remote control and 8-hour timer','Copper motor rated for daily use']),
  P('p10','Netgrid AX1800 mesh router','Netgrid','Electronics','router',128000,null,4.2,142,11,'#2B3C9E','#C9D3FF','Covers a three-bedroom flat without the dead corner by the kitchen.',['Wi-Fi 6, up to 1,800Mbps','Covers 180m² per unit','Guest network and parental controls']),
  P('p11','Adire print cotton shirt','Aso Lagos','Fashion','shirt',28500,35000,4.6,289,48,'#1E2A78','#7FA8E8','Hand-dyed indigo on soft cotton, cut relaxed enough for the heat.',['100% cotton, pre-shrunk','Hand-dyed — no two are identical','Machine washable, cold']),
  P('p12','Kicks Runner 4 trainers','Kicks','Sports','sneaker',56000,72000,4.5,431,19,'#D9452F','#FFD2C8','Cushioned trainers for road running and the long walk to the bus stop.',['Breathable knit upper','Foam midsole with 8mm drop','Reflective heel for evening runs']),
  P('p13','Marché leather tote','Marché','Fashion','bag',74500,null,4.7,112,8,'#7A4A1E','#F0D6B8','Full-grain leather tote that fits a laptop, a lunchbox and a change of clothes.',['Full-grain leather, ages beautifully','Fits a 15" laptop','Interior zip pocket and key leash']),
  P('p14','Ilé lounge armchair','Ilé','Home','chair',185000,219000,4.4,73,4,'#0F7A55','#CFE8DC','A low armchair with a solid frame and a cover you can actually remove and wash.',['Kiln-dried hardwood frame','Removable, washable cover','Assembles in under ten minutes']),
  P('p15','Dusk arc floor lamp','Dusk','Home','lamp',63000,null,4.2,56,12,'#E0A526','#FFF0CC','Warm, dimmable light for the corner that the ceiling bulb never reaches.',['Three brightness levels','Weighted base, no tipping','LED bulb included, 15,000 hours']),
  P('p16','Whirl 1000W blender','Whirl','Home','blender',37500,44000,4.3,524,35,'#D9452F','#FFD6CE','Crushes ice, pounds pepper, and cleans up in the sink without a fight.',['1000W motor, 4 stainless blades','1.5L shatterproof jar','Pulse mode for pepper and tomatoes']),
  P('p17','Whirl 1.7L electric kettle','Whirl','Home','kettle',21500,null,4.5,612,44,'#1E2A78','#BFC9F2','Boils in three minutes and switches itself off before you notice.',['1.7L stainless interior','Auto shut-off and boil-dry protection','Cordless, 360° base']),
  P('p18','Ese shea body butter, 250ml','Ese','Beauty','jar',9800,12500,4.8,903,60,'#7A4A1E','#F5DFC2','Unrefined shea whipped with coconut oil. One jar lasts a season.',['Unrefined Nigerian shea butter','No parabens or added fragrance','Sourced from a women-run co-op in Kwara']),
  P('p19','Ese neroli eau de parfum, 50ml','Ese','Beauty','bottle',34000,null,4.4,187,15,'#E0A526','#FFF1CC','Neroli and vetiver — bright at first, warm by afternoon.',['50ml eau de parfum','Notes: neroli, vetiver, soft amber','Lasts six to eight hours']),
  P('p20','Golden Harvest rice, 10kg','Golden Harvest','Groceries','sack',32500,38000,4.6,1204,80,'#0F7A55','#DCEFDF','Long-grain parboiled rice, destoned and bagged in Kebbi.',['10kg, long-grain parboiled','Destoned and double-sifted','Resealable woven bag']),
  P('p21','Ìlà groundnut oil, 5 litres','Ìlà','Groceries','bottle',18900,21500,4.5,742,55,'#E0A526','#FFF3D1','Cold-pressed groundnut oil in a keg that pours without spilling.',['5L cold-pressed groundnut oil','No added preservatives','Wide-mouth cap for refilling']),
  P('p22','Highland ball, size 5','Highland','Sports','ball',14500,null,4.3,268,33,'#141A2E','#B9C4E2','Match-weight football with a stitched cover that holds air for weeks.',['Size 5, machine-stitched','Butyl bladder holds pressure','Pump needle included']),
  P('p23','Iron Co. adjustable dumbbell set, 20kg','Iron Co.','Sports','dumbbell',86000,99000,4.6,141,5,'#141A2E','#9FA9C9','One pair that replaces a rack — adjust from 2.5kg to 20kg per hand.',['2.5–20kg per dumbbell','Knurled steel handles','Locking collars included']),
  P('p24','Lagos Noir — a novel','Ọ̀rọ̀ Press','Home','book',6500,8000,4.7,325,24,'#2B3C9E','#D6DDFF','A detective story that treats Lagos traffic as a character in its own right.',['Paperback, 342 pages','Winner, 2024 Nommo Award','Also available as an audiobook']),
  P('p25','Sonari Buds Mini wireless earbuds','Sonari','Electronics','headphones',34500,41000,4.1,588,0,'#5C3A9E','#DCC9FF','Small, light earbuds that stay put on a run and charge in the case four times over.',['28 hours total with the case','IPX5 sweat resistant','Touch controls for calls and skip']),
  P('p26','Aso Lagos wax print kaftan','Aso Lagos','Fashion','shirt',42000,null,4.5,164,17,'#D9452F','#FFDCCF','A wax print kaftan cut long, made for Friday evenings and Sunday afternoons.',['Cotton wax print, six yards','Side pockets, lined shoulders','Tailored in Lagos']),
  P('p27','Marché slim card wallet','Marché','Fashion','bag',19500,24000,4.3,231,29,'#141A2E','#A9B4D6','Six cards and a few notes, flat enough for a front pocket.',['Full-grain leather','Six card slots and a note sleeve','RFID-blocking lining']),
  P('p28','Ese clay face wash, 200ml','Ese','Beauty','jar',12500,null,4.2,376,38,'#0F7A55','#D3EEE1','A gentle clay cleanser for humid days and dusty harmattan mornings.',['Kaolin clay and aloe','Fragrance-free, pH balanced','Suitable for daily use']),
];

  const insert = db.prepare(`
    INSERT INTO products (id,name,brand,cat,art,price,was,rating,base_reviews,stock,c1,c2,desc,bullets)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const seedAll = db.transaction((rows) => {
    for (const p of rows) {
      insert.run(
        p.id, p.name, p.brand, p.cat, p.art,
        p.price, p.was, p.rating, p.reviews,
        p.stock, p.c1, p.c2, p.desc,
        JSON.stringify(p.bullets)
      );
    }
  });
  seedAll(PRODUCTS);
  console.log(`Seeded ${PRODUCTS.length} products into ${DB_PATH}`);
}

module.exports = db;
