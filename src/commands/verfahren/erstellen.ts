import {
  CommandInteraction, SlashCommandBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, ColorResolvable, GuildMember
} from 'discord.js';
import { hasJustizPermission } from '../../utils/permissions';
import { createErrorEmbed } from '../../utils/embeds';
import { config } from '../../config/config';

export const data = new SlashCommandBuilder()
  .setName('verfahren')
  .setDescription('Erstellt das Verfahrens-Panel mit ➕ Button')
  .addSubcommand(sub => sub
    .setName('panel')
    .setDescription('Erstellt das Verfahrens-Panel mit ➕ Button im aktuellen Kanal')
  );

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;

  if (!hasJustizPermission(member) && !member.permissions.has('Administrator')) {
    await interaction.reply({
      embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst Administrator- oder Justiz-Rechte.')],
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(config.colors.justiz as ColorResolvable)
    .setTitle('⚖️ Justiz | Verfahrenssystem')
    .setDescription(
      'Willkommen beim Justiz-Verfahrenssystem des **Deutschen RP Servers**.\n\n' +
      'Berechtigte Justizmitglieder können hier neue Verfahren eröffnen.\n\n' +
      '**Verfahrensarten:**\n' +
      '• Strafverfahren\n• Zivilverfahren\n• Verkehrsverfahren\n• Sonstiges\n\n' +
      '**Berechtigte Rollen:**\n' +
      '• Justiz-Leitung\n• Richter\n• Staatsanwalt\n• Anwalt\n• Justizanwärter'
    )
    .setFooter({ text: 'Deutscher RP Server | Justiz' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('neues_verfahren')
        .setLabel('Neues Verfahren eröffnen')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('➕')
    );

  await interaction.reply({ embeds: [embed], components: [row] });
}

export default { data, execute };
