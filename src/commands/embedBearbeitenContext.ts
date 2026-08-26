import {
  ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction,
  GuildMember, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
} from 'discord.js';
import { createErrorEmbed } from '../utils/embeds';
import { hasAdminPermission, hasJustizPermission } from '../utils/permissions';

// Rechtsklick auf eine Nachricht → Apps → "Embed bearbeiten"
// Funktioniert auch für ältere Embeds, die nicht in der Datenbank stehen,
// da die Werte direkt aus der Nachricht gelesen werden.
export const data = new ContextMenuCommandBuilder()
  .setName('Embed bearbeiten')
  .setType(ApplicationCommandType.Message);

export async function execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;

  if (!hasAdminPermission(member) && !hasJustizPermission(member)) {
    await interaction.reply({
      embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst Admin- oder Justiz-Rechte.')],
      ephemeral: true,
    });
    return;
  }

  const message = interaction.targetMessage;

  // Nur Nachrichten des Bots lassen sich bearbeiten
  if (message.author.id !== interaction.client.user?.id) {
    await interaction.reply({
      embeds: [createErrorEmbed('Nicht bearbeitbar', 'Es lassen sich nur Embeds bearbeiten, die von diesem Bot gesendet wurden.')],
      ephemeral: true,
    });
    return;
  }

  const embed = message.embeds[0];
  if (!embed) {
    await interaction.reply({
      embeds: [createErrorEmbed('Kein Embed', 'Diese Nachricht enthält kein Embed zum Bearbeiten.')],
      ephemeral: true,
    });
    return;
  }

  const farbeHex = typeof embed.color === 'number'
    ? '#' + embed.color.toString(16).padStart(6, '0')
    : '#5865F2';

  const modal = new ModalBuilder()
    .setCustomId(`modal_embed_ctx_${message.channelId}_${message.id}`)
    .setTitle('Embed bearbeiten');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('titel').setLabel('Titel')
        .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(256)
        .setValue(embed.title ?? '')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('beschreibung').setLabel('Beschreibung')
        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000)
        .setValue(embed.description ?? '')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('farbe').setLabel('Farbe (Hex, z.B. #2563EB)')
        .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(7)
        .setValue(farbeHex)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('autor').setLabel('Autor-Name (optional)')
        .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256)
        .setValue(embed.author?.name ?? '')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('fusszeile').setLabel('Fußzeile (optional)')
        .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(2048)
        .setValue(embed.footer?.text ?? 'Deutscher RP Server')
    ),
  );

  await interaction.showModal(modal);
}

export default { data, execute };
