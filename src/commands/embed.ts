import {
  CommandInteraction, SlashCommandBuilder, EmbedBuilder, ColorResolvable,
  TextChannel, GuildMember, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ChannelType
} from 'discord.js';
import { createErrorEmbed } from '../utils/embeds';
import { hasAdminPermission, hasJustizPermission } from '../utils/permissions';
import { config } from '../config/config';

const VORLAGEN: Record<string, { titel: string; beschreibung: string; farbe: string; autorName: string }> = {
  polizei_ausbildung:        { titel: '🚓 Ausbildung | Polizei',        beschreibung: 'Willkommen bei der Polizeiausbildung des **Deutschen RP Servers**.', farbe: '#2563EB', autorName: '🚓 Deutscher RP Server | Polizei' },
  feuerwehr_ausbildung:      { titel: '🚒 Ausbildung | Feuerwehr',      beschreibung: 'Willkommen bei der Feuerwehrausbildung des **Deutschen RP Servers**.',   farbe: '#E74C3C', autorName: '🚒 Deutscher RP Server | Feuerwehr' },
  rettungsdienst_ausbildung: { titel: '🚑 Ausbildung | Rettungsdienst', beschreibung: 'Willkommen bei der Rettungsdienst-Ausbildung des **Deutschen RP Servers**.', farbe: '#FF6B81', autorName: '🚑 Deutscher RP Server | Rettungsdienst' },
  justiz_ausbildung:         { titel: '⚖️ Ausbildung | Justiz',         beschreibung: 'Willkommen bei der Justizausbildung des **Deutschen RP Servers**.',    farbe: '#9B59B6', autorName: '⚖️ Deutscher RP Server | Justiz' },
  ankuendigung:              { titel: '📢 Ankündigung',                 beschreibung: 'Wichtige Ankündigung des **Deutschen RP Servers**.',                     farbe: '#5865F2', autorName: '📢 Deutscher RP Server' },
  information:               { titel: '📋 Information',                 beschreibung: 'Informationen des **Deutschen RP Servers**.',                            farbe: '#3498DB', autorName: '📋 Deutscher RP Server' },
  event:                     { titel: '🎉 Event',                       beschreibung: 'Neues Event auf dem **Deutschen RP Server**!',                           farbe: '#F39C12', autorName: '🎉 Deutscher RP Server | Events' },
  update:                    { titel: '🛠️ Update',                      beschreibung: 'Server-Update des **Deutschen RP Servers**.',                            farbe: '#2ECC71', autorName: '🛠️ Deutscher RP Server' },
};

export const data = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('Embed erstellen und in einen Kanal senden')
  .addSubcommand(sub => sub
    .setName('erstellen')
    .setDescription('Erstellt ein Embed über einen Editor-Dialog')
    .addChannelOption(o => o
      .setName('kanal')
      .setDescription('Zielkanal')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addStringOption(o => o
      .setName('vorlage')
      .setDescription('Optionale Vorlage als Ausgangspunkt')
      .setRequired(false)
      .addChoices(
        { name: '🚓 Polizei Ausbildung',          value: 'polizei_ausbildung' },
        { name: '🚒 Feuerwehr Ausbildung',         value: 'feuerwehr_ausbildung' },
        { name: '🚑 Rettungsdienst Ausbildung',    value: 'rettungsdienst_ausbildung' },
        { name: '⚖️ Justiz Ausbildung',            value: 'justiz_ausbildung' },
        { name: '📢 Ankündigung',                  value: 'ankuendigung' },
        { name: '📋 Information',                  value: 'information' },
        { name: '🎉 Event',                        value: 'event' },
        { name: '🛠️ Update',                       value: 'update' },
      )
    )
  );

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;

  if (!hasAdminPermission(member) && !hasJustizPermission(member)) {
    await interaction.reply({
      embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst Admin- oder Justiz-Rechte.')],
      ephemeral: true,
    });
    return;
  }

  const kanal = interaction.options.getChannel('kanal', true) as TextChannel;
  const vorlageKey = interaction.options.getString('vorlage');
  const vorlage = vorlageKey ? VORLAGEN[vorlageKey] : null;

  const modal = new ModalBuilder()
    .setCustomId(`modal_embed_senden_${kanal.id}`)
    .setTitle(vorlage ? `Embed: ${vorlageKey}` : 'Embed erstellen');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('titel')
        .setLabel('Titel')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(256)
        .setValue(vorlage?.titel ?? '')
        .setPlaceholder('Titel des Embeds')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('beschreibung')
        .setLabel('Beschreibung')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(4000)
        .setValue(vorlage?.beschreibung ?? '')
        .setPlaceholder('Beschreibung (Markdown unterstützt)')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('farbe')
        .setLabel('Farbe (Hex, z.B. #2563EB)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(7)
        .setValue(vorlage?.farbe ?? '#5865F2')
        .setPlaceholder('#5865F2')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('autor')
        .setLabel('Autor-Name (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(256)
        .setValue(vorlage?.autorName ?? '')
        .setPlaceholder('z.B. 🚓 Deutscher RP Server | Polizei')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('fusszeile')
        .setLabel('Fußzeile (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(2048)
        .setValue('Deutscher RP Server')
        .setPlaceholder('Fußzeilen-Text')
    ),
  );

  await interaction.showModal(modal);
}

export default { data, execute };
