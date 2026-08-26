/* ═══════════════════════════════════════════════════════════════
   Deutscher RP — Admin Panel App
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── State ────────────────────────────────────────────────────────
const state = {
  currentPage: 'dashboard',
  user: null,
  rollenData: null,
  verfahrenPage: 1,
  aktenPage: 1,
  refreshInterval: null,
};

// ── API Helper ───────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(path, opts);
  if (res.status === 401) {
    showLogin();
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Toast ────────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3500) {
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 280);
  }, duration);
}

// ── Navigation ───────────────────────────────────────────────────
function navigate(page) {
  state.currentPage = page;

  // Nav-Links
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Pages
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  // Topbar title
  const titles = {
    dashboard: 'Dashboard', rollen: 'Rollen-Konfiguration',
    settings: 'Server-Einstellungen', verfahren: 'Verfahren',
    akten: 'Akten', logs: 'Admin-Logs', admins: 'Admin-Benutzer',
  };
  document.getElementById('page-title').textContent = titles[page] || page;

  // Daten laden
  switch (page) {
    case 'dashboard': loadDashboard(); break;
    case 'rollen':    loadRollen();    break;
    case 'settings':  loadSettings();  break;
    case 'verfahren': loadVerfahren(); break;
    case 'akten':     loadAkten();     break;
    case 'logs':      loadLogs();      break;
    case 'admins':    loadAdmins();    break;
    case 'spieler':   loadSpieler();   break;
    case 'warns':     loadWarns();     break;
    case 'modlogs':   loadModLogs();   break;
    case 'chat':      loadChat();      break;
    case 'tiktok':    loadTikTok();    break;
  }

  // Sidebar auf Mobile schließen
  document.getElementById('sidebar').classList.remove('open');

  // URL-Hash
  history.replaceState(null, '', `#${page}`);
}

// ── Auth ─────────────────────────────────────────────────────────
function showLogin() {
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  if (state.refreshInterval) clearInterval(state.refreshInterval);
}

function showApp(user) {
  state.user = user;
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  // User-Info
  document.getElementById('user-name').textContent = user.username;
  document.getElementById('user-role').textContent = user.role;
  document.getElementById('user-avatar').textContent = user.username[0].toUpperCase();

  // Admins-Tab nur für Superadmin
  if (user.role !== 'superadmin') {
    document.getElementById('nav-admins').classList.add('hidden');
  }

  // Startseite
  const hash = location.hash.replace('#', '') || 'dashboard';
  navigate(hash);

  // Auto-Refresh alle 60s
  state.refreshInterval = setInterval(() => {
    if (state.currentPage === 'dashboard') loadDashboard();
  }, 60000);
}

async function checkAuth() {
  try {
    const data = await api('GET', '/api/auth/me');
    if (data) {
      showApp(data);
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

// ── LOGIN FORM ───────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  btn.querySelector('.btn-text').textContent = 'Anmelden...';
  btn.disabled = true;

  try {
    const data = await api('POST', '/api/auth/login', {
      username: document.getElementById('login-username').value,
      password: document.getElementById('login-password').value,
    });
    if (data?.ok) {
      showApp(data);
    }
  } catch (err) {
    errEl.textContent = err.message || 'Login fehlgeschlagen';
    errEl.classList.remove('hidden');
  } finally {
    btn.querySelector('.btn-text').textContent = 'Anmelden';
    btn.disabled = false;
  }
});

// ── LOGOUT ───────────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('POST', '/api/auth/logout');
  showLogin();
  toast('Erfolgreich abgemeldet', 'info');
});

// ── SIDEBAR TOGGLE ───────────────────────────────────────────────
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});
document.getElementById('sidebar-close').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
});

// ── NAV CLICKS ───────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    navigate(el.dataset.page);
  });
});

// ════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════
async function loadDashboard() {
  try {
    const [statsData, logsData] = await Promise.all([
      api('GET', '/api/stats'),
      api('GET', '/api/logs'),
    ]);
    if (!statsData) return;

    // Stat-Cards
    document.getElementById('stat-verfahren').textContent = statsData.totalVerfahren;
    document.getElementById('stat-offen').textContent = statsData.offeneVerfahren;
    document.getElementById('stat-akten').textContent = statsData.totalAkten;
    document.getElementById('stat-rollen').textContent = `${statsData.konfigurierteRollen}/${statsData.totalRollen}`;
    document.getElementById('stat-members').textContent = (statsData.memberCount ?? 0).toLocaleString('de');
    document.getElementById('stat-ping').textContent = `${statsData.botPing} ms`;
    document.querySelectorAll('.stat-card').forEach(el => el.classList.remove('loading'));

    // Server-Info
    document.getElementById('info-guild').textContent = statsData.guildName;
    document.getElementById('info-status').textContent = statsData.botStatus;
    document.getElementById('info-ping').textContent = `${statsData.botPing} ms`;

    // Bot-Status Topbar
    const dot = document.getElementById('bot-status-dot');
    const statusText = document.getElementById('bot-status-text');
    const pingBadge = document.getElementById('ping-badge');
    if (statsData.botStatus === 'online') {
      dot.className = 'status-dot online';
      statusText.textContent = 'Online';
    } else {
      dot.className = 'status-dot offline';
      statusText.textContent = 'Offline';
    }
    pingBadge.textContent = `${statsData.botPing} ms`;

    // Letzte Logs
    if (logsData?.logs) {
      const container = document.getElementById('recent-logs');
      const recent = logsData.logs.slice(0, 8);
      if (recent.length === 0) {
        container.innerHTML = '<div class="loading-text">Keine Logs vorhanden</div>';
      } else {
        container.innerHTML = recent.map(l => `
          <div class="log-entry">
            <span class="log-time">${formatDate(l.erstellt_am, true)}</span>
            <span class="log-user">${escHtml(l.username)}</span>
            <span class="log-action">${escHtml(l.aktion)}</span>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    toast('Dashboard-Fehler: ' + err.message, 'error');
  }
}

// ════════════════════════════════════════════════════════════════
// ROLLEN
// ════════════════════════════════════════════════════════════════
const KATEGORIEN_META = {
  justiz:        { titel: '⚖️ Justiz',          keys: ['justizLeitung','oberRichter','richter','staatsanwalt','gerichtsschreiber','anwalt','justizAnwaerter'] },
  polizei:       { titel: '🚓 Polizei',          keys: ['polizeiLeitung','polizei','polizeiAnwaerter'] },
  feuerwehr:     { titel: '🚒 Feuerwehr',        keys: ['feuerwehrLeitung','feuerwehr','feuerwehrAnwaerter'] },
  rettungsdienst:{ titel: '🚑 Rettungsdienst',   keys: ['rettungsdienstLeitung','rettungsdienst','rettungsdienstAnwaerter'] },
  admin:         { titel: '🛡️ Administration',   keys: ['owner','coOwner','administrator','moderator'] },
};

async function loadRollen() {
  const container = document.getElementById('rollen-kategorien');
  container.innerHTML = '<div class="loading-text">Lädt...</div>';
  try {
    const data = await api('GET', '/api/rollen');
    if (!data) return;
    state.rollenData = data;
    renderRollen(data);
  } catch (err) {
    container.innerHTML = `<div class="loading-text">Fehler: ${escHtml(err.message)}</div>`;
  }
}

function renderRollen(data) {
  const container = document.getElementById('rollen-kategorien');
  const rollen = data.rollen || [];
  const discordRollen = data.discordRollen || [];
  const rollenMap = {};
  rollen.forEach(r => rollenMap[r.key] = r);

  // Optionen für Discord-Rollen
  const roleOptions = discordRollen
    .map(dr => `<option value="${dr.id}">${escHtml(dr.name)}</option>`)
    .join('');

  container.innerHTML = Object.entries(KATEGORIEN_META).map(([katKey, kat]) => `
    <div class="rollen-kategorie">
      <div class="kat-header" onclick="toggleKat(this)">
        <span>${kat.titel}</span>
        <span class="kat-toggle">▼</span>
      </div>
      <div class="kat-body">
        ${kat.keys.map(key => {
          const r = rollenMap[key];
          if (!r) return '';
          const currentId = r.roleId || '';
          return `
            <div class="rollen-row">
              <div class="rollen-info">
                <strong>${r.emoji} ${escHtml(r.label)}</strong>
                <small>${escHtml(r.beschreibung)}</small>
              </div>
              <select class="role-select" id="sel-role-${key}"
                      data-key="${key}" data-current="${currentId}">
                <option value="">— Nicht gesetzt —</option>
                ${discordRollen.map(dr =>
                  `<option value="${dr.id}" ${dr.id === currentId ? 'selected' : ''}>${escHtml(dr.name)}</option>`
                ).join('')}
              </select>
              <button class="btn-save-role" title="Speichern"
                      onclick="saveRole('${key}')">💾</button>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}

function toggleKat(header) {
  header.classList.toggle('collapsed');
  header.nextElementSibling.classList.toggle('collapsed');
}

async function saveRole(key) {
  const sel = document.getElementById(`sel-role-${key}`);
  if (!sel) return;
  const roleId = sel.value;
  const btn = sel.nextElementSibling;
  btn.classList.add('saving');
  try {
    const guildId = state.rollenData?.guildId;
    await api('POST', '/api/rollen', { guildId, roleKey: key, roleId });
    sel.dataset.current = roleId;
    btn.classList.remove('saving');
    btn.classList.add('saved');
    setTimeout(() => btn.classList.remove('saved'), 2000);
    toast('Rolle gespeichert!', 'success');
  } catch (err) {
    btn.classList.remove('saving');
    toast('Fehler: ' + err.message, 'error');
  }
}

// ════════════════════════════════════════════════════════════════
// EINSTELLUNGEN
// ════════════════════════════════════════════════════════════════
async function loadSettings() {
  const msgEl = document.getElementById('settings-msg');
  msgEl.classList.add('hidden');
  try {
    const data = await api('GET', '/api/settings');
    if (!data) return;

    const settings = data.settings || {};
    const channels = data.channels || [];
    const categories = data.categories || [];
    const voiceChannels = data.voiceChannels || [];

    // Text/Forum-Kanäle
    const textOpts = '<option value="">— Nicht gesetzt —</option>' +
      channels.map(c => `<option value="${c.id}">${escHtml(c.name)}${c.type === 15 ? ' [Forum]' : ''}</option>`).join('');

    // Voice-Kanäle
    const voiceOpts = '<option value="">— Nicht gesetzt —</option>' +
      voiceChannels.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');

    // Kategorien
    const catOpts = '<option value="">— Nicht gesetzt —</option>' +
      categories.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');

    // Selects befüllen
    const channelSelects = ['sel-verfahren','sel-akten','sel-log','sel-justiz-aus','sel-pol-aus','sel-fw-aus','sel-rd-aus','sel-ankuend','sel-willkommen','sel-live'];
    channelSelects.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = textOpts;
    });

    const voiceEl = document.getElementById('sel-voice-create');
    if (voiceEl) voiceEl.innerHTML = voiceOpts;

    const catEl = document.getElementById('sel-voice-cat');
    if (catEl) catEl.innerHTML = catOpts;

    // Gespeicherte Werte setzen
    const fieldMap = {
      'sel-verfahren':   'verfahren_channel_id',
      'sel-akten':       'akten_channel_id',
      'sel-log':         'log_channel_id',
      'sel-justiz-aus':  'justiz_ausbildung_channel_id',
      'sel-pol-aus':     'polizei_ausbildung_channel_id',
      'sel-fw-aus':      'feuerwehr_ausbildung_channel_id',
      'sel-rd-aus':      'rettungsdienst_ausbildung_channel_id',
      'sel-ankuend':     'ankuendigung_channel_id',
      'sel-willkommen':  'willkommen_channel_id',
      'sel-live':        'live_channel_id',
      'sel-voice-create':'voice_create_channel_id',
      'sel-voice-cat':   'voice_category_id',
    };

    Object.entries(fieldMap).forEach(([selId, field]) => {
      const el = document.getElementById(selId);
      if (el && settings[field]) el.value = settings[field];
    });

    // hidden guildId
    document.getElementById('settings-form').dataset.guildId = data.guildId;

  } catch (err) {
    toast('Einstellungen-Fehler: ' + err.message, 'error');
  }
}

document.getElementById('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById('settings-msg');
  msgEl.classList.add('hidden');

  const form = e.target;
  const guildId = form.dataset.guildId;
  const body = { guildId };

  new FormData(form).forEach((val, key) => { body[key] = val || null; });

  try {
    await api('POST', '/api/settings', body);
    msgEl.className = 'alert alert-success';
    msgEl.textContent = '✅ Einstellungen gespeichert!';
    msgEl.classList.remove('hidden');
    toast('Einstellungen gespeichert!', 'success');
    setTimeout(() => msgEl.classList.add('hidden'), 4000);
  } catch (err) {
    msgEl.className = 'alert alert-error';
    msgEl.textContent = '❌ ' + err.message;
    msgEl.classList.remove('hidden');
  }
});

// ════════════════════════════════════════════════════════════════
// VERFAHREN
// ════════════════════════════════════════════════════════════════
async function loadVerfahren(page = 1) {
  state.verfahrenPage = page;
  const tbody = document.getElementById('verfahren-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Lädt...</td></tr>';

  const search = document.getElementById('verfahren-search').value;
  try {
    const data = await api('GET', `/api/verfahren?page=${page}&limit=15&search=${encodeURIComponent(search)}`);
    if (!data) return;

    if (data.verfahren.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Keine Verfahren gefunden</td></tr>';
    } else {
      tbody.innerHTML = data.verfahren.map(v => `
        <tr>
          <td><strong>${escHtml(v.aktenzeichen)}</strong></td>
          <td>${escHtml(v.beschuldigter || '—')}</td>
          <td>${escHtml((v.vorwurf || '—').substring(0, 40))}${(v.vorwurf||'').length > 40 ? '…' : ''}</td>
          <td><span class="badge badge-${v.status}">${escHtml(v.status)}</span></td>
          <td>${formatDate(v.erstellt_am)}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="deleteVerfahren(${v.id}, '${escHtml(v.aktenzeichen)}')">🗑️</button>
          </td>
        </tr>
      `).join('');
    }

    renderPagination('verfahren-pagination', data.pages, page, loadVerfahren);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading-text">Fehler: ${escHtml(err.message)}</td></tr>`;
  }
}

async function deleteVerfahren(id, aktenzeichen) {
  if (!confirm(`Verfahren "${aktenzeichen}" wirklich löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`)) return;
  try {
    await api('DELETE', `/api/verfahren/${id}`);
    toast(`Verfahren ${aktenzeichen} gelöscht`, 'success');
    loadVerfahren(state.verfahrenPage);
  } catch (err) {
    toast('Fehler: ' + err.message, 'error');
  }
}

let verfahrenSearchTimeout;
document.getElementById('verfahren-search').addEventListener('input', () => {
  clearTimeout(verfahrenSearchTimeout);
  verfahrenSearchTimeout = setTimeout(() => loadVerfahren(1), 400);
});

// ════════════════════════════════════════════════════════════════
// AKTEN
// ════════════════════════════════════════════════════════════════
async function loadAkten(page = 1) {
  state.aktenPage = page;
  const tbody = document.getElementById('akten-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="loading-text">Lädt...</td></tr>';

  const search = document.getElementById('akten-search').value;
  try {
    const data = await api('GET', `/api/akten?page=${page}&limit=15&search=${encodeURIComponent(search)}`);
    if (!data) return;

    if (data.akten.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-text">Keine Akten gefunden</td></tr>';
    } else {
      tbody.innerHTML = data.akten.map(a => `
        <tr>
          <td><strong>${escHtml(a.aktenzeichen)}</strong></td>
          <td><span class="badge badge-${a.status}">${escHtml(a.status)}</span></td>
          <td>${escHtml(a.erstellt_von || '—')}</td>
          <td>${formatDate(a.erstellt_am)}</td>
          <td style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="viewAkte('${escHtml(a.aktenzeichen)}', '${escHtml((a.inhalt||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").substring(0,200))}')">👁️</button>
            <button class="btn btn-primary btn-sm" title="Justizakte als PDF" onclick="openAktePdf('${escHtml(a.aktenzeichen)}','justiz')">⚖️ PDF</button>
            <button class="btn btn-primary btn-sm" title="Polizei-Verfahrensakte als PDF" onclick="openAktePdf('${escHtml(a.aktenzeichen)}','polizei')">🚓 PDF</button>
            <button class="btn btn-danger btn-sm" onclick="deleteAkte(${a.id}, '${escHtml(a.aktenzeichen)}')">🗑️</button>
          </td>
        </tr>
      `).join('');
    }

    renderPagination('akten-pagination', data.pages, page, loadAkten);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading-text">Fehler: ${escHtml(err.message)}</td></tr>`;
  }
}

function viewAkte(aktenzeichen, inhalt) {
  alert(`Akte: ${aktenzeichen}\n\n${inhalt || 'Kein Inhalt'}`);
}

// Öffnet das (neu generierte) PDF einer Akte in einem neuen Tab.
// typ: 'justiz' | 'polizei'. Cookie-Auth wird vom Browser automatisch mitgesendet.
function openAktePdf(aktenzeichen, typ) {
  const guildId = state.rollenData?.guildId || '';
  const q = guildId ? `?guildId=${encodeURIComponent(guildId)}` : '';
  const url = `/api/akten/${encodeURIComponent(aktenzeichen)}/pdf/${typ}${q}`;
  window.open(url, '_blank');
}

async function deleteAkte(id, aktenzeichen) {
  if (!confirm(`Akte "${aktenzeichen}" wirklich löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`)) return;
  try {
    await api('DELETE', `/api/akten/${id}`);
    toast(`Akte ${aktenzeichen} gelöscht`, 'success');
    loadAkten(state.aktenPage);
  } catch (err) {
    toast('Fehler: ' + err.message, 'error');
  }
}

let aktenSearchTimeout;
document.getElementById('akten-search').addEventListener('input', () => {
  clearTimeout(aktenSearchTimeout);
  aktenSearchTimeout = setTimeout(() => loadAkten(1), 400);
});

// ════════════════════════════════════════════════════════════════
// LOGS
// ════════════════════════════════════════════════════════════════
async function loadLogs() {
  const tbody = document.getElementById('logs-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Lädt...</td></tr>';
  try {
    const data = await api('GET', '/api/logs');
    if (!data) return;

    if (data.logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Keine Logs</td></tr>';
    } else {
      tbody.innerHTML = data.logs.map(l => `
        <tr>
          <td style="white-space:nowrap">${formatDate(l.erstellt_am, true)}</td>
          <td>${escHtml(l.username)}</td>
          <td><code style="background:var(--bg-elevated);padding:2px 6px;border-radius:4px">${escHtml(l.aktion)}</code></td>
          <td style="color:var(--text-secondary)">${escHtml(l.details || '—')}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="loading-text">Fehler: ${escHtml(err.message)}</td></tr>`;
  }
}

// ════════════════════════════════════════════════════════════════
// ADMINS
// ════════════════════════════════════════════════════════════════
async function loadAdmins() {
  const tbody = document.getElementById('admins-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Lädt...</td></tr>';
  try {
    const data = await api('GET', '/api/admins');
    if (!data) return;

    if (data.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Keine Benutzer</td></tr>';
    } else {
      tbody.innerHTML = data.users.map(u => `
        <tr>
          <td><strong>${escHtml(u.username)}</strong></td>
          <td><span class="badge badge-${u.role}">${escHtml(u.role)}</span></td>
          <td>${formatDate(u.created_at)}</td>
          <td>
            ${u.username !== state.user?.username ? `
              <button class="btn btn-danger btn-sm" onclick="deleteAdmin(${u.id}, '${escHtml(u.username)}')">Deaktivieren</button>
            ` : '<span style="color:var(--text-muted)">— Du —</span>'}
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="loading-text">Fehler: ${escHtml(err.message)}</td></tr>`;
  }
}

function showAddAdmin() {
  document.getElementById('add-admin-modal').classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

document.getElementById('add-admin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('add-admin-error');
  errEl.classList.add('hidden');
  try {
    await api('POST', '/api/admins', {
      username: document.getElementById('new-admin-username').value,
      password: document.getElementById('new-admin-password').value,
      role: document.getElementById('new-admin-role').value,
    });
    closeModal('add-admin-modal');
    toast('Admin erstellt!', 'success');
    loadAdmins();
    e.target.reset();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
});

async function deleteAdmin(id, username) {
  if (!confirm(`Admin "${username}" wirklich deaktivieren?`)) return;
  try {
    await api('DELETE', `/api/admins/${id}`);
    toast(`${username} deaktiviert`, 'success');
    loadAdmins();
  } catch (err) {
    toast('Fehler: ' + err.message, 'error');
  }
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
function renderPagination(containerId, totalPages, currentPage, loadFn) {
  const container = document.getElementById(containerId);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = `<button class="page-btn" onclick="${loadFn.name}(${currentPage-1})" ${currentPage <= 1 ? 'disabled' : ''}>‹ Zurück</button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${loadFn.name}(${i})">${i}</button>`;
    } else if (Math.abs(i - currentPage) === 2) {
      html += `<span style="color:var(--text-muted);padding:0 4px">…</span>`;
    }
  }

  html += `<button class="page-btn" onclick="${loadFn.name}(${currentPage+1})" ${currentPage >= totalPages ? 'disabled' : ''}>Weiter ›</button>`;
  container.innerHTML = html;
}

function formatDate(isoStr, withTime = false) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (!withTime) return date;
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Init (siehe Ende der Datei) ──

// ════════════════════════════════════════════════════════════════
// SPIELER
// ════════════════════════════════════════════════════════════════
let spielerSearchTimeout;
async function loadSpieler(page = 1) {
  const grid = document.getElementById('spieler-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-text">Lädt Mitglieder...</div>';
  const search = document.getElementById('spieler-search')?.value || '';
  try {
    const data = await api('GET', `/api/spieler?page=${page}&limit=24&search=${encodeURIComponent(search)}`);
    if (!data) return;
    if (!data.spieler || data.spieler.length === 0) {
      grid.innerHTML = '<div class="loading-text">Keine Spieler gefunden</div>';
      return;
    }
    grid.innerHTML = data.spieler.map(s => `
      <div class="spieler-card" onclick="viewSpieler('${s.id}')">
        <img src="${s.avatar}" class="spieler-avatar" alt="" />
        <div class="spieler-info">
          <strong>${escHtml(s.displayName)}</strong>
          <small>${escHtml(s.tag)}</small>
          <div class="spieler-badges">
            ${s.warns > 0 ? `<span class="badge badge-strafverfahren">${s.warns} ⚠️</span>` : ''}
            ${s.booster ? '<span class="badge badge-superadmin">💎</span>' : ''}
            <span class="badge badge-admin">${s.rollenCount} Rollen</span>
          </div>
        </div>
      </div>
    `).join('');
    renderPagination('spieler-pagination', data.pages, page, loadSpieler);
  } catch (err) {
    grid.innerHTML = `<div class="loading-text">Fehler: ${escHtml(err.message)}</div>`;
  }
}

async function viewSpieler(userId) {
  try {
    const d = await api('GET', `/api/spieler/${userId}`);
    if (!d) return;
    const rollen = (d.rollen || []).map(r => `<span class="badge badge-admin">${escHtml(r.name)}</span>`).join(' ') || '—';
    const warns = (d.warns || []).map(w => `<div class="log-entry"><span class="log-time">#${w.id}</span><span>${escHtml(w.grund)}</span><span class="log-detail">${formatDate(w.erstellt_am)}</span></div>`).join('') || '<div class="loading-text">Keine Verwarnungen</div>';
    document.getElementById('spieler-modal-title').textContent = d.tag;
    document.getElementById('spieler-modal-body').innerHTML = `
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px">
        <img src="${d.avatar}" style="width:80px;height:80px;border-radius:50%" alt="" />
        <div>
          <div class="info-row"><span>ID</span><strong>${d.id}</strong></div>
          <div class="info-row"><span>Auf Server</span><strong>${d.aufServer ? '✅ Ja' : '❌ Nein'}</strong></div>
          <div class="info-row"><span>Beigetreten</span><strong>${formatDate(d.joinedAt)}</strong></div>
          <div class="info-row"><span>Account erstellt</span><strong>${formatDate(d.createdAt)}</strong></div>
        </div>
      </div>
      <div class="card"><div class="card-header">🎭 Rollen (${(d.rollen||[]).length})</div><div class="card-body">${rollen}</div></div>
      <div class="card" style="margin-top:12px"><div class="card-header">⚠️ Verwarnungen (${(d.warns||[]).length})</div><div class="card-body">${warns}</div></div>
    `;
    document.getElementById('spieler-modal').classList.remove('hidden');
  } catch (err) {
    toast('Fehler: ' + err.message, 'error');
  }
}

// ════════════════════════════════════════════════════════════════
// VERWARNUNGEN
// ════════════════════════════════════════════════════════════════
let warnsSearchTimeout;
async function loadWarns(page = 1) {
  const tbody = document.getElementById('warns-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Lädt...</td></tr>';
  const search = document.getElementById('warns-search')?.value || '';
  try {
    const data = await api('GET', `/api/warns?page=${page}&limit=20&search=${encodeURIComponent(search)}`);
    if (!data) return;
    if (!data.warns || data.warns.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Keine Verwarnungen</td></tr>';
    } else {
      tbody.innerHTML = data.warns.map(w => `
        <tr>
          <td><strong>#${w.id}</strong></td>
          <td>${escHtml(w.benutzer_name)}</td>
          <td>${escHtml(w.grund)}</td>
          <td>${escHtml(w.moderator_name)}</td>
          <td>${formatDate(w.erstellt_am)}</td>
          <td><button class="btn btn-danger btn-sm" onclick="deleteWarn(${w.id})">🗑️</button></td>
        </tr>
      `).join('');
    }
    renderPagination('warns-pagination', data.pages, page, loadWarns);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading-text">Fehler: ${escHtml(err.message)}</td></tr>`;
  }
}

async function deleteWarn(id) {
  if (!confirm(`Verwarnung #${id} wirklich löschen?`)) return;
  try {
    await api('DELETE', `/api/warns/${id}`);
    toast('Verwarnung gelöscht', 'success');
    loadWarns();
  } catch (err) { toast('Fehler: ' + err.message, 'error'); }
}

// ════════════════════════════════════════════════════════════════
// MOD-LOGS
// ════════════════════════════════════════════════════════════════
async function loadModLogs(page = 1) {
  const tbody = document.getElementById('modlogs-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="loading-text">Lädt...</td></tr>';
  try {
    const data = await api('GET', `/api/modlogs?page=${page}&limit=30`);
    if (!data) return;
    if (!data.logs || data.logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-text">Keine Mod-Logs</td></tr>';
    } else {
      tbody.innerHTML = data.logs.map(l => `
        <tr>
          <td style="white-space:nowrap">${formatDate(l.erstellt_am, true)}</td>
          <td>${escHtml(l.moderator_name)}</td>
          <td><code style="background:var(--bg-elevated);padding:2px 6px;border-radius:4px">${escHtml(l.aktion)}</code></td>
          <td>${escHtml(l.ziel_name || '—')}</td>
          <td style="color:var(--text-secondary)">${escHtml(l.grund || '—')}</td>
        </tr>
      `).join('');
    }
    renderPagination('modlogs-pagination', data.pages, page, loadModLogs);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading-text">Fehler: ${escHtml(err.message)}</td></tr>`;
  }
}

// ════════════════════════════════════════════════════════════════
// CHAT LEEREN
// ════════════════════════════════════════════════════════════════
async function loadChat() {
  try {
    const data = await api('GET', '/api/settings');
    if (!data) return;
    const channels = data.channels || [];
    const sel = document.getElementById('chat-kanal-select');
    if (sel) {
      sel.innerHTML = '<option value="">— Kanal wählen —</option>' +
        channels.filter(c => c.type === 0).map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
    }
    const logsData = await api('GET', '/api/modlogs?limit=8');
    const recent = document.getElementById('chat-log-recent');
    if (recent && logsData) {
      const chatLogs = (logsData.logs || []).filter(l => l.aktion === 'chat_leeren');
      recent.innerHTML = chatLogs.length === 0 ? '<div class="loading-text">Noch keine Löschungen</div>' :
        chatLogs.map(l => `<div class="log-entry"><span class="log-time">${formatDate(l.erstellt_am, true)}</span><span>${escHtml(l.ziel_name || '')}</span><span class="log-detail">${escHtml(l.grund || '')}</span></div>`).join('');
    }
  } catch (err) { toast('Fehler: ' + err.message, 'error'); }
}

// ════════════════════════════════════════════════════════════════
// TIKTOK LIVE
// ════════════════════════════════════════════════════════════════
async function loadTikTok() {
  const tbody = document.getElementById('tiktok-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Lädt...</td></tr>';
  try {
    const data = await api('GET', '/api/tiktok');
    if (!data) return;

    const hinweis = document.getElementById('tiktok-live-hinweis');
    if (hinweis) {
      hinweis.className = data.liveChannelId ? 'alert alert-success' : 'alert alert-error';
      hinweis.style.marginBottom = '16px';
      hinweis.innerHTML = data.liveChannelId
        ? '✅ Live-Kanal ist gesetzt. Ändern in Einstellungen → Live-Ankündigungs-Kanal.'
        : '⚠️ Kein Live-Kanal gesetzt! Gehe zu Einstellungen → Live-Ankündigungs-Kanal.';
    }

    const streamer = data.streamer || [];
    if (streamer.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Keine TikToker überwacht</td></tr>';
    } else {
      tbody.innerHTML = streamer.map(s => `
        <tr>
          <td>${s.ist_live ? '🔴 Live' : '⚫ Offline'}</td>
          <td><strong>@${escHtml(s.tiktok_username)}</strong></td>
          <td>${escHtml(s.anzeige_name || s.tiktok_username)}</td>
          <td><button class="btn btn-danger btn-sm" onclick="deleteTikTok(${s.id}, '${escHtml(s.tiktok_username)}')">🗑️</button></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="loading-text">Fehler: ${escHtml(err.message)}</td></tr>`;
  }
}

async function deleteTikTok(id, username) {
  if (!confirm(`@${username} aus der Überwachung entfernen?`)) return;
  try {
    await api('DELETE', `/api/tiktok/${id}`);
    toast(`@${username} entfernt`, 'success');
    loadTikTok();
  } catch (err) { toast('Fehler: ' + err.message, 'error'); }
}

// ── Event-Listener für die neuen Seiten ──
document.addEventListener('DOMContentLoaded', () => {
  const spielerSearch = document.getElementById('spieler-search');
  if (spielerSearch) spielerSearch.addEventListener('input', () => {
    clearTimeout(spielerSearchTimeout);
    spielerSearchTimeout = setTimeout(() => loadSpieler(1), 400);
  });

  const warnsSearch = document.getElementById('warns-search');
  if (warnsSearch) warnsSearch.addEventListener('input', () => {
    clearTimeout(warnsSearchTimeout);
    warnsSearchTimeout = setTimeout(() => loadWarns(1), 400);
  });

  const chatForm = document.getElementById('chat-leeren-form');
  if (chatForm) chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const channelId = document.getElementById('chat-kanal-select').value;
    const menge = parseInt(document.getElementById('chat-menge').value);
    const msg = document.getElementById('chat-msg');
    if (!channelId) { toast('Bitte Kanal wählen', 'error'); return; }
    try {
      const r = await api('POST', '/api/chat-leeren', { channelId, menge });
      msg.className = 'alert alert-success';
      msg.textContent = `✅ ${r.deleted} Nachrichten gelöscht`;
      msg.classList.remove('hidden');
      loadChat();
    } catch (err) {
      msg.className = 'alert alert-error';
      msg.textContent = '❌ ' + err.message;
      msg.classList.remove('hidden');
    }
  });

  const tiktokForm = document.getElementById('tiktok-form');
  if (tiktokForm) tiktokForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('tiktok-username').value;
    const anzeigeName = document.getElementById('tiktok-anzeigename').value;
    const msg = document.getElementById('tiktok-msg');
    try {
      await api('POST', '/api/tiktok', { username, anzeigeName });
      msg.className = 'alert alert-success';
      msg.textContent = `✅ @${username} hinzugefügt`;
      msg.classList.remove('hidden');
      document.getElementById('tiktok-username').value = '';
      document.getElementById('tiktok-anzeigename').value = '';
      loadTikTok();
    } catch (err) {
      msg.className = 'alert alert-error';
      msg.textContent = '❌ ' + err.message;
      msg.classList.remove('hidden');
    }
  });
});

// ── Init ──
checkAuth();
