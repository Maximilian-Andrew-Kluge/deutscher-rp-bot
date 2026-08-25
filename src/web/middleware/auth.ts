import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/config';

export interface AuthRequest extends Request {
  admin?: { username: string; role: string };
}

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'deutscher-rp-admin-secret-change-me';

export function generateToken(username: string, role: string): string {
  return jwt.sign({ username, role }, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): { username: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { username: string; role: string };
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  // Token aus Cookie oder Authorization-Header
  const token = req.cookies?.admin_token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    if (req.path.startsWith('/api/')) {
      res.status(401).json({ error: 'Nicht authentifiziert' });
    } else {
      res.redirect('/login');
    }
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    if (req.path.startsWith('/api/')) {
      res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
    } else {
      res.redirect('/login');
    }
    return;
  }

  req.admin = payload;
  next();
}
