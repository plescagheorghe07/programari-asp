const BASE_URL = 'https://eservicii.gov.md';

const DEFAULT_HEADERS = {
  Accept: '*/*',
  'Accept-Language': 'ro-MD',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
};

function getCookie() {
  return process.env.COOKIE || '';
}

function buildHeaders(referer) {
  const headers = { ...DEFAULT_HEADERS };
  const cookie = getCookie();
  if (cookie) headers.Cookie = cookie;
  if (referer) {
    headers.Referer = referer;
    headers.Origin = BASE_URL;
    headers['Sec-Fetch-Dest'] = 'empty';
    headers['Sec-Fetch-Mode'] = 'cors';
    headers['Sec-Fetch-Site'] = 'same-origin';
  }
  return headers;
}

function parseUrl(url) {
  const match = url.match(
    /eservicii\.gov\.md\/asp\/dimtcca\/cerere\/([A-Z0-9]+)\/([a-f0-9-]+)/i
  );
  if (!match) {
    throw new Error('Link invalid. Format așteptat: .../cerere/APO01/uuid');
  }
  return { requestType: match[1].toUpperCase(), requestId: match[2] };
}

async function fetchJson(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function getRequest(requestType, requestId) {
  const referer = `${BASE_URL}/asp/dimtcca/cerere/${requestType}/${requestId}`;
  return fetchJson(`/asp/dimtcca/api/fod/request/${requestType}/${requestId}`, {
    headers: buildHeaders(referer),
  });
}

async function getAvailableDates(publicServiceId, locationId, referer) {
  return fetchJson(
    `/asp/dimtcca/api/qmatic/dates/${publicServiceId}/${locationId}`,
    { headers: buildHeaders(referer) }
  );
}

async function getAvailableTimes(publicServiceId, locationId, date, referer) {
  return fetchJson(
    `/asp/dimtcca/api/qmatic/times/${publicServiceId}/${locationId}/${date}`,
    { headers: buildHeaders(referer) }
  );
}

function buildAppointmentPayload(requestData, date, timeSlot) {
  const payload = JSON.parse(JSON.stringify(requestData));
  payload.termsAndConditionsAccepted = true;
  payload.serviceRequest.examinationDate = date;
  payload.serviceRequest.examinationTime = {
    time: timeSlot.time,
    id: timeSlot.id,
    name: timeSlot.name,
  };
  payload.serviceRequest.isMakingAppointment = true;
  return payload;
}

async function validateAppointment(payload, referer) {
  return fetchJson('/asp/dimtcca/api/apo-request/validate-appointment', {
    method: 'POST',
    headers: {
      ...buildHeaders(referer),
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });
}

async function confirmAppointment(payload, referer) {
  return fetchJson('/asp/dimtcca/api/qmatic/confirm', {
    method: 'POST',
    headers: {
      ...buildHeaders(referer),
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });
}

function filterDatesByMinDays(dates, minDaysDiff) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const min = new Date(today);
  min.setDate(min.getDate() + minDaysDiff);
  const minStr = min.toISOString().slice(0, 10);
  return filterDatesByRange(dates, minStr, null);
}

function filterDatesByRange(dates, minDate, maxDate) {
  return dates
    .filter((d) => {
      if (!d.timeSlots || d.timeSlots <= 0) return false;
      if (minDate && d.date < minDate) return false;
      if (maxDate && d.date > maxDate) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = {
  parseUrl,
  getRequest,
  getAvailableDates,
  getAvailableTimes,
  buildAppointmentPayload,
  validateAppointment,
  confirmAppointment,
  filterDatesByMinDays,
  filterDatesByRange,
};
