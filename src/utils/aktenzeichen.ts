import { getDatabase } from '../database/database';

/**
 * Generiert ein Aktenzeichen basierend auf der HÖCHSTEN aktuell existierenden Nummer.
 *
 * Die Nummer richtet sich dynamisch nach den vorhandenen Verfahren + Akten:
 * - Keine Verfahren/Akten mehr im aktuellen Jahr → beginnt wieder bei 1
 * - Höchste Nummer ist z.B. 4 → nächste wird 5
 * - Wird die höchste (z.B. 5) gelöscht → nächste wird wieder 5
 *
 * Format: PREFIX-JAHR-NNN  (z.B. RP-JU-2026-005)
 * sql.js unterstützt kein RETURNING — daher werden die vorhandenen
 * Aktenzeichen ausgelesen und die höchste Nummer ermittelt.
 */
export function generateAktenzeichen(guildId: string, prefix: string): string {
  const db = getDatabase();
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;

  // Höchste Nummer aus BEIDEN Tabellen (verfahren + akten) ermitteln
  const rows = [
    ...(db.prepare('SELECT aktenzeichen FROM verfahren WHERE guild_id = ? AND aktenzeichen LIKE ?')
      .all(guildId, like) as Array<{ aktenzeichen: string }>),
    ...(db.prepare('SELECT aktenzeichen FROM akten WHERE guild_id = ? AND aktenzeichen LIKE ?')
      .all(guildId, like) as Array<{ aktenzeichen: string }>),
  ];

  let hoechste = 0;
  for (const r of rows) {
    // Letztes Segment nach dem letzten "-" ist die Nummer
    const teile = r.aktenzeichen.split('-');
    const nummer = parseInt(teile[teile.length - 1], 10);
    if (!isNaN(nummer) && nummer > hoechste) {
      hoechste = nummer;
    }
  }

  // Nächste freie Nummer finden (Kollisions-Sicherung falls Nummer doch belegt ist)
  let naechste = hoechste + 1;
  const belegt = new Set(rows.map(r => r.aktenzeichen));
  while (belegt.has(`${prefix}-${year}-${String(naechste).padStart(3, '0')}`)) {
    naechste++;
  }

  const padded = String(naechste).padStart(3, '0');
  return `${prefix}-${year}-${padded}`;
}

/**
 * Gibt die aktuell höchste vergebene Nummer zurück (0 wenn keine existiert).
 */
export function getCurrentCounter(guildId: string, prefix: string): number {
  const db = getDatabase();
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;

  const rows = [
    ...(db.prepare('SELECT aktenzeichen FROM verfahren WHERE guild_id = ? AND aktenzeichen LIKE ?')
      .all(guildId, like) as Array<{ aktenzeichen: string }>),
    ...(db.prepare('SELECT aktenzeichen FROM akten WHERE guild_id = ? AND aktenzeichen LIKE ?')
      .all(guildId, like) as Array<{ aktenzeichen: string }>),
  ];

  let hoechste = 0;
  for (const r of rows) {
    const teile = r.aktenzeichen.split('-');
    const nummer = parseInt(teile[teile.length - 1], 10);
    if (!isNaN(nummer) && nummer > hoechste) hoechste = nummer;
  }
  return hoechste;
}
