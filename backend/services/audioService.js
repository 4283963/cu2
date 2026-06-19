const db = require('../db/database');

function parseJsonField(value, defaultValue) {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch (e) {
    return defaultValue;
  }
}

function matchAudio(emotion, style, limit = 10) {
  let whereClauses = [];
  let params = [];

  if (emotion) {
    whereClauses.push('emotion_tag LIKE ?');
    params.push(`%${emotion}%`);
  }
  if (style) {
    whereClauses.push('style_tag LIKE ?');
    params.push(`%${style}%`);
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' OR ') : '';

  const stmt = db.prepare(`
    SELECT * FROM audio_assets 
    ${whereSql}
    ORDER BY created_at DESC 
    LIMIT ?
  `);

  let assets = stmt.all(...params, Number(limit)).map(item => {
    let score = 0;
    
    if (emotion && item.emotion_tag) {
      if (item.emotion_tag === emotion) {
        score += 0.5;
      } else if (item.emotion_tag.includes(emotion) || emotion.includes(item.emotion_tag)) {
        score += 0.3;
      }
    }
    
    if (style && item.style_tag) {
      if (item.style_tag === style) {
        score += 0.3;
      } else if (item.style_tag.includes(style) || style.includes(item.style_tag)) {
        score += 0.15;
      }
    }

    return {
      ...item,
      metadata: parseJsonField(item.metadata, {}),
      url: `/uploads/audio/${item.filename}`,
      match_score: Math.min(score, 1)
    };
  });

  assets.sort((a, b) => b.match_score - a.match_score);

  return {
    matches: assets,
    total: assets.length
  };
}

function matchAudioByText(text, limit = 10) {
  const stmt = db.prepare(`
    SELECT * FROM audio_assets 
    WHERE transcript LIKE ? OR description LIKE ? OR original_name LIKE ?
    ORDER BY created_at DESC 
    LIMIT ?
  `);

  const searchTerm = `%${text}%`;
  const assets = stmt.all(searchTerm, searchTerm, searchTerm, Number(limit)).map(item => ({
    ...item,
    metadata: parseJsonField(item.metadata, {}),
    url: `/uploads/audio/${item.filename}`,
    match_score: 0.5
  }));

  return {
    matches: assets,
    total: assets.length
  };
}

function getAllEmotions() {
  const stmt = db.prepare('SELECT DISTINCT emotion_tag as emotion FROM audio_assets WHERE emotion_tag IS NOT NULL AND emotion_tag != ""');
  return stmt.all().map(item => item.emotion);
}

function getAllStyles() {
  const stmt = db.prepare('SELECT DISTINCT style_tag as style FROM audio_assets WHERE style_tag IS NOT NULL AND style_tag != ""');
  return stmt.all().map(item => item.style);
}

function getAudioById(id) {
  const stmt = db.prepare('SELECT * FROM audio_assets WHERE id = ?');
  const asset = stmt.get(id);
  
  if (asset) {
    asset.metadata = parseJsonField(asset.metadata, {});
    asset.url = `/uploads/audio/${asset.filename}`;
  }
  
  return asset;
}

module.exports = {
  matchAudio,
  matchAudioByText,
  getAllEmotions,
  getAllStyles,
  getAudioById
};
