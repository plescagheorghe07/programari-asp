const db = require('../db');
const api = require('./eserviciiApi');

let isRunning = false;

function resolveDateRange(appointment) {
  if (appointment.min_date || appointment.max_date) {
    return {
      minDate: appointment.min_date || null,
      maxDate: appointment.max_date || null,
      label: `${appointment.min_date || '—'} … ${appointment.max_date || '—'}`,
    };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const min = new Date(today);
  min.setDate(min.getDate() + (appointment.min_days_diff || 14));
  return {
    minDate: min.toISOString().slice(0, 10),
    maxDate: null,
    label: `min ${appointment.min_days_diff || 14} zile`,
  };
}

async function processAppointment(appointment) {
  const referer = appointment.url;
  const { minDate, maxDate, label } = resolveDateRange(appointment);

  let requestData;
  try {
    requestData = appointment.request_data
      ? JSON.parse(appointment.request_data)
      : await api.getRequest(appointment.request_type, appointment.request_id);
  } catch (err) {
    db.updateCheck(appointment.id, 'error', err.message);
    db.addLog(appointment.id, 'error', `Eroare la încărcare cerere: ${err.message}`);
    return;
  }

  db.updateAfterFetch(appointment.id, {
    personName: requestData.requestor?.fullName || requestData.requestor
      ? `${requestData.requestor.requestorFirstName} ${requestData.requestor.requestorLastName}`
      : null,
    requestNumber: requestData.requestNumber,
    locationName: requestData.serviceRequest?.examinationLocation?.name,
    requestData,
  });

  if (requestData.hasAppointment) {
    const extDate = requestData.serviceRequest?.examinationDate;
    const extTime = requestData.serviceRequest?.examinationTime?.time;
    db.addLog(
      appointment.id,
      'info',
      `Programare existentă pe eservicii (${extDate || '?'} ${extTime || ''}) — continuăm până reprogramăm noi.`
    );
  }

  const publicServiceId = requestData.serviceRequest?.publicServiceId;
  const locationId = requestData.serviceRequest?.examinationLocation?.publicId;

  if (!publicServiceId || !locationId) {
    const msg = 'Lipsesc publicServiceId sau locationId din cerere.';
    db.updateCheck(appointment.id, 'error', msg);
    db.addLog(appointment.id, 'error', msg);
    return;
  }

  let dates;
  try {
    dates = await api.getAvailableDates(publicServiceId, locationId, referer);
  } catch (err) {
    db.updateCheck(appointment.id, 'error', err.message);
    db.addLog(appointment.id, 'error', `Eroare la date disponibile: ${err.message}`);
    return;
  }

  const eligibleDates = api.filterDatesByRange(dates, minDate, maxDate);

  if (eligibleDates.length === 0) {
    db.updateCheck(appointment.id, 'waiting', null);
    db.addLog(
      appointment.id,
      'info',
      `Nicio dată eligibilă (${label}). ${dates.length} date totale găsite.`
    );
    return;
  }

  for (const dateEntry of eligibleDates) {
    let times;
    try {
      times = await api.getAvailableTimes(
        publicServiceId,
        locationId,
        dateEntry.date,
        referer
      );
    } catch (err) {
      db.addLog(
        appointment.id,
        'warn',
        `Eroare la ore pentru ${dateEntry.date}: ${err.message}`
      );
      continue;
    }

    if (!times || times.length === 0) continue;

    const timeSlot = times[0];
    const payload = api.buildAppointmentPayload(requestData, dateEntry.date, timeSlot);

    try {
      const validation = await api.validateAppointment(payload, referer);
      if (!validation.isValid) {
        const msg = validation.validations
          ?.map((v) => v.message)
          .filter(Boolean)
          .join('; ') || 'Validare eșuată';
        db.addLog(appointment.id, 'warn', `Validare eșuată ${dateEntry.date} ${timeSlot.time}: ${msg}`);
        continue;
      }

      const confirm = await api.confirmAppointment(payload, referer);
      if (confirm.meta?.statusCode === 201 || confirm.meta?.statusMessage === 'Success') {
        db.markDone(appointment.id, dateEntry.date, timeSlot.time);
        db.addLog(
          appointment.id,
          'success',
          `Programare confirmată: ${dateEntry.date} la ${timeSlot.time}`
        );
        return;
      }

      db.addLog(
        appointment.id,
        'warn',
        `Confirmare nereușită ${dateEntry.date}: ${confirm.meta?.message || JSON.stringify(confirm)}`
      );
    } catch (err) {
      db.addLog(
        appointment.id,
        'warn',
        `Eroare la programare ${dateEntry.date} ${timeSlot.time}: ${err.message}`
      );
    }
  }

  db.updateCheck(appointment.id, 'waiting', null);
  db.addLog(appointment.id, 'info', 'Verificare completă — nicio programare reușită încă.');
}

async function runScheduler() {
  if (isRunning) return;
  isRunning = true;

  try {
    const appointments = db.getActiveAppointments();
    for (const appointment of appointments) {
      try {
        await processAppointment(appointment);
      } catch (err) {
        db.updateCheck(appointment.id, 'error', err.message);
        db.addLog(appointment.id, 'error', `Eroare neașteptată: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  } finally {
    isRunning = false;
  }
}

module.exports = { runScheduler, processAppointment };
