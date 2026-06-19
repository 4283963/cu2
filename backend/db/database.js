const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
const dbPath = path.join(__dirname, 'app.db');

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
      console.log('Database loaded from file');
    } catch (e) {
      console.error('Failed to load database, creating new one:', e.message);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
    console.log('New database created');
  }

  createTables();
  console.log('Database initialized successfully');
}

function createTables() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS prompt_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      system_prompt TEXT NOT NULL,
      user_prompt_template TEXT NOT NULL,
      variables TEXT DEFAULT '[]',
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS audio_assets (
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
    )`,
    `CREATE TABLE IF NOT EXISTS test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      script_text TEXT NOT NULL,
      expected_emotion TEXT,
      expected_style TEXT,
      reference_audio_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS test_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS test_set_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_set_id INTEGER NOT NULL,
      test_case_id INTEGER NOT NULL,
      sort_order INTEGER DEFAULT 0,
      UNIQUE(test_set_id, test_case_id)
    )`,
    `CREATE TABLE IF NOT EXISTS llm_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      api_base TEXT NOT NULL,
      api_key TEXT,
      model_name TEXT NOT NULL,
      endpoint TEXT DEFAULT '/v1/chat/completions',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS test_runs (
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
    )`,
    `CREATE TABLE IF NOT EXISTS test_results (
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
    )`
  ];

  for (const sql of statements) {
    try {
      db.run(sql);
    } catch (e) {
      console.error('Failed to create table:', e.message);
    }
  }

  saveDatabase();
}

let saveTimer = null;
let needsSave = false;

function scheduleSave() {
  needsSave = true;
  if (!saveTimer) {
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (needsSave) {
        saveDatabase();
        needsSave = false;
      }
    }, 100);
  }
}

function saveDatabase() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (e) {
    console.error('Failed to save database:', e.message);
  }
}

function run(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    stmt.step();
    stmt.free();
    scheduleSave();
    return {
      changes: db.getRowsModified()
    };
  } catch (e) {
    console.error('SQL Error (run):', e.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw e;
  }
}

function get(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    let result = undefined;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  } catch (e) {
    console.error('SQL Error (get):', e.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw e;
  }
}

function all(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (e) {
    console.error('SQL Error (all):', e.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw e;
  }
}

function insert(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    stmt.step();
    stmt.free();
    
    const idResult = db.exec('SELECT last_insert_rowid() as id');
    const lastId = idResult[0]?.values[0]?.[0];
    
    scheduleSave();
    return {
      changes: db.getRowsModified(),
      lastInsertRowid: lastId
    };
  } catch (e) {
    console.error('SQL Error (insert):', e.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw e;
  }
}

function prepare(sql) {
  const stmt = db.prepare(sql);
  
  return {
    run(...params) {
      try {
        stmt.reset();
        if (params.length > 0) {
          stmt.bind(params);
        }
        stmt.step();
        
        let lastId = null;
        try {
          const idResult = db.exec('SELECT last_insert_rowid() as id');
          lastId = idResult[0]?.values[0]?.[0];
        } catch (e) {
          // 忽略获取 lastInsertRowid 的错误
        }
        
        scheduleSave();
        return {
          changes: db.getRowsModified(),
          lastInsertRowid: lastId
        };
      } catch (e) {
        console.error('SQL Error (prepare.run):', e.message);
        console.error('SQL:', sql);
        console.error('Params:', params);
        try { stmt.reset(); } catch (_) {}
        throw e;
      }
    },
    get(...params) {
      try {
        stmt.reset();
        if (params.length > 0) {
          stmt.bind(params);
        }
        let result = undefined;
        if (stmt.step()) {
          result = stmt.getAsObject();
        }
        return result;
      } catch (e) {
        console.error('SQL Error (prepare.get):', e.message);
        console.error('SQL:', sql);
        console.error('Params:', params);
        try { stmt.reset(); } catch (_) {}
        throw e;
      }
    },
    all(...params) {
      try {
        stmt.reset();
        if (params.length > 0) {
          stmt.bind(params);
        }
        const results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        return results;
      } catch (e) {
        console.error('SQL Error (prepare.all):', e.message);
        console.error('SQL:', sql);
        console.error('Params:', params);
        try { stmt.reset(); } catch (_) {}
        throw e;
      }
    },
    free() {
      try {
        stmt.free();
      } catch (e) {
        // 忽略释放错误
      }
    }
  };
}

module.exports = {
  initDatabase,
  prepare,
  run,
  get,
  all,
  insert,
  saveDatabase
};
