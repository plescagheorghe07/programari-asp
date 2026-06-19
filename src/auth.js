const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_EXPIRY = '7d';

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET lipsă sau prea scurt (minim 32 caractere)');
  }
  return secret;
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    getSecret(),
    { expiresIn: JWT_EXPIRY }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

function extractToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  if (req.cookies?.auth_token) {
    return req.cookies.auth_token;
  }
  return null;
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Neautorizat' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Sesiune expirată' });
  }

  const user = db.getUserById(payload.sub);
  if (!user) {
    return res.status(401).json({ error: 'Utilizator invalid' });
  }

  req.user = { id: user.id, email: user.email };
  next();
}

function requireAuthPage(req, res, next) {
  const token = extractToken(req);
  if (!token || !verifyToken(token)) {
    return res.redirect('/login');
  }
  next();
}

module.exports = {
  signToken,
  verifyToken,
  extractToken,
  requireAuth,
  requireAuthPage,
};
