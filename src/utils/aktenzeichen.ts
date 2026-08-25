import { getDatabase } from '../database/database';

/**
 * Generiert ein eindeutiges Aktenzeichen.
 * Der Zähler wird DAUERHAFT in der DB gespeichert und nie zurückgesetzt.
 * sql.js unterstützt kein RETURNING — daher separates SELECT nach dem UPDATE.
 */
export function generateAktenzeichen(guildId: string, prefix: string): string {
  const db = getDatabase();
  const year = new Date().getFullYear();

  // Prüfen ob Eintrag existiert
  const existing = db.prepare(
    'SELECT counter FROM aktenzeichen_counter WHERE guild_id = ? AND prefix = ? AND year = ?'
  ).get(guildId, prefix, year) as { counter: number } | undefined;

  let newCounter: number;

  if (existing) {
    // Hochzählen
    newCounter = existing.counter + 1;
    db.prepare(
      'UPDATE aktenzeichen_counter SET counter = ? WHERE guild_id = ? AND prefix = ? AND year = ?'
    ).run(newCounter, guildId, prefix, year);
  } else {
    // Neuen Eintrag anlegen
    newCounter = 1;
    db.prepare(
      'INSERT INTO aktenzeichen_counter (guild_id, prefix, year, counter) VALUES (?, ?, ?, 1)'
    ).run(guildId, prefix, year);
  }

  const paddedCounter = String(newCounter).padStart(3, '0');
  return `${prefix}-${year}-${paddedCounter}`;
}

export function getCurrentCounter(guildId: string, prefix: string): number {
  const db = getDatabase();
  const year = new Date().getFullYear();

  const row = db.prepare(
    'SELECT counter FROM aktenzeichen_counter WHERE guild_id = ? AND prefix = ? AND year = ?'
  ).get(guildId, prefix, year) as { counter: number } | undefined;

  return row?.counter ?? 0;
}
