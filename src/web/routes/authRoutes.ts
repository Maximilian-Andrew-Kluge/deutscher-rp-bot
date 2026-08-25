import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../../database/database';
import { generateToken, requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ── Login ────────────────────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
    return;
  }

  const db = getDatabase();
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as
    | { id: number; username: string; password_hash: string; role: string; active: number }
    | undefined;

  if (!user || !user.active) {
    res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    return;
  }

  const token = generateToken(user.username, user.role);

  // Logging
  db.prepare('INSERT INTO admin_logs (username, aktion, details) VALUES (?, ?, ?)')
    .run(user.username, 'login', `IP: ${req.ip}`);

  // secure nur wenn explizit HTTPS genutzt wird (ADMIN_HTTPS=true)
  // Bei Zugriff über http:// (z.B. lokales Netzwerk) muss secure=false sein,
  // sonst wird das Cookie vom Browser verworfen.
  const useSecure = process.env.ADMIN_HTTPS === 'true';

  res
    .cookie('admin_token', token, {
      httpOnly: true,
      secure: useSecure,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24h
    })
    .json({ ok: true, username: user.username, role: user.role });
});

// ── Logout ───────────────────────────────────────────────────────────────────
router.post('/logout', (req: Request, res: Response): void => {
  res.clearCookie('admin_token').json({ ok: true });
});

// ── Aktuellen Benutzer abrufen ───────────────────────────────────────────────
router.get('/me', requireAuth, (req: AuthRequest, res: Response): void => {
  res.json({ username: req.admin!.username, role: req.admin!.role });
});

export default router;
