require('dotenv').config();
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const apiRoutes = require('./routes/api');
const { runScheduler } = require('./services/scheduler');
const { extractToken, verifyToken } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3005;
const POLL_MINUTES = parseInt(process.env.POLL_INTERVAL_MINUTES, 10) || 2;
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

function isAuthenticated(req) {
  const token = extractToken(req);
  return token && verifyToken(token);
}

app.use('/api', apiRoutes);

app.get('/login', (req, res) => {
  if (isAuthenticated(req)) return res.redirect('/');
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

const PUBLIC_PATHS = new Set(['/login', '/login.js', '/styles.css']);

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (PUBLIC_PATHS.has(req.path)) return next();
  if (!isAuthenticated(req)) {
    if (req.path === '/' || req.path === '/index.html') {
      return res.redirect('/login');
    }
    return res.status(401).send('Neautorizat');
  }
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

cron.schedule(`*/${POLL_MINUTES} * * * *`, () => {
  console.log(`[${new Date().toISOString()}] Rulare scheduler...`);
  runScheduler().catch((err) => console.error('Scheduler error:', err));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server pornit pe http://127.0.0.1:${PORT}`);
  console.log(`Scheduler: la fiecare ${POLL_MINUTES} minute`);
  setTimeout(() => {
    runScheduler().catch((err) => console.error('Initial run error:', err));
  }, 3000);
});
