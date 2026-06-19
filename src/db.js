const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'appointments.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    request_type TEXT NOT NULL,
    request_id TEXT NOT NULL,
    person_name TEXT,
    request_number TEXT,
    location_name TEXT,
    min_days_diff INTEGER NOT NULL DEFAULT 14,
    is_done INTEGER NOT NULL DEFAULT 0,
    is_paid INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    booked_date TEXT,
    booked_time TEXT,
    last_check_at TEXT,
    last_error TEXT,
    last_status TEXT DEFAULT 'pending',
    request_data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(request_type, request_id)
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL,
    level TEXT NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const columns = db.prepare('PRAGMA table_info(appointments)').all().map((c) => c.name);
if (!columns.includes('min_date')) {
  db.exec('ALTER TABLE appointments ADD COLUMN min_date TEXT');
}
if (!columns.includes('max_date')) {
  db.exec('ALTER TABLE appointments ADD COLUMN max_date TEXT');
}
if (!columns.includes('is_finished')) {
  db.exec('ALTER TABLE appointments ADD COLUMN is_finished INTEGER NOT NULL DEFAULT 0');
}

const stmts = {
  getAll: db.prepare(`
    SELECT * FROM appointments ORDER BY created_at DESC
  `),
  getById: db.prepare('SELECT * FROM appointments WHERE id = ?'),
  getActive: db.prepare(`
    SELECT * FROM appointments WHERE is_finished = 0 AND is_active = 1
  `),
  insert: db.prepare(`
    INSERT INTO appointments (
      url, request_type, request_id, person_name, request_number,
      location_name, min_days_diff, min_date, max_date, request_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateAfterFetch: db.prepare(`
    UPDATE appointments SET
      person_name = ?, request_number = ?, location_name = ?,
      request_data = ?, updated_at = datetime('now')
    WHERE id = ?
  `),
  markDone: db.prepare(`
    UPDATE appointments SET
      is_done = 1, is_finished = 1, booked_date = ?, booked_time = ?,
      last_status = 'booked', last_error = NULL,
      updated_at = datetime('now')
    WHERE id = ?
  `),
  updateCheck: db.prepare(`
    UPDATE appointments SET
      last_check_at = datetime('now'),
      last_status = ?, last_error = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `),
  updatePaid: db.prepare(`
    UPDATE appointments SET is_paid = ?, updated_at = datetime('now') WHERE id = ?
  `),
  updateActive: db.prepare(`
    UPDATE appointments SET is_active = ?, updated_at = datetime('now') WHERE id = ?
  `),
  updateMinDays: db.prepare(`
    UPDATE appointments SET min_days_diff = ?, updated_at = datetime('now') WHERE id = ?
  `),
  updateDateRange: db.prepare(`
    UPDATE appointments SET
      min_date = ?, max_date = ?, updated_at = datetime('now')
    WHERE id = ?
  `),
  updateFinished: db.prepare(`
    UPDATE appointments SET
      is_finished = ?, is_done = ?, updated_at = datetime('now')
    WHERE id = ?
  `),
  delete: db.prepare('DELETE FROM appointments WHERE id = ?'),
  insertLog: db.prepare(`
    INSERT INTO logs (appointment_id, level, message) VALUES (?, ?, ?)
  `),
  getLogs: db.prepare(`
    SELECT * FROM logs WHERE appointment_id = ? ORDER BY created_at DESC LIMIT ?
  `),
  countUsers: db.prepare('SELECT COUNT(*) AS count FROM users'),
  getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  getUserById: db.prepare('SELECT id, email, created_at FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)'),
};

function seedDefaultUser() {
  const { count } = stmts.countUsers.get();
  if (count > 0) return;

  const email = 'plescagheorghe07@gmail.com';
  const passwordHash = bcrypt.hashSync('georgie6699', 12);
  stmts.insertUser.run(email, passwordHash);
  console.log(`Utilizator implicit creat: ${email}`);
}

function getUserByEmail(email) {
  return stmts.getUserByEmail.get(email);
}

function getUserById(id) {
  return stmts.getUserById.get(id);
}

function verifyUserPassword(email, password) {
  const user = getUserByEmail(email);
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return { id: user.id, email: user.email };
}

seedDefaultUser();

function getAllAppointments() {
  return stmts.getAll.all();
}

function getAppointmentById(id) {
  return stmts.getById.get(id);
}

function getActiveAppointments() {
  return stmts.getActive.all();
}

function createAppointment(data) {
  const result = stmts.insert.run(
    data.url,
    data.requestType,
    data.requestId,
    data.personName || null,
    data.requestNumber || null,
    data.locationName || null,
    data.minDaysDiff ?? 14,
    data.minDate || null,
    data.maxDate || null,
    data.requestData ? JSON.stringify(data.requestData) : null
  );
  return result.lastInsertRowid;
}

function updateAfterFetch(id, data) {
  stmts.updateAfterFetch.run(
    data.personName,
    data.requestNumber,
    data.locationName,
    JSON.stringify(data.requestData),
    id
  );
}

function markDone(id, date, time) {
  stmts.markDone.run(date, time, id);
}

function updateCheck(id, status, error) {
  stmts.updateCheck.run(status, error || null, id);
}

function setPaid(id, isPaid) {
  stmts.updatePaid.run(isPaid ? 1 : 0, id);
}

function setActive(id, isActive) {
  stmts.updateActive.run(isActive ? 1 : 0, id);
}

function setMinDays(id, days) {
  stmts.updateMinDays.run(days, id);
}

function setDateRange(id, minDate, maxDate) {
  stmts.updateDateRange.run(minDate || null, maxDate || null, id);
}

function setFinished(id, isFinished) {
  const val = isFinished ? 1 : 0;
  stmts.updateFinished.run(val, val, id);
}

function deleteAppointment(id) {
  stmts.delete.run(id);
}

function addLog(appointmentId, level, message) {
  stmts.insertLog.run(appointmentId, level, message);
}

function getLogs(appointmentId, limit = 50) {
  return stmts.getLogs.all(appointmentId, limit);
}

module.exports = {
  getAllAppointments,
  getAppointmentById,
  getActiveAppointments,
  createAppointment,
  updateAfterFetch,
  markDone,
  updateCheck,
  setPaid,
  setActive,
  setMinDays,
  setDateRange,
  setFinished,
  deleteAppointment,
  addLog,
  getLogs,
  getUserByEmail,
  getUserById,
  verifyUserPassword,
};
