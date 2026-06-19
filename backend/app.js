const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const db = require('./db/database');

const promptRoutes = require('./routes/prompts');
const audioRoutes = require('./routes/audio');
const testRoutes = require('./routes/tests');
const modelRoutes = require('./routes/models');

app.use('/api/prompts', promptRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/models', modelRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Prompt Evaluation API is running' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

async function startServer() {
  try {
    await db.initDatabase();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
