import {
  CommandInteraction, SlashCommandBuilder, EmbedBuilder, ColorResolvable,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  GuildMember,
} from 'discord.js';
import { getDatabase } from '../database/database';
import { createErrorEmbed, createSuccessEmbed } from '../utils/embeds';
import { hasAdminPermission } from '../utils/permissions';
import { config } from '../config/config';

// ── Menü-Kategorien ──────────────────────────────────────────────────────────
// Discord erlaubt max. 5 ActionRows pro Nachricht → 5 Kategorien.
// Admin hat 7 Rollen — wir splitten in 2 Nachrichten (Embed 1 + Embed 2)
export const MENU_KATEGORIEN: Array<{
  id: string;
  titel: string;
  emoji: string;
  placeholder: string;
  rollen: Array<{ key: string; label: string; emoji: string; beschreibung: string }>;
}> = [
  {
    id: 'menu_admin',
    titel: 'Administration',
    emoji: '🛡️',
    placeholder: '🛡️ Admin-Rolle auswählen...',
    rollen: [
      { key: 'owner',         label: 'Owner',         emoji: '👑', beschreibung: 'Voller Zugriff' },
      { key: 'coOwner',       label: 'Co-Owner',      emoji: '🔱', beschreibung: 'Fast voller Zugriff' },
      { key: 'administrator', label: 'Administrator', emoji: '🛡️', beschreibung: 'Admin-Funktionen' },
      { key: 'moderator',     label: 'Moderator',     emoji: '🔨', beschreibung: 'Moderations-Funktionen' },
      { key: 'developer',     label: 'Developer',     emoji: '💻', beschreibung: 'Entwickler-Zugriff' },
      { key: 'supporter',     label: 'Supporter',     emoji: '🎧', beschreibung: 'Support-Funktionen' },
      { key: 'azubi',         label: 'Azubi',         emoji: '📚', beschreibung: 'Azubi-Funktionen' },
    ],
  },
  {
    id: 'menu_fraktion',
    titel: 'Fraktion',
    emoji: '🏛️',
    placeholder: '🏛️ Fraktions-Rolle auswählen...',
    rollen: [
      { key: 'fraktionsleitung', label: 'Fraktionsleitung', emoji: '🏛️', beschreibung: 'Fraktions-Administration' },
    ],
  },
  {
    id: 'menu_justiz',
    titel: 'Justiz',
    emoji: '⚖️',
    placeholder: '⚖️ Justiz-Rolle auswählen...',
    rollen: [
      { key: 'justizLeitung',   label: 'Justiz-Leitung',  emoji: '⚖️', beschreibung: 'Voller Justiz-Zugriff' },
      { key: 'richter',         label: 'Richter',          emoji: '⚖️', beschreibung: 'Verfahren leiten & abschließen' },
      { key: 'staatsanwalt',    label: 'Staatsanwalt',     emoji: '⚖️', beschreibung: 'Verfahren bearbeiten' },
      { key: 'anwalt',          label: 'Anwalt',           emoji: '🏛️', beschreibung: 'Verfahren lesen & begleiten' },
      { key: 'justizAnwaerter', label: 'Justizanwärter',   emoji: '📋', beschreibung: 'Eingeschränkter Justiz-Zugriff' },
    ],
  },
  {
    id: 'menu_polizei',
    titel: 'Polizei',
    emoji: '🚓',
    placeholder: '🚓 Polizei-Rolle auswählen...',
    rollen: [
      { key: 'polizeiLeitung',   label: 'Polizei-Leitung',  emoji: '🚓', beschreibung: 'Polizei-Administration' },
      { key: 'polizei',          label: 'Polizei',           emoji: '🚓', beschreibung: 'Polizei-Funktionen' },
      { key: 'polizeiAnwaerter', label: 'Polizeianwärter',   emoji: '🚓', beschreibung: 'Eingeschränkte Polizei-Funktionen' },
    ],
  },
  {
    id: 'menu_feuerwehr',
    titel: 'Feuerwehr',
    emoji: '🚒',
    placeholder: '🚒 Feuerwehr-Rolle auswählen...',
    rollen: [
      { key: 'feuerwehrLeitung',   label: 'Feuerwehr-Leitung',  emoji: '🚒', beschreibung: 'Feuerwehr-Administration' },
      { key: 'feuerwehr',          label: 'Feuerwehr',           emoji: '🚒', beschreibung: 'Feuerwehr-Funktionen' },
      { key: 'feuerwehrAnwaerter', label: 'Feuerwehranwärter',   emoji: '🚒', beschreibung: 'Eingeschränkte Feuerwehr-Funktionen' },
    ],
  },
];

