import { ChannelType, PermissionFlagsBits } from 'discord.js';

/**
 * Server-Blueprint für den Deutschen RP Server.
 * Beschreibt Rollen, Kategorien und Kanäle mit Berechtigungen,
 * damit /serveraufbau einen kompletten Server automatisch aufbauen kann.
 */

export interface RoleBlueprint {
  /** role_config Key (für Bot-Zuordnung), null = keine Zuordnung */
  key: string | null;
  name: string;
  color: number;
  hoist: boolean;       // getrennt anzeigen
  mentionable: boolean;
  permissions: bigint[]; // Discord-Rechte
}

// Gängige Rechte-Sets
const ADMIN_PERMS = [PermissionFlagsBits.Administrator];
const MOD_PERMS = [
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageEmojisAndStickers,
  PermissionFlagsBits.ViewAuditLog,
  PermissionFlagsBits.MoveMembers,
  PermissionFlagsBits.MuteMembers,
  PermissionFlagsBits.DeafenMembers,
  PermissionFlagsBits.ManageThreads,
];
const DEV_PERMS = [
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ViewAuditLog,
  PermissionFlagsBits.ManageThreads,
];
const NO_PERMS: bigint[] = [];

/**
 * Rollen — Reihenfolge = Hierarchie von OBEN nach UNTEN.
 * Die erste Rolle wird ganz oben eingefügt.
 */
export const ROLE_BLUEPRINT: RoleBlueprint[] = [
  // ── Administration ──
  { key: 'owner',                  name: 'OWNER',                    color: 0xf1c40f, hoist: true,  mentionable: false, permissions: ADMIN_PERMS },
  { key: 'coOwner',                name: 'CO-OWNER',                 color: 0xffb000, hoist: true,  mentionable: false, permissions: ADMIN_PERMS },
  { key: 'administrator',          name: 'ADMINISTRATOR',            color: 0xff3b30, hoist: true,  mentionable: false, permissions: MOD_PERMS.concat([PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ManageNicknames, PermissionFlagsBits.ManageWebhooks, PermissionFlagsBits.MentionEveryone, PermissionFlagsBits.ManageEvents]) },
  { key: 'administratorAnwaerter', name: 'ADMINISTRATOR AZUBI',      color: 0xff6961, hoist: true,  mentionable: false, permissions: NO_PERMS },
  { key: 'moderator',              name: 'MODERATOR',                color: 0x5865f2, hoist: true,  mentionable: false, permissions: MOD_PERMS },
  { key: 'developer',              name: 'DEVELOPER',                color: 0xb8b8b8, hoist: true,  mentionable: false, permissions: DEV_PERMS },
  // ── Support ──
  { key: 'supportLeitung',         name: 'SUPPORT-LEITUNG',          color: 0x2ecc71, hoist: true,  mentionable: false, permissions: MOD_PERMS },
  { key: 'supporter',              name: 'SUPPORTER',                color: 0x2ecc71, hoist: true,  mentionable: false, permissions: [PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.MuteMembers] },
  { key: 'supportAnwaerter',       name: 'SUPPORT AZUBI',            color: 0x58d68d, hoist: true,  mentionable: false, permissions: NO_PERMS },
  // ── Fraktionsleitung ──
  { key: 'fraktionsleitung',       name: 'FRAKTIONSLEITUNG',         color: 0xf1c40f, hoist: true,  mentionable: false, permissions: NO_PERMS },
  // ── Justiz ──
  { key: 'justizLeitung',          name: 'JUSTIZ-LEITUNG',           color: 0x6a1b9a, hoist: true,  mentionable: false, permissions: NO_PERMS },
  { key: 'richter',                name: 'RICHTER',                  color: 0x9b59b6, hoist: true,  mentionable: false, permissions: NO_PERMS },
  { key: 'staatsanwalt',           name: 'STAATSANWALT',             color: 0x7e57c2, hoist: true,  mentionable: false, permissions: NO_PERMS },
  { key: 'anwalt',                 name: 'ANWALT',                   color: 0x5e35b1, hoist: true,  mentionable: false, permissions: NO_PERMS },
  { key: 'justizAnwaerter',        name: 'JUSTIZANWÄRTER',           color: 0xb39ddb, hoist: true,  mentionable: false, permissions: NO_PERMS },
  // ── Polizei ──
  { key: 'polizeiLeitung',         name: 'POLIZEI-LEITUNG',          color: 0x3498db, hoist: true,  mentionable: false, permissions: NO_PERMS },
  { key: 'polizei',                name: 'POLIZEI',                  color: 0x3498db, hoist: true,  mentionable: false, permissions: NO_PERMS },
  { key: 'polizeiAnwaerter',       name: 'POLIZEIANWÄRTER',          color: 0x85c1e9, hoist: true,  mentionable: false, permissions: NO_PERMS },
  // ── Feuerwehr ──
  { key: 'feuerwehrLeitung',       name: 'FEUERWEHR-LEITUNG',        color: 0xe74c3c, hoist: true,  mentionable: false, permissions: NO_PERMS },
  { key: 'feuerwehr',              name: 'FEUERWEHR',                color: 0xe74c3c, hoist: true,  mentionable: false, permissions: NO_PERMS },
  { key: 'feuerwehrAnwaerter',     name: 'FEUERWEHRANWÄRTER',        color: 0xf8b4b4, hoist: true,  mentionable: false, permissions: NO_PERMS },
  // ── Rettungsdienst ──
  { key: 'rettungsdienstLeitung',  name: 'RETTUNGSDIENST-LEITUNG',   color: 0xff6b81, hoist: true,  mentionable: false, permissions: NO_PERMS },
  { key: 'rettungsdienst',         name: 'RETTUNGSDIENST',           color: 0xff6b81, hoist: true,  mentionable: false, permissions: NO_PERMS },
  { key: 'rettungsdienstAnwaerter',name: 'RETTUNGSDIENSTANWÄRTER',   color: 0xf8bbd0, hoist: true,  mentionable: false, permissions: NO_PERMS },
  // ── ADAC ──
  { key: 'adacLeitung',            name: 'ADAC LEITUNG',             color: 0xffd700, hoist: false, mentionable: false, permissions: NO_PERMS },
  { key: null,                     name: 'PANNENHELFER',             color: 0xffa500, hoist: false, mentionable: false, permissions: NO_PERMS },
  // ── Community ──
  { key: null,                     name: 'V.I.P.',                   color: 0xffd700, hoist: true,  mentionable: false, permissions: NO_PERMS },
  { key: null,                     name: 'ZIVILIST',                 color: 0x95a5a6, hoist: true,  mentionable: true,  permissions: NO_PERMS },
  { key: null,                     name: 'MEMBER',                   color: 0xbdc3c7, hoist: true,  mentionable: true,  permissions: NO_PERMS },
];

