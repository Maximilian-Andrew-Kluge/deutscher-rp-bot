import {
  CommandInteraction, SlashCommandBuilder, GuildMember, AttachmentBuilder,
  ChannelType, PermissionsBitField, Role, GuildChannel, CategoryChannel,
} from 'discord.js';
import { createErrorEmbed } from '../utils/embeds';
import { hasAdminPermission } from '../utils/permissions';
import { getDatabase } from '../database/database';

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('Exportiert die komplette Serverstruktur (Rollen, Rechte, Kanäle) als Datei');

// Menschenlesbare Namen der wichtigsten Berechtigungen
const PERM_LABELS: Array<[keyof typeof PermissionsBitField.Flags, string]> = [
  ['Administrator', 'Administrator'],
  ['ManageGuild', 'Server verwalten'],
  ['ManageRoles', 'Rollen verwalten'],
  ['ManageChannels', 'Kanäle verwalten'],
  ['KickMembers', 'Mitglieder kicken'],
  ['BanMembers', 'Mitglieder bannen'],
  ['ModerateMembers', 'Timeout (Moderieren)'],
  ['ManageMessages', 'Nachrichten verwalten'],
  ['ManageNicknames', 'Nicknames verwalten'],
  ['ManageWebhooks', 'Webhooks verwalten'],
  ['ManageEmojisAndStickers', 'Emojis/Sticker verwalten'],
  ['MentionEveryone', '@everyone pingen'],
  ['ViewAuditLog', 'Audit-Log ansehen'],
  ['MoveMembers', 'Mitglieder verschieben (Voice)'],
  ['MuteMembers', 'Voice muten'],
  ['DeafenMembers', 'Voice deafen'],
  ['ManageEvents', 'Events verwalten'],
  ['ManageThreads', 'Threads verwalten'],
];

function getRolePerms(role: Role): string[] {
  const perms: string[] = [];
  for (const [flag, label] of PERM_LABELS) {
    if (role.permissions.has(PermissionsBitField.Flags[flag])) {
      perms.push(label);
    }
  }
  return perms;
}

