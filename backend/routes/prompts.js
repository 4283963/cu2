const express = require('express');
const router = express.Router();
const db = require('../db/database');

function parseJsonField(value, defaultValue) {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch (e) {
    return defaultValue;
  }
}

router.get('/', (req, res) => {
  const { page = 1, pageSize = 20, category, keyword } = req.query;
  const offset = (page - 1) * pageSize;

  let whereClauses = [];
  let params = [];

  if (category) {
    whereClauses.push('category = ?');
    params.push(category);
  }
  if (keyword) {
    whereClauses.push('(name LIKE ? OR description LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const totalStmt = db.prepare(`SELECT COUNT(*) as total FROM prompt_templates ${whereSql}`);
  const { total } = totalStmt.get(...params);

  const stmt = db.prepare(`
    SELECT * FROM prompt_templates 
    ${whereSql}
    ORDER BY updated_at DESC 
    LIMIT ? OFFSET ?
  `);
  const templates = stmt.all(...params, Number(pageSize), offset).map(item => ({
    ...item,
    variables: parseJsonField(item.variables, [])
  }));

  res.json({
    list: templates,
    total,
    page: Number(page),
    pageSize: Number(pageSize)
  });
});

router.get('/:id', (req, res) => {
  const stmt = db.prepare('SELECT * FROM prompt_templates WHERE id = ?');
  const template = stmt.get(req.params.id);
  
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  template.variables = parseJsonField(template.variables, []);
  res.json(template);
});

router.post('/', (req, res) => {
  const { name, description, system_prompt, user_prompt_template, variables = [], category } = req.body;

  if (!name || !system_prompt || !user_prompt_template) {
    return res.status(400).json({ error: 'Name, system_prompt and user_prompt_template are required' });
  }

  const stmt = db.prepare(`
    INSERT INTO prompt_templates (name, description, system_prompt, user_prompt_template, variables, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    name,
    description || '',
    system_prompt,
    user_prompt_template,
    JSON.stringify(variables),
    category || ''
  );

  res.status(201).json({
    id: result.lastInsertRowid,
    name,
    description,
    system_prompt,
    user_prompt_template,
    variables,
    category
  });
});

router.put('/:id', (req, res) => {
  const { name, description, system_prompt, user_prompt_template, variables, category } = req.body;
  const id = req.params.id;

  const existing = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const stmt = db.prepare(`
    UPDATE prompt_templates 
    SET name = ?, description = ?, system_prompt = ?, user_prompt_template = ?, variables = ?, category = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(
    name || existing.name,
    description !== undefined ? description : existing.description,
    system_prompt || existing.system_prompt,
    user_prompt_template || existing.user_prompt_template,
    JSON.stringify(variables !== undefined ? variables : parseJsonField(existing.variables, [])),
    category !== undefined ? category : existing.category,
    id
  );

  const updated = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(id);
  updated.variables = parseJsonField(updated.variables, []);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM prompt_templates WHERE id = ?');
  const result = stmt.run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.json({ message: 'Template deleted successfully' });
});

router.post('/:id/preview', (req, res) => {
  const { id } = req.params;
  const { variables = {} } = req.body;

  const template = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(id);
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  let userPrompt = template.user_prompt_template;
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    userPrompt = userPrompt.replace(regex, variables[key] || '');
  });

  res.json({
    system_prompt: template.system_prompt,
    user_prompt: userPrompt
  });
});

module.exports = router;
