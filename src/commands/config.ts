import {
  CommandInteraction, SlashCommandBuilder, GuildMember,
  EmbedBuilder, ColorResolvable
} from 'discord.js';
import { getDatabase } from '../database/database';
import { createErrorEmbed, createSuccessEmbed } from '../utils/embeds';
import { hasAdminPermission } from '../utils/permissions';
import { config } from '../config/config';

interface LogRow {
  id: number;
  aktion: string;
  benutzer_id: string;
  details: string | null;
  erstellt_am: string;
}

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Erweiterte Bot-Konfiguration')
  .addSubcommand(sub => sub
    .setName('logs')
    .setDescription('Zeigt die letzten Bot-Logs')
    .addIntegerOption(o => o.setName('anzahl').setDescription('Anzahl (max. 25)').setRequired(false).setMinValue(1).setMaxValue(25))
  )
  .addSubcommand(sub => sub
    .setName('statistiken')
    .setDescription('Zeigt Server-Statistiken')
  )
  .addSubcommand(sub => sub
    .setName('reset')
    .setDescription('Setzt alle Bot-Einstellungen zurück (VORSICHT!)')
  );

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;

  if (!hasAdminPermission(member)) {
    await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst Administrator-Rechte.')], ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const db = getDatabase();

  if (sub === 'logs') {
    const anzahl = interaction.options.getInteger('anzahl') ?? 10;
    const logs = db.prepare('SELECT * FROM logs WHERE guild_id = ? ORDER BY erstellt_am DESC LIMIT ?').all(interaction.guildId!, anzahl) as unknown as LogRow[];

    if (logs.length === 0) {
      await interaction.reply({ content: '📭 Keine Logs vorhanden.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.info as ColorResolvable)
      .setTitle(`📋 Bot-Logs (letzte ${logs.length})`)
      .setDescription(
        logs.map(l =>
          `\`${l.erstellt_am}\` **${l.aktion}** — <@${l.benutzer_id}>${l.details ? `\n  └ ${l.details}` : ''}`
        ).join('\n\n').substring(0, 4000)
      )
      .setFooter({ text: 'Deutscher RP Server | Logs' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (sub === 'statistiken') {
    const get = (sql: string) => (db.prepare(sql).get(interaction.guildId!) as { count: number }).count;

    const embed = new EmbedBuilder()
      .setColor(config.colors.server as ColorResolvable)
      .setTitle('📊 Server-Statistiken')
      .addFields(
        { name: '⚖️ Verfahren gesamt', value: String(get(`SELECT COUNT(*) as count FROM verfahren WHERE guild_id = ?`)), inline: true },
        { name: '🟡 Offene Verfahren', value: String(get(`SELECT COUNT(*) as count FROM verfahren WHERE guild_id = ? AND status != 'abgeschlossen'`)), inline: true },
        { name: '🔒 Gesperrte Verfahren', value: String(get(`SELECT COUNT(*) as count FROM verfahren WHERE guild_id = ? AND gesperrt = 1`)), inline: true },
        { name: '📁 Archivierte Akten', value: String(get(`SELECT COUNT(*) as count FROM akten WHERE guild_id = ?`)), inline: true },
        { name: '📒 Notizen gesamt', value: String((db.prepare(`SELECT COUNT(*) as count FROM verfahren_notizen vn JOIN verfahren v ON vn.verfahren_id = v.id WHERE v.guild_id = ?`).get(interaction.guildId!) as { count: number }).count), inline: true },
        { name: '🎙️ Temp. Voice-Kanäle', value: String(get(`SELECT COUNT(*) as count FROM temp_voice_channels WHERE guild_id = ?`)), inline: true },
        { name: '📋 Log-Einträge', value: String(get(`SELECT COUNT(*) as count FROM logs WHERE guild_id = ?`)), inline: true },
      )
      .setFooter({ text: 'Deutscher RP Server | Statistiken' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (sub === 'reset') {
    db.prepare('DELETE FROM server_settings WHERE guild_id = ?').run(interaction.guildId!);
    db.prepare('DELETE FROM role_config WHERE guild_id = ?').run(interaction.guildId!);

    await interaction.reply({
      embeds: [createSuccessEmbed('Zurückgesetzt',
        'Alle Bot-Einstellungen wurden zurückgesetzt.\n\n' +
        '⚠️ Nutze `/setup kanale`, `/setup ausbildung` und `/setup rolle` um den Bot neu einzurichten.'
      )],
      ephemeral: true
    });
  }
}

export default { data, execute };