// Rettungsdienst läuft als eigene zweite Nachricht da wir schon 5 Rows mit 5 Kategorien haben
export const MENU_KATEGORIEN_2: Array<{
  id: string;
  titel: string;
  emoji: string;
  placeholder: string;
  rollen: Array<{ key: string; label: string; emoji: string; beschreibung: string }>;
}> = [
  {
    id: 'menu_rettungsdienst',
    titel: 'Rettungsdienst',
    emoji: '🚑',
    placeholder: '🚑 Rettungsdienst-Rolle auswählen...',
    rollen: [
      { key: 'rettungsdienstLeitung',   label: 'Rettungsdienst-Leitung',  emoji: '🚑', beschreibung: 'Rettungsdienst-Administration' },
      { key: 'rettungsdienst',          label: 'Rettungsdienst',           emoji: '🚑', beschreibung: 'Rettungsdienst-Funktionen' },
      { key: 'rettungsdienstAnwaerter', label: 'Rettungsdienstanwärter',   emoji: '🚑', beschreibung: 'Eingeschränkte RD-Funktionen' },
    ],
  },
];

// Alle Kategorien zusammen für den Handler
export const ALLE_KATEGORIEN = [...MENU_KATEGORIEN, ...MENU_KATEGORIEN_2];

// ── Command ──────────────────────────────────────────────────────────────────
export const data = new SlashCommandBuilder()
  .setName('rollenmenu')
  .setDescription('Rollen-Menü verwalten')
  .addSubcommand(sub => sub
    .setName('erstellen')
    .setDescription('Postet das persistente Rollen-Zuweisung-Menü in diesen Kanal')
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

  const { embed1, components1, embed2, components2 } = buildMenuMessages(interaction.guildId!);

  // Erste Nachricht (Admin, Fraktion, Justiz, Polizei, Feuerwehr)
  await interaction.reply({ embeds: [embed1], components: components1 });

  // Zweite Nachricht (Rettungsdienst) als Follow-up
  if (components2.length > 0) {
    await interaction.followUp({ embeds: [embed2], components: components2 });
  }
}

// ── Menü-Nachrichten aufbauen — exportiert für PanelManager ─────────────────
export function buildMenuMessages(guildId: string): {
  embed1: EmbedBuilder;
  components1: ActionRowBuilder<StringSelectMenuBuilder>[];
  embed2: EmbedBuilder;
  components2: ActionRowBuilder<StringSelectMenuBuilder>[];
} {
  const db = getDatabase();
  const rollenConfig = db.prepare(
    'SELECT role_key, role_id FROM role_config WHERE guild_id = ?'
  ).all(guildId) as unknown as Array<{ role_key: string; role_id: string }>;

  const roleMap = new Map(rollenConfig.map(r => [r.role_key, r.role_id]));

  const buildComponents = (kategorien: typeof MENU_KATEGORIEN) =>
    kategorien
      .filter(kat => kat.rollen.some(r => roleMap.has(r.key)))
      .map(kat => {
        const options = kat.rollen
          .filter(r => roleMap.has(r.key))
          .map(r =>
            new StringSelectMenuOptionBuilder()
              .setValue(r.key)
              .setLabel(r.label)
              .setDescription(r.beschreibung)
              .setEmoji(r.emoji)
          );

        return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`rollenmenu_${kat.id}`)
            .setPlaceholder(kat.placeholder)
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options)
        );
      });

  const buildDescription = (kategorien: typeof MENU_KATEGORIEN) =>
    kategorien
      .filter(kat => kat.rollen.some(r => roleMap.has(r.key)))
      .map(kat => {
        const liste = kat.rollen
          .filter(r => roleMap.has(r.key))
          .map(r => `${r.emoji} **${r.label}** — ${r.beschreibung}`)
          .join('\n');
        return `**${kat.emoji} ${kat.titel}**\n${liste}`;
      })
      .join('\n\n');

  const keineKonfiguriert = rollenConfig.length === 0;

  const embed1 = new EmbedBuilder()
    .setColor(config.colors.server as ColorResolvable)
    .setTitle('🎭 Rollen-Zuweisung | Deutscher RP Server')
    .setDescription(
      '**So funktioniert es:**\n' +
      '• Wähle eine Rolle im Menü → sie wird dir **zugewiesen**\n' +
      '• Wähle dieselbe Rolle nochmal → sie wird dir **entfernt** *(Toggle)*\n\n' +
      (keineKonfiguriert
        ? '⚠️ Noch keine Rollen konfiguriert. Bitte `/rollen-panel erstellen` nutzen.'
        : buildDescription(MENU_KATEGORIEN)
      )
    )
    .setFooter({ text: 'Deutscher RP Server | Rollen-System' })
    .setTimestamp();

  const embed2 = new EmbedBuilder()
    .setColor(config.colors.rettungsdienst as ColorResolvable)
    .setTitle('🚑 Rettungsdienst')
    .setDescription(buildDescription(MENU_KATEGORIEN_2) || '⚠️ Keine Rettungsdienst-Rollen konfiguriert.')
    .setFooter({ text: 'Deutscher RP Server | Rollen-System' });

  return {
    embed1,
    components1: buildComponents(MENU_KATEGORIEN),
    embed2,
    components2: buildComponents(MENU_KATEGORIEN_2),
  };
}

export default { data, execute };
