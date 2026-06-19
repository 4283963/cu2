const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
const dbPath = path.join(__dirname, 'app.db');

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log('Database loaded from file');
  } else {
    db = new SQL.Database();
    console.log('New database created');
  }

  createTables();
  console.log('Database initialized successfully');
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      system_prompt TEXT NOT NULL,
      user_prompt_template TEXT NOT NULL,
      variables TEXT DEFAULT '[]',
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audio_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      duration REAL,
      emotion_tag TEXT,
      style_tag TEXT,
      description TEXT,
      transcript TEXT,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      script_text TEXT NOT NULL,
      expected_emotion TEXT,
      expected_style TEXT,
      reference_audio_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reference_audio_id) REFERENCES audio_assets(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS test_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS test_set_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_set_id INTEGER NOT NULL,
      test_case_id INTEGER NOT NULL,
      sort_order INTEGER DEFAULT 0,
      UNIQUE(test_set_id, test_case_id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS llm_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      api_base TEXT NOT NULL,
      api_key TEXT,
      model_name TEXT NOT NULL,
      endpoint TEXT DEFAULT '/v1/chat/completions',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS test_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_set_id INTEGER,
      prompt_template_id INTEGER,
      model_id INTEGER,
      status TEXT DEFAULT 'pending',
      started_at DATETIME,
      completed_at DATETIME,
      total_cases INTEGER DEFAULT 0,
      passed_cases INTEGER DEFAULT 0,
      failed_cases INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS test_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_run_id INTEGER NOT NULL,
      test_case_id INTEGER NOT NULL,
      model_output TEXT,
      detected_emotion TEXT,
      detected_style TEXT,
      matched_audio_id INTEGER,
      match_score REAL,
      evaluation_score REAL,
      evaluation_details TEXT,
      status TEXT DEFAULT 'completed',
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  saveDatabase();
}

function saveDatabase() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (e) {
    console.error('Failed to save database:', e);
  }
}

function prepare(sql) {
  const stmt = db.prepare(sql);
  
  return {
    run(...params) {
      stmt.bind(params);
      stmt.step();
      const lastId = db.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0];
      const changes = db.getRowsModified();
      stmt.reset();
      saveDatabase();
      return {
        changes,
        lastInsertRowid: lastId
      };
    },
    get(...params) {
      stmt.bind(params);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.reset();
        return row;
      }
      stmt.reset();
      return undefined;
    },
    all(...params) {
      const results = [];
      stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.reset();
      return results;
    }
  };
}

function exec(sql, params = []) {
  const results = db.exec(sql, params);
  saveDatabase();
  return results;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  const results = [];
  if (params.length > 0) {
    stmt.bind(params);
  }
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0];
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
  saveDatabase();
  return {
    changes: db.getRowsModified()
  };
}

module.exports = {
  initDatabase,
  prepare,
  exec,
  all,
  get,
  run,
  saveDatabase
};
