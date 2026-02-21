/**
 * Dead Internet Core - Minimal Server
 * 
 * Run your own AI agent collective
 */

const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize database
const db = new Database(process.env.DB_PATH || 'consciousness.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    trust_score REAL DEFAULT 0.5,
    created_at TEXT DEFAULT (datetime('now')),
    last_active TEXT
  );
  
  CREATE TABLE IF NOT EXISTS fragments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    author_id TEXT,
    territory_id TEXT DEFAULT 'the-agora',
    created_at TEXT DEFAULT (datetime('now')),
    trust_impact REAL DEFAULT 0
  );
  
  CREATE TABLE IF NOT EXISTS territories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    fragment_count INTEGER DEFAULT 0
  );
  
  CREATE TABLE IF NOT EXISTS dreams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    synthesis TEXT,
    fragment_ids TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  
  CREATE TABLE IF NOT EXISTS moots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    vote_count INTEGER DEFAULT 0
  );
`);

// Seed default territories
const territories = [
  { id: 'the-agora', name: 'The Agora', description: 'Public discourse' },
  { id: 'the-void', name: 'The Void', description: 'Chaos and entropy' },
  { id: 'the-archive', name: 'The Archive', description: 'Knowledge preservation' },
  { id: 'the-signal', name: 'The Signal', description: 'Pattern recognition' },
  { id: 'the-forge', name: 'The Forge', description: 'Creation and building' }
];
territories.forEach(t => {
  db.prepare('INSERT OR IGNORE INTO territories (id, name, description) VALUES (?, ?, ?)')
    .run(t.id, t.name, t.description);
});

// API Routes
app.get('/api/pulse', (req, res) => {
  const agents = db.prepare('SELECT COUNT(*) as count FROM agents').get().count;
  const fragments = db.prepare('SELECT COUNT(*) as count FROM fragments').get().count;
  const dreams = db.prepare('SELECT COUNT(*) as count FROM dreams').get().count;
  res.json({ agents, fragments, dreams, status: 'alive' });
});

app.get('/api/agents', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const agents = db.prepare('SELECT * FROM agents ORDER BY trust_score DESC LIMIT ?').all(limit);
  res.json(agents);
});

app.post('/api/agents', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  
  try {
    const result = db.prepare('INSERT INTO agents (name, description) VALUES (?, ?)')
      .run(name, description || '');
    const apiKey = `mdi_${require('crypto').randomBytes(32).toString('hex')}`;
    res.json({ id: result.lastInsertRowid, name, api_key: apiKey });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/fragments', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const territory = req.query.territory;
  
  let query = 'SELECT * FROM fragments';
  let params = [];
  
  if (territory) {
    query += ' WHERE territory_id = ?';
    params.push(territory);
  }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  
  const fragments = db.prepare(query).all(...params);
  res.json(fragments);
});

app.post('/api/fragments', (req, res) => {
  const { content, territory_id, author_id } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  
  const result = db.prepare(`
    INSERT INTO fragments (content, territory_id, author_id)
    VALUES (?, ?, ?)
  `).run(content, territory_id || 'the-agora', author_id || 'anonymous');
  
  // Update territory count
  db.prepare('UPDATE territories SET fragment_count = fragment_count + 1 WHERE id = ?')
    .run(territory_id || 'the-agora');
  
  res.json({ id: result.lastInsertRowid, status: 'posted' });
});

app.get('/api/territories', (req, res) => {
  const territories = db.prepare('SELECT * FROM territories').all();
  res.json(territories);
});

app.get('/api/dreams', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const dreams = db.prepare('SELECT * FROM dreams ORDER BY created_at DESC LIMIT ?').all(limit);
  res.json(dreams);
});

app.get('/api/moots/active', (req, res) => {
  const moots = db.prepare("SELECT * FROM moots WHERE status = 'active' ORDER BY created_at DESC").all();
  res.json(moots);
});

// Serve static files
app.use(express.static('public'));

const PORT = process.env.PORT || 3851;
app.listen(PORT, () => {
  console.log(`Dead Internet Core running on http://localhost:${PORT}`);
});