// ── Zugriffsgruppen (Referenzen auf Rollen-Namen für Kanal-Overrides) ──
export const GRUPPEN = {
  team: ['ADMINISTRATOR', 'ADMINISTRATOR AZUBI', 'MODERATOR', 'DEVELOPER', 'SUPPORT-LEITUNG'],
  owner: ['OWNER', 'CO-OWNER'],
  support: ['SUPPORT-LEITUNG', 'SUPPORTER', 'SUPPORT AZUBI', 'MODERATOR', 'ADMINISTRATOR', 'ADMINISTRATOR AZUBI'],
  justiz: ['JUSTIZ-LEITUNG', 'RICHTER', 'STAATSANWALT', 'ANWALT', 'JUSTIZANWÄRTER'],
  polizei: ['POLIZEI-LEITUNG', 'POLIZEI', 'POLIZEIANWÄRTER'],
  feuerwehr: ['FEUERWEHR-LEITUNG', 'FEUERWEHR', 'FEUERWEHRANWÄRTER'],
  rettungsdienst: ['RETTUNGSDIENST-LEITUNG', 'RETTUNGSDIENST', 'RETTUNGSDIENSTANWÄRTER'],
  adac: ['ADAC LEITUNG', 'PANNENHELFER'],
  vip: ['V.I.P.'],
  zivilist: ['ZIVILIST'],
} as const;

export interface ChannelBlueprint {
  name: string;
  type: ChannelType.GuildText | ChannelType.GuildVoice | ChannelType.GuildAnnouncement | ChannelType.GuildForum | ChannelType.GuildStageVoice;
}

export interface CategoryBlueprint {
  name: string;
  /** true = @everyone gesperrt, nur die angegebenen Rollen sehen die Kategorie */
  privat: boolean;
  /** Rollen-Namen die Zugriff erhalten (wenn privat) */
  rollen: string[];
  channels: ChannelBlueprint[];
}

const T = ChannelType.GuildText;
const V = ChannelType.GuildVoice;
const A = ChannelType.GuildAnnouncement;
const F = ChannelType.GuildForum;
const S = ChannelType.GuildStageVoice;

/**
 * Kategorien + Kanäle. Reihenfolge = Anzeigereihenfolge.
 */
