import {
  CommandInteraction, SlashCommandBuilder, GuildMember, EmbedBuilder,
  ColorResolvable, PermissionFlagsBits, GuildChannel,
} from 'discord.js';
import { createErrorEmbed } from '../utils/embeds';
import { hasAdminPermission } from '../utils/permissions';
import { getDatabase } from '../database/database';
import { config } from '../config/config';

export const data = new SlashCommandBuilder()
  .setName('reparieren')
  .setDescription('Korrigiert bekannte Fehler bei Kanal-Berechtigungen automatisch');

/** Kanal-IDs mit den Fraktions-Rollen die dort Zugriff bekommen sollen */
interface FixTarget {
  channelId: string;
  channelName: string;
  // role_config Keys deren Rollen ViewChannel erhalten sollen
  roleKeys: string[];
  // optional: role_config Keys deren falsche Overrides entfernt werden sollen
  removeKeys?: string[];
  hinweis: string;
}

const FIXES: FixTarget[] = [
  {
    channelId: '1540703171179970570',
    channelName: 'feuerwehr-besprechung',
    roleKeys: ['feuerwehrLeitung', 'feuerwehr', 'feuerwehrAnwaerter'],
    removeKeys: ['polizeiLeitung', 'polizei', 'polizeiAnwaerter'],
    hinweis: 'Feuerwehr-Rollen statt Polizei freigeschaltet',
  },
  {
    channelId: '1540707929878167583',
    channelName: 'rettungsdienst-besprechung',
    roleKeys: ['rettungsdienstLeitung', 'rettungsdienst', 'rettungsdienstAnwaerter'],
    hinweis: 'Rettungsdienst-Rollen freigeschaltet',
  },
  {
    channelId: '1540761227423260772',
    channelName: 'justiz-neuigkeiten',
    roleKeys: ['justizAnwaerter'],
    hinweis: 'Justizanwärter darf Neuigkeiten jetzt sehen',
  },
];

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;

  if (!hasAdminPermission(member)) {
    await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst Administrator-Rechte.')], ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild!;
  const db = getDatabase();

  // Rollen-Zuordnung laden
  const rows = db.prepare('SELECT role_key, role_id FROM role_config WHERE guild_id = ?')
    .all(guild.id) as Array<{ role_key: string; role_id: string }>;
  const roleMap = new Map(rows.map(r => [r.role_key, r.role_id]));

  const ergebnisse: string[] = [];

  for (const fix of FIXES) {
    const channel = guild.channels.cache.get(fix.channelId) as GuildChannel | undefined
      ?? await guild.channels.fetch(fix.channelId).catch(() => null) as GuildChannel | null;

    if (!channel) {
      ergebnisse.push(`⚠️ **${fix.channelName}** — Kanal nicht gefunden (evtl. gelöscht/umbenannt)`);
      continue;
    }

    let geaendert = 0;
    const fehlend: string[] = [];

    // Rollen freischalten
    for (const key of fix.roleKeys) {
      const roleId = roleMap.get(key);
      if (!roleId) { fehlend.push(key); continue; }
      try {
        await channel.permissionOverwrites.edit(roleId, {
          ViewChannel: true,
          Connect: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
        geaendert++;
      } catch { /* Rolle evtl. nicht mehr vorhanden */ }
    }

    // Falsche Rollen entfernen
    if (fix.removeKeys) {
      for (const key of fix.removeKeys) {
        const roleId = roleMap.get(key);
        if (!roleId) continue;
        try {
          await channel.permissionOverwrites.delete(roleId);
          geaendert++;
        } catch { /* kein Override vorhanden */ }
      }
    }

    let zeile = `✅ **#${channel.name}** — ${fix.hinweis} (${geaendert} Anpassungen)`;
    if (fehlend.length > 0) {
      zeile += `\n   ⚠️ Nicht konfigurierte Rollen: ${fehlend.join(', ')} — mit \`/setup rolle\` setzen`;
    }
    ergebnisse.push(zeile);
  }

  // Prüfen ob @everyone bei jedem Fraktions-Kanal gesperrt ist (bleibt erhalten)
  // Auto-Rolle Zusatzhinweis
  const settings = db.prepare('SELECT auto_role_id FROM server_settings WHERE guild_id = ?')
    .get(guild.id) as { auto_role_id: string | null } | undefined;

  const botMember = guild.members.me;
  const hinweise: string[] = [];

  if (botMember && settings?.auto_role_id) {
    const autoRole = guild.roles.cache.get(settings.auto_role_id);
    if (autoRole && autoRole.position >= botMember.roles.highest.position) {
      hinweise.push(`⚠️ **Auto-Rolle funktioniert nicht!** Die Rolle **${autoRole.name}** (Pos. ${autoRole.position}) steht über der Bot-Rolle (Pos. ${botMember.roles.highest.position}). Zieh die Bot-Rolle in den Server-Einstellungen höher.`);
    }
  }

  const embed = new EmbedBuilder()
    .setColor(config.colors.success as ColorResolvable)
    .setTitle('🔧 Server-Reparatur abgeschlossen')
    .setDescription(ergebnisse.join('\n\n'))
    .setFooter({ text: 'Deutscher RP Server | Reparatur' })
    .setTimestamp();

  if (hinweise.length > 0) {
    embed.addFields({ name: '⚠️ Wichtige Hinweise', value: hinweise.join('\n\n') });
  }

  await interaction.editReply({ embeds: [embed] });
}

export default { data, execute };
