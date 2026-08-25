import {
  CommandInteraction, SlashCommandBuilder, EmbedBuilder, ColorResolvable,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildMember,
} from 'discord.js';
import { getDatabase } from '../database/database';
import { createErrorEmbed } from '../utils/embeds';
import { hasAdminPermission } from '../utils/permissions';
import { config } from '../config/config';

// ── Alle Rollen-Keys — exakt deine Discord-Rollen ───────────────────────────
export const ROLLEN_KEYS: Array<{
  key: string;
  label: string;
  emoji: string;
  beschreibung: string;
}> = [
  // Administration
  { key: 'owner',                   label: 'Owner',                     emoji: '👑', beschreibung: 'Voller Zugriff' },
  { key: 'coOwner',                 label: 'Co-Owner',                  emoji: '🔱', beschreibung: 'Fast voller Zugriff' },
  { key: 'administrator',           label: 'Administrator',             emoji: '🛡️', beschreibung: 'Admin-Funktionen' },
  { key: 'moderator',               label: 'Moderator',                 emoji: '🔨', beschreibung: 'Moderations-Funktionen' },
  { key: 'developer',               label: 'Developer',                 emoji: '💻', beschreibung: 'Entwickler-Zugriff' },
  { key: 'supporter',               label: 'Supporter',                 emoji: '🎧', beschreibung: 'Support-Funktionen' },
  { key: 'azubi',                   label: 'Azubi',                     emoji: '📚', beschreibung: 'Azubi-Funktionen' },
  // Fraktion
  { key: 'fraktionsleitung',        label: 'Fraktionsleitung',          emoji: '🏛️', beschreibung: 'Fraktions-Administration' },
  // Justiz
  { key: 'justizLeitung',           label: 'Justiz-Leitung',            emoji: '⚖️', beschreibung: 'Voller Justiz-Zugriff' },
  { key: 'richter',                 label: 'Richter',                   emoji: '⚖️', beschreibung: 'Verfahren leiten & abschließen' },
  { key: 'staatsanwalt',            label: 'Staatsanwalt',              emoji: '⚖️', beschreibung: 'Verfahren bearbeiten' },
  { key: 'anwalt',                  label: 'Anwalt',                    emoji: '🏛️', beschreibung: 'Verfahren lesen & begleiten' },
  { key: 'justizAnwaerter',         label: 'Justizanwärter',            emoji: '📋', beschreibung: 'Eingeschränkter Justiz-Zugriff' },
  // Polizei
  { key: 'polizeiLeitung',          label: 'Polizei-Leitung',           emoji: '🚓', beschreibung: 'Polizei-Administration' },
  { key: 'polizei',                 label: 'Polizei',                   emoji: '🚓', beschreibung: 'Polizei-Funktionen' },
  { key: 'polizeiAnwaerter',        label: 'Polizeianwärter',           emoji: '🚓', beschreibung: 'Eingeschränkte Polizei-Funktionen' },
  // Feuerwehr
  { key: 'feuerwehrLeitung',        label: 'Feuerwehr-Leitung',         emoji: '🚒', beschreibung: 'Feuerwehr-Administration' },
  { key: 'feuerwehr',               label: 'Feuerwehr',                 emoji: '🚒', beschreibung: 'Feuerwehr-Funktionen' },
  { key: 'feuerwehrAnwaerter',      label: 'Feuerwehranwärter',         emoji: '🚒', beschreibung: 'Eingeschränkte Feuerwehr-Funktionen' },
  // Rettungsdienst
  { key: 'rettungsdienstLeitung',   label: 'Rettungsdienst-Leitung',    emoji: '🚑', beschreibung: 'Rettungsdienst-Administration' },
  { key: 'rettungsdienst',          label: 'Rettungsdienst',            emoji: '🚑', beschreibung: 'Rettungsdienst-Funktionen' },
  { key: 'rettungsdienstAnwaerter', label: 'Rettungsdienstanwärter',    emoji: '🚑', beschreibung: 'Eingeschränkte RD-Funktionen' },
];

// ── Command ──────────────────────────────────────────────────────────────────
export const data = new SlashCommandBuilder()
  .setName('rollen-panel')
  .setDescription('Erstellt das interaktive Rollen-Konfigurationspanel')
  .addSubcommand(sub => sub
    .setName('erstellen')
    .setDescription('Postet das Rollen-Panel in diesen Kanal')
  )
  .addSubcommand(sub => sub
    .setName('status')
    .setDescription('Zeigt alle aktuell konfigurierten Rollen')
  );

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;

  if (!hasAdminPermission(member)) {
    await interaction.reply({
      embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst Administrator-Rechte.')],
      ephemeral: true,
    });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'status') {
    const embed = buildPanelEmbed(interaction.guildId!);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  await interaction.reply({
    embeds: [buildPanelEmbed(interaction.guildId!)],
    components: buildPanelButtons(),
  });
}