function channelTypeName(type: ChannelType): string {
  switch (type) {
    case ChannelType.GuildText: return 'Text';
    case ChannelType.GuildVoice: return 'Voice';
    case ChannelType.GuildCategory: return 'Kategorie';
    case ChannelType.GuildAnnouncement: return 'Ankündigung';
    case ChannelType.GuildForum: return 'Forum';
    case ChannelType.GuildStageVoice: return 'Bühne';
    case ChannelType.GuildMedia: return 'Medien';
    default: return `Typ ${type}`;
  }
}

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;

  if (!hasAdminPermission(member)) {
    await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst Administrator-Rechte.')], ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild!;

  // Vollständige Daten laden
  await guild.roles.fetch();
  await guild.channels.fetch();
  await guild.members.fetch().catch(() => null);

  const lines: string[] = [];
  const L = (s = '') => lines.push(s);

  // ── Kopf ──────────────────────────────────────────────────────────────────
  L('══════════════════════════════════════════════════════════');
  L(`  SERVER-STRUKTUR EXPORT`);
  L(`  Server: ${guild.name} (ID: ${guild.id})`);
  L(`  Mitglieder: ${guild.memberCount}`);
  L(`  Erstellt am: ${new Date().toLocaleString('de-DE')}`);
  L('══════════════════════════════════════════════════════════');
  L();

  // ── Rollen (nach Position, höchste zuerst) ──────────────────────────────────
  const roles = [...guild.roles.cache.values()]
    .sort((a, b) => b.position - a.position);

  L('╔══════════════════════════════════════════════════════════');
  L(`║  ROLLEN (${roles.length})`);
  L('╚══════════════════════════════════════════════════════════');
  L();
  for (const role of roles) {
    if (role.id === guild.id) {
      L(`[@everyone]  (Basis-Rolle)`);
    } else {
      const color = role.hexColor === '#000000' ? 'keine' : role.hexColor;
      L(`▸ ${role.name}`);
      L(`    ID: ${role.id}`);
      L(`    Position: ${role.position}  |  Farbe: ${color}  |  Mitglieder: ${role.members.size}`);
      L(`    Getrennt angezeigt: ${role.hoist ? 'ja' : 'nein'}  |  Erwähnbar: ${role.mentionable ? 'ja' : 'nein'}  |  Bot-Rolle: ${role.managed ? 'ja' : 'nein'}`);
    }
    const perms = role.id === guild.id
      ? getRolePerms(role)
      : getRolePerms(role);
    if (perms.length > 0) {
      L(`    Rechte: ${perms.join(', ')}`);
    } else {
      L(`    Rechte: (keine besonderen)`);
    }
    L();
  }

  // ── Kanäle (nach Kategorie gruppiert) ───────────────────────────────────────
  L('╔══════════════════════════════════════════════════════════');
  L(`║  KANÄLE & KATEGORIEN`);
  L('╚══════════════════════════════════════════════════════════');
  L();

  const allChannels = [...guild.channels.cache.values()];
  const categories = allChannels
    .filter(c => c.type === ChannelType.GuildCategory)
    .sort((a, b) => (a as CategoryChannel).position - (b as CategoryChannel).position) as CategoryChannel[];

  const printChannel = (ch: GuildChannel) => {
    L(`   • [${channelTypeName(ch.type)}] ${ch.name}  (ID: ${ch.id})`);
    // Rollen-spezifische Overrides (nur Rollen, nicht einzelne Member)
    const overwrites = ch.permissionOverwrites.cache.filter(o => o.type === 0);
    for (const ow of overwrites.values()) {
      const role = guild.roles.cache.get(ow.id);
      if (!role) continue;
      const allow = ow.allow.toArray();
      const deny = ow.deny.toArray();
      if (allow.includes('ViewChannel') || deny.includes('ViewChannel')) {
        const state = deny.includes('ViewChannel') ? 'GESPERRT' : 'sichtbar';
        L(`       └ ${role.name}: ${state}`);
      }
    }
  };

  // Kanäle ohne Kategorie
  const noCat = allChannels
    .filter(c => c.type !== ChannelType.GuildCategory && !(c as GuildChannel).parentId)
    .sort((a, b) => (a as GuildChannel).position - (b as GuildChannel).position) as GuildChannel[];

  if (noCat.length > 0) {
    L('📁 (Ohne Kategorie)');
    noCat.forEach(printChannel);
    L();
  }

  for (const cat of categories) {
    L(`📁 ${cat.name}  (ID: ${cat.id})`);
    const children = allChannels
      .filter(c => (c as GuildChannel).parentId === cat.id)
      .sort((a, b) => (a as GuildChannel).position - (b as GuildChannel).position) as GuildChannel[];
    children.forEach(printChannel);
    L();
  }

  // ── Bot-Konfiguration (role_config Zuordnung) ───────────────────────────────
  L('╔══════════════════════════════════════════════════════════');
  L(`║  BOT-ROLLEN-ZUORDNUNG (role_config)`);
  L('╚══════════════════════════════════════════════════════════');
  L();
  try {
    const db = getDatabase();
    const configured = db.prepare('SELECT role_key, role_id FROM role_config WHERE guild_id = ? ORDER BY role_key')
      .all(guild.id) as Array<{ role_key: string; role_id: string }>;
    if (configured.length === 0) {
      L('   ⚠️ Keine Rollen im Bot konfiguriert! Nutze /setup rolle.');
    } else {
      for (const c of configured) {
        const role = guild.roles.cache.get(c.role_id);
        L(`   ${c.role_key.padEnd(28)} → ${role ? role.name : '⚠️ ROLLE NICHT GEFUNDEN (' + c.role_id + ')'}`);
      }
    }
  } catch (e) {
    L(`   (Fehler beim Lesen der Bot-Konfiguration: ${e instanceof Error ? e.message : 'unbekannt'})`);
  }
  L();

  // Bot-eigene höchste Rolle (wichtig für Rechte-Analyse)
  const botMember = guild.members.me;
  L('╔══════════════════════════════════════════════════════════');
  L(`║  BOT-STATUS`);
  L('╚══════════════════════════════════════════════════════════');
  L();
  if (botMember) {
    L(`   Bot höchste Rolle: ${botMember.roles.highest.name} (Position ${botMember.roles.highest.position})`);
    L(`   Bot ist Administrator: ${botMember.permissions.has('Administrator') ? 'ja' : 'nein'}`);
  }
  L();
  L('══════════════════════════════════════════════════════════');
  L('  Ende des Exports — schick diese Datei an Kiro zur Analyse.');
  L('══════════════════════════════════════════════════════════');

  const content = lines.join('\n');
  const attachment = new AttachmentBuilder(Buffer.from(content, 'utf-8'), {
    name: `serverinfo_${guild.name.replace(/[^a-zA-Z0-9]/g, '_')}.txt`,
  });

  await interaction.editReply({
    content: '📋 Hier ist die komplette Serverstruktur. Lade die Datei herunter und schick sie mir (Kiro) im Chat zur Analyse.',
    files: [attachment],
  });
}

export default { data, execute };
