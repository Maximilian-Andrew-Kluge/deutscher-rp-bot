import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { Client } from 'discord.js';
import { getDatabase } from '../database/database';
import authRoutes from './routes/authRoutes';
import { createApiRouter } from './routes/apiRoutes';
import bcrypt from 'bcryptjs';

const WEB_PORT = parseInt(process.env.ADMIN_PORT || '3000');
const WEB_DIR = path.join(process.cwd(), 'web', 'public');

export async function startWebServer(client: Client): Promise<void> {
  await ensureAdminTables();
  await ensureDefaultAdmin();

  const app = express();

  // ── Middleware ───────────────────────────────────────────────────────────
  // Same-Origin Requests (Panel + API auf gleichem Host/Port) immer erlauben.
  // Bei fehlender Origin (same-origin fetch) reflektieren wir sie zurück.
  app.use(cors({
    origin: (origin, callback) => callback(null, origin || true),
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // ── Statische Dateien ────────────────────────────────────────────────────
  app.use(express.static(WEB_DIR));

  // ── API-Routen ───────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api', createApiRouter(client));

  // ── SPA Fallback — alle anderen Routen → index.html ─────────────────────
  app.get('*', (_req, res) => {
    res.sendFile(path.join(WEB_DIR, 'index.html'));
  });

  app.listen(WEB_PORT, () => {
    console.log(`🌐 Admin-Panel läuft auf http://localhost:${WEB_PORT}`);
  });
}

// ── Datenbank-Tabellen für Admin-Panel ──────────────────────────────────────
async function ensureAdminTables(): Promise<void> {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      aktion TEXT NOT NULL,
      details TEXT,
      erstellt_am TEXT DEFAULT (datetime('now'))
    )
  `);
}

// ── Standard-Admin anlegen falls noch keiner existiert ───────────────────────
async function ensureDefaultAdmin(): Promise<void> {
  const db = getDatabase();
  const count = (db.prepare('SELECT COUNT(*) as c FROM admin_users').get() as { c: number }).c;

  if (count === 0) {
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(defaultPassword, 12);
    db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'superadmin');
    console.log(`\n⚠️  Standard-Admin erstellt:`);
    console.log(`   Benutzername: admin`);
    console.log(`   Passwort: ${defaultPassword}`);
    console.log(`   ⚠️  Bitte sofort im Admin-Panel ändern!\n`);
  }
}
