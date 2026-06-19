const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/audio');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/x-m4a', 'audio/aac'];
    if (allowedTypes.includes(file.mimetype) || 
        ['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }
});

function parseJsonField(value, defaultValue) {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch (e) {
    return defaultValue;
  }
}

router.get('/', (req, res) => {
  const { page = 1, pageSize = 20, emotion, style, keyword } = req.query;
  const offset = (page - 1) * pageSize;

  let whereClauses = [];
  let params = [];

  if (emotion) {
    whereClauses.push('emotion_tag = ?');
    params.push(emotion);
  }
  if (style) {
    whereClauses.push('style_tag = ?');
    params.push(style);
  }
  if (keyword) {
    whereClauses.push('(original_name LIKE ? OR description LIKE ? OR transcript LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const totalStmt = db.prepare(`SELECT COUNT(*) as total FROM audio_assets ${whereSql}`);
  const { total } = totalStmt.get(...params);

  const stmt = db.prepare(`
    SELECT * FROM audio_assets 
    ${whereSql}
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `);
  const assets = stmt.all(...params, Number(pageSize), offset).map(item => ({
    ...item,
    metadata: parseJsonField(item.metadata, {}),
    url: `/uploads/audio/${item.filename}`
  }));

  res.json({
    list: assets,
    total,
    page: Number(page),
    pageSize: Number(pageSize)
  });
});

router.get('/:id', (req, res) => {
  const stmt = db.prepare('SELECT * FROM audio_assets WHERE id = ?');
  const asset = stmt.get(req.params.id);

  if (!asset) {
    return res.status(404).json({ error: 'Audio asset not found' });
  }

  asset.metadata = parseJsonField(asset.metadata, {});
  asset.url = `/uploads/audio/${asset.filename}`;
  res.json(asset);
});

router.post('/upload', upload.single('audio'), (req, res) => {
  try {
    const { emotion_tag, style_tag, description, transcript, metadata } = req.body;

    const stmt = db.prepare(`
      INSERT INTO audio_assets (filename, original_name, file_path, emotion_tag, style_tag, description, transcript, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      req.file.filename,
      req.file.originalname,
      req.file.path,
      emotion_tag || '',
      style_tag || '',
      description || '',
      transcript || '',
      JSON.stringify(metadata ? JSON.parse(metadata) : {})
    );

    const asset = db.prepare('SELECT * FROM audio_assets WHERE id = ?').get(result.lastInsertRowid);
    asset.metadata = parseJsonField(asset.metadata, {});
    asset.url = `/uploads/audio/${asset.filename}`;

    res.status(201).json(asset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  const { emotion_tag, style_tag, description, transcript, metadata } = req.body;
  const id = req.params.id;

  const existing = db.prepare('SELECT * FROM audio_assets WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Audio asset not found' });
  }

  const stmt = db.prepare(`
    UPDATE audio_assets 
    SET emotion_tag = ?, style_tag = ?, description = ?, transcript = ?, metadata = ?
    WHERE id = ?
  `);
  stmt.run(
    emotion_tag !== undefined ? emotion_tag : existing.emotion_tag,
    style_tag !== undefined ? style_tag : existing.style_tag,
    description !== undefined ? description : existing.description,
    transcript !== undefined ? transcript : existing.transcript,
    JSON.stringify(metadata !== undefined ? metadata : parseJsonField(existing.metadata, {})),
    id
  );

  const updated = db.prepare('SELECT * FROM audio_assets WHERE id = ?').get(id);
  updated.metadata = parseJsonField(updated.metadata, {});
  updated.url = `/uploads/audio/${updated.filename}`;
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const asset = db.prepare('SELECT * FROM audio_assets WHERE id = ?').get(req.params.id);
  
  if (!asset) {
    return res.status(404).json({ error: 'Audio asset not found' });
  }

  try {
    if (fs.existsSync(asset.file_path)) {
      fs.unlinkSync(asset.file_path);
    }
  } catch (e) {
    console.error('Failed to delete file:', e);
  }

  const stmt = db.prepare('DELETE FROM audio_assets WHERE id = ?');
  stmt.run(req.params.id);

  res.json({ message: 'Audio asset deleted successfully' });
});

router.post('/match', (req, res) => {
  const { emotion, style, text, limit = 5 } = req.body;

  let whereClauses = [];
  let params = [];

  if (emotion) {
    whereClauses.push('emotion_tag = ?');
    params.push(emotion);
  }
  if (style) {
    whereClauses.push('style_tag = ?');
    params.push(style);
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const stmt = db.prepare(`
    SELECT * FROM audio_assets 
    ${whereSql}
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  
  let assets = stmt.all(...params, Number(limit)).map(item => {
    let score = 0;
    if (emotion && item.emotion_tag === emotion) score += 0.5;
    if (style && item.style_tag === style) score += 0.3;
    if (text && item.transcript && item.transcript.includes(text)) score += 0.2;
    return {
      ...item,
      metadata: parseJsonField(item.metadata, {}),
      url: `/uploads/audio/${item.filename}`,
      match_score: Math.min(score, 1)
    };
  });

  assets.sort((a, b) => b.match_score - a.match_score);

  res.json({
    matches: assets,
    total: assets.length
  });
});

router.get('/tags/emotions', (req, res) => {
  const stmt = db.prepare('SELECT DISTINCT emotion_tag as emotion FROM audio_assets WHERE emotion_tag IS NOT NULL AND emotion_tag != ""');
  const emotions = stmt.all().map(item => item.emotion);
  res.json(emotions);
});

router.get('/tags/styles', (req, res) => {
  const stmt = db.prepare('SELECT DISTINCT style_tag as style FROM audio_assets WHERE style_tag IS NOT NULL AND style_tag != ""');
  const styles = stmt.all().map(item => item.style);
  res.json(styles);
});

module.exports = router;
