require('dotenv').config();
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const apiRoutes = require('./routes/api');
const { runScheduler } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;
const POLL_MINUTES = parseInt(process.env.POLL_INTERVAL_MINUTES, 10) || 2;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

cron.schedule(`*/${POLL_MINUTES} * * * *`, () => {
  console.log(`[${new Date().toISOString()}] Rulare scheduler...`);
  runScheduler().catch((err) => console.error('Scheduler error:', err));
});

app.listen(PORT, () => {
  console.log(`Server pornit pe http://localhost:${PORT}`);
  console.log(`Scheduler: la fiecare ${POLL_MINUTES} minute`);
  setTimeout(() => {
    runScheduler().catch((err) => console.error('Initial run error:', err));
  }, 3000);
});
