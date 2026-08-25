import {
  CommandInteraction, SlashCommandBuilder, EmbedBuilder, ColorResolvable,
  GuildMember, ChannelType,
} from 'discord.js';
import { getDatabase } from '../database/database';
import { hasAdminPermission } from '../utils/permissions';
import { createErrorEmbed, createSuccessEmbed } from '../utils/embeds';
import { config } from '../config/config';

export const data = new SlashCommandBuilder()
  .setName('tiktok')
  .setDescription('TikTok Live-Benachrichtigungen verwalten')
  .addSubcommand(sub => sub
    .setName('kanal')
    .setDescription('Setzt den Kanal für Live-Ankündigungen')
    .addChannelOption(o => o
      .setName('kanal')
      .setDescription('Der Kanal für Live-Ankündigungen')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
    )
  )
  .addSubcommand(sub => sub
    .setName('hinzufuegen')
    .setDescription('Fügt einen TikToker zur Live-Überwachung hinzu')
    .addStringOption(o => o
      .setName('username')
      .setDescription('TikTok-Benutzername (ohne @)')
      .setRequired(true)
    )
    .addStringOption(o => o
      .setName('anzeigename')
      .setDescription('Anzeigename in der Benachrichtigung (optional)')
      .setRequired(false)
    )
  )
  .addSubcommand(sub => sub
    .setName('entfernen')
    .setDescription('Entfernt einen TikToker aus der Überwachung')
    .addStringOption(o => o
      .setName('username')
      .setDescription('TikTok-Benutzername (ohne @)')
      .setRequired(true)
    )
  )
  .addSubcommand(sub => sub
    .setName('liste')
    .setDescription('Zeigt alle überwachten TikToker')
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
  const guildId = interaction.guildId!;

  // ── Live-Kanal setzen ──
  if (sub === 'kanal') {
    const kanal = interaction.options.getChannel('kanal', true);
    db.prepare('INSERT INTO server_settings (guild_id) VALUES (?) ON CONFLICT(guild_id) DO NOTHING').run(guildId);
    db.prepare('UPDATE server_settings SET live_channel_id = ? WHERE guild_id = ?').run(kanal.id, guildId);
    await interaction.reply({
      embeds: [createSuccessEmbed('Live-Kanal gesetzt', `Live-Ankündigungen werden jetzt in ${kanal} gepostet.`)],
      ephemeral: true,
    });
    return;
  }

  // ── TikToker hinzufügen ──
  if (sub === 'hinzufuegen') {
    const username = interaction.options.getString('username', true).replace(/^@/, '').trim().toLowerCase();
    const anzeigeName = interaction.options.getString('anzeigename') || username;

    try {
      db.prepare('INSERT INTO tiktok_streamer (guild_id, tiktok_username, anzeige_name, hinzugefuegt_von) VALUES (?, ?, ?, ?)')
        .run(guildId, username, anzeigeName, interaction.user.id);
      await interaction.reply({
        embeds: [createSuccessEmbed(
          '✅ TikToker hinzugefügt',
          `**@${username}** wird jetzt überwacht.\nBei Live-Start kommt eine Benachrichtigung im Live-Kanal.\n\n⚠️ Stelle sicher dass der Live-Kanal mit \`/tiktok kanal\` gesetzt ist.`
        )],
        ephemeral: true,
      });
    } catch {
      await interaction.reply({ embeds: [createErrorEmbed('Bereits vorhanden', `**@${username}** wird bereits überwacht.`)], ephemeral: true });
    }
    return;
  }

  // ── TikToker entfernen ──
  if (sub === 'entfernen') {
    const username = interaction.options.getString('username', true).replace(/^@/, '').trim().toLowerCase();
    const result = db.prepare('DELETE FROM tiktok_streamer WHERE guild_id = ? AND tiktok_username = ?').run(guildId, username);
    if (result.changes > 0) {
      await interaction.reply({ embeds: [createSuccessEmbed('Entfernt', `**@${username}** wird nicht mehr überwacht.`)], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [createErrorEmbed('Nicht gefunden', `**@${username}** war nicht in der Überwachung.`)], ephemeral: true });
    }
    return;
  }

  // ── Liste ──
  if (sub === 'liste') {
    const streamer = db.prepare('SELECT * FROM tiktok_streamer WHERE guild_id = ? ORDER BY tiktok_username')
      .all(guildId) as unknown as Array<{ tiktok_username: string; anzeige_name: string | null; ist_live: number }>;

    const settings = db.prepare('SELECT live_channel_id FROM server_settings WHERE guild_id = ?')
      .get(guildId) as { live_channel_id: string | null } | undefined;

    const embed = new EmbedBuilder()
      .setColor(config.colors.server as ColorResolvable)
      .setTitle('📱 Überwachte TikToker')
      .setDescription(
        streamer.length === 0
          ? 'Es werden noch keine TikToker überwacht.\nNutze `/tiktok hinzufuegen`.'
          : streamer.map(s => `${s.ist_live ? '🔴' : '⚫'} **@${s.tiktok_username}**${s.anzeige_name && s.anzeige_name !== s.tiktok_username ? ` (${s.anzeige_name})` : ''}`).join('\n')
      )
      .addFields({
        name: 'Live-Kanal',
        value: settings?.live_channel_id ? `<#${settings.live_channel_id}>` : '❌ Nicht gesetzt — nutze `/tiktok kanal`',
        inline: false,
      })
      .setFooter({ text: '🔴 = aktuell live | ⚫ = offline' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }
}

export default { data, execute };
