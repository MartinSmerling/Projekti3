const express = require("express");
const initSqlJs = require("sql.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "vaihda-tama-tuotannossa-vahvaan-salaisuuteen";
const DB_PATH = path.join(__dirname, "treenipaivakirja.db");

let db;

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      duration INTEGER NOT NULL,
      intensity TEXT NOT NULL,
      notes TEXT,
      distance_km INTEGER DEFAULT 0,
      distance_m INTEGER DEFAULT 0,
      has_distance INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  saveDb();
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Apufunktiot sql.js:lle
function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  const id = db.exec("SELECT last_insert_rowid()")[0]?.values[0][0];
  saveDb();
  return id;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Auth middleware ---
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Kirjautuminen vaaditaan" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: "Virheellinen tai vanhentunut token" });
  }
}

// --- Rekisteröinti ---
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Käyttäjänimi ja salasana vaaditaan" });
  if (username.length < 3)
    return res.status(400).json({ error: "Käyttäjänimen tulee olla vähintään 3 merkkiä" });
  if (password.length < 6)
    return res.status(400).json({ error: "Salasanan tulee olla vähintään 6 merkkiä" });

  const existing = dbGet("SELECT id FROM users WHERE username = ?", [username]);
  if (existing) return res.status(409).json({ error: "Käyttäjänimi on jo käytössä" });

  try {
    const hashed = bcrypt.hashSync(password, 10);
    const id = dbRun("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashed]);
    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, username });
  } catch (e) {
    res.status(500).json({ error: "Palvelinvirhe" });
  }
});

// --- Kirjautuminen ---
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Käyttäjänimi ja salasana vaaditaan" });

  const user = dbGet("SELECT * FROM users WHERE username = ?", [username]);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: "Väärä käyttäjänimi tai salasana" });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, username: user.username });
});

// --- Hae treenit ---
app.get("/api/workouts", authMiddleware, (req, res) => {
  const workouts = dbAll(
    "SELECT * FROM workouts WHERE user_id = ? ORDER BY date DESC, created_at DESC",
    [req.userId]
  );
  res.json(workouts);
});

// --- Lisää treeni ---
app.post("/api/workouts", authMiddleware, (req, res) => {
  const { date, type, duration, intensity, notes, distance_km, distance_m, has_distance } = req.body;
  if (!date || !type || !duration || !intensity)
    return res.status(400).json({ error: "Pakolliset kentät puuttuvat" });

  const id = dbRun(
    `INSERT INTO workouts (user_id, date, type, duration, intensity, notes, distance_km, distance_m, has_distance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.userId, date, type, duration, intensity, notes || "", distance_km || 0, distance_m || 0, has_distance ? 1 : 0]
  );

  const workout = dbGet("SELECT * FROM workouts WHERE id = ?", [id]);
  res.json(workout);
});

// --- Poista treeni ---
app.delete("/api/workouts/:id", authMiddleware, (req, res) => {
  const workout = dbGet("SELECT * FROM workouts WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!workout) return res.status(404).json({ error: "Treeniä ei löydy" });

  dbRun("DELETE FROM workouts WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;

initDb().then(() => {
  app.listen(PORT, () => console.log(`Palvelin käynnissä: http://localhost:${PORT}`));
});