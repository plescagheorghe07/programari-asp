const TOKEN_KEY = 'dimtcca_token';

let token = localStorage.getItem(TOKEN_KEY);

const addForm = document.getElementById('add-form');
const addError = document.getElementById('add-error');
const appointmentsBody = document.getElementById('appointments-body');
const statsEl = document.getElementById('stats');
const logsModal = document.getElementById('logs-modal');
const logsList = document.getElementById('logs-list');
const userEmailEl = document.getElementById('user-email');

function defaultMinDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/login';
    throw new Error('Sesiune expirată');
  }
  if (!res.ok) throw new Error(data.error || 'Eroare server');
  return data;
}

async function init() {
  document.getElementById('min-date').value = defaultMinDate();
  try {
    const me = await api('/me');
    userEmailEl.textContent = me.user.email;
    loadAppointments();
  } catch {
    window.location.href = '/login';
  }
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  } catch { /* ignore */ }
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = '/login';
});

document.getElementById('refresh-btn').addEventListener('click', loadAppointments);
document.getElementById('close-logs').addEventListener('click', () => logsModal.classList.add('hidden'));

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  addError.classList.add('hidden');
  const url = document.getElementById('url').value.trim();
  const minDate = document.getElementById('min-date').value;
  const maxDate = document.getElementById('max-date').value;
  try {
    await api('/appointments', {
      method: 'POST',
      body: JSON.stringify({ url, minDate, maxDate: maxDate || null }),
    });
    document.getElementById('url').value = '';
    document.getElementById('max-date').value = '';
    loadAppointments();
  } catch (err) {
    addError.textContent = err.message;
    addError.classList.remove('hidden');
  }
});