export const CATEGORY_BLUEPRINT: CategoryBlueprint[] = [
  {
    name: '📯│ Allgemein │📯',
    privat: false, rollen: [],
    channels: [
      { name: '👋・willkommen', type: T },
      { name: '📚・regeln', type: T },
      { name: '📰・neuigkeiten', type: A },
      { name: '📅・events', type: T },
    ],
  },
  {
    name: '📜│ CHATS │📜',
    privat: false, rollen: [],
    channels: [
      { name: '💬・hauptchat', type: T },
      { name: '🐸・memes', type: T },
      { name: '📸・medien', type: T },
      { name: '🔌・commands', type: T },
      { name: '🎮・in-game-namen', type: T },
    ],
  },
  {
    name: '👑│ OWNER │👑',
    privat: true, rollen: [...GRUPPEN.owner],
    channels: [
      { name: '👑・owner-chat', type: T },
      { name: '⚙️・server-verwaltung', type: T },
      { name: '💡・owner-ideen', type: T },
      { name: '📝・owner-notizen', type: T },
      { name: '👑・owner-talk', type: V },
    ],
  },
  {
    name: '🛡️│ TEAMVERWALTUNG │🛡️',
    privat: true, rollen: [...GRUPPEN.team],
    channels: [
      { name: '📌・team-infos', type: T },
      { name: '📢・team-ankündigung', type: A },
      { name: '💬・team-chat', type: T },
      { name: '💡・team-ideen', type: T },
      { name: '❓・team-fragen', type: T },
      { name: '🛡️・team-regeln', type: T },
      { name: '🎓・admin-ausbildung', type: T },
      { name: '🎓・support-ausbildung', type: T },
      { name: '💬・team-talk', type: V },
    ],
  },
  {
    name: '🎧│ Support │🎧',
    privat: false, rollen: [],
    channels: [
      { name: '🎫・ticket', type: T },
      { name: '🔇・Warteraum', type: V },
      { name: '🎧・Support', type: V },
    ],
  },
  {
    name: '⚖️│ JUSTIZ │⚖️',
    privat: true, rollen: [...GRUPPEN.justiz],
    channels: [
      { name: '📰・neuigkeiten', type: A },
      { name: '📜・gesetze', type: T },
      { name: '💬・chat', type: T },
      { name: '🎓・justiz-ausbildung', type: T },
      { name: '⚖️・verfahren-erstellen', type: T },
      { name: '⚖️・verfahren', type: F },
      { name: '📂・akten', type: F },
      { name: '🏛️・gericht', type: S },
    ],
  },
  {
    name: '🚓│ POLIZEI │🚓',
    privat: true, rollen: [...GRUPPEN.polizei],
    channels: [
      { name: '📰・neuigkeiten', type: A },
      { name: '💬・chat', type: T },
      { name: '🎓・polizei-ausbildung', type: T },
      { name: '🚓・polizei-funk', type: V },
      { name: '🚓・polizei-wache', type: V },
    ],
  },
  {
    name: '🚒│ FEUERWEHR │🚒',
    privat: true, rollen: [...GRUPPEN.feuerwehr],
    channels: [
      { name: '📰・neuigkeiten', type: A },
      { name: '💬・chat', type: T },
      { name: '🎓・feuerwehr-ausbildung', type: T },
      { name: '🚒・feuerwehr-funk', type: V },
      { name: '🚒・feuerwehr-wache', type: V },
    ],
  },
  {
    name: '🚑│ RETTUNGSDIENST │🚑',
    privat: true, rollen: [...GRUPPEN.rettungsdienst],
    channels: [
      { name: '📰・neuigkeiten', type: A },
      { name: '💬・chat', type: T },
      { name: '🎓・rettungsdienst-ausbildung', type: T },
      { name: '🚑・rettungs-funk', type: V },
      { name: '🚑・rettungs-wache', type: V },
    ],
  },
  {
    name: '🚕│ ADAC │🚕',
    privat: true, rollen: [...GRUPPEN.adac],
    channels: [
      { name: '📰・neuigkeiten', type: A },
      { name: '💬・chat', type: T },
      { name: '🚕・adac-talk', type: V },
    ],
  },
  {
    name: '👑│ V.I.P │👑',
    privat: true, rollen: [...GRUPPEN.vip],
    channels: [
      { name: '👑・vip-chat', type: T },
      { name: '👑・V.I.P Sprachchat', type: V },
    ],
  },
  {
    name: '🎭│ ROLEPLAY │🎭',
    privat: false, rollen: [],
    channels: [
      { name: '➕ Creator Channel', type: V },
    ],
  },
];
