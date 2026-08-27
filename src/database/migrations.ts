import { getDatabase } from './database';

export function runMigrations(): void {
  const db = getDatabase();

  // Server-Einstellungen — erweitert um Ausbildungs-Kanäle
  db.exec(`
    CREATE TABLE IF NOT EXISTS server_settings (
      guild_id TEXT PRIMARY KEY,
      verfahren_channel_id TEXT,
      akten_channel_id TEXT,
      log_channel_id TEXT,
      voice_create_channel_id TEXT,
      voice_category_id TEXT,
      polizei_ausbildung_channel_id TEXT,
      feuerwehr_ausbildung_channel_id TEXT,
      rettungsdienst_ausbildung_channel_id TEXT,
      justiz_ausbildung_channel_id TEXT,
      ankuendigung_channel_id TEXT,
      willkommen_channel_id TEXT,
      setup_complete INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Fehlende Spalten in server_settings nachträglich hinzufügen (Migration)
  const settingsCols = ['polizei_ausbildung_channel_id', 'feuerwehr_ausbildung_channel_id',
    'rettungsdienst_ausbildung_channel_id', 'justiz_ausbildung_channel_id', 'ankuendigung_channel_id',
    'willkommen_channel_id', 'live_channel_id', 'support_channel_id', 'support_notify_channel_id',
    'counter_category_id', 'counter_members_id', 'counter_online_id', 'counter_boosts_id', 'counter_clock_id'];
  for (const col of settingsCols) {
    try {
      db.exec(`ALTER TABLE server_settings ADD COLUMN ${col} TEXT`);
    } catch { /* Spalte existiert bereits */ }
  }

  // Rollen-Konfiguration
  db.exec(`
    CREATE TABLE IF NOT EXISTS role_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      role_key TEXT NOT NULL,
      role_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(guild_id, role_key)
    )
  `);

  // Aktenzeichen-Zähler — NIEMALS zurücksetzen
  db.exec(`
    CREATE TABLE IF NOT EXISTS aktenzeichen_counter (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      prefix TEXT NOT NULL,
      year INTEGER NOT NULL,
      counter INTEGER DEFAULT 0,
      UNIQUE(guild_id, prefix, year)
    )
  `);

  // Verfahren — erweitert um gesperrt-Feld
  db.exec(`
    CREATE TABLE IF NOT EXISTS verfahren (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      aktenzeichen TEXT NOT NULL UNIQUE,
      forum_post_id TEXT,
      forum_channel_id TEXT,
      verfahrensart TEXT NOT NULL,
      status TEXT DEFAULT 'offen',
      gesperrt INTEGER DEFAULT 0,
      beschuldigter TEXT,
      roblox_name TEXT,
      roblox_id TEXT,
      geschaedigter TEXT,
      zeugen TEXT,
      ermittler TEXT,
      richter TEXT,
      staatsanwalt TEXT,
      anwalt TEXT,
      vorwurf TEXT,
      tatzeit TEXT,
      tatort TEXT,
      sachverhalt TEXT,
      zusatzinfo TEXT,
      erstellt_von TEXT NOT NULL,
      erstellt_am TEXT DEFAULT (datetime('now')),
      aktualisiert_am TEXT DEFAULT (datetime('now')),
      abgeschlossen_am TEXT,
      abgeschlossen_von TEXT,
      archiviert INTEGER DEFAULT 0
    )
  `);

  // gesperrt-Spalte nachträglich hinzufügen falls nicht vorhanden
  try {
    db.exec(`ALTER TABLE verfahren ADD COLUMN gesperrt INTEGER DEFAULT 0`);
  } catch { /* existiert bereits */ }

  // Verfahren-Notizen — erweitert um notiz_id für Löschung
  db.exec(`
    CREATE TABLE IF NOT EXISTS verfahren_notizen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      verfahren_id INTEGER NOT NULL,
      notiz TEXT NOT NULL,
      erstellt_von TEXT NOT NULL,
      erstellt_von_id TEXT,
      erstellt_am TEXT DEFAULT (datetime('now'))
    )
  `);

  // erstellt_von_id nachträglich hinzufügen
  try {
    db.exec(`ALTER TABLE verfahren_notizen ADD COLUMN erstellt_von_id TEXT`);
  } catch { /* existiert bereits */ }

  // Akten
  db.exec(`
    CREATE TABLE IF NOT EXISTS akten (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      aktenzeichen TEXT NOT NULL UNIQUE,
      verfahren_id INTEGER,
      forum_post_id TEXT,
      forum_channel_id TEXT,
      status TEXT DEFAULT 'abgeschlossen',
      inhalt TEXT,
      erstellt_von TEXT NOT NULL,
      erstellt_am TEXT DEFAULT (datetime('now'))
    )
  `);

  // Embed-Vorlagen
  db.exec(`
    CREATE TABLE IF NOT EXISTS embed_vorlagen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      typ TEXT DEFAULT 'custom',
      titel TEXT,
      beschreibung TEXT,
      farbe TEXT,
      autor_name TEXT,
      autor_icon TEXT,
      thumbnail TEXT,
      bild TEXT,
      fusszeil TEXT,
      fusszeile_icon TEXT,
      zeitstempel INTEGER DEFAULT 0,
      felder TEXT,
      erstellt_von TEXT NOT NULL,
      erstellt_am TEXT DEFAULT (datetime('now')),
      UNIQUE(guild_id, name)
    )
  `);

  // Gesendete Embeds — damit sie später bearbeitet werden können
  db.exec(`
    CREATE TABLE IF NOT EXISTS gesendete_embeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      titel TEXT,
      beschreibung TEXT,
      farbe TEXT,
      autor TEXT,
      fusszeile TEXT,
      erstellt_von TEXT,
      erstellt_am TEXT DEFAULT (datetime('now')),
      aktualisiert_am TEXT DEFAULT (datetime('now')),
      UNIQUE(guild_id, message_id)
    )
  `);

  // Temporäre Voice-Kanäle — unverändert
  db.exec(`
    CREATE TABLE IF NOT EXISTS temp_voice_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL UNIQUE,
      owner_id TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      erstellt_am TEXT DEFAULT (datetime('now'))
    )
  `);

  // Logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      aktion TEXT NOT NULL,
      benutzer_id TEXT NOT NULL,
      details TEXT,
      erstellt_am TEXT DEFAULT (datetime('now'))
    )
  `);

  // Urteil + Strafe + Beweise + Fraktion nachträglich hinzufügen (für PDF)
  for (const col of ['urteil TEXT', 'strafe TEXT', 'beweise TEXT', 'fraktion TEXT', 'geburtsdatum TEXT', 'zustaendiges_gericht TEXT', 'weitere_beteiligte TEXT']) {
    try { db.exec(`ALTER TABLE verfahren ADD COLUMN ${col}`); } catch { /* existiert */ }
  }

  // Verfahren-Entwurf (mehrstufige Erstellung — Zwischenspeicher)
  db.exec(`
    CREATE TABLE IF NOT EXISTS verfahren_draft (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      beschuldigter TEXT,
      roblox_name TEXT,
      roblox_id TEXT,
      fraktion TEXT,
      geburtsdatum TEXT,
      verfahrensart TEXT,
      zustaendiges_gericht TEXT,
      vorwurf TEXT,
      tatzeit TEXT,
      tatort TEXT,
      sachverhalt TEXT,
      beweise TEXT,
      richter TEXT,
      staatsanwalt TEXT,
      anwalt TEXT,
      geschaedigter TEXT,
      zeugen TEXT,
      ermittler TEXT,
      weitere_beteiligte TEXT,
      zusatzinfo TEXT,
      erstellt_am TEXT DEFAULT (datetime('now')),
      UNIQUE(guild_id, user_id)
    )
  `);

  // Verwarnungen
  db.exec(`
    CREATE TABLE IF NOT EXISTS warns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      benutzer_id TEXT NOT NULL,
      benutzer_name TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      moderator_name TEXT NOT NULL,
      grund TEXT NOT NULL,
      erstellt_am TEXT DEFAULT (datetime('now'))
    )
  `);

  // TikTok Live-Benachrichtigungen — überwachte Streamer
  db.exec(`
    CREATE TABLE IF NOT EXISTS tiktok_streamer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      tiktok_username TEXT NOT NULL,
      anzeige_name TEXT,
      ist_live INTEGER DEFAULT 0,
      hinzugefuegt_von TEXT,
      erstellt_am TEXT DEFAULT (datetime('now')),
      UNIQUE(guild_id, tiktok_username)
    )
  `);

  // Moderations-Logs (Kick, Ban, Chat leeren etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS mod_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      moderator_name TEXT NOT NULL,
      aktion TEXT NOT NULL,
      ziel_id TEXT,
      ziel_name TEXT,
      grund TEXT,
      erstellt_am TEXT DEFAULT (datetime('now'))
    )
  `);

  console.log('✅ Datenbankmigrationen abgeschlossen.');
}
