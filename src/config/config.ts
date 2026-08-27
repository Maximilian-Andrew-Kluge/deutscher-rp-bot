import dotenv from 'dotenv';
dotenv.config();

export const config = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  guildId: process.env.GUILD_ID || '',
  databasePath: process.env.DATABASE_PATH || './data/database.db',

  colors: {
    polizei: 0x2563EB,
    feuerwehr: 0xE74C3C,
    rettungsdienst: 0xFF6B81,
    justiz: 0x9B59B6,
    adac: 0xFFD700,
    server: 0x5865F2,
    success: 0x2ECC71,
    error: 0xE74C3C,
    warning: 0xF39C12,
    info: 0x3498DB,
  },

  prefixes: {
    verfahren: 'RP-JU',
    akte: 'AKT',
    polizei: 'RP-POL',
  },

  rollen: {
    // Administration
    owner: 'OWNER',
    coOwner: 'CO-OWNER',
    administrator: 'ADMINISTRATOR',
    administratorAnwaerter: 'ADMINISTRATOR-ANWÄRTER',
    moderator: 'MODERATOR',
    developer: 'DEVELOPER',
    // Support
    supportLeitung: 'SUPPORT-LEITUNG',
    supporter: 'SUPPORTER',
    supportAnwaerter: 'SUPPORT-AZUBI',
    // Fraktion
    fraktionsleitung: 'FRAKTIONSLEITUNG',
    // Justiz
    justizLeitung: 'JUSTIZ-LEITUNG',
    richter: 'RICHTER',
    staatsanwalt: 'STAATSANWALT',
    anwalt: 'ANWALT',
    justizAnwaerter: 'JUSTIZANWÄRTER',
    // Polizei
    polizeiLeitung: 'POLIZEI-LEITUNG',
    polizei: 'POLIZEI',
    polizeiAnwaerter: 'POLIZEIANWÄRTER',
    // Feuerwehr
    feuerwehrLeitung: 'FEUERWEHR-LEITUNG',
    feuerwehr: 'FEUERWEHR',
    feuerwehrAnwaerter: 'FEUERWEHRANWÄRTER',
    // Rettungsdienst
    rettungsdienstLeitung: 'RETTUNGSDIENST-LEITUNG',
    rettungsdienst: 'RETTUNGSDIENST',
    rettungsdienstAnwaerter: 'RETTUNGSDIENSTANWÄRTER',
    // ADAC
    adacLeitung: 'ADAC-LEITUNG',
  }
};

export type BotConfig = typeof config;
