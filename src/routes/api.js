const express = require('express');
const db = require('../db');
const api = require('../services/eserviciiApi');
const { processAppointment } = require('../services/scheduler');

const router = express.Router();

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  const password = process.env.ADMIN_PASSWORD || 'admin';
  if (auth === `Bearer ${password}`) return next();
  res.status(401).json({ error: 'Neautorizat' });
}

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === (process.env.ADMIN_PASSWORD || 'admin')) {
    return res.json({ ok: true, token: password });
  }
  res.status(401).json({ error: 'Parolă incorectă' });
});

router.use(requireAuth);

router.get('/appointments', (req, res) => {
  const appointments = db.getAllAppointments().map(formatAppointment);
  res.json(appointments);
});

router.post('/appointments', async (req, res) => {
  try {
    const { url, minDaysDiff } = req.body;
    if (!url) return res.status(400).json({ error: 'URL obligatoriu' });

    const { requestType, requestId } = api.parseUrl(url);
    const requestData = await api.getRequest(requestType, requestId);

    const id = db.createAppointment({
      url: url.trim(),
      requestType,
      requestId,
      personName: requestData.requestor?.fullName,
      requestNumber: requestData.requestNumber,
      locationName: requestData.serviceRequest?.examinationLocation?.name,
      minDaysDiff: parseInt(minDaysDiff, 10) || 14,
      requestData,
    });

    db.addLog(id, 'info', 'Programare adăugată în sistem.');

    if (requestData.hasAppointment) {
      db.markDone(
        id,
        requestData.serviceRequest?.examinationDate,
        requestData.serviceRequest?.examinationTime?.time
      );
      db.addLog(id, 'success', 'Cererea are deja programare.');
    }

    res.json({ ok: true, id, appointment: formatAppointment(db.getAppointmentById(id)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/appointments/:id/paid', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const appointment = db.getAppointmentById(id);
  if (!appointment) return res.status(404).json({ error: 'Negăsit' });

  db.setPaid(id, !!req.body.isPaid);
  res.json({ ok: true, appointment: formatAppointment(db.getAppointmentById(id)) });
});

router.patch('/appointments/:id/active', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const appointment = db.getAppointmentById(id);
  if (!appointment) return res.status(404).json({ error: 'Negăsit' });

  db.setActive(id, !!req.body.isActive);
  res.json({ ok: true, appointment: formatAppointment(db.getAppointmentById(id)) });
});

router.patch('/appointments/:id/min-days', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const appointment = db.getAppointmentById(id);
  if (!appointment) return res.status(404).json({ error: 'Negăsit' });

  const days = parseInt(req.body.minDaysDiff, 10);
  if (isNaN(days) || days < 0) {
    return res.status(400).json({ error: 'Zile minime invalide' });
  }

  db.setMinDays(id, days);
  res.json({ ok: true, appointment: formatAppointment(db.getAppointmentById(id)) });
});

router.post('/appointments/:id/run', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const appointment = db.getAppointmentById(id);
  if (!appointment) return res.status(404).json({ error: 'Negăsit' });

  try {
    await processAppointment(appointment);
    res.json({ ok: true, appointment: formatAppointment(db.getAppointmentById(id)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/appointments/:id/logs', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const appointment = db.getAppointmentById(id);
  if (!appointment) return res.status(404).json({ error: 'Negăsit' });

  res.json(db.getLogs(id, 100));
});

router.delete('/appointments/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const appointment = db.getAppointmentById(id);
  if (!appointment) return res.status(404).json({ error: 'Negăsit' });

  db.deleteAppointment(id);
  res.json({ ok: true });
});

function formatAppointment(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    requestType: row.request_type,
    requestId: row.request_id,
    personName: row.person_name,
    requestNumber: row.request_number,
    locationName: row.location_name,
    minDaysDiff: row.min_days_diff,
    isDone: !!row.is_done,
    isPaid: !!row.is_paid,
    isActive: !!row.is_active,
    bookedDate: row.booked_date,
    bookedTime: row.booked_time,
    lastCheckAt: row.last_check_at,
    lastError: row.last_error,
    lastStatus: row.last_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = router;
