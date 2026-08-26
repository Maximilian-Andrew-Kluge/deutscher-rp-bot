import {
  CommandInteraction, SlashCommandBuilder, EmbedBuilder, ColorResolvable,
  TextChannel, GuildMember, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ChannelType, StringSelectMenuBuilder
} from 'discord.js';
import { createErrorEmbed, createInfoEmbed } from '../utils/embeds';
import { hasAdminPermission, hasJustizPermission } from '../utils/permissions';
import { config } from '../config/config';
import { getDatabase } from '../database/database';

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
  )
  .addSubcommand(sub => sub
    .setName('bearbeiten')
    .setDescription('Bearbeitet ein bereits erstelltes Embed (Auswahl aus Liste)')
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

  const sub = interaction.options.getSubcommand();

  // ── /embed bearbeiten → Auswahl-Menü der bereits erstellten Embeds ──
  if (sub === 'bearbeiten') {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT id, channel_id, titel, erstellt_am
      FROM gesendete_embeds
      WHERE guild_id = ?
      ORDER BY aktualisiert_am DESC
      LIMIT 25
    `).all(interaction.guildId!) as Array<{ id: number; channel_id: string; titel: string | null; erstellt_am: string }>;

    if (rows.length === 0) {
      await interaction.reply({
        embeds: [createInfoEmbed('Keine Embeds gefunden', 'Es wurden noch keine Embeds über den Bot erstellt, die bearbeitet werden können.')],
        ephemeral: true,
      });
      return;
    }

    const options = rows.map(r => {
      const datum = r.erstellt_am?.split(' ')[0] ?? '';
      const titel = (r.titel || 'Ohne Titel').slice(0, 90);
      return {
        label: titel,
        description: `#Kanal: ${r.channel_id.slice(-6)} · ${datum}`.slice(0, 100),
        value: String(r.id),
      };
    });

    const menu = new StringSelectMenuBuilder()
      .setCustomId('embed_edit_select')
      .setPlaceholder('Wähle das Embed, das du bearbeiten möchtest...')
      .addOptions(options);

    await interaction.reply({
      content: '🖊️ **Embed bearbeiten** — wähle aus der Liste:',
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
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
