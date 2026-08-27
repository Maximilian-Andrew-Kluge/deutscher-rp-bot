import { Router, Response } from 'express';
import { Client } from 'discord.js';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../../database/database';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { ROLLEN_KEYS } from '../../commands/rollenpanel';

export function createApiRouter(client: Client): Router {
  const router = Router();

  // Alle Routen benötigen Auth
  router.use(requireAuth);

  // ════════════════════════════════════════════════════════════════════════════
  // DASHBOARD — Statistiken
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/stats', async (_req: AuthRequest, res: Response): Promise<void> => {
    const db = getDatabase();
    try {
      const totalVerfahren = (db.prepare('SELECT COUNT(*) as c FROM verfahren').get() as { c: number }).c;
      const offeneVerfahren = (db.prepare("SELECT COUNT(*) as c FROM verfahren WHERE status != 'abgeschlossen' AND archiviert = 0").get() as { c: number }).c;
      const totalAkten = (db.prepare('SELECT COUNT(*) as c FROM akten').get() as { c: number }).c;
      const konfigurierteRollen = (db.prepare('SELECT COUNT(*) as c FROM role_config').get() as { c: number }).c;

      const guild = client.guilds.cache.first();
      const memberCount = guild?.memberCount ?? 0;
      const guildName = guild?.name ?? 'Unbekannt';
      const botPing = client.ws.ping;

      res.json({
        totalVerfahren,
        offeneVerfahren,
        totalAkten,
        konfigurierteRollen,
        totalRollen: ROLLEN_KEYS.length,
        memberCount,
        guildName,
        botPing,
        botStatus: client.isReady() ? 'online' : 'offline',
      });
    } catch (err) {
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ROLLEN-KONFIGURATION
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/rollen', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const guildId = req.query.guildId as string || client.guilds.cache.first()?.id || '';

    const gespeicherteRollen = db.prepare('SELECT role_key, role_id FROM role_config WHERE guild_id = ?')
      .all(guildId) as unknown as Array<{ role_key: string; role_id: string }>;

    const roleMap = new Map(gespeicherteRollen.map(r => [r.role_key, r.role_id]));

    // Discord-Rollen des Servers abrufen
    const guild = client.guilds.cache.get(guildId) || client.guilds.cache.first();
    const discordRollen = guild
      ? guild.roles.cache
          .filter(r => !r.managed && r.name !== '@everyone')
          .sort((a, b) => b.position - a.position)
          .map(r => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position }))
      : [];

    const result = ROLLEN_KEYS.map(r => ({
      key: r.key,
      label: r.label,
      emoji: r.emoji,
      beschreibung: r.beschreibung,
      roleId: roleMap.get(r.key) || null,
    }));

    res.json({ rollen: result, discordRollen, guildId });
  });

  router.post('/rollen', async (req: AuthRequest, res: Response): Promise<void> => {
    const { guildId, roleKey, roleId } = req.body as { guildId?: string; roleKey?: string; roleId?: string };
    const effectiveGuildId = guildId || client.guilds.cache.first()?.id || '';

    if (!roleKey || !roleId) {
      res.status(400).json({ error: 'roleKey und roleId erforderlich' });
      return;
    }

    const validKey = ROLLEN_KEYS.find(r => r.key === roleKey);
    if (!validKey) {
      res.status(400).json({ error: `Unbekannter roleKey: ${roleKey}` });
      return;
    }

    const db = getDatabase();
    db.prepare(`
      INSERT INTO role_config (guild_id, role_key, role_id)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id, role_key) DO UPDATE SET role_id = excluded.role_id
    `).run(effectiveGuildId, roleKey, roleId);

    db.prepare('INSERT INTO admin_logs (username, aktion, details) VALUES (?, ?, ?)')
      .run(req.admin!.username, 'rollen_update', `${roleKey} → ${roleId}`);

    res.json({ ok: true });
  });

  router.delete('/rollen/:roleKey', (req: AuthRequest, res: Response): void => {
    const { roleKey } = req.params;
    const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id || '';
    const db = getDatabase();
    db.prepare('DELETE FROM role_config WHERE guild_id = ? AND role_key = ?').run(guildId, roleKey);
    res.json({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SERVER-EINSTELLUNGEN
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/settings', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id || '';
    const settings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId) as Record<string, unknown> | undefined;

    // Discord-Kanäle für Dropdowns
    const guild = client.guilds.cache.get(guildId) || client.guilds.cache.first();
    const channels = guild
      ? guild.channels.cache
          .filter(c => c.type === 0 || c.type === 15) // Text + Forum
          .map(c => ({ id: c.id, name: c.name, type: c.type }))
      : [];
    const categories = guild
      ? guild.channels.cache
          .filter(c => c.type === 4)
          .map(c => ({ id: c.id, name: c.name }))
      : [];
    const voiceChannels = guild
      ? guild.channels.cache
          .filter(c => c.type === 2)
          .map(c => ({ id: c.id, name: c.name }))
      : [];

    res.json({ settings: settings || {}, channels, categories, voiceChannels, guildId });
  });

  router.post('/settings', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const body = req.body as Record<string, string>;
    const guildId = body.guildId || client.guilds.cache.first()?.id || '';

    const fields = [
      'verfahren_channel_id', 'akten_channel_id', 'log_channel_id',
      'voice_create_channel_id', 'voice_category_id',
      'polizei_ausbildung_channel_id', 'feuerwehr_ausbildung_channel_id',
      'rettungsdienst_ausbildung_channel_id', 'justiz_ausbildung_channel_id',
      'ankuendigung_channel_id', 'willkommen_channel_id', 'live_channel_id',
    ];

    const existing = db.prepare('SELECT guild_id FROM server_settings WHERE guild_id = ?').get(guildId);
    if (!existing) {
      db.prepare('INSERT INTO server_settings (guild_id) VALUES (?)').run(guildId);
    }

    for (const field of fields) {
      if (body[field] !== undefined) {
        db.prepare(`UPDATE server_settings SET ${field} = ?, updated_at = datetime('now') WHERE guild_id = ?`)
          .run(body[field] || null, guildId);
      }
    }

    db.prepare('INSERT INTO admin_logs (username, aktion, details) VALUES (?, ?, ?)')
      .run(req.admin!.username, 'settings_update', `Guild: ${guildId}`);

    res.json({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // VERFAHREN
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/verfahren', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id || '';
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');
    const offset = (page - 1) * limit;
    const search = (req.query.search as string || '').trim();

    // Nur aktive Verfahren — abgeschlossene/archivierte sind in den Akten
    let query = "SELECT * FROM verfahren WHERE guild_id = ? AND status != 'abgeschlossen' AND archiviert = 0";
    let countQuery = "SELECT COUNT(*) as c FROM verfahren WHERE guild_id = ? AND status != 'abgeschlossen' AND archiviert = 0";
    const params: unknown[] = [guildId];

    if (search) {
      query += ' AND (aktenzeichen LIKE ? OR beschuldigter LIKE ? OR vorwurf LIKE ?)';
      countQuery += ' AND (aktenzeichen LIKE ? OR beschuldigter LIKE ? OR vorwurf LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    query += ' ORDER BY erstellt_am DESC LIMIT ? OFFSET ?';

    const total = (db.prepare(countQuery).get(...params) as { c: number }).c;
    const verfahren = db.prepare(query).all(...params, limit, offset);

    res.json({ verfahren, total, page, limit, pages: Math.ceil(total / limit) });
  });

  router.delete('/verfahren/:id', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const { id } = req.params;
    db.prepare('DELETE FROM verfahren WHERE id = ?').run(parseInt(id));
    db.prepare('INSERT INTO admin_logs (username, aktion, details) VALUES (?, ?, ?)')
      .run(req.admin!.username, 'verfahren_delete', `ID: ${id}`);
    res.json({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // AKTEN
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/akten', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id || '';
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');
    const offset = (page - 1) * limit;
    const search = (req.query.search as string || '').trim();

    let query = 'SELECT * FROM akten WHERE guild_id = ?';
    let countQuery = 'SELECT COUNT(*) as c FROM akten WHERE guild_id = ?';
    const params: unknown[] = [guildId];

    if (search) {
      query += ' AND (aktenzeichen LIKE ? OR inhalt LIKE ?)';
      countQuery += ' AND (aktenzeichen LIKE ? OR inhalt LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like);
    }

    query += ' ORDER BY erstellt_am DESC LIMIT ? OFFSET ?';

    const total = (db.prepare(countQuery).get(...params) as { c: number }).c;
    const akten = db.prepare(query).all(...params, limit, offset);

    res.json({ akten, total, page, limit, pages: Math.ceil(total / limit) });
  });

  router.delete('/akten/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    const db = getDatabase();
    const { id } = req.params;
    const akte = db.prepare('SELECT aktenzeichen, verfahren_id, forum_post_id FROM akten WHERE id = ?')
      .get(parseInt(id)) as { aktenzeichen: string; verfahren_id: number | null; forum_post_id: string | null } | undefined;
    if (!akte) {
      res.status(404).json({ error: 'Akte nicht gefunden' });
      return;
    }

    // Discord-Akten-Thread ebenfalls löschen (Website → Server synchronisieren)
    if (akte.forum_post_id) {
      try {
        const thread = await client.channels.fetch(akte.forum_post_id).catch(() => null);
        if (thread && 'delete' in thread) {
          await (thread as { delete: (reason?: string) => Promise<unknown> }).delete('Akte über Website gelöscht');
        }
      } catch (err) {
        console.error('Discord-Thread der Akte konnte nicht gelöscht werden:', err);
      }
    }

    // DB-Einträge löschen (Akte + zugehöriges archiviertes Verfahren)
    db.prepare('DELETE FROM akten WHERE id = ?').run(parseInt(id));
    if (akte.verfahren_id) {
      db.prepare('DELETE FROM verfahren WHERE id = ?').run(akte.verfahren_id);
    }
    db.prepare('INSERT INTO admin_logs (username, aktion, details) VALUES (?, ?, ?)')
      .run(req.admin!.username, 'akte_delete', `Aktenzeichen: ${akte.aktenzeichen}`);
    res.json({ ok: true });
  });

  // ── PDF-Download einer Akte (Justiz- oder Polizei-Verfahrensakte) ──────────
  // Das PDF wird bei Bedarf aus den gespeicherten Verfahrensdaten neu generiert,
  // damit es immer den aktuellen Stand widerspiegelt und auch für Alt-Akten geht.
  router.get('/akten/:aktenzeichen/pdf/:typ', async (req: AuthRequest, res: Response): Promise<void> => {
    const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id || '';
    const { aktenzeichen, typ } = req.params;

    if (typ !== 'justiz' && typ !== 'polizei') {
      res.status(400).json({ error: 'Ungültiger PDF-Typ (justiz oder polizei)' });
      return;
    }

    const db = getDatabase();

    // Akte holen (für verfahren_id) und zugehöriges Verfahren laden
    const akte = db.prepare('SELECT * FROM akten WHERE guild_id = ? AND aktenzeichen = ?')
      .get(guildId, aktenzeichen) as { verfahren_id: number | null; erstellt_von: string } | undefined;
    if (!akte) {
      res.status(404).json({ error: 'Akte nicht gefunden' });
      return;
    }

    let verfahren = akte.verfahren_id
      ? db.prepare('SELECT * FROM verfahren WHERE id = ?').get(akte.verfahren_id) as Record<string, unknown> | undefined
      : undefined;
    // Fallback: über Aktenzeichen suchen (falls verfahren_id fehlt)
    if (!verfahren) {
      verfahren = db.prepare('SELECT * FROM verfahren WHERE guild_id = ? AND aktenzeichen = ?')
        .get(guildId, aktenzeichen) as Record<string, unknown> | undefined;
    }
    if (!verfahren) {
      res.status(404).json({ error: 'Zugehöriges Verfahren nicht gefunden — PDF kann nicht erstellt werden.' });
      return;
    }

    // Notizen laden
    const notizen = db.prepare(
      'SELECT id, notiz, erstellt_von, erstellt_von_id, erstellt_am FROM verfahren_notizen WHERE verfahren_id = ? ORDER BY id ASC'
    ).all(verfahren.id) as unknown as import('../../utils/embeds').NotizData[];

    // "Abgeschlossen durch" als lesbaren Namen auflösen
    let abgeschlossenName = (verfahren.abgeschlossen_von as string) || '';
    if (abgeschlossenName) {
      const user = await client.users.fetch(abgeschlossenName).catch(() => null);
      if (user) abgeschlossenName = user.tag;
    }

    const pdfData = {
      ...(verfahren as unknown as import('../../services/verfahrenService').VerfahrenRow),
      abgeschlossen_von_name: abgeschlossenName,
    };

    try {
      const { generateJustizaktePDF, generatePolizeiaktePDF } = await import('../../services/pdfService');
      const buffer = typ === 'justiz'
        ? await generateJustizaktePDF(pdfData, notizen)
        : await generatePolizeiaktePDF(pdfData, notizen);

      const safeAz = aktenzeichen.replace(/[^a-zA-Z0-9-]/g, '_');
      const label = typ === 'justiz' ? 'Justizakte' : 'Polizei-Verfahrensakte';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${label}_${safeAz}.pdf"`);
      res.send(buffer);
    } catch (err) {
      console.error('PDF-Generierung (Web) fehlgeschlagen:', err);
      res.status(500).json({ error: 'PDF konnte nicht erstellt werden' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // LOGS
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/logs', (_req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const logs = db.prepare('SELECT * FROM admin_logs ORDER BY erstellt_am DESC LIMIT 200').all();
    res.json({ logs });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ADMIN-BENUTZER VERWALTUNG (nur superadmin)
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/admins', (req: AuthRequest, res: Response): void => {
    if (req.admin!.role !== 'superadmin') {
      res.status(403).json({ error: 'Nur für Superadmin' });
      return;
    }
    const db = getDatabase();
    const users = db.prepare('SELECT id, username, role, active, created_at FROM admin_users').all();
    res.json({ users });
  });

  router.post('/admins', async (req: AuthRequest, res: Response): Promise<void> => {
    if (req.admin!.role !== 'superadmin') {
      res.status(403).json({ error: 'Nur für Superadmin' });
      return;
    }
    const { username, password, role } = req.body as { username?: string; password?: string; role?: string };
    if (!username || !password) {
      res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
      return;
    }
    const hash = await bcrypt.hash(password, 12);
    const db = getDatabase();
    try {
      db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, role || 'admin');
      res.json({ ok: true });
    } catch {
      res.status(409).json({ error: 'Benutzername bereits vergeben' });
    }
  });

  router.delete('/admins/:id', (req: AuthRequest, res: Response): void => {
    if (req.admin!.role !== 'superadmin') {
      res.status(403).json({ error: 'Nur für Superadmin' });
      return;
    }
    const db = getDatabase();
    db.prepare('UPDATE admin_users SET active = 0 WHERE id = ?').run(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // DISCORD-SERVER INFO
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/guilds', (_req: AuthRequest, res: Response): void => {
    const guilds = client.guilds.cache.map(g => ({
      id: g.id,
      name: g.name,
      memberCount: g.memberCount,
      icon: g.iconURL(),
    }));
    res.json({ guilds });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SPIELER-ÜBERSICHT
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/spieler', async (req: AuthRequest, res: Response): Promise<void> => {
    const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id || '';
    const search = (req.query.search as string || '').trim().toLowerCase();
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '25');

    const guild = client.guilds.cache.get(guildId) || client.guilds.cache.first();
    if (!guild) { res.json({ spieler: [], total: 0, pages: 0 }); return; }

    try {
      // Alle Members laden (gecacht; bei Bedarf fetch)
      await guild.members.fetch();
      const db = getDatabase();

      let members = [...guild.members.cache.values()].filter(m => !m.user.bot);

      if (search) {
        members = members.filter(m =>
          m.user.tag.toLowerCase().includes(search) ||
          m.displayName.toLowerCase().includes(search) ||
          m.user.id.includes(search)
        );
      }

      // Sortieren: nach Beitrittsdatum (neueste zuerst)
      members.sort((a, b) => (b.joinedTimestamp ?? 0) - (a.joinedTimestamp ?? 0));

      const total = members.length;
      const pages = Math.ceil(total / limit);
      const paginated = members.slice((page - 1) * limit, page * limit);

      // Warns pro Spieler
      const warnCounts = db.prepare(
        'SELECT benutzer_id, COUNT(*) as c FROM warns WHERE guild_id = ? GROUP BY benutzer_id'
      ).all(guildId) as unknown as Array<{ benutzer_id: string; c: number }>;
      const warnMap = new Map(warnCounts.map(w => [w.benutzer_id, w.c]));

      const spieler = paginated.map(m => ({
        id: m.user.id,
        tag: m.user.tag,
        displayName: m.displayName,
        avatar: m.user.displayAvatarURL({ size: 64 }),
        joinedAt: m.joinedAt?.toISOString() ?? null,
        createdAt: m.user.createdAt.toISOString(),
        rollen: m.roles.cache
          .filter(r => r.name !== '@everyone')
          .sort((a, b) => b.position - a.position)
          .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
          .slice(0, 5),
        rollenCount: m.roles.cache.size - 1,
        warns: warnMap.get(m.user.id) ?? 0,
        status: m.presence?.status ?? 'offline',
        booster: !!m.premiumSinceTimestamp,
      }));

      res.json({ spieler, total, page, pages });
    } catch (err) {
      res.status(500).json({ error: 'Fehler beim Laden der Spieler' });
    }
  });

  // Einzelnen Spieler holen
  router.get('/spieler/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
    const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id || '';
    const { userId } = req.params;

    const guild = client.guilds.cache.get(guildId) || client.guilds.cache.first();
    if (!guild) { res.status(404).json({ error: 'Server nicht gefunden' }); return; }

    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      const user = member?.user ?? await client.users.fetch(userId).catch(() => null);
      if (!user) { res.status(404).json({ error: 'Benutzer nicht gefunden' }); return; }

      const db = getDatabase();
      const warns = db.prepare(
        'SELECT * FROM warns WHERE guild_id = ? AND benutzer_id = ? ORDER BY erstellt_am DESC'
      ).all(guildId, userId) as unknown[];

      const modLogs = db.prepare(
        'SELECT * FROM mod_logs WHERE guild_id = ? AND ziel_id = ? ORDER BY erstellt_am DESC LIMIT 20'
      ).all(guildId, userId) as unknown[];

      res.json({
        id: user.id,
        tag: user.tag,
        displayName: member?.displayName ?? user.username,
        avatar: user.displayAvatarURL({ size: 128 }),
        createdAt: user.createdAt.toISOString(),
        joinedAt: member?.joinedAt?.toISOString() ?? null,
        aufServer: !!member,
        rollen: member?.roles.cache
          .filter(r => r.name !== '@everyone')
          .sort((a, b) => b.position - a.position)
          .map(r => ({ id: r.id, name: r.name, color: r.hexColor })) ?? [],
        booster: !!member?.premiumSinceTimestamp,
        warns,
        modLogs,
      });
    } catch {
      res.status(500).json({ error: 'Fehler beim Laden des Spielers' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // WARNS
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/warns', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id || '';
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');
    const offset = (page - 1) * limit;
    const search = (req.query.search as string || '').trim();

    let query = 'SELECT * FROM warns WHERE guild_id = ?';
    let countQuery = 'SELECT COUNT(*) as c FROM warns WHERE guild_id = ?';
    const params: unknown[] = [guildId];

    if (search) {
      query += ' AND (benutzer_name LIKE ? OR benutzer_id LIKE ? OR grund LIKE ?)';
      countQuery += ' AND (benutzer_name LIKE ? OR benutzer_id LIKE ? OR grund LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    query += ' ORDER BY erstellt_am DESC LIMIT ? OFFSET ?';

    const total = (db.prepare(countQuery).get(...params) as { c: number }).c;
    const warns = db.prepare(query).all(...params, limit, offset);

    res.json({ warns, total, page, pages: Math.ceil(total / limit) });
  });

  router.delete('/warns/:id', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const { id } = req.params;
    const warn = db.prepare('SELECT * FROM warns WHERE id = ?').get(parseInt(id)) as { benutzer_name: string; grund: string } | undefined;
    if (!warn) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    db.prepare('DELETE FROM warns WHERE id = ?').run(parseInt(id));
    db.prepare('INSERT INTO admin_logs (username, aktion, details) VALUES (?, ?, ?)')
      .run(req.admin!.username, 'warn_delete', `Warn #${id} von ${warn.benutzer_name}`);
    res.json({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // MOD-LOGS
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/modlogs', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id || '';
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '30');
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT COUNT(*) as c FROM mod_logs WHERE guild_id = ?').get(guildId) as { c: number }).c;
    const logs = db.prepare('SELECT * FROM mod_logs WHERE guild_id = ? ORDER BY erstellt_am DESC LIMIT ? OFFSET ?')
      .all(guildId, limit, offset);

    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CHAT LEEREN (über Website)
  // ════════════════════════════════════════════════════════════════════════════
  router.post('/chat-leeren', async (req: AuthRequest, res: Response): Promise<void> => {
    const { channelId, menge } = req.body as { channelId?: string; menge?: number };

    if (!channelId || !menge || menge < 1 || menge > 100) {
      res.status(400).json({ error: 'channelId und menge (1-100) erforderlich' });
      return;
    }

    const guild = client.guilds.cache.first();
    if (!guild) { res.status(404).json({ error: 'Server nicht gefunden' }); return; }

    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== 0) {
      res.status(404).json({ error: 'Text-Kanal nicht gefunden' });
      return;
    }

    try {
      const { TextChannel } = await import('discord.js');
      const textChannel = channel as unknown as import('discord.js').TextChannel;
      const messages = await textChannel.messages.fetch({ limit: menge });
      const deleted = await textChannel.bulkDelete(messages, true);

      const db = getDatabase();
      db.prepare('INSERT INTO mod_logs (guild_id, moderator_id, moderator_name, aktion, ziel_id, ziel_name, grund) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(guild.id, 'web-admin', req.admin!.username, 'chat_leeren', channelId, channel.name, `${deleted.size} Nachrichten via Web-Panel`);

      db.prepare('INSERT INTO admin_logs (username, aktion, details) VALUES (?, ?, ?)')
        .run(req.admin!.username, 'chat_leeren', `#${channel.name}: ${deleted.size} Nachrichten`);

      res.json({ ok: true, deleted: deleted.size });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      res.status(500).json({ error: msg });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TIKTOK LIVE-STREAMER
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/tiktok', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id || '';
    const streamer = db.prepare('SELECT * FROM tiktok_streamer WHERE guild_id = ? ORDER BY tiktok_username')
      .all(guildId);
    const settings = db.prepare('SELECT live_channel_id FROM server_settings WHERE guild_id = ?')
      .get(guildId) as { live_channel_id: string | null } | undefined;
    res.json({ streamer, liveChannelId: settings?.live_channel_id ?? null });
  });

  router.post('/tiktok', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const guildId = (req.body.guildId as string) || client.guilds.cache.first()?.id || '';
    const username = String(req.body.username || '').replace(/^@/, '').trim().toLowerCase();
    const anzeigeName = String(req.body.anzeigeName || username).trim();

    if (!username) { res.status(400).json({ error: 'Username erforderlich' }); return; }

    try {
      db.prepare('INSERT INTO tiktok_streamer (guild_id, tiktok_username, anzeige_name, hinzugefuegt_von) VALUES (?, ?, ?, ?)')
        .run(guildId, username, anzeigeName, `web:${req.admin!.username}`);
      db.prepare('INSERT INTO admin_logs (username, aktion, details) VALUES (?, ?, ?)')
        .run(req.admin!.username, 'tiktok_add', `@${username}`);
      res.json({ ok: true });
    } catch {
      res.status(409).json({ error: 'TikToker wird bereits überwacht' });
    }
  });

  router.delete('/tiktok/:id', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    db.prepare('DELETE FROM tiktok_streamer WHERE id = ?').run(parseInt(req.params.id));
    db.prepare('INSERT INTO admin_logs (username, aktion, details) VALUES (?, ?, ?)')
      .run(req.admin!.username, 'tiktok_remove', `ID: ${req.params.id}`);
    res.json({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ABWESENHEITEN
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/abwesenheiten', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id || '';
    const filter = (req.query.filter as string) || 'aktiv';
    const where = filter === 'alle' ? '' : `AND aktiv = ${filter === 'aktiv' ? '1' : '0'}`;
    const rows = db.prepare(`SELECT * FROM abwesenheiten WHERE guild_id = ? ${where} ORDER BY erstellt_am DESC`).all(guildId);
    res.json({ abwesenheiten: rows });
  });

  router.delete('/abwesenheiten/:id', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    db.prepare('DELETE FROM abwesenheiten WHERE id = ?').run(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // AUSBILDUNGEN
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/ausbildungen', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id || '';
    const filter = (req.query.filter as string) || 'alle';
    const where = filter === 'alle' ? '' : `AND status = '${filter}'`;
    const rows = db.prepare(`SELECT * FROM ausbildungen WHERE guild_id = ? ${where} ORDER BY gestartet_am DESC`).all(guildId);
    res.json({ ausbildungen: rows });
  });

  router.delete('/ausbildungen/:id', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    db.prepare('DELETE FROM ausbildungen WHERE id = ?').run(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TICKETS
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/tickets', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id || '';
    const filter = (req.query.filter as string) || 'alle';
    const where = filter === 'alle' ? '' : `AND status = '${filter}'`;
    const rows = db.prepare(`SELECT * FROM tickets WHERE guild_id = ? ${where} ORDER BY erstellt_am DESC LIMIT 50`).all(guildId);
    res.json({ tickets: rows });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // DIENSTPLAN
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/dienstplan', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id || '';
    const rows = db.prepare(`SELECT * FROM dienstplan WHERE guild_id = ? ORDER BY CASE tag WHEN 'Montag' THEN 1 WHEN 'Dienstag' THEN 2 WHEN 'Mittwoch' THEN 3 WHEN 'Donnerstag' THEN 4 WHEN 'Freitag' THEN 5 WHEN 'Samstag' THEN 6 WHEN 'Sonntag' THEN 7 END, von_uhrzeit`).all(guildId);
    res.json({ eintraege: rows });
  });

  router.delete('/dienstplan/:id', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    db.prepare('DELETE FROM dienstplan WHERE id = ?').run(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // FAHNDUNGEN
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/fahndungen', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id || '';
    const filter = (req.query.filter as string) || 'gesucht';
    const where = filter === 'alle' ? '' : `AND status = '${filter}'`;
    const rows = db.prepare(`SELECT * FROM fahndungen WHERE guild_id = ? ${where} ORDER BY erstellt_am DESC`).all(guildId);
    res.json({ fahndungen: rows });
  });

  router.delete('/fahndungen/:id', (req: AuthRequest, res: Response): void => {
    const db = getDatabase();
    db.prepare('DELETE FROM fahndungen WHERE id = ?').run(parseInt(req.params.id));
    res.json({ ok: true });
  });

  return router;
}