function statusBadge(a) {
  if (a.isDone) return '<span class="badge badge-done">Finalizat</span>';
  const map = {
    waiting: 'badge-waiting',
    error: 'badge-error',
    pending: 'badge-pending',
    booked: 'badge-done',
  };
  const cls = map[a.lastStatus] || 'badge-pending';
  const label = {
    waiting: 'În așteptare',
    error: 'Eroare',
    pending: 'Nou',
    booked: 'Programat',
  }[a.lastStatus] || a.lastStatus;
  return `<span class="badge ${cls}">${label}</span>`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso + (iso.includes('T') ? '' : 'Z')).toLocaleString('ro-MD', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateOnly(value) {
  if (!value) return '—';
  return value;
}

async function loadAppointments() {
  try {
    const appointments = await api('/appointments');
    renderStats(appointments);
    renderTable(appointments);
  } catch (err) {
    console.error(err);
  }
}

function renderStats(appointments) {
  const total = appointments.length;
  const done = appointments.filter((a) => a.isDone).length;
  const active = appointments.filter((a) => !a.isDone && a.isActive).length;
  const paid = appointments.filter((a) => a.isPaid).length;

  statsEl.innerHTML = `
    <div class="stat-card"><div class="value">${total}</div><div class="label">Total</div></div>
    <div class="stat-card"><div class="value">${active}</div><div class="label">Active</div></div>
    <div class="stat-card"><div class="value">${done}</div><div class="label">Finalizate</div></div>
    <div class="stat-card"><div class="value">${paid}</div><div class="label">Plătite</div></div>
  `;
}

function renderTable(appointments) {
  if (!appointments.length) {
    appointmentsBody.innerHTML = '<tr><td colspan="12" class="muted">Nicio programare adăugată.</td></tr>';
    return;
  }

  appointmentsBody.innerHTML = appointments.map((a) => `
    <tr data-id="${a.id}">
      <td><span class="person-name">${esc(a.personName || '—')}</span></td>
      <td class="muted">${esc(a.requestNumber || '—')}</td>
      <td title="${esc(a.locationName || '')}">${esc(truncate(a.locationName, 30))}</td>
      <td>
        <input type="date" class="min-date-input" data-id="${a.id}" value="${esc(a.minDate || '')}">
      </td>
      <td>
        <input type="date" class="max-date-input" data-id="${a.id}" value="${esc(a.maxDate || '')}">
      </td>
      <td>${statusBadge(a)}</td>
      <td>
        <label class="switch">
          <input type="checkbox" class="paid-toggle" data-id="${a.id}" ${a.isPaid ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </td>
      <td>
        <label class="switch">
          <input type="checkbox" class="active-toggle" data-id="${a.id}" ${a.isActive ? 'checked' : ''} ${a.isDone ? 'disabled' : ''}>
          <span class="slider"></span>
        </label>
      </td>
      <td>${a.bookedDate ? `${a.bookedDate} ${a.bookedTime || ''}` : '—'}</td>
      <td class="muted">${formatDate(a.lastCheckAt)}</td>
      <td class="muted">${formatDate(a.createdAt)}</td>
      <td class="actions-cell">
        <button class="btn-secondary btn-small run-btn" data-id="${a.id}" ${a.isDone ? 'disabled' : ''}>Rulează</button>
        <button class="btn-secondary btn-small logs-btn" data-id="${a.id}">Jurnal</button>
        <button class="btn-danger btn-small delete-btn" data-id="${a.id}">Șterge</button>
      </td>
    </tr>
  `).join('');

  bindTableEvents();
}

async function saveDateRange(id) {
  const row = document.querySelector(`tr[data-id="${id}"]`);
  const minDate = row.querySelector('.min-date-input').value;
  const maxDate = row.querySelector('.max-date-input').value;
  await api(`/appointments/${id}/date-range`, {
    method: 'PATCH',
    body: JSON.stringify({ minDate, maxDate: maxDate || null }),
  });
}

function bindTableEvents() {
  document.querySelectorAll('.paid-toggle').forEach((el) => {
    el.addEventListener('change', async () => {
      const id = el.dataset.id;
      try {
        await api(`/appointments/${id}/paid`, {
          method: 'PATCH',
          body: JSON.stringify({ isPaid: el.checked }),
        });
        loadAppointments();
      } catch (err) { alert(err.message); el.checked = !el.checked; }
    });
  });

  document.querySelectorAll('.active-toggle').forEach((el) => {
    el.addEventListener('change', async () => {
      const id = el.dataset.id;
      try {
        await api(`/appointments/${id}/active`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: el.checked }),
        });
        loadAppointments();
      } catch (err) { alert(err.message); el.checked = !el.checked; }
    });
  });

  document.querySelectorAll('.min-date-input, .max-date-input').forEach((el) => {
    el.addEventListener('change', async () => {
      const id = el.dataset.id;
      try {
        await saveDateRange(id);
      } catch (err) { alert(err.message); loadAppointments(); }
    });
  });

  document.querySelectorAll('.run-btn').forEach((el) => {
    el.addEventListener('click', async () => {
      el.disabled = true;
      el.textContent = '...';
      try {
        await api(`/appointments/${el.dataset.id}/run`, { method: 'POST' });
        loadAppointments();
      } catch (err) { alert(err.message); }
      el.disabled = false;
      el.textContent = 'Rulează';
    });
  });

  document.querySelectorAll('.logs-btn').forEach((el) => {
    el.addEventListener('click', () => showLogs(el.dataset.id));
  });

  document.querySelectorAll('.delete-btn').forEach((el) => {
    el.addEventListener('click', async () => {
      if (!confirm('Ștergi această programare?')) return;
      try {
        await api(`/appointments/${el.dataset.id}`, { method: 'DELETE' });
        loadAppointments();
      } catch (err) { alert(err.message); }
    });
  });
}

async function showLogs(id) {
  logsList.innerHTML = '<p class="muted">Se încarcă...</p>';
  logsModal.classList.remove('hidden');
  try {
    const logs = await api(`/appointments/${id}/logs`);
    if (!logs.length) {
      logsList.innerHTML = '<p class="muted">Niciun eveniment.</p>';
      return;
    }
    logsList.innerHTML = logs.map((l) => `
      <div class="log-item ${l.level}">
        <div class="time">${formatDate(l.created_at)}</div>
        <div class="msg">${esc(l.message)}</div>
      </div>
    `).join('');
  } catch (err) {
    logsList.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function truncate(str, len) {
  if (!str) return '—';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

init();
setInterval(loadAppointments, 30000);
