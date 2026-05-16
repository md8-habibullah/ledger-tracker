const initSqlJs = require('sql.js');

async function test() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  
  console.log("Initializing database schema...");
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  console.log("Testing user registration...");
  db.run("INSERT INTO users (username, password) VALUES (?, ?)", ["testuser", "password"]);
  
  const stmt = db.prepare("SELECT * FROM users WHERE username = ?");
  stmt.bind(["testuser"]);
  stmt.step();
  const user = stmt.getAsObject();
  stmt.free();
  
  console.log("User found ID:", user.id);
  console.log("User found Username:", user.username);

  if (!user.id) {
    console.error("User ID not found!");
    process.exit(1);
  }

  console.log("Testing transaction creation...");
  db.run("INSERT INTO transactions (user_id, amount, type, category, description, date, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)", 
    [user.id, 123.45, "expense", "Testing", "Test Transaction", "2026-04-30", new Date().toISOString()]);

  const txStmt = db.prepare("SELECT * FROM transactions WHERE user_id = ?");
  txStmt.bind([user.id]);
  txStmt.step();
  const tx = txStmt.getAsObject();
  txStmt.free();
  
  console.log("Transaction found amount:", tx.amount);
  
  if (user.username === "testuser" && tx.amount === 123.45) {
    console.log("\x1b[32m%s\x1b[0m", "CORE SQLITE LOGIC VERIFIED SUCCESSFULLY!");
  } else {
    console.log("\x1b[31m%s\x1b[0m", "VERIFICATION FAILED!");
    process.exit(1);
  }
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
