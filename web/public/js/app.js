/* ═══════════════════════════════════════════════════════════════
   Deutscher RP Server — Admin Panel
   Enterprise Dashboard Application
   ═══════════════════════════════════════════════════════════════ */
'use strict';

// ══════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════
const state = {
  currentPage: 'dashboard',
  user: null,
  rollenData: null,
  verfahrenPage: 1,
  aktenPage: 1,
  refreshInterval: null,
};

// ══════════════════════════════════════════════════════════════════
// API
// ══════════════════════════════════════════════════════════════════
async function api(method, path, body) {
  const opts = { method, credentials: 'include', headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (res.status === 401) { showLogin(); return null; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ══════════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════════
function toast(msg, type = 'info', duration = 3500) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.classList.add('fade-out'); setTimeout(() => el.remove(), 300); }, duration);
}

// ══════════════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════════════
function navigate(page) {
  state.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const titles = { dashboard:'Dashboard', spieler:'Spieler', warns:'Verwarnungen', modlogs:'Mod-Logs', chat:'Chat leeren', tiktok:'TikTok Live', tickets:'Tickets', verfahren:'Verfahren', akten:'Akten', fahndungen:'Fahndungen', dienstplan:'Dienstplan', abwesenheiten:'Abwesenheiten', ausbildungen:'Ausbildungen', rollen:'Rollen', settings:'Einstellungen', logs:'Admin-Logs', admins:'Admins' };
  document.getElementById('page-title').textContent = titles[page] || page;

  const loaders = { dashboard:loadDashboard, rollen:loadRollen, settings:loadSettings, verfahren:loadVerfahren, akten:loadAkten, logs:loadLogs, admins:loadAdmins, spieler:loadSpieler, warns:loadWarns, modlogs:loadModLogs, chat:loadChat, tiktok:loadTikTok, tickets:loadTickets, fahndungen:loadFahndungen, dienstplan:loadDienstplan, abwesenheiten:loadAbwesenheiten, ausbildungen:loadAusbildungen };
  if (loaders[page]) loaders[page]();

  document.getElementById('sidebar').classList.remove('open');
  history.replaceState(null, '', `#${page}`);
}

// ══════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════
function showLogin() {
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  if (state.refreshInterval) { clearInterval(state.refreshInterval); state.refreshInterval = null; }
}

function showApp(user) {
  state.user = user;
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-name').textContent = user.username;
  document.getElementById('user-role').textContent = user.role;
  document.getElementById('user-avatar').textContent = user.username[0].toUpperCase();
  if (user.role !== 'superadmin') document.getElementById('nav-admins').classList.add('hidden');
  navigate(location.hash.replace('#','') || 'dashboard');
  state.refreshInterval = setInterval(() => { if (state.currentPage === 'dashboard') loadDashboard(); }, 60000);
}

async function checkAuth() {
  try { const d = await api('GET','/api/auth/me'); d ? showApp(d) : showLogin(); }
  catch { showLogin(); }
}

