/**
 * Datenbankmodul — nutzt sql.js (reines WebAssembly, kein nativer Build nötig).
 * Bietet eine synchrone better-sqlite3-kompatible API durch sofortigen
 * WASM-Load beim Modulstart.
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config/config';

// sql.js Typen
interface SqlJsStatic {
  Database: new (data?: ArrayLike<number> | Buffer | null) => SqlDatabase;
}

interface SqlStatement {
  bind(params?: unknown): boolean;
  step(): boolean;
  getAsObject(params?: unknown): Record<string, unknown>;
  free(): boolean;
  reset(): void;
}

interface SqlDatabase {
  run(sql: string, params?: unknown): SqlDatabase;
  prepare(sql: string): SqlStatement;
  exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
  export(): Uint8Array;
  close(): void;
  getRowsModified(): number;
}

// ---- Synchroner Wrapper ----

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface PreparedStatement {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

class SyncDatabase {
  private _db: SqlDatabase;
  private _filePath: string;
  private _saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(db: SqlDatabase, filePath: string) {
    this._db = db;
    this._filePath = filePath;
  }

  pragma(pragma: string): void {
    try { this._db.run(`PRAGMA ${pragma}`); } catch { /* ignorieren */ }
  }

  exec(sql: string): void {
    // Mehrere Statements splitten und einzeln ausführen
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      try {
        this._db.run(stmt);
      } catch (err) {
        // Fehler bei einzelnen Statements loggen aber weitermachen
        const msg = (err as Error).message;
        if (!msg.includes('already exists')) {
          console.warn(`SQL-Warnung: ${msg} bei: ${stmt.substring(0, 80)}`);
        }
      }
    }
    this._scheduleSave();
  }

  prepare(sql: string): PreparedStatement {
    const self = this;

    return {
      run(...params: unknown[]): RunResult {
        try {
          self._db.run(sql, params as unknown[]);
          const changes = self._db.getRowsModified();
          let lastId = 0;
          try {
            const r = self._db.exec('SELECT last_insert_rowid()');
            if (r.length > 0 && r[0].values.length > 0) {
              lastId = r[0].values[0][0] as number;
            }
          } catch { /* ignorieren */ }
          self._scheduleSave();
          return { changes, lastInsertRowid: lastId };
        } catch (err) {
          throw err;
        }
      },

      get(...params: unknown[]): Record<string, unknown> | undefined {
        try {
          const stmt = self._db.prepare(sql);
          stmt.bind(params as unknown[]);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        } catch (err) {
          throw err;
        }
      },

      all(...params: unknown[]): Record<string, unknown>[] {
        try {
          const results: Record<string, unknown>[] = [];
          const stmt = self._db.prepare(sql);
          stmt.bind(params as unknown[]);
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        } catch (err) {
          throw err;
        }
      }
    };
  }

  close(): void {
    this._saveToFile();
    this._db.close();
  }

  private _scheduleSave(): void {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._saveToFile(), 500);
  }

  private _saveToFile(): void {
    try {
      const data = this._db.export();
      const dir = path.dirname(this._filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this._filePath, Buffer.from(data));
    } catch (err) {
      console.error('Fehler beim Speichern der DB:', err);
    }
  }
}

// ---- Globale Instanz ----

let _dbInstance: SyncDatabase | null = null;

/**
 * Gibt die synchrone Datenbankinstanz zurück.
 * Muss nach initDatabase() aufgerufen werden.
 */
export function getDatabase(): SyncDatabase {
  if (!_dbInstance) {
    throw new Error('Datenbank nicht initialisiert! Bitte zuerst initDatabase() aufrufen.');
  }
  return _dbInstance;
}

/**
 * Initialisiert die Datenbank synchron.
 * MUSS einmal beim Start aufgerufen werden (await initDatabase()).
 */
export async function initDatabase(): Promise<void> {
  if (_dbInstance) return;

  const dbPath = path.resolve(config.databasePath);
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // sql.js async laden
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const initSqlJs: (config?: unknown) => Promise<SqlJsStatic> = require('sql.js');
  const SQL = await initSqlJs();

  let db: SqlDatabase;

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log(`✅ Datenbank geladen: ${dbPath}`);
  } else {
    db = new SQL.Database();
    console.log(`✅ Neue Datenbank erstellt: ${dbPath}`);
  }

  _dbInstance = new SyncDatabase(db, dbPath);
}

export function closeDatabase(): void {
  if (_dbInstance) {
    _dbInstance.close();
    _dbInstance = null;
    console.log('🔒 Datenbank geschlossen.');
  }
}
