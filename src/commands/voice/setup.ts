import { CommandInteraction, SlashCommandBuilder, ChannelType, GuildMember } from 'discord.js';
import { getDatabase } from '../../database/database';
import { createErrorEmbed, createSuccessEmbed } from '../../utils/embeds';
import { hasAdminPermission } from '../../utils/permissions';

export const data = new SlashCommandBuilder()
  .setName('voice-setup')
  .setDescription('Richtet das temporäre Voice-Channel-System ein')
  .addChannelOption(opt =>
    opt.setName('erstell-kanal')
      .setDescription('Voice-Kanal: Benutzer treten ihm bei, um einen eigenen Kanal zu erstellen')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildVoice)
  )
  .addChannelOption(opt =>
    opt.setName('kategorie')
      .setDescription('Kategorie, in der temporäre Kanäle erstellt werden')
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildCategory)
  );

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;

  if (!hasAdminPermission(member)) {
    await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst Administrator-Rechte.')], ephemeral: true });
    return;
  }

  const createChannel = interaction.options.getChannel('erstell-kanal', true);
  const category = interaction.options.getChannel('kategorie');

  const db = getDatabase();
  db.prepare(`
    INSERT INTO server_settings (guild_id, voice_create_channel_id, voice_category_id)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      voice_create_channel_id = excluded.voice_create_channel_id,
      voice_category_id = excluded.voice_category_id,
      updated_at = datetime('now')
  `).run(interaction.guildId!, createChannel.id, category?.id || null);

  await interaction.reply({
    embeds: [createSuccessEmbed(
      'Voice-System eingerichtet',
      `**Erstell-Kanal:** ${createChannel}\n**Kategorie:** ${category ? category.toString() : 'Keine (Root-Ebene)'}\n\nBenutzer, die dem Erstell-Kanal beitreten, erhalten automatisch einen eigenen temporären RP-Channel.`
    )],
    ephemeral: true
  });
}

export default { data, execute };
