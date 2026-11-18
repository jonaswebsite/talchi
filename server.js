const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const path = require("path");

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false });
const PORT = process.env.PORT || 3000;
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "32kb" }));
app.use(session({
  store: new pgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || "development-only-change-this-secret",
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 14 }
}));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: "draft-7", legacyHeaders: false }));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      display_name VARCHAR(40) NOT NULL,
      username VARCHAR(24) NOT NULL UNIQUE,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone VARCHAR(30),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id BIGSERIAL PRIMARY KEY,
      is_group BOOLEAN NOT NULL DEFAULT FALSE,
      title VARCHAR(80),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (conversation_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body VARCHAR(4000) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS messages_conversation_id_id_idx ON messages(conversation_id, id);
    CREATE INDEX IF NOT EXISTS users_username_lower_idx ON users(LOWER(username));
  `);
}
const safeUser = u => ({ id: u.id, displayName: u.display_name, username: u.username });
async function auth(req,res,next) {
  if (!req.session.userId) return res.status(401).json({ error: "Bitte melde dich an." });
  const r = await pool.query("SELECT id, display_name, username FROM users WHERE id=$1", [req.session.userId]);
  if (!r.rowCount) return res.status(401).json({ error: "Sitzung abgelaufen." });
  req.user = r.rows[0]; next();
}
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);

app.post("/api/register", asyncRoute(async (req,res) => {
  const { displayName, username, email, password, phone } = req.body || {};
  if (!displayName || !username || !email || !password) return res.status(400).json({error:"Bitte Name, Benutzername, E-Mail und Passwort ausfüllen."});
  if (String(displayName).trim().length > 40 || !/^[a-zA-Z0-9_]{3,24}$/.test(String(username)) || !/^\S+@\S+\.\S+$/.test(String(email)) || String(password).length < 8 || String(password).length > 128)
    return res.status(400).json({error:"Prüfe deine Angaben. Benutzername: 3–24 Zeichen (Buchstaben, Zahlen, _), Passwort: mindestens 8 Zeichen."});
  const hash = await bcrypt.hash(password, 12);
  try {
    const r = await pool.query("INSERT INTO users(display_name,username,email,password_hash,phone) VALUES($1,$2,$3,$4,$5) RETURNING id,display_name,username",
      [String(displayName).trim(),String(username).toLowerCase(),String(email).trim().toLowerCase(),hash,phone ? String(phone).trim().slice(0,30) : null]);
    req.session.userId = r.rows[0].id; res.status(201).json({ user: safeUser(r.rows[0]) });
  } catch(e) { if(e.code==="23505") return res.status(409).json({error:"E-Mail oder Benutzername ist bereits vergeben."}); throw e; }
}));
app.post("/api/login", asyncRoute(async (req,res) => {
  const { login, password } = req.body || {};
  const r = await pool.query("SELECT * FROM users WHERE LOWER(email)=LOWER($1) OR LOWER(username)=LOWER($1)", [String(login||"")]);
  if (!r.rowCount || !(await bcrypt.compare(String(password||""),r.rows[0].password_hash))) return res.status(401).json({error:"Anmeldedaten stimmen nicht."});
  req.session.userId = r.rows[0].id; res.json({user:safeUser(r.rows[0])});
}));
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/me",auth,(req,res)=>res.json({user:safeUser(req.user)}));
app.get("/api/users",auth,asyncRoute(async(req,res)=>{
  const q=String(req.query.q||"").trim().replace(/^@/,"");
  if(q.length<2) return res.json({users:[]});
  const r=await pool.query("SELECT id,display_name,username FROM users WHERE id<>$1 AND (username ILIKE $2 OR display_name ILIKE $2) ORDER BY username LIMIT 20",[req.user.id,"%"+q+"%"]);
  res.json({users:r.rows.map(safeUser)});
}));
app.get("/api/conversations",auth,asyncRoute(async(req,res)=>{
  const r=await pool.query(`SELECT c.id,c.is_group,c.title,
    (SELECT json_build_object('id',u.id,'displayName',u.display_name,'username',u.username) FROM conversation_members cm2 JOIN users u ON u.id=cm2.user_id WHERE cm2.conversation_id=c.id AND cm2.user_id<>$1 LIMIT 1) AS other_user,
    (SELECT body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
    (SELECT created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_at
    FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id WHERE cm.user_id=$1
    ORDER BY COALESCE((SELECT MAX(created_at) FROM messages WHERE conversation_id=c.id),c.created_at) DESC`,[req.user.id]);
  res.json({conversations:r.rows});
}));
app.post("/api/conversations",auth,asyncRoute(async(req,res)=>{
  const target=Number(req.body.userId);
  if(!Number.isSafeInteger(target)||target===Number(req.user.id)) return res.status(400).json({error:"Ungültiger Nutzer."});
  const u=await pool.query("SELECT id FROM users WHERE id=$1",[target]); if(!u.rowCount)return res.status(404).json({error:"Nutzer nicht gefunden."});
  const existing=await pool.query(`SELECT c.id FROM conversations c JOIN conversation_members a ON a.conversation_id=c.id AND a.user_id=$1 JOIN conversation_members b ON b.conversation_id=c.id AND b.user_id=$2 WHERE c.is_group=FALSE AND (SELECT COUNT(*) FROM conversation_members x WHERE x.conversation_id=c.id)=2 LIMIT 1`,[req.user.id,target]);
  if(existing.rowCount)return res.json({id:existing.rows[0].id});
  const c=await pool.query("INSERT INTO conversations DEFAULT VALUES RETURNING id");
  await pool.query("INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2),($1,$3)",[c.rows[0].id,req.user.id,target]);
  res.status(201).json({id:c.rows[0].id});
}));
app.get("/api/conversations/:id/messages",auth,asyncRoute(async(req,res)=>{
  const id=Number(req.params.id);
  const member=await pool.query("SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2",[id,req.user.id]);
  if(!member.rowCount)return res.status(404).json({error:"Chat nicht gefunden."});
  const r=await pool.query("SELECT m.id,m.body,m.sender_id,m.created_at,u.display_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=$1 ORDER BY m.id DESC LIMIT 100",[id]);
  res.json({messages:r.rows.reverse().map(m=>({id:m.id,text:m.body,mine:String(m.sender_id)===String(req.user.id),sender:m.display_name,time:m.created_at}))});
}));
app.post("/api/conversations/:id/messages",auth,asyncRoute(async(req,res)=>{
  const id=Number(req.params.id), body=String(req.body.body||"").trim();
  if(!body||body.length>4000)return res.status(400).json({error:"Nachricht muss 1–4000 Zeichen lang sein."});
  const member=await pool.query("SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2",[id,req.user.id]);
  if(!member.rowCount)return res.status(404).json({error:"Chat nicht gefunden."});
  const r=await pool.query("INSERT INTO messages(conversation_id,sender_id,body) VALUES($1,$2,$3) RETURNING id,body,sender_id,created_at",[id,req.user.id,body]);
  res.status(201).json({message:{id:r.rows[0].id,text:r.rows[0].body,mine:true,time:r.rows[0].created_at}});
}));
app.use(express.static(path.join(__dirname)));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:"Serverfehler. Bitte später erneut versuchen."});});
initDb().then(()=>app.listen(PORT,()=>console.log("TALCHI läuft auf Port "+PORT))).catch(err=>{console.error("Datenbankstart fehlgeschlagen",err);process.exit(1);});
