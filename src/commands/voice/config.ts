import { CommandInteraction, SlashCommandBuilder, GuildMember, EmbedBuilder, ColorResolvable } from 'discord.js';
import { getDatabase } from '../../database/database';
import { createErrorEmbed, createSuccessEmbed } from '../../utils/embeds';
import { hasAdminPermission } from '../../utils/permissions';
import { config } from '../../config/config';

interface VoiceSettings {
  voice_create_channel_id: string | null;
  voice_category_id: string | null;
}

interface TempChannel {
  channel_id: string;
  owner_id: string;
  channel_name: string;
  erstellt_am: string;
}

export const data = new SlashCommandBuilder()
  .setName('voice-config')
  .setDescription('Voice-System Konfiguration und Verwaltung')
  .addSubcommand(sub =>
    sub.setName('info')
      .setDescription('Zeigt die aktuelle Voice-Konfiguration')
  )
  .addSubcommand(sub =>
    sub.setName('reset')
      .setDescription('Setzt das Voice-System zurück')
  )
  .addSubcommand(sub =>
    sub.setName('liste')
      .setDescription('Zeigt alle aktiven temporären Kanäle')
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

  if (sub === 'info') {
    const settings = db.prepare('SELECT voice_create_channel_id, voice_category_id FROM server_settings WHERE guild_id = ?').get(interaction.guildId!) as VoiceSettings | undefined;

    const embed = new EmbedBuilder()
      .setColor(config.colors.server as ColorResolvable)
      .setTitle('🎙️ Voice-System Konfiguration')
      .addFields(
        { name: '🔊 Erstell-Kanal', value: settings?.voice_create_channel_id ? `<#${settings.voice_create_channel_id}>` : '❌ Nicht gesetzt', inline: true },
        { name: '📁 Kategorie', value: settings?.voice_category_id ? `<#${settings.voice_category_id}>` : '❌ Nicht gesetzt', inline: true },
      )
      .setFooter({ text: 'Deutscher RP Server | Voice-System' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (sub === 'reset') {
    db.prepare(`
      UPDATE server_settings SET voice_create_channel_id = NULL, voice_category_id = NULL
      WHERE guild_id = ?
    `).run(interaction.guildId!);

    await interaction.reply({ embeds: [createSuccessEmbed('Voice-System zurückgesetzt', 'Das Voice-System wurde deaktiviert.')], ephemeral: true });

  } else if (sub === 'liste') {
    const channels = db.prepare('SELECT * FROM temp_voice_channels WHERE guild_id = ? ORDER BY erstellt_am DESC').all(interaction.guildId!) as unknown as TempChannel[];

    if (channels.length === 0) {
      await interaction.reply({ content: '📭 Keine aktiven temporären Kanäle.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.info as ColorResolvable)
      .setTitle('🎙️ Aktive temporäre Voice-Kanäle')
      .setDescription(
        channels.map(c =>
          `• **${c.channel_name}**\n  Besitzer: <@${c.owner_id}> | Erstellt: <t:${Math.floor(new Date(c.erstellt_am).getTime() / 1000)}:R>`
        ).join('\n\n').substring(0, 4000)
      )
      .setFooter({ text: `${channels.length} aktiver Kanal/Kanäle` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

export default { data, execute };
