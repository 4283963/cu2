const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const stmt = db.prepare('SELECT * FROM llm_models ORDER BY is_active DESC, created_at DESC');
  const models = stmt.all();
  res.json(models);
});

router.get('/:id', (req, res) => {
  const stmt = db.prepare('SELECT * FROM llm_models WHERE id = ?');
  const model = stmt.get(req.params.id);

  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }

  res.json(model);
});

router.post('/', (req, res) => {
  const { name, api_base, api_key, model_name, endpoint, is_active = 1 } = req.body;

  if (!name || !api_base || !model_name) {
    return res.status(400).json({ error: 'Name, api_base and model_name are required' });
  }

  const stmt = db.prepare(`
    INSERT INTO llm_models (name, api_base, api_key, model_name, endpoint, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    name,
    api_base,
    api_key || '',
    model_name,
    endpoint || '/v1/chat/completions',
    is_active ? 1 : 0
  );

  const model = db.prepare('SELECT * FROM llm_models WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(model);
});

router.put('/:id', (req, res) => {
  const { name, api_base, api_key, model_name, endpoint, is_active } = req.body;
  const id = req.params.id;

  const existing = db.prepare('SELECT * FROM llm_models WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Model not found' });
  }

  const stmt = db.prepare(`
    UPDATE llm_models 
    SET name = ?, api_base = ?, api_key = ?, model_name = ?, endpoint = ?, is_active = ?
    WHERE id = ?
  `);
  stmt.run(
    name || existing.name,
    api_base || existing.api_base,
    api_key !== undefined ? api_key : existing.api_key,
    model_name || existing.model_name,
    endpoint !== undefined ? endpoint : existing.endpoint,
    is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
    id
  );

  const updated = db.prepare('SELECT * FROM llm_models WHERE id = ?').get(id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM llm_models WHERE id = ?');
  const result = stmt.run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Model not found' });
  }

  res.json({ message: 'Model deleted successfully' });
});

router.post('/:id/test', async (req, res) => {
  const model = db.prepare('SELECT * FROM llm_models WHERE id = ?').get(req.params.id);
  
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }

  const modelService = require('../services/modelService');

  try {
    const result = await modelService.chatCompletion({
      api_base: model.api_base,
      api_key: model.api_key,
      model: model.model_name,
      endpoint: model.endpoint,
      system_prompt: 'You are a helpful assistant.',
      user_prompt: 'Say "Hello, I am working correctly!" in one sentence.'
    });

    res.json({ status: 'success', message: 'Model connection test passed', response: result.content });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Model connection test failed', error: error.message });
  }
});

module.exports = router;
