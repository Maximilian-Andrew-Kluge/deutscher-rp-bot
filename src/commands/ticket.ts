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
      { id: 'problem', label: 'Was ist dein Problem?', placeholder: 'Beschreibe kurz und klar, was nicht funktioniert oder wobei du Hilfe brauchst.', style: TextInputStyle.Paragraph, required: true },
      { id: 'versucht', label: 'Was hast du bereits versucht?', placeholder: 'Hast du schon etwas probiert? Neustart, erneut beitreten etc.?', style: TextInputStyle.Paragraph, required: false },
      { id: 'ort', label: 'Wo tritt das Problem auf?', placeholder: 'z.B. im Spiel, Discord, bestimmter Job, Fahrzeug, Menü...', style: TextInputStyle.Short, required: true },
      { id: 'dringend', label: 'Wie dringend ist es? (1-10)', placeholder: '1 = kann warten, 10 = blockiert mich komplett', style: TextInputStyle.Short, required: false },
    ],
  },
  meldung: {
    label: 'Support Meldungen',
    emoji: '📢',
    color: ButtonStyle.Primary,
    modalTitle: 'Support Meldung',
    fields: [
      { id: 'was', label: 'Was genau möchtest du melden?', placeholder: 'Beschreibe den Vorfall so detailliert wie möglich.', style: TextInputStyle.Paragraph, required: true },
      { id: 'wer', label: 'Wer ist beteiligt?', placeholder: 'Discord-Namen oder Roblox-Namen aller Beteiligten.', style: TextInputStyle.Short, required: true },
      { id: 'wann_wo', label: 'Wann und wo ist es passiert?', placeholder: 'z.B. Heute 15:30, am Rathaus / im Discord Voice', style: TextInputStyle.Short, required: true },
      { id: 'beweise', label: 'Hast du Beweise? (Screenshots/Videos)', placeholder: 'Falls ja, lade sie nach dem Erstellen des Tickets im Thread hoch.', style: TextInputStyle.Short, required: false },
      { id: 'sonstiges', label: 'Sonstiges', placeholder: 'Weitere Infos die für die Bearbeitung wichtig sein könnten.', style: TextInputStyle.Paragraph, required: false },
    ],
  },
  beschwerde: {
    label: 'Beschwerde',
    emoji: '📝',
    color: ButtonStyle.Secondary,
    modalTitle: 'Beschwerde',
    fields: [
      { id: 'gegen', label: 'Gegen wen richtet sich die Beschwerde?', placeholder: 'Discord- oder Roblox-Name der Person (oder Team/Fraktion).', style: TextInputStyle.Short, required: true },
      { id: 'was', label: 'Was genau ist passiert?', placeholder: 'Schildere den Vorfall ausführlich und sachlich.', style: TextInputStyle.Paragraph, required: true },
      { id: 'wann', label: 'Wann ist es passiert?', placeholder: 'Datum und ungefähre Uhrzeit.', style: TextInputStyle.Short, required: true },
      { id: 'beweise', label: 'Beweise vorhanden?', placeholder: 'Screenshots, Videos, Chat-Logs? Falls ja, im Thread hochladen.', style: TextInputStyle.Short, required: false },
      { id: 'ergebnis', label: 'Was erwartest du als Ergebnis?', placeholder: 'Was soll deiner Meinung nach passieren? (z.B. Verwarnung, Gespräch)', style: TextInputStyle.Paragraph, required: false },
    ],
  },
  bewerbung: {
    label: 'Bewerben (für Admin)',
    emoji: '📋',
    color: ButtonStyle.Success,
    modalTitle: 'Admin-Bewerbung',
    fields: [
      { id: 'name_alter', label: 'Name und Alter', placeholder: 'z.B. Max, 17 Jahre', style: TextInputStyle.Short, required: true },
      { id: 'serverzeit', label: 'Wie lange bist du auf dem Server aktiv?', placeholder: 'z.B. Seit 3 Monaten, täglich 2-3 Stunden online', style: TextInputStyle.Short, required: true },
      { id: 'erfahrung', label: 'Erfahrung als Admin/Moderator?', placeholder: 'Wo, wie lange, welche Aufgaben? Falls nein: "Keine Erfahrung"', style: TextInputStyle.Paragraph, required: true },
      { id: 'motivation', label: 'Warum willst du Admin werden?', placeholder: 'Was motiviert dich? Was möchtest du im Team bewirken? Warum sollten wir dich nehmen?', style: TextInputStyle.Paragraph, required: true },
      { id: 'situation', label: 'Wie gehst du mit Regelverstoessen um?', placeholder: 'Beschreibe an einem Beispiel, wie du reagieren würdest wenn jemand Regeln bricht.', style: TextInputStyle.Paragraph, required: true },
    ],
  },
  bug: {
    label: 'Bugs Melden',
    emoji: '🐛',
    color: ButtonStyle.Danger,
    modalTitle: 'Bug melden',
    fields: [
      { id: 'was', label: 'Was ist passiert?', placeholder: 'Beschreibe den Fehler klar und deutlich.', style: TextInputStyle.Paragraph, required: true },
      { id: 'erwartet', label: 'Was sollte eigentlich passieren?', placeholder: 'Was hast du erwartet, das passiert? Was wäre das richtige Verhalten?', style: TextInputStyle.Paragraph, required: true },
      { id: 'schritte', label: 'Wie kann man den Bug reproduzieren?', placeholder: '1. Gehe zu... 2. Klicke auf... 3. Dann passiert...', style: TextInputStyle.Paragraph, required: true },
      { id: 'wo', label: 'Wo genau tritt er auf?', placeholder: 'Ort, Fahrzeug, Job, System, Menü — so spezifisch wie möglich.', style: TextInputStyle.Short, required: true },
      { id: 'screenshot', label: 'Screenshot/Video vorhanden?', placeholder: 'Falls ja, nach Ticket-Erstellung im Thread hochladen.', style: TextInputStyle.Short, required: false },
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