// ══════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════
async function loadDashboard() {
  try {
    const [stats, logsData] = await Promise.all([api('GET','/api/stats'), api('GET','/api/logs')]);
    if (!stats) return;

    document.getElementById('stat-verfahren').textContent = stats.totalVerfahren;
    document.getElementById('stat-offen').textContent = stats.offeneVerfahren;
    document.getElementById('stat-akten').textContent = stats.totalAkten;
    document.getElementById('stat-rollen').textContent = `${stats.konfigurierteRollen}/${stats.totalRollen}`;
    document.getElementById('stat-members').textContent = (stats.memberCount ?? 0).toLocaleString('de');
    document.getElementById('stat-ping').textContent = `${stats.botPing} ms`;
    document.querySelectorAll('.stat-card').forEach(el => el.classList.remove('loading'));

    document.getElementById('info-guild').textContent = stats.guildName;
    document.getElementById('info-status').textContent = stats.botStatus;
    document.getElementById('info-ping').textContent = `${stats.botPing} ms`;

    const dot = document.getElementById('bot-status-dot');
    const txt = document.getElementById('bot-status-text');
    dot.className = `status-dot ${stats.botStatus === 'online' ? 'online' : 'offline'}`;
    txt.textContent = stats.botStatus === 'online' ? 'Online' : 'Offline';
    document.getElementById('ping-badge').textContent = `${stats.botPing} ms`;

    if (logsData?.logs) {
      const c = document.getElementById('recent-logs');
      const r = logsData.logs.slice(0, 8);
      c.innerHTML = r.length === 0 ? '<div class="loading-text">Keine Aktivitaet</div>' :
        r.map(l => `<div class="info-row"><span>${formatDate(l.erstellt_am,true)}</span><strong>${escHtml(l.username)} — ${escHtml(l.aktion)}</strong></div>`).join('');
    }
  } catch (err) { toast('Dashboard: ' + err.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════════
// ROLLEN
// ══════════════════════════════════════════════════════════════════
const KATEGORIEN_META = {
  admin:         { titel: 'Administration', keys: ['owner','coOwner','administrator','administratorAnwaerter','moderator','developer'] },
  support:       { titel: 'Support', keys: ['supportLeitung','supporter','supportAnwaerter'] },
  justiz:        { titel: 'Justiz', keys: ['justizLeitung','richter','staatsanwalt','anwalt','justizAnwaerter'] },
  polizei:       { titel: 'Polizei', keys: ['polizeiLeitung','polizei','polizeiAnwaerter'] },
  feuerwehr:     { titel: 'Feuerwehr', keys: ['feuerwehrLeitung','feuerwehr','feuerwehrAnwaerter'] },
  rettungsdienst:{ titel: 'Rettungsdienst', keys: ['rettungsdienstLeitung','rettungsdienst','rettungsdienstAnwaerter'] },
  sonstige:      { titel: 'Sonstige', keys: ['fraktionsleitung','adacLeitung'] },
};

async function loadRollen() {
  const c = document.getElementById('rollen-kategorien');
  c.innerHTML = '<div class="loading-text">Laden</div>';
  try {
    const data = await api('GET','/api/rollen');
    if (!data) return;
    state.rollenData = data;
    renderRollen(data);
  } catch (err) { c.innerHTML = `<div class="loading-text">Fehler: ${escHtml(err.message)}</div>`; }
}

function renderRollen(data) {
  const c = document.getElementById('rollen-kategorien');
  const map = {}; (data.rollen||[]).forEach(r => map[r.key] = r);
  const dr = data.discordRollen || [];

  c.innerHTML = Object.entries(KATEGORIEN_META).map(([,kat]) => `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">${kat.titel}</div>
      <div class="card-body">
        <div class="rollen-grid">${kat.keys.map(key => {
          const r = map[key]; if (!r) return '';
          return `<div class="rolle-item">
            <label>${escHtml(r.label)}</label>
            <select id="sel-role-${key}" data-key="${key}" data-current="${r.roleId||''}">
              <option value="">Nicht gesetzt</option>
              ${dr.map(d => `<option value="${d.id}" ${d.id===r.roleId?'selected':''}>${escHtml(d.name)}</option>`).join('')}
            </select>
            <button class="btn btn-primary btn-sm" onclick="saveRole('${key}')">Speichern</button>
          </div>`;
        }).join('')}</div>
      </div>
    </div>
  `).join('');
}

async function saveRole(key) {
  const sel = document.getElementById(`sel-role-${key}`);
  if (!sel) return;
  try {
    await api('POST','/api/rollen', { guildId: state.rollenData?.guildId, roleKey: key, roleId: sel.value });
    sel.dataset.current = sel.value;
    toast('Rolle gespeichert', 'success');
  } catch (err) { toast('Fehler: ' + err.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════════
// EINSTELLUNGEN
// ══════════════════════════════════════════════════════════════════
async function loadSettings() {
  try {
    const data = await api('GET','/api/settings');
    if (!data) return;
    const s = data.settings || {}, ch = data.channels || [], cats = data.categories || [], vc = data.voiceChannels || [];

    const textOpts = '<option value="">Nicht gesetzt</option>' + ch.map(c => `<option value="${c.id}">${escHtml(c.name)}${c.type===15?' [Forum]':''}</option>`).join('');
    const voiceOpts = '<option value="">Nicht gesetzt</option>' + vc.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
    const catOpts = '<option value="">Nicht gesetzt</option>' + cats.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');

    ['sel-verfahren','sel-akten','sel-log','sel-justiz-aus','sel-pol-aus','sel-fw-aus','sel-rd-aus','sel-ankuend','sel-willkommen','sel-live','sel-support-aus','sel-adac-aus','sel-admin-aus'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = textOpts; });
    const ve = document.getElementById('sel-voice-create'); if (ve) ve.innerHTML = voiceOpts;
    const ce = document.getElementById('sel-voice-cat'); if (ce) ce.innerHTML = catOpts;

    const fm = { 'sel-verfahren':'verfahren_channel_id','sel-akten':'akten_channel_id','sel-log':'log_channel_id','sel-justiz-aus':'justiz_ausbildung_channel_id','sel-pol-aus':'polizei_ausbildung_channel_id','sel-fw-aus':'feuerwehr_ausbildung_channel_id','sel-rd-aus':'rettungsdienst_ausbildung_channel_id','sel-ankuend':'ankuendigung_channel_id','sel-willkommen':'willkommen_channel_id','sel-live':'live_channel_id','sel-voice-create':'voice_create_channel_id','sel-voice-cat':'voice_category_id','sel-support-aus':'support_ausbildung_channel_id','sel-adac-aus':'adac_ausbildung_channel_id','sel-admin-aus':'admin_ausbildung_channel_id' };
    Object.entries(fm).forEach(([id,f]) => { const el = document.getElementById(id); if (el && s[f]) el.value = s[f]; });
    document.getElementById('settings-form').dataset.guildId = data.guildId;
  } catch (err) { toast('Einstellungen: ' + err.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════════
// VERFAHREN
// ══════════════════════════════════════════════════════════════════
async function loadVerfahren(page = 1) {
  state.verfahrenPage = page;
  const tbody = document.getElementById('verfahren-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Laden</td></tr>';
  try {
    const data = await api('GET', `/api/verfahren?page=${page}&limit=15&search=${encodeURIComponent(document.getElementById('verfahren-search').value)}`);
    if (!data) return;
    tbody.innerHTML = data.verfahren.length === 0 ? '<tr><td colspan="6" class="loading-text">Keine Verfahren</td></tr>' :
      data.verfahren.map(v => `<tr>
        <td><strong>${escHtml(v.aktenzeichen)}</strong></td>
        <td>${escHtml(v.beschuldigter||'—')}</td>
        <td>${escHtml((v.vorwurf||'').substring(0,40))}${(v.vorwurf||'').length>40?'...':''}</td>
        <td><span class="badge badge-${statusBadge(v.status)}">${escHtml(v.status)}</span></td>
        <td>${formatDate(v.erstellt_am)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteVerfahren(${v.id},'${escHtml(v.aktenzeichen)}')">Loeschen</button></td>
      </tr>`).join('');
    renderPagination('verfahren-pagination', data.pages, page, loadVerfahren);
  } catch (err) { tbody.innerHTML = `<tr><td colspan="6" class="loading-text">Fehler: ${escHtml(err.message)}</td></tr>`; }
}

async function deleteVerfahren(id, az) {
  if (!confirm(`Verfahren "${az}" wirklich loeschen?`)) return;
  try { await api('DELETE',`/api/verfahren/${id}`); toast(`${az} geloescht`,'success'); loadVerfahren(state.verfahrenPage); }
  catch (err) { toast(err.message,'error'); }
}

// ══════════════════════════════════════════════════════════════════
// AKTEN
// ══════════════════════════════════════════════════════════════════
async function loadAkten(page = 1) {
  state.aktenPage = page;
  const tbody = document.getElementById('akten-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="loading-text">Laden</td></tr>';
  try {
    const data = await api('GET', `/api/akten?page=${page}&limit=15&search=${encodeURIComponent(document.getElementById('akten-search').value)}`);
    if (!data) return;
    tbody.innerHTML = data.akten.length === 0 ? '<tr><td colspan="5" class="loading-text">Keine Akten</td></tr>' :
      data.akten.map(a => `<tr>
        <td><strong>${escHtml(a.aktenzeichen)}</strong></td>
        <td><span class="badge badge-${statusBadge(a.status)}">${escHtml(a.status)}</span></td>
        <td>${escHtml(a.erstellt_von||'—')}</td>
        <td>${formatDate(a.erstellt_am)}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="openAktePdf('${escHtml(a.aktenzeichen)}','justiz')" title="Justizakte PDF">Justiz</button>
          <button class="btn btn-secondary btn-sm" onclick="openAktePdf('${escHtml(a.aktenzeichen)}','polizei')" title="Polizeiakte PDF">Polizei</button>
          <button class="btn btn-danger btn-sm" onclick="deleteAkte(${a.id},'${escHtml(a.aktenzeichen)}')">Loeschen</button>
        </td>
      </tr>`).join('');
    renderPagination('akten-pagination', data.pages, page, loadAkten);
  } catch (err) { tbody.innerHTML = `<tr><td colspan="5" class="loading-text">Fehler: ${escHtml(err.message)}</td></tr>`; }
}

function openAktePdf(az, typ) {
  const gid = state.rollenData?.guildId || '';
  window.open(`/api/akten/${encodeURIComponent(az)}/pdf/${typ}${gid?'?guildId='+encodeURIComponent(gid):''}`, '_blank');
}

async function deleteAkte(id, az) {
  if (!confirm(`Akte "${az}" wirklich loeschen?`)) return;
  try { await api('DELETE',`/api/akten/${id}`); toast(`${az} geloescht`,'success'); loadAkten(state.aktenPage); }
  catch (err) { toast(err.message,'error'); }
}

// ══════════════════════════════════════════════════════════════════
// LOGS
// ══════════════════════════════════════════════════════════════════
async function loadLogs() {
  const tbody = document.getElementById('logs-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Laden</td></tr>';
  try {
    const data = await api('GET','/api/logs'); if (!data) return;
    tbody.innerHTML = data.logs.length === 0 ? '<tr><td colspan="4" class="loading-text">Keine Logs</td></tr>' :
      data.logs.map(l => `<tr><td style="white-space:nowrap">${formatDate(l.erstellt_am,true)}</td><td>${escHtml(l.username)}</td><td><span class="badge badge-info">${escHtml(l.aktion)}</span></td><td>${escHtml(l.details||'—')}</td></tr>`).join('');
  } catch (err) { tbody.innerHTML = `<tr><td colspan="4" class="loading-text">Fehler</td></tr>`; }
}

// ══════════════════════════════════════════════════════════════════
// ADMINS
// ══════════════════════════════════════════════════════════════════
async function loadAdmins() {
  const tbody = document.getElementById('admins-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Laden</td></tr>';
  try {
    const data = await api('GET','/api/admins'); if (!data) return;
    tbody.innerHTML = data.users.length === 0 ? '<tr><td colspan="4" class="loading-text">Keine Admins</td></tr>' :
      data.users.map(u => `<tr>
        <td><strong>${escHtml(u.username)}</strong></td>
        <td><span class="badge badge-admin">${escHtml(u.role)}</span></td>
        <td>${formatDate(u.created_at)}</td>
        <td>${u.username !== state.user?.username ? `<button class="btn btn-danger btn-sm" onclick="deleteAdmin(${u.id},'${escHtml(u.username)}')">Deaktivieren</button>` : '<span style="color:var(--text-muted)">Du</span>'}</td>
      </tr>`).join('');
  } catch (err) { tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Fehler</td></tr>'; }
}

function showAddAdmin() { document.getElementById('add-admin-modal').classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

async function deleteAdmin(id, name) {
  if (!confirm(`"${name}" deaktivieren?`)) return;
  try { await api('DELETE',`/api/admins/${id}`); toast(`${name} deaktiviert`,'success'); loadAdmins(); }
  catch (err) { toast(err.message,'error'); }
}

// ══════════════════════════════════════════════════════════════════
// SPIELER
// ══════════════════════════════════════════════════════════════════
async function loadSpieler(page = 1) {
  const grid = document.getElementById('spieler-grid'); if (!grid) return;
  grid.innerHTML = '<div class="loading-text">Laden</div>';
  try {
    const data = await api('GET',`/api/spieler?page=${page}&limit=24&search=${encodeURIComponent(document.getElementById('spieler-search')?.value||'')}`);
    if (!data) return;
    if (!data.spieler || data.spieler.length === 0) { grid.innerHTML = '<div class="loading-text">Keine Spieler</div>'; return; }
    grid.innerHTML = data.spieler.map(s => `
      <div class="spieler-card" onclick="viewSpieler('${s.id}')">
        <img src="${s.avatar}" class="spieler-avatar" alt="" />
        <div class="name">${escHtml(s.displayName)}</div>
        <div class="role">${escHtml(s.tag)} &middot; ${s.rollenCount} Rollen</div>
      </div>
    `).join('');
    renderPagination('spieler-pagination', data.pages, page, loadSpieler);
  } catch (err) { grid.innerHTML = `<div class="loading-text">Fehler: ${escHtml(err.message)}</div>`; }
}

async function viewSpieler(userId) {
  try {
    const d = await api('GET',`/api/spieler/${userId}`); if (!d) return;
    const rollen = (d.rollen||[]).map(r => `<span class="badge badge-admin">${escHtml(r.name)}</span>`).join(' ') || '—';
    const warns = (d.warns||[]).map(w => `<div class="info-row"><span>#${w.id} — ${escHtml(w.grund)}</span><strong>${formatDate(w.erstellt_am)}</strong></div>`).join('') || '<div class="loading-text">Keine Verwarnungen</div>';
    document.getElementById('spieler-modal-title').textContent = d.tag;
    document.getElementById('spieler-modal-body').innerHTML = `
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:20px">
        <img src="${d.avatar}" style="width:72px;height:72px;border-radius:50%;border:2px solid var(--border)" alt="" />
        <div style="flex:1">
          <div class="info-row"><span>ID</span><strong>${d.id}</strong></div>
          <div class="info-row"><span>Beigetreten</span><strong>${formatDate(d.joinedAt)}</strong></div>
          <div class="info-row"><span>Account erstellt</span><strong>${formatDate(d.createdAt)}</strong></div>
        </div>
      </div>
      <div class="card"><div class="card-header">Rollen (${(d.rollen||[]).length})</div><div class="card-body" style="display:flex;flex-wrap:wrap;gap:6px">${rollen}</div></div>
      <div class="card" style="margin-top:12px"><div class="card-header">Verwarnungen (${(d.warns||[]).length})</div><div class="card-body">${warns}</div></div>
    `;
    document.getElementById('spieler-modal').classList.remove('hidden');
  } catch (err) { toast(err.message,'error'); }
}

// ══════════════════════════════════════════════════════════════════
// WEB-MODERATION (Warn, Kick, Ban von der Website)
// ══════════════════════════════════════════════════════════════════
async function webWarn(e) { e.preventDefault(); const u=document.getElementById('mod-warn-user').value, g=document.getElementById('mod-warn-grund').value; if(!u||!g){toast('User-ID und Grund erforderlich','error');return false;} try{await api('POST','/api/warns',{userId:u,grund:g});toast('Verwarnung erteilt','success');document.getElementById('form-warn').reset();}catch(err){toast(err.message,'error');}return false; }
async function webKick(e) { e.preventDefault(); const u=document.getElementById('mod-kick-user').value, g=document.getElementById('mod-kick-grund').value; if(!u){toast('User-ID erforderlich','error');return false;} if(!confirm('Wirklich kicken?'))return false; try{await api('POST','/api/kick',{userId:u,grund:g});toast('Spieler gekickt','success');document.getElementById('form-kick').reset();}catch(err){toast(err.message,'error');}return false; }
async function webBan(e) { e.preventDefault(); const u=document.getElementById('mod-ban-user').value, g=document.getElementById('mod-ban-grund').value, t=parseInt(document.getElementById('mod-ban-tage').value)||0; if(!u){toast('User-ID erforderlich','error');return false;} if(!confirm('Wirklich bannen? Das kann nicht einfach rueckgaengig gemacht werden!'))return false; try{await api('POST','/api/ban',{userId:u,grund:g,tage:t});toast('Spieler gebannt','success');document.getElementById('form-ban').reset();}catch(err){toast(err.message,'error');}return false; }

// ══════════════════════════════════════════════════════════════════
// VERWARNUNGEN
// ══════════════════════════════════════════════════════════════════
async function loadWarns(page = 1) {
  const tbody = document.getElementById('warns-tbody'); if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Laden</td></tr>';
  try {
    const data = await api('GET',`/api/warns?page=${page}&limit=20&search=${encodeURIComponent(document.getElementById('warns-search')?.value||'')}`);
    if (!data) return;
    tbody.innerHTML = (!data.warns||data.warns.length===0) ? '<tr><td colspan="6" class="loading-text">Keine Verwarnungen</td></tr>' :
      data.warns.map(w => `<tr><td><strong>#${w.id}</strong></td><td>${escHtml(w.benutzer_name)}</td><td>${escHtml(w.grund)}</td><td>${escHtml(w.moderator_name)}</td><td>${formatDate(w.erstellt_am)}</td><td><button class="btn btn-danger btn-sm" onclick="deleteWarn(${w.id})">Loeschen</button></td></tr>`).join('');
    renderPagination('warns-pagination', data.pages, page, loadWarns);
  } catch (err) { tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Fehler</td></tr>'; }
}

async function deleteWarn(id) {
  if (!confirm(`Verwarnung #${id} loeschen?`)) return;
  try { await api('DELETE',`/api/warns/${id}`); toast('Geloescht','success'); loadWarns(); }
  catch (err) { toast(err.message,'error'); }
}

// ══════════════════════════════════════════════════════════════════
// MOD-LOGS
// ══════════════════════════════════════════════════════════════════
async function loadModLogs(page = 1) {
  const tbody = document.getElementById('modlogs-tbody'); if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="loading-text">Laden</td></tr>';
  try {
    const data = await api('GET',`/api/modlogs?page=${page}&limit=30`); if (!data) return;
    tbody.innerHTML = (!data.logs||data.logs.length===0) ? '<tr><td colspan="5" class="loading-text">Keine Logs</td></tr>' :
      data.logs.map(l => `<tr><td style="white-space:nowrap">${formatDate(l.erstellt_am,true)}</td><td>${escHtml(l.moderator_name)}</td><td><span class="badge badge-info">${escHtml(l.aktion)}</span></td><td>${escHtml(l.ziel_name||'—')}</td><td>${escHtml(l.grund||'—')}</td></tr>`).join('');
    renderPagination('modlogs-pagination', data.pages, page, loadModLogs);
  } catch (err) { tbody.innerHTML = '<tr><td colspan="5" class="loading-text">Fehler</td></tr>'; }
}

// ══════════════════════════════════════════════════════════════════
// CHAT LEEREN
// ══════════════════════════════════════════════════════════════════
async function loadChat() {
  try {
    const data = await api('GET','/api/settings'); if (!data) return;
    const sel = document.getElementById('chat-kanal-select');
    if (sel) sel.innerHTML = '<option value="">Kanal waehlen...</option>' + (data.channels||[]).filter(c=>c.type===0).map(c=>`<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
    const logsData = await api('GET','/api/modlogs?limit=8');
    const recent = document.getElementById('chat-log-recent');
    if (recent && logsData) {
      const cl = (logsData.logs||[]).filter(l=>l.aktion==='chat_leeren');
      recent.innerHTML = cl.length===0 ? '<div class="loading-text">Keine Loeschungen</div>' :
        cl.map(l=>`<div class="info-row"><span>${formatDate(l.erstellt_am,true)}</span><strong>${escHtml(l.ziel_name||'')} — ${escHtml(l.grund||'')}</strong></div>`).join('');
    }
  } catch (err) { toast(err.message,'error'); }
}

// ══════════════════════════════════════════════════════════════════
// TIKTOK
// ══════════════════════════════════════════════════════════════════
async function loadTikTok() {
  const tbody = document.getElementById('tiktok-tbody'); if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Laden</td></tr>';
  try {
    const data = await api('GET','/api/tiktok'); if (!data) return;
    const h = document.getElementById('tiktok-live-hinweis');
    if (h) { h.className = data.liveChannelId ? 'alert alert-success' : 'alert alert-error'; h.textContent = data.liveChannelId ? 'Live-Kanal ist konfiguriert.' : 'Kein Live-Kanal gesetzt! Einstellungen pruefen.'; }
    const s = data.streamer||[];
    tbody.innerHTML = s.length===0 ? '<tr><td colspan="4" class="loading-text">Keine TikToker</td></tr>' :
      s.map(t=>`<tr><td>${t.ist_live?'<span class="badge badge-danger">Live</span>':'<span class="badge badge-info">Offline</span>'}</td><td><strong>@${escHtml(t.tiktok_username)}</strong></td><td>${escHtml(t.anzeige_name||t.tiktok_username)}</td><td><button class="btn btn-danger btn-sm" onclick="deleteTikTok(${t.id},'${escHtml(t.tiktok_username)}')">Entfernen</button></td></tr>`).join('');
  } catch (err) { tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Fehler</td></tr>'; }
}

async function deleteTikTok(id, name) {
  if (!confirm(`@${name} entfernen?`)) return;
  try { await api('DELETE',`/api/tiktok/${id}`); toast(`@${name} entfernt`,'success'); loadTikTok(); }
  catch (err) { toast(err.message,'error'); }
}

// ══════════════════════════════════════════════════════════════════
// TICKETS
// ══════════════════════════════════════════════════════════════════
async function loadTickets() {
  const tbody = document.getElementById('tickets-tbody'); if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Laden</td></tr>';
  try {
    const data = await api('GET','/api/tickets'); if (!data) return;
    const t = data.tickets || [];
    tbody.innerHTML = t.length === 0 ? '<tr><td colspan="6" class="loading-text">Keine Tickets</td></tr>' :
      t.map(r => `<tr><td><strong>#${r.id}</strong></td><td>${escHtml(r.username)}</td><td>${escHtml(r.kategorie)}</td><td><span class="badge badge-${r.status==='offen'?'warning':'success'}">${escHtml(r.status)}</span></td><td>${formatDate(r.erstellt_am)}</td><td>${r.geschlossen_am ? formatDate(r.geschlossen_am) + ' von ' + escHtml(r.geschlossen_von||'') : '—'}</td></tr>`).join('');
  } catch (err) { tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Fehler</td></tr>'; }
}

// ══════════════════════════════════════════════════════════════════
// FAHNDUNGEN
// ══════════════════════════════════════════════════════════════════
async function loadFahndungen() {
  const tbody = document.getElementById('fahndungen-tbody'); if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="loading-text">Laden</td></tr>';
  try {
    const data = await api('GET','/api/fahndungen?filter=alle'); if (!data) return;
    const f = data.fahndungen || [];
    tbody.innerHTML = f.length === 0 ? '<tr><td colspan="7" class="loading-text">Keine Fahndungen</td></tr>' :
      f.map(r => `<tr><td><strong>#${r.id}</strong></td><td>${escHtml(r.gesuchter)}</td><td>${escHtml(r.roblox_name||'—')}</td><td>${escHtml(r.grund)}</td><td><span class="badge badge-${r.status==='gesucht'?'danger':'success'}">${escHtml(r.status)}</span></td><td>${escHtml(r.erstellt_von_name)}</td><td><button class="btn btn-danger btn-sm" onclick="deleteFahndung(${r.id})">Loeschen</button></td></tr>`).join('');
  } catch (err) { tbody.innerHTML = '<tr><td colspan="7" class="loading-text">Fehler</td></tr>'; }
}
async function deleteFahndung(id) { if (!confirm('Fahndung loeschen?')) return; try { await api('DELETE',`/api/fahndungen/${id}`); toast('Geloescht','success'); loadFahndungen(); } catch(e) { toast(e.message,'error'); } }

// ══════════════════════════════════════════════════════════════════
// DIENSTPLAN
// ══════════════════════════════════════════════════════════════════
async function loadDienstplan() {
  const tbody = document.getElementById('dienstplan-tbody'); if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Laden</td></tr>';
  try {
    const data = await api('GET','/api/dienstplan'); if (!data) return;
    const e = data.eintraege || [];
    tbody.innerHTML = e.length === 0 ? '<tr><td colspan="6" class="loading-text">Keine Eintraege</td></tr>' :
      e.map(r => `<tr><td><strong>${escHtml(r.tag)}</strong></td><td>${escHtml(r.username)}</td><td>${escHtml(r.fraktion)}</td><td>${escHtml(r.von_uhrzeit)}</td><td>${escHtml(r.bis_uhrzeit)}</td><td><button class="btn btn-danger btn-sm" onclick="deleteDienstplan(${r.id})">Loeschen</button></td></tr>`).join('');
  } catch (err) { tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Fehler</td></tr>'; }
}
async function deleteDienstplan(id) { if (!confirm('Eintrag loeschen?')) return; try { await api('DELETE',`/api/dienstplan/${id}`); toast('Geloescht','success'); loadDienstplan(); } catch(e) { toast(e.message,'error'); } }

// ══════════════════════════════════════════════════════════════════
// ABWESENHEITEN
// ══════════════════════════════════════════════════════════════════
async function loadAbwesenheiten() {
  const tbody = document.getElementById('abwesenheiten-tbody'); if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Laden</td></tr>';
  try {
    const data = await api('GET','/api/abwesenheiten'); if (!data) return;
    const a = data.abwesenheiten || [];
    tbody.innerHTML = a.length === 0 ? '<tr><td colspan="6" class="loading-text">Keine Abwesenheiten</td></tr>' :
      a.map(r => `<tr><td>${escHtml(r.username)}</td><td>${escHtml(r.fraktion||'—')}</td><td>${escHtml(r.von)}</td><td>${escHtml(r.bis)}</td><td>${escHtml(r.grund)}</td><td><button class="btn btn-danger btn-sm" onclick="deleteAbwesenheit(${r.id})">Loeschen</button></td></tr>`).join('');
  } catch (err) { tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Fehler</td></tr>'; }
}
async function deleteAbwesenheit(id) { if (!confirm('Abwesenheit loeschen?')) return; try { await api('DELETE',`/api/abwesenheiten/${id}`); toast('Geloescht','success'); loadAbwesenheiten(); } catch(e) { toast(e.message,'error'); } }

// ══════════════════════════════════════════════════════════════════
// AUSBILDUNGEN
// ══════════════════════════════════════════════════════════════════
async function loadAusbildungen() {
  const tbody = document.getElementById('ausbildungen-tbody'); if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="loading-text">Laden</td></tr>';
  try {
    const data = await api('GET','/api/ausbildungen'); if (!data) return;
    const a = data.ausbildungen || [];
    tbody.innerHTML = a.length === 0 ? '<tr><td colspan="7" class="loading-text">Keine Ausbildungen</td></tr>' :
      a.map(r => `<tr><td>${escHtml(r.username)}</td><td>${escHtml(r.fraktion)}</td><td>${escHtml(r.ausbildung)}</td><td>${escHtml(r.ausbilder_name||'—')}</td><td><span class="badge badge-${r.status==='laufend'?'warning':'success'}">${escHtml(r.status)}</span></td><td>${formatDate(r.gestartet_am)}</td><td><button class="btn btn-danger btn-sm" onclick="deleteAusbildung(${r.id})">Loeschen</button></td></tr>`).join('');
  } catch (err) { tbody.innerHTML = '<tr><td colspan="7" class="loading-text">Fehler</td></tr>'; }
}
async function deleteAusbildung(id) { if (!confirm('Ausbildung loeschen?')) return; try { await api('DELETE',`/api/ausbildungen/${id}`); toast('Geloescht','success'); loadAusbildungen(); } catch(e) { toast(e.message,'error'); } }

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════
function renderPagination(id, total, current, fn) {
  const c = document.getElementById(id);
  if (total <= 1) { c.innerHTML = ''; return; }
  let h = `<button ${current<=1?'disabled':''} onclick="${fn.name}(${current-1})">Zurueck</button>`;
  for (let i=1;i<=total;i++) { if (i===1||i===total||Math.abs(i-current)<=1) h += `<button class="${i===current?'active':''}" onclick="${fn.name}(${i})">${i}</button>`; else if (Math.abs(i-current)===2) h += '<span style="color:var(--text-muted)">...</span>'; }
  h += `<button ${current>=total?'disabled':''} onclick="${fn.name}(${current+1})">Weiter</button>`;
  c.innerHTML = h;
}

function formatDate(iso, withTime=false) {
  if (!iso) return '—';
  const d = new Date(iso); if (isNaN(d)) return iso;
  const date = d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
  return withTime ? `${date} ${d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}` : date;
}

function escHtml(s) { if (s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function statusBadge(s) {
  const map = { offen:'warning', ermittlung:'info', strafverfahren:'info', gerichtsverfahren:'info', abgeschlossen:'success' };
  return map[(s||'').toLowerCase()] || 'info';
}

// ══════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Login
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('login-error');
    err.classList.add('hidden'); btn.disabled = true;
    try {
      const d = await api('POST','/api/auth/login',{ username:document.getElementById('login-username').value, password:document.getElementById('login-password').value });
      if (d?.ok) showApp(d);
    } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
    finally { btn.disabled = false; }
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => { await api('POST','/api/auth/logout'); showLogin(); toast('Abgemeldet','info'); });

  // Sidebar
  document.getElementById('hamburger').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  document.getElementById('sidebar-close').addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));

  // Nav
  document.querySelectorAll('.nav-item').forEach(el => el.addEventListener('click', (e) => { e.preventDefault(); navigate(el.dataset.page); }));

  // Settings
  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('settings-msg'); msg.classList.add('hidden');
    const body = { guildId: e.target.dataset.guildId };
    new FormData(e.target).forEach((v,k) => { body[k] = v || null; });
    try { await api('POST','/api/settings',body); msg.className='alert alert-success'; msg.textContent='Gespeichert'; msg.classList.remove('hidden'); toast('Gespeichert','success'); }
    catch (err) { msg.className='alert alert-error'; msg.textContent=err.message; msg.classList.remove('hidden'); }
  });

  // Search debounce
  const debounce = (el, fn) => { let t; if (el) el.addEventListener('input', () => { clearTimeout(t); t = setTimeout(fn, 400); }); };
  debounce(document.getElementById('verfahren-search'), () => loadVerfahren(1));
  debounce(document.getElementById('akten-search'), () => loadAkten(1));
  debounce(document.getElementById('spieler-search'), () => loadSpieler(1));
  debounce(document.getElementById('warns-search'), () => loadWarns(1));

  // Add Admin
  document.getElementById('add-admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('add-admin-error'); err.classList.add('hidden');
    try {
      await api('POST','/api/admins',{ username:document.getElementById('new-admin-username').value, password:document.getElementById('new-admin-password').value, role:document.getElementById('new-admin-role').value });
      closeModal('add-admin-modal'); toast('Admin erstellt','success'); loadAdmins(); e.target.reset();
    } catch (ex) { err.textContent=ex.message; err.classList.remove('hidden'); }
  });

  // Chat leeren
  const chatForm = document.getElementById('chat-leeren-form');
  if (chatForm) chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ch = document.getElementById('chat-kanal-select').value, m = parseInt(document.getElementById('chat-menge').value), msg = document.getElementById('chat-msg');
    if (!ch) { toast('Kanal waehlen','error'); return; }
    try { const r = await api('POST','/api/chat-leeren',{channelId:ch,menge:m}); msg.className='alert alert-success'; msg.textContent=`${r.deleted} Nachrichten geloescht`; msg.classList.remove('hidden'); loadChat(); }
    catch (err) { msg.className='alert alert-error'; msg.textContent=err.message; msg.classList.remove('hidden'); }
  });

  // TikTok
  const ttForm = document.getElementById('tiktok-form');
  if (ttForm) ttForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('tiktok-username').value, n = document.getElementById('tiktok-anzeigename').value, msg = document.getElementById('tiktok-msg');
    try { await api('POST','/api/tiktok',{username:u,anzeigeName:n}); msg.className='alert alert-success'; msg.textContent=`@${u} hinzugefuegt`; msg.classList.remove('hidden'); document.getElementById('tiktok-username').value=''; document.getElementById('tiktok-anzeigename').value=''; loadTikTok(); }
    catch (err) { msg.className='alert alert-error'; msg.textContent=err.message; msg.classList.remove('hidden'); }
  });

  // Init
  checkAuth();
});
