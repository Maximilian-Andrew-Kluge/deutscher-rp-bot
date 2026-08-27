import {
  CommandInteraction, SlashCommandBuilder, EmbedBuilder, ColorResolvable,
  GuildMember, TextChannel, ButtonBuilder, ButtonStyle, ActionRowBuilder,
  ButtonInteraction, ThreadAutoArchiveDuration, ChannelType,
} from 'discord.js';
import { getDatabase } from '../database/database';
import { config } from '../config/config';
import { createErrorEmbed, createSuccessEmbed } from '../utils/embeds';
import { hasAdminPermission, hasModPermission } from '../utils/permissions';

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Ticket-System')
  .addSubcommand(sub => sub.setName('panel').setDescription('Postet das Ticket-Panel mit Button in diesen Kanal'))
  .addSubcommand(sub => sub.setName('schliessen').setDescription('Schliesst das aktuelle Ticket'));

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;
  const sub = interaction.options.getSubcommand();

  if (sub === 'panel') {
    if (!hasAdminPermission(member)) {
      await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Nur Admins.')], ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.server as ColorResolvable)
      .setTitle('🎫 Support-Ticket erstellen')
      .setDescription(
        'Du brauchst Hilfe oder hast ein Anliegen?\n\n' +
        'Klicke auf den Button unten, um ein Ticket zu erstellen.\n' +
        'Ein Staff-Mitglied wird sich so schnell wie möglich um dich kümmern.\n\n' +
        '**Bitte beachte:**\n' +
        '• Erstelle nur ein Ticket pro Anliegen\n' +
        '• Beschreibe dein Problem so genau wie möglich\n' +
        '• Habe etwas Geduld — wir antworten so schnell es geht'
      )
      .setFooter({ text: 'Deutscher RP Server | Ticket-System' })
      .setTimestamp();

    const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_erstellen')
        .setLabel('Ticket erstellen')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎫'),
    );

    const channel = interaction.channel as TextChannel;
    await channel.send({ embeds: [embed], components: [button] });
    await interaction.reply({ embeds: [createSuccessEmbed('Panel gepostet', 'Das Ticket-Panel wurde gesendet.')], ephemeral: true });

  } else if (sub === 'schliessen') {
    if (!hasAdminPermission(member) && !hasModPermission(member)) {
      await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Nur Staff kann Tickets schliessen.')], ephemeral: true });
      return;
    }

    const db = getDatabase();
    const ticket = db.prepare('SELECT id, user_id FROM tickets WHERE guild_id = ? AND thread_id = ? AND status = ?')
      .get(interaction.guildId!, interaction.channelId, 'offen') as { id: number; user_id: string } | undefined;

    if (!ticket) {
      await interaction.reply({ embeds: [createErrorEmbed('Kein Ticket', 'Dieser Kanal ist kein offenes Ticket.')], ephemeral: true });
      return;
    }

    db.prepare("UPDATE tickets SET status = 'geschlossen', geschlossen_am = datetime('now'), geschlossen_von = ? WHERE id = ?")
      .run(member.user.tag, ticket.id);

    await interaction.reply({ embeds: [createSuccessEmbed('🔒 Ticket geschlossen', `Dieses Ticket wurde von ${member} geschlossen.\nDer Thread wird in 10 Sekunden archiviert.`)] });

    setTimeout(async () => {
      try {
        const thread = interaction.channel;
        if (thread && 'setArchived' in thread) {
          await (thread as { setArchived: (a: boolean) => Promise<unknown> }).setArchived(true);
        }
      } catch { /* ignore */ }
    }, 10000);
  }
}

export default { data, execute };
