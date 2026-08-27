import {
  CommandInteraction, SlashCommandBuilder, EmbedBuilder, ColorResolvable,
  GuildMember, TextChannel, ButtonBuilder, ButtonStyle, ActionRowBuilder,
  ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle,
  ModalSubmitInteraction, ThreadAutoArchiveDuration, ChannelType,
} from 'discord.js';
import { getDatabase } from '../database/database';
import { config } from '../config/config';
import { createErrorEmbed, createSuccessEmbed } from '../utils/embeds';
import { hasAdminPermission, hasModPermission } from '../utils/permissions';

// ── Ticket-Kategorien ─────────────────────────────────────────────────────────
const KATEGORIEN = {
  support: {
    label: 'Allgemeiner Support',
    emoji: '🎧',
    color: ButtonStyle.Success,
    modalTitle: 'Allgemeines Support-Ticket',
    fields: [
      { id: 'beschreibung', label: 'Wobei benötigst du Unterstützung?', placeholder: 'Beschreibe dein Anliegen möglichst genau. Was ist passiert und wobei benötigst du Hilfe?', style: TextInputStyle.Paragraph, required: true },
      { id: 'zusatzinfo', label: 'Zusätzliche Informationen', placeholder: 'Weitere Informationen, Screenshots, Videos oder sonstige wichtige Hinweise (optional).', style: TextInputStyle.Paragraph, required: false },
      { id: 'ort', label: 'Wo ist das Problem aufgetreten?', placeholder: 'z.B. im Spiel, Discord, bei einem Job, Fahrzeug, System oder Menü', style: TextInputStyle.Short, required: false },
    ],
  },
  meldung: {
    label: 'Support Meldungen',
    emoji: '📢',
    color: ButtonStyle.Primary,
    modalTitle: 'Weiter Support Meldungen',
    fields: [
      { id: 'beschreibung', label: 'Was möchtest du melden?', placeholder: 'Beschreibe deine Meldung möglichst genau.', style: TextInputStyle.Paragraph, required: true },
      { id: 'ort', label: 'Wo ist der Vorfall passiert?', placeholder: 'z.B. Roblox, Discord, bestimmter Ort, Job, Fahrzeug oder System', style: TextInputStyle.Short, required: false },
      { id: 'beteiligte', label: 'Beteiligte Personen', placeholder: 'Nenne, falls bekannt, die Roblox- oder Discord-Namen der beteiligten Personen.', style: TextInputStyle.Short, required: false },
      { id: 'zusatzinfo', label: 'Weitere Informationen', placeholder: 'Weitere Informationen oder Beweise, die für die Bearbeitung wichtig sein könnten.', style: TextInputStyle.Paragraph, required: false },
    ],
  },
  beschwerde: {
    label: 'Beschwerde',
    emoji: '📝',
    color: ButtonStyle.Secondary,
    modalTitle: 'Beschwerde Ticket',
    fields: [
      { id: 'beschreibung', label: 'Worum geht es bei deiner Beschwerde?', placeholder: 'Beschreibe ausführlich, was passiert ist und warum du dich beschweren möchtest.', style: TextInputStyle.Paragraph, required: true },
      { id: 'gegen', label: 'Gegen wen richtet sich die Beschwerde?', placeholder: 'Nenne den Roblox- oder Discord-Namen der betreffenden Person.', style: TextInputStyle.Short, required: true },
      { id: 'wann', label: 'Wann ist der Vorfall passiert?', placeholder: 'Gib möglichst Datum und ungefähre Uhrzeit an.', style: TextInputStyle.Short, required: false },
      { id: 'beweise', label: 'Gibt es Beweise?', placeholder: 'Screenshots, Videos, Nachrichten oder andere relevante Beweise.', style: TextInputStyle.Short, required: false },
      { id: 'zusatzinfo', label: 'Weitere Informationen', placeholder: 'Gibt es noch etwas, das unser Team wissen sollte?', style: TextInputStyle.Paragraph, required: false },
    ],
  },
  bewerbung: {
    label: 'Bewerben (für Admin)',
    emoji: '📋',
    color: ButtonStyle.Success,
    modalTitle: 'Bewerbungs Ticket',
    fields: [
      { id: 'name_alter', label: 'Name und Alter', placeholder: 'z.B. Max, 17 Jahre', style: TextInputStyle.Short, required: true },
      { id: 'serverzeit', label: 'Wie lange bist du auf dem Server aktiv?', placeholder: 'z.B. Seit 3 Monaten, täglich 2-3 Stunden online', style: TextInputStyle.Short, required: true },
      { id: 'erfahrung', label: 'Erfahrung als Admin/Moderator?', placeholder: 'Wo, wie lange, welche Aufgaben? Falls nein, schreibe "Keine Erfahrung"', style: TextInputStyle.Paragraph, required: true },
      { id: 'motivation', label: 'Warum willst du Admin werden?', placeholder: 'Was motiviert dich? Was möchtest du im Team bewirken? Warum sollten wir dich nehmen?', style: TextInputStyle.Paragraph, required: true },
      { id: 'situation', label: 'Wie gehst du mit Regelverstoessen um?', placeholder: 'Beschreibe an einem Beispiel, wie du reagieren würdest wenn jemand gegen die Regeln verstösst.', style: TextInputStyle.Paragraph, required: true },
    ],
  },
  bug: {
    label: 'Bugs Melden',
    emoji: '🐛',
    color: ButtonStyle.Danger,
    modalTitle: 'Bug melden',
    fields: [
      { id: 'beschreibung', label: 'Was ist passiert?', placeholder: 'Beschreibe den Fehler möglichst genau. Was ist passiert?', style: TextInputStyle.Paragraph, required: true },
      { id: 'ort', label: 'Wo ist der Fehler aufgetreten?', placeholder: 'z.B. im Spiel, bei einem Fahrzeug, Job, Menü, Gebäude oder bestimmtem System', style: TextInputStyle.Paragraph, required: true },
      { id: 'reproduzieren', label: 'Wie kann man den Fehler reproduzieren?', placeholder: 'Beschreibe die Schritte, mit denen der Fehler erneut auftritt.', style: TextInputStyle.Paragraph, required: true },
      { id: 'wo_genau', label: 'Wo genau ist der Fehler?', placeholder: 'Name des Ortes, Fahrzeugs, Jobs, Systems oder der Funktion', style: TextInputStyle.Short, required: false },
      { id: 'screenshot', label: 'Hast du einen Screenshot oder ein Video?', placeholder: 'Falls vorhanden, sende Screenshot oder Video anschließend im Ticket.', style: TextInputStyle.Short, required: false },
    ],
  },
};

