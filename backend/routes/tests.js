const express = require('express');
const router = express.Router();
const db = require('../db/database');
const modelService = require('../services/modelService');
const audioService = require('../services/audioService');

function parseJsonField(value, defaultValue) {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch (e) {
    return defaultValue;
  }
}

router.get('/cases', (req, res) => {
  const { page = 1, pageSize = 20, keyword } = req.query;
  const offset = (page - 1) * pageSize;

  let whereClauses = [];
  let params = [];

  if (keyword) {
    whereClauses.push('(name LIKE ? OR script_text LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const totalStmt = db.prepare(`SELECT COUNT(*) as total FROM test_cases ${whereSql}`);
  const { total } = totalStmt.get(...params);

  const stmt = db.prepare(`
    SELECT tc.*, aa.original_name as reference_audio_name
    FROM test_cases tc
    LEFT JOIN audio_assets aa ON tc.reference_audio_id = aa.id
    ${whereSql}
    ORDER BY tc.created_at DESC 
    LIMIT ? OFFSET ?
  `);
  const cases = stmt.all(...params, Number(pageSize), offset).map(item => ({
    ...item,
    expected_keywords: parseJsonField(item.expected_keywords, []),
    expected_phrases: parseJsonField(item.expected_phrases, [])
  }));

  res.json({
    list: cases,
    total,
    page: Number(page),
    pageSize: Number(pageSize)
  });
});

router.get('/cases/:id', (req, res) => {
  const stmt = db.prepare('SELECT * FROM test_cases WHERE id = ?');
  const testCase = stmt.get(req.params.id);

  if (!testCase) {
    return res.status(404).json({ error: 'Test case not found' });
  }

  testCase.expected_keywords = parseJsonField(testCase.expected_keywords, []);
  testCase.expected_phrases = parseJsonField(testCase.expected_phrases, []);
  res.json(testCase);
});

router.post('/cases', (req, res) => {
  const { name, description, script_text, expected_emotion, expected_style, expected_keywords, expected_phrases, reference_audio_id } = req.body;

  if (!name || !script_text) {
    return res.status(400).json({ error: 'Name and script_text are required' });
  }

  const stmt = db.prepare(`
    INSERT INTO test_cases (name, description, script_text, expected_emotion, expected_style, expected_keywords, expected_phrases, reference_audio_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    name,
    description || '',
    script_text,
    expected_emotion || '',
    expected_style || '',
    JSON.stringify(expected_keywords || []),
    JSON.stringify(expected_phrases || []),
    reference_audio_id || null
  );

  const testCase = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(result.lastInsertRowid);
  if (testCase) {
    testCase.expected_keywords = parseJsonField(testCase.expected_keywords, []);
    testCase.expected_phrases = parseJsonField(testCase.expected_phrases, []);
  }
  res.status(201).json(testCase);
});

router.put('/cases/:id', (req, res) => {
  const { name, description, script_text, expected_emotion, expected_style, expected_keywords, expected_phrases, reference_audio_id } = req.body;
  const id = req.params.id;

  const existing = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Test case not found' });
  }

  const oldKeywords = parseJsonField(existing.expected_keywords, []);
  const oldPhrases = parseJsonField(existing.expected_phrases, []);

  const stmt = db.prepare(`
    UPDATE test_cases 
    SET name = ?, description = ?, script_text = ?, expected_emotion = ?, expected_style = ?, expected_keywords = ?, expected_phrases = ?, reference_audio_id = ?
    WHERE id = ?
  `);
  stmt.run(
    name || existing.name,
    description !== undefined ? description : existing.description,
    script_text || existing.script_text,
    expected_emotion !== undefined ? expected_emotion : existing.expected_emotion,
    expected_style !== undefined ? expected_style : existing.expected_style,
    expected_keywords !== undefined ? JSON.stringify(expected_keywords) : JSON.stringify(oldKeywords),
    expected_phrases !== undefined ? JSON.stringify(expected_phrases) : JSON.stringify(oldPhrases),
    reference_audio_id !== undefined ? reference_audio_id : existing.reference_audio_id,
    id
  );

  const updated = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(id);
  if (updated) {
    updated.expected_keywords = parseJsonField(updated.expected_keywords, []);
    updated.expected_phrases = parseJsonField(updated.expected_phrases, []);
  }
  res.json(updated);
});

router.delete('/cases/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM test_cases WHERE id = ?');
  const result = stmt.run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Test case not found' });
  }

  res.json({ message: 'Test case deleted successfully' });
});

router.get('/sets', (req, res) => {
  const { page = 1, pageSize = 20 } = req.query;
  const offset = (page - 1) * pageSize;

  const totalStmt = db.prepare('SELECT COUNT(*) as total FROM test_sets');
  const { total } = totalStmt.get();

  const stmt = db.prepare(`
    SELECT ts.*, 
           COUNT(tsc.test_case_id) as case_count
    FROM test_sets ts
    LEFT JOIN test_set_cases tsc ON ts.id = tsc.test_set_id
    GROUP BY ts.id
    ORDER BY ts.created_at DESC 
    LIMIT ? OFFSET ?
  `);
  const sets = stmt.all(Number(pageSize), offset);

  res.json({
    list: sets,
    total,
    page: Number(page),
    pageSize: Number(pageSize)
  });
});

router.get('/sets/:id', (req, res) => {
  const testSet = db.prepare('SELECT * FROM test_sets WHERE id = ?').get(req.params.id);

  if (!testSet) {
    return res.status(404).json({ error: 'Test set not found' });
  }

  const cases = db.prepare(`
    SELECT tc.*, tsc.sort_order
    FROM test_set_cases tsc
    JOIN test_cases tc ON tsc.test_case_id = tc.id
    WHERE tsc.test_set_id = ?
    ORDER BY tsc.sort_order ASC
  `).all(req.params.id).map(item => ({
    ...item,
    expected_keywords: parseJsonField(item.expected_keywords, []),
    expected_phrases: parseJsonField(item.expected_phrases, [])
  }));

  testSet.cases = cases;
  res.json(testSet);
});

router.post('/sets', (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const stmt = db.prepare('INSERT INTO test_sets (name, description) VALUES (?, ?)');
  const result = stmt.run(name, description || '');

  const testSet = db.prepare('SELECT * FROM test_sets WHERE id = ?').get(result.lastInsertRowid);
  testSet.cases = [];
  res.status(201).json(testSet);
});

router.put('/sets/:id', (req, res) => {
  const { name, description } = req.body;
  const id = req.params.id;

  const existing = db.prepare('SELECT * FROM test_sets WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Test set not found' });
  }

  const stmt = db.prepare('UPDATE test_sets SET name = ?, description = ? WHERE id = ?');
  stmt.run(name || existing.name, description !== undefined ? description : existing.description, id);

  const updated = db.prepare('SELECT * FROM test_sets WHERE id = ?').get(id);
  res.json(updated);
});

router.delete('/sets/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM test_sets WHERE id = ?');
  const result = stmt.run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Test set not found' });
  }

  res.json({ message: 'Test set deleted successfully' });
});

router.post('/sets/:id/cases', (req, res) => {
  const { id } = req.params;
  const { case_ids = [] } = req.body;

  const testSet = db.prepare('SELECT * FROM test_sets WHERE id = ?').get(id);
  if (!testSet) {
    return res.status(404).json({ error: 'Test set not found' });
  }

  const insertStmt = db.prepare('INSERT OR IGNORE INTO test_set_cases (test_set_id, test_case_id, sort_order) VALUES (?, ?, ?)');
  
  case_ids.forEach((caseId, index) => {
    insertStmt.run(id, caseId, index);
  });

  const cases = db.prepare(`
    SELECT tc.*, tsc.sort_order
    FROM test_set_cases tsc
    JOIN test_cases tc ON tsc.test_case_id = tc.id
    WHERE tsc.test_set_id = ?
    ORDER BY tsc.sort_order ASC
  `).all(id).map(item => ({
    ...item,
    expected_keywords: parseJsonField(item.expected_keywords, []),
    expected_phrases: parseJsonField(item.expected_phrases, [])
  }));

  res.json({ message: 'Cases added to test set', cases });
});

router.delete('/sets/:id/cases/:caseId', (req, res) => {
  const { id, caseId } = req.params;

  const stmt = db.prepare('DELETE FROM test_set_cases WHERE test_set_id = ? AND test_case_id = ?');
  const result = stmt.run(id, caseId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Case not found in test set' });
  }

  res.json({ message: 'Case removed from test set' });
});

router.post('/runs', async (req, res) => {
  const { test_set_id, prompt_template_id, model_id } = req.body;

  if (!test_set_id || !prompt_template_id || !model_id) {
    return res.status(400).json({ error: 'test_set_id, prompt_template_id, and model_id are required' });
  }

  const testSet = db.prepare('SELECT * FROM test_sets WHERE id = ?').get(test_set_id);
  if (!testSet) {
    return res.status(404).json({ error: 'Test set not found' });
  }

  const promptTemplate = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(prompt_template_id);
  if (!promptTemplate) {
    return res.status(404).json({ error: 'Prompt template not found' });
  }

  const model = db.prepare('SELECT * FROM llm_models WHERE id = ?').get(model_id);
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }

  const cases = db.prepare(`
    SELECT tc.*
    FROM test_set_cases tsc
    JOIN test_cases tc ON tsc.test_case_id = tc.id
    WHERE tsc.test_set_id = ?
    ORDER BY tsc.sort_order ASC
  `).all(test_set_id);

  const insertRun = db.prepare(`
    INSERT INTO test_runs (test_set_id, prompt_template_id, model_id, status, total_cases)
    VALUES (?, ?, ?, 'running', ?)
  `);
  const result = insertRun.run(test_set_id, prompt_template_id, model_id, cases.length);
  const runId = result.lastInsertRowid;

  db.prepare('UPDATE test_runs SET started_at = CURRENT_TIMESTAMP WHERE id = ?').run(runId);

  res.json({
    id: runId,
    status: 'running',
    total_cases: cases.length,
    message: 'Test run started'
  });

  processTestRun(runId, cases, promptTemplate, model).catch(err => {
    console.error('Test run failed:', err);
    db.prepare('UPDATE test_runs SET status = ?, failed_cases = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('failed', cases.length, runId);
  });
});

async function processTestRun(runId, cases, promptTemplate, model) {
  let passed = 0;
  let failed = 0;

  const insertResult = db.prepare(`
    INSERT INTO test_results (test_run_id, test_case_id, model_output, detected_emotion, detected_style, matched_audio_id, match_score, evaluation_score, keyword_score, emotion_score, style_score, keyword_match_details, evaluation_details, status, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const testCase of cases) {
    try {
      let userPrompt = promptTemplate.user_prompt_template;
      userPrompt = userPrompt.replace(/\{\{script_text\}\}/g, testCase.script_text);
      userPrompt = userPrompt.replace(/\{\{expected_emotion\}\}/g, testCase.expected_emotion || '');
      userPrompt = userPrompt.replace(/\{\{expected_style\}\}/g, testCase.expected_style || '');

      const response = await modelService.chatCompletion({
        api_base: model.api_base,
        api_key: model.api_key,
        model: model.model_name,
        endpoint: model.endpoint,
        system_prompt: promptTemplate.system_prompt,
        user_prompt: userPrompt
      });

      const modelOutput = response.content || '';
      
      const { emotion, style } = modelService.extractEmotionStyle(modelOutput);

      const matchResult = audioService.matchAudio(emotion, style, 1);
      const matchedAudio = matchResult.matches[0] || null;

      const expectedKeywords = parseJsonField(testCase.expected_keywords, []);
      const expectedPhrases = parseJsonField(testCase.expected_phrases, []);

      const emotionStyleResult = modelService.calculateEvaluationScore({
        expected_emotion: testCase.expected_emotion,
        expected_style: testCase.expected_style,
        detected_emotion: emotion,
        detected_style: style
      });

      const keywordResult = modelService.calculateKeywordScore(modelOutput, expectedKeywords, expectedPhrases);

      const evalScore = modelService.calculateFinalEvaluation(emotionStyleResult, keywordResult);

      if (evalScore >= 0.6) {
        passed++;
      } else {
        failed++;
      }

      insertResult.run(
        runId,
        testCase.id,
        modelOutput,
        emotion,
        style,
        matchedAudio ? matchedAudio.id : null,
        matchedAudio ? matchedAudio.match_score : 0,
        evalScore,
        keywordResult.score,
        emotionStyleResult.emotionScore,
        emotionStyleResult.styleScore,
        JSON.stringify(keywordResult),
        JSON.stringify({
          emotion_match: emotion === testCase.expected_emotion,
          style_match: style === testCase.expected_style,
          emotion_details: emotionStyleResult,
          keyword_details: keywordResult
        }),
        'completed',
        null
      );

    } catch (error) {
      failed++;
      insertResult.run(
        runId,
        testCase.id,
        null,
        null,
        null,
        null,
        0,
        0,
        0,
        0,
        0,
        null,
        null,
        'failed',
        error.message
      );
    }
  }

  db.prepare(`
    UPDATE test_runs 
    SET status = 'completed', passed_cases = ?, failed_cases = ?, completed_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(passed, failed, runId);
}

router.get('/runs', (req, res) => {
  const { page = 1, pageSize = 20, status, test_set_id } = req.query;
  const offset = (page - 1) * pageSize;

  let whereClauses = [];
  let params = [];

  if (status) {
    whereClauses.push('tr.status = ?');
    params.push(status);
  }
  if (test_set_id) {
    whereClauses.push('tr.test_set_id = ?');
    params.push(test_set_id);
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const totalStmt = db.prepare(`SELECT COUNT(*) as total FROM test_runs tr ${whereSql}`);
  const { total } = totalStmt.get(...params);

  const stmt = db.prepare(`
    SELECT tr.*, 
           ts.name as test_set_name,
           pt.name as prompt_template_name,
           lm.name as model_name
    FROM test_runs tr
    LEFT JOIN test_sets ts ON tr.test_set_id = ts.id
    LEFT JOIN prompt_templates pt ON tr.prompt_template_id = pt.id
    LEFT JOIN llm_models lm ON tr.model_id = lm.id
    ${whereSql}
    ORDER BY tr.created_at DESC 
    LIMIT ? OFFSET ?
  `);
  const runs = stmt.all(...params, Number(pageSize), offset);

  res.json({
    list: runs,
    total,
    page: Number(page),
    pageSize: Number(pageSize)
  });
});

router.get('/runs/:id', (req, res) => {
  const run = db.prepare(`
    SELECT tr.*, 
           ts.name as test_set_name,
           pt.name as prompt_template_name,
           pt.system_prompt,
           pt.user_prompt_template,
           lm.name as model_name,
           lm.model_name as model_identifier
    FROM test_runs tr
    LEFT JOIN test_sets ts ON tr.test_set_id = ts.id
    LEFT JOIN prompt_templates pt ON tr.prompt_template_id = pt.id
    LEFT JOIN llm_models lm ON tr.model_id = lm.id
    WHERE tr.id = ?
  `).get(req.params.id);

  if (!run) {
    return res.status(404).json({ error: 'Test run not found' });
  }

  const results = db.prepare(`
    SELECT tr.*, 
           tc.name as test_case_name,
           tc.script_text,
           tc.expected_emotion,
           tc.expected_style,
           tc.expected_keywords,
           tc.expected_phrases,
           aa.original_name as matched_audio_name,
           aa.filename as matched_audio_filename
    FROM test_results tr
    LEFT JOIN test_cases tc ON tr.test_case_id = tc.id
    LEFT JOIN audio_assets aa ON tr.matched_audio_id = aa.id
    WHERE tr.test_run_id = ?
    ORDER BY tr.created_at ASC
  `).all(req.params.id).map(item => ({
    ...item,
    evaluation_details: parseJsonField(item.evaluation_details, {}),
    keyword_match_details: parseJsonField(item.keyword_match_details, {}),
    expected_keywords: parseJsonField(item.expected_keywords, []),
    expected_phrases: parseJsonField(item.expected_phrases, []),
    matched_audio_url: item.matched_audio_filename ? `/uploads/audio/${item.matched_audio_filename}` : null
  }));

  run.results = results;
  res.json(run);
});

router.get('/runs/:id/compare', (req, res) => {
  const { run_ids } = req.query;
  
  if (!run_ids) {
    return res.status(400).json({ error: 'run_ids query parameter is required (comma-separated)' });
  }

  const runIdList = run_ids.split(',').map(id => Number(id.trim())).filter(Boolean);
  
  if (runIdList.length < 2) {
    return res.status(400).json({ error: 'At least 2 run IDs are required for comparison' });
  }

  const runs = [];
  const allCaseIds = new Set();

  for (const runId of runIdList) {
    const run = db.prepare(`
      SELECT tr.*, 
             ts.name as test_set_name,
             pt.name as prompt_template_name,
             lm.name as model_name
      FROM test_runs tr
      LEFT JOIN test_sets ts ON tr.test_set_id = ts.id
      LEFT JOIN prompt_templates pt ON tr.prompt_template_id = pt.id
      LEFT JOIN llm_models lm ON tr.model_id = lm.id
      WHERE tr.id = ?
    `).get(runId);

    if (run) {
      const results = db.prepare(`
        SELECT tr.*, tc.name as test_case_name, tc.script_text
        FROM test_results tr
        LEFT JOIN test_cases tc ON tr.test_case_id = tc.id
        WHERE tr.test_run_id = ?
      `).all(runId);

      results.forEach(r => allCaseIds.add(r.test_case_id));
      run.results = results;
      runs.push(run);
    }
  }

  const comparison = {
    runs: runs.map(r => ({
      id: r.id,
      name: `${r.model_name} - ${r.prompt_template_name}`,
      status: r.status,
      total_cases: r.total_cases,
      passed_cases: r.passed_cases,
      failed_cases: r.failed_cases,
      avg_score: r.results.length > 0 
        ? r.results.reduce((sum, r) => sum + (r.evaluation_score || 0), 0) / r.results.length 
        : 0
    })),
    case_ids: Array.from(allCaseIds)
  };

  res.json(comparison);
});

module.exports = router;