// ── Panel Embed — exportiert für PanelManager ────────────────────────────────
export function buildPanelEmbed(guildId: string): EmbedBuilder {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT role_key, role_id FROM role_config WHERE guild_id = ?'
  ).all(guildId) as unknown as Array<{ role_key: string; role_id: string }>;

  const roleMap = new Map(rows.map(r => [r.role_key, r.role_id]));

  const line = (key: string) => {
    const info = ROLLEN_KEYS.find(r => r.key === key)!;
    return `${info.emoji} **${info.label}** → ${roleMap.has(key) ? `<@&${roleMap.get(key)}>` : '❌ Nicht gesetzt'}`;
  };

  return new EmbedBuilder()
    .setColor(config.colors.server as ColorResolvable)
    .setTitle('⚙️ Rollen-Konfiguration | Deutscher RP Server')
    .setDescription(
      'Klicke auf eine Kategorie um die Discord-Rollen zuzuweisen.\n' +
      'Jede Berechtigungsebene bekommt eine eigene Discord-Rolle.'
    )
    .addFields(
      {
        name: '🛡️ Administration',
        value: ['owner', 'coOwner', 'administrator', 'moderator', 'developer', 'supporter', 'azubi'].map(line).join('\n'),
        inline: false,
      },
      {
        name: '🏛️ Fraktion',
        value: ['fraktionsleitung'].map(line).join('\n'),
        inline: false,
      },
      {
        name: '⚖️ Justiz',
        value: ['justizLeitung', 'richter', 'staatsanwalt', 'anwalt', 'justizAnwaerter'].map(line).join('\n'),
        inline: false,
      },
      {
        name: '🚓 Polizei',
        value: ['polizeiLeitung', 'polizei', 'polizeiAnwaerter'].map(line).join('\n'),
        inline: true,
      },
      {
        name: '🚒 Feuerwehr',
        value: ['feuerwehrLeitung', 'feuerwehr', 'feuerwehrAnwaerter'].map(line).join('\n'),
        inline: true,
      },
      {
        name: '🚑 Rettungsdienst',
        value: ['rettungsdienstLeitung', 'rettungsdienst', 'rettungsdienstAnwaerter'].map(line).join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: `${rows.length}/${ROLLEN_KEYS.length} Rollen konfiguriert • Deutscher RP Server` })
    .setTimestamp();
}

// ── Panel Buttons — exportiert für PanelManager ──────────────────────────────
export function buildPanelButtons(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('rollenpanel_admin').setLabel('🛡️ Administration').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rollenpanel_fraktion').setLabel('🏛️ Fraktion').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rollenpanel_justiz').setLabel('⚖️ Justiz').setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('rollenpanel_polizei').setLabel('🚓 Polizei').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('rollenpanel_feuerwehr').setLabel('🚒 Feuerwehr').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('rollenpanel_rettungsdienst').setLabel('🚑 Rettungsdienst').setStyle(ButtonStyle.Primary),
    ),
  ];
}

export default { data, execute };

// ── Kategorie-Definitionen für den PanelManager ──────────────────────────────
export const KATEGORIEN: Record<string, {
  titel: string;
  emoji: string;
  farbe: number;
  rollen: string[];
}> = {
  admin: {
    titel: 'Administrations-Rollen konfigurieren',
    emoji: '🛡️',
    farbe: config.colors.server,
    rollen: ['owner', 'coOwner', 'administrator', 'moderator', 'developer', 'supporter', 'azubi'],
  },
  fraktion: {
    titel: 'Fraktions-Rollen konfigurieren',
    emoji: '🏛️',
    farbe: config.colors.server,
    rollen: ['fraktionsleitung'],
  },
  justiz: {
    titel: 'Justiz-Rollen konfigurieren',
    emoji: '⚖️',
    farbe: config.colors.justiz,
    rollen: ['justizLeitung', 'richter', 'staatsanwalt', 'anwalt', 'justizAnwaerter'],
  },
  polizei: {
    titel: 'Polizei-Rollen konfigurieren',
    emoji: '🚓',
    farbe: config.colors.polizei,
    rollen: ['polizeiLeitung', 'polizei', 'polizeiAnwaerter'],
  },
  feuerwehr: {
    titel: 'Feuerwehr-Rollen konfigurieren',
    emoji: '🚒',
    farbe: config.colors.feuerwehr,
    rollen: ['feuerwehrLeitung', 'feuerwehr', 'feuerwehrAnwaerter'],
  },
  rettungsdienst: {
    titel: 'Rettungsdienst-Rollen konfigurieren',
    emoji: '🚑',
    farbe: config.colors.rettungsdienst,
    rollen: ['rettungsdienstLeitung', 'rettungsdienst', 'rettungsdienstAnwaerter'],
  },
};