type TicketKategorie = keyof typeof KATEGORIEN;

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Ticket-System')
  .addSubcommand(sub => sub.setName('panel').setDescription('Postet das Ticket-Panel mit Kategorien-Buttons'))
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
      .setTitle('🎫 Ticket erstellen')
      .setDescription(
        'Du kannst den Ticket-Support starten, indem du einen Bereich auswählst und auf den Button des jeweiligen Bereiches klickst.\n\n' +
        '⚠️ **Wichtig:** Bei Bewerbungen kann es zu längeren Wartezeiten kommen.'
      )
      .setFooter({ text: 'Deutscher RP Server — Ticket-System' })
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket_kat_support').setLabel('Allgemeiner Support').setStyle(ButtonStyle.Success).setEmoji('🎧'),
      new ButtonBuilder().setCustomId('ticket_kat_meldung').setLabel('Support Meldungen').setStyle(ButtonStyle.Primary).setEmoji('📢'),
      new ButtonBuilder().setCustomId('ticket_kat_beschwerde').setLabel('Beschwerde').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket_kat_bewerbung').setLabel('Bewerben (für Admin)').setStyle(ButtonStyle.Success).setEmoji('📋'),
      new ButtonBuilder().setCustomId('ticket_kat_bug').setLabel('Bugs Melden').setStyle(ButtonStyle.Danger).setEmoji('🐛'),
    );

    const channel = interaction.channel as TextChannel;
    await channel.send({ embeds: [embed], components: [row1, row2] });
    await interaction.reply({ embeds: [createSuccessEmbed('Panel gepostet', 'Das Ticket-Panel wurde gesendet.')], ephemeral: true });

  } else if (sub === 'schliessen') {
    if (!hasAdminPermission(member) && !hasModPermission(member)) {
      await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Nur Staff.')], ephemeral: true });
      return;
    }

    const db = getDatabase();
    const ticket = db.prepare('SELECT id FROM tickets WHERE guild_id = ? AND thread_id = ? AND status = ?')
      .get(interaction.guildId!, interaction.channelId, 'offen') as { id: number } | undefined;

    if (!ticket) {
      await interaction.reply({ embeds: [createErrorEmbed('Kein Ticket', 'Dies ist kein offenes Ticket.')], ephemeral: true });
      return;
    }

    db.prepare("UPDATE tickets SET status = 'geschlossen', geschlossen_am = datetime('now'), geschlossen_von = ? WHERE id = ?")
      .run(member.user.tag, ticket.id);

    await interaction.reply({ embeds: [createSuccessEmbed('🔒 Ticket geschlossen', `Geschlossen von ${member}. Thread wird archiviert.`)] });

    setTimeout(async () => {
      try {
        const thread = interaction.channel;
        if (thread && 'setArchived' in thread) {
          await (thread as { setArchived: (a: boolean) => Promise<unknown> }).setArchived(true);
        }
      } catch { /* ignore */ }
    }, 5000);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// BUTTON + MODAL HANDLER (aufgerufen vom PanelManager)
// ══════════════════════════════════════════════════════════════════════════════

/** Öffnet das Modal für die gewählte Ticket-Kategorie */
export function handleTicketButton(interaction: ButtonInteraction): ModalBuilder | null {
  const katKey = interaction.customId.replace('ticket_kat_', '') as TicketKategorie;
  const kat = KATEGORIEN[katKey];
  if (!kat) return null;

  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_${katKey}`)
    .setTitle(kat.modalTitle);

  kat.fields.forEach(f => {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(f.id)
          .setLabel(f.label)
          .setPlaceholder(f.placeholder)
          .setStyle(f.style)
          .setRequired(f.required)
          .setMaxLength(f.style === TextInputStyle.Paragraph ? 1000 : 200)
      )
    );
  });

  return modal;
}

/** Verarbeitet das Ticket-Modal und erstellt den Thread */
export async function handleTicketModal(interaction: ModalSubmitInteraction): Promise<void> {
  const katKey = interaction.customId.replace('ticket_modal_', '') as TicketKategorie;
  const kat = KATEGORIEN[katKey];
  if (!kat) return;

  const member = interaction.member as GuildMember;
  const guildId = interaction.guildId!;
  const db = getDatabase();

  // Prüfen ob bereits ein offenes Ticket existiert
  const existing = db.prepare('SELECT id FROM tickets WHERE guild_id = ? AND user_id = ? AND status = ?')
    .get(guildId, member.id, 'offen') as { id: number } | undefined;
  if (existing) {
    await interaction.reply({ embeds: [createErrorEmbed('Offenes Ticket', 'Du hast bereits ein offenes Ticket. Warte auf eine Antwort oder lass es schliessen.')], ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const channel = interaction.channel as TextChannel;

    // Felder aus dem Modal lesen
    const fieldValues: Record<string, string> = {};
    kat.fields.forEach(f => {
      try { fieldValues[f.id] = interaction.fields.getTextInputValue(f.id).trim(); } catch { fieldValues[f.id] = ''; }
    });

    // Thread erstellen
    const thread = await channel.threads.create({
      name: `${kat.emoji} ${kat.label} — ${member.user.username}`,
      autoArchiveDuration: 4320 as 60,
      type: 12 as 11, // PrivateThread
      reason: `Ticket: ${kat.label} von ${member.user.tag}`,
    });

    await thread.members.add(member.id);

    // In DB speichern
    db.prepare('INSERT INTO tickets (guild_id, user_id, username, thread_id, kategorie) VALUES (?, ?, ?, ?, ?)')
      .run(guildId, member.id, member.user.tag, thread.id, katKey);

    // Ticket-Info Embed
    const embed = new EmbedBuilder()
      .setColor(config.colors.info as ColorResolvable)
      .setTitle(`${kat.emoji} ${kat.modalTitle}`)
      .setDescription(`Ticket von ${member}\n\n**Kategorie:** ${kat.label}`)
      .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
      .setFooter({ text: `Ticket-ID: ${thread.id} | Deutscher RP Server` })
      .setTimestamp();

    // Antworten als Felder hinzufügen
    kat.fields.forEach(f => {
      const value = fieldValues[f.id];
      if (value) {
        embed.addFields({ name: f.label, value: value.substring(0, 1020), inline: false });
      }
    });

    const closeBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket_schliessen').setLabel('Ticket schliessen').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    );

    await thread.send({ embeds: [embed], components: [closeBtn] });

    await interaction.editReply({ embeds: [createSuccessEmbed('🎫 Ticket erstellt', `Dein Ticket wurde erstellt: ${thread}\n\nEin Staff-Mitglied wird sich melden.`)] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    await interaction.editReply({ embeds: [createErrorEmbed('Fehler', `Ticket konnte nicht erstellt werden: ${msg}`)] });
  }
}

export default { data, execute };
