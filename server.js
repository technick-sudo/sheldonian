// Simple Node.js Forum (Educational / Demo Purpose)
// Requirements: node >=18
// Install deps: npm install express express-session sqlite3 bcrypt

const express = require("express");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

const app = express();
const db = new sqlite3.Database("forum.db");

app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // serve style.css
app.use(
  session({
    secret: "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
  })
);

// --- Database setup ---
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// --- Helper ---
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

function page(title, body) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${title}</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <div class="container">
      ${body}
    </div>
  </body>
  </html>`;
}

// --- Routes ---
app.get("/", (req, res) => {
  db.all("SELECT * FROM posts ORDER BY created_at DESC", (err, posts) => {
    res.send(page("Forum", `
      <h1>Simple Forum</h1>
      <div class="nav">
        ${req.session.user
          ? `Logged in as <b>${req.session.user}</b> | <a href='/logout'>Logout</a>`
          : `<a href='/login'>Login</a> | <a href='/register'>Register</a>`}
      </div>
      ${req.session.user ? `
        <form method='POST' action='/post'>
          <textarea name='content' required placeholder='Write something...'></textarea>
          <button>Post</button>
        </form>
      ` : ``}
      <hr />
      ${posts.map(p => `
        <div class='post'>
          <div class='post-user'>${p.user}</div>
          <div>${p.content}</div>
          <div class='post-time'>${p.created_at}</div>
        </div>
      `).join("")}
    `));
  });
});

app.get("/register", (req, res) => {
  res.send(page("Register", `
    <h2>Register</h2>
    <form method='POST'>
      <input name='username' required placeholder='Username' />
      <input name='password' type='password' required placeholder='Password' />
      <button>Register</button>
    </form>
  `));
});

app.post("/register", async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  db.run(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [req.body.username, hash],
    err => {
      if (err) return res.send(page("Error", "Username already taken"));
      res.redirect("/login");
    }
  );
});

app.get("/login", (req, res) => {
  res.send(page("Login", `
    <h2>Login</h2>
    <form method='POST'>
      <input name='username' required placeholder='Username' />
      <input name='password' type='password' required placeholder='Password' />
      <button>Login</button>
    </form>
  `));
});

app.post("/login", (req, res) => {
  db.get(
    "SELECT * FROM users WHERE username = ?",
    [req.body.username],
    async (err, user) => {
      if (!user) return res.send(page("Error", "Invalid login"));
      const ok = await bcrypt.compare(req.body.password, user.password);
      if (!ok) return res.send(page("Error", "Invalid login"));
      req.session.user = user.username;
      res.redirect("/");
    }
  );
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.post("/post", requireLogin, (req, res) => {
  db.run(
    "INSERT INTO posts (user, content) VALUES (?, ?)",
    [req.session.user, req.body.content],
    () => res.redirect("/")
  );
});

// --- Start server ---
app.listen(3000, () => console.log("Forum running on http://localhost:3000"));