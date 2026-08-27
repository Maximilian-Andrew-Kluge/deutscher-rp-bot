import {
  CommandInteraction, SlashCommandBuilder, EmbedBuilder, ColorResolvable,
  GuildMember, TextChannel, ButtonBuilder, ButtonStyle, ActionRowBuilder,
  ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle,
  ModalSubmitInteraction, ChannelType, PermissionFlagsBits, CategoryChannel,
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
      { id: 'beweise', label: 'Hast du Beweise? (Screenshots/Videos)', placeholder: 'Falls ja, lade sie nach dem Erstellen des Tickets im Kanal hoch.', style: TextInputStyle.Short, required: false },
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
      { id: 'beweise', label: 'Beweise vorhanden?', placeholder: 'Screenshots, Videos, Chat-Logs? Falls ja, im Ticket-Kanal hochladen.', style: TextInputStyle.Short, required: false },
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
      { id: 'screenshot', label: 'Screenshot/Video vorhanden?', placeholder: 'Falls ja, nach Ticket-Erstellung im Kanal hochladen.', style: TextInputStyle.Short, required: false },
    ],
  },
};

type TicketKategorie = keyof typeof KATEGORIEN;

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Ticket-System')
  .addSubcommand(sub => sub.setName('panel').setDescription('Postet das Ticket-Panel mit Kategorien-Buttons'))
  .addSubcommand(sub => sub.setName('schliessen').setDescription('Schliesst das aktuelle Ticket'))
  .addSubcommand(sub => sub
    .setName('setup')
    .setDescription('Konfiguriert die Ticket-Kategorie und den Log-Kanal')
    .addChannelOption(o => o.setName('kategorie').setDescription('Kategorie für Ticket-Kanäle').setRequired(true).addChannelTypes(ChannelType.GuildCategory))
    .addChannelOption(o => o.setName('log').setDescription('Kanal für Ticket-Logs').setRequired(false).addChannelTypes(ChannelType.GuildText))
  );

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;
  const sub = interaction.options.getSubcommand();

  if (sub === 'setup') {
    if (!hasAdminPermission(member)) {
      await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Nur Admins.')], ephemeral: true });
      return;
    }
    const kategorie = interaction.options.getChannel('kategorie', true);
    const logChannel = interaction.options.getChannel('log');
    const db = getDatabase();
    if (logChannel) {
      db.prepare('UPDATE server_settings SET ticket_category_id = ?, ticket_log_channel_id = ? WHERE guild_id = ?')
        .run(kategorie.id, logChannel.id, interaction.guildId!);
    } else {
      db.prepare('UPDATE server_settings SET ticket_category_id = ? WHERE guild_id = ?')
        .run(kategorie.id, interaction.guildId!);
    }
    const desc = `**Kategorie:** ${kategorie}` + (logChannel ? `\n**Log-Kanal:** ${logChannel}` : '');
    await interaction.reply({ embeds: [createSuccessEmbed('Ticket-System konfiguriert', desc)], ephemeral: true });
    return;
  }

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
    return;
  }

  if (sub === 'schliessen') {
    if (!hasAdminPermission(member) && !hasModPermission(member)) {
      await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Nur Staff.')], ephemeral: true });
      return;
    }
    await closeTicketChannel(interaction.channel as TextChannel, member, interaction);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// BUTTON HANDLER — aufgerufen vom PanelManager
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

/** Verarbeitet das Ticket-Modal und erstellt den Textkanal */
export async function handleTicketModal(interaction: ModalSubmitInteraction): Promise<void> {
  const katKey = interaction.customId.replace('ticket_modal_', '') as TicketKategorie;
  const kat = KATEGORIEN[katKey];
  if (!kat) return;

  const member = interaction.member as GuildMember;
  const guild = interaction.guild!;
  const guildId = interaction.guildId!;
  const db = getDatabase();

  // Prüfen ob bereits ein offenes Ticket existiert
  const existing = db.prepare('SELECT id FROM tickets WHERE guild_id = ? AND user_id = ? AND status = ?')
    .get(guildId, member.id, 'offen') as { id: number } | undefined;
  if (existing) {
    await interaction.reply({ embeds: [createErrorEmbed('Offenes Ticket', 'Du hast bereits ein offenes Ticket. Warte auf eine Antwort oder lass es schliessen.')], ephemeral: true });
    return;
  }

  // Ticket-Kategorie aus Settings laden
  const settings = db.prepare('SELECT ticket_category_id FROM server_settings WHERE guild_id = ?')
    .get(guildId) as { ticket_category_id: string | null } | undefined;

  if (!settings?.ticket_category_id) {
    await interaction.reply({ embeds: [createErrorEmbed('Nicht konfiguriert', 'Ticket-Kategorie nicht gesetzt. Admin muss `/ticket setup` ausführen.')], ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Ticket-Nummer generieren (fortlaufend, wird nie zurückgesetzt)
    let ticketNr: string;
    const lastTicket = db.prepare("SELECT thread_id FROM tickets WHERE guild_id = ? ORDER BY id DESC LIMIT 1")
      .get(guildId) as { thread_id: string } | undefined;
    const counterRow = db.prepare("SELECT counter FROM aktenzeichen_counter WHERE guild_id = ? AND prefix = 'TICKET' AND year = 0")
      .get(guildId) as { counter: number } | undefined;
    
    if (counterRow) {
      db.prepare("UPDATE aktenzeichen_counter SET counter = counter + 1 WHERE guild_id = ? AND prefix = 'TICKET' AND year = 0").run(guildId);
      ticketNr = String(counterRow.counter + 1).padStart(4, '0');
    } else {
      db.prepare("INSERT INTO aktenzeichen_counter (guild_id, prefix, year, counter) VALUES (?, 'TICKET', 0, 1)").run(guildId);
      ticketNr = '0001';
    }
    const channelName = `ticket-${ticketNr}`;

    // Felder aus dem Modal lesen
    const fieldValues: Record<string, string> = {};
    kat.fields.forEach(f => {
      try { fieldValues[f.id] = interaction.fields.getTextInputValue(f.id).trim(); } catch { fieldValues[f.id] = ''; }
    });

    // Textkanal in der Ticket-Kategorie erstellen
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: settings.ticket_category_id,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
        { id: guild.members.me!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] },
      ],
      reason: `Ticket ${ticketNr}: ${kat.label} von ${member.user.tag}`,
    });

    // Staff-Rollen Zugriff geben (Admins, Mods, Support)
    const staffKeys = ['owner', 'coOwner', 'administrator', 'administratorAnwaerter', 'moderator', 'supportLeitung', 'supporter', 'supportAnwaerter'];
    const roleConfigs = db.prepare('SELECT role_id FROM role_config WHERE guild_id = ? AND role_key IN (' + staffKeys.map(() => '?').join(',') + ')')
      .all(guildId, ...staffKeys) as Array<{ role_id: string }>;

    for (const rc of roleConfigs) {
      try {
        await ticketChannel.permissionOverwrites.edit(rc.role_id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      } catch { /* Rolle existiert evtl. nicht */ }
    }

    // In DB speichern
    db.prepare('INSERT INTO tickets (guild_id, user_id, username, thread_id, kategorie) VALUES (?, ?, ?, ?, ?)')
      .run(guildId, member.id, member.user.tag, ticketChannel.id, katKey);

    // Willkommens-Embed mit allen Antworten
    const embed = new EmbedBuilder()
      .setColor(config.colors.info as ColorResolvable)
      .setTitle(`${kat.emoji} ${kat.modalTitle}`)
      .setDescription(`Willkommen ${member}, es wird sich bald jemand dein Ticket ansehen.`)
      .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
      .setFooter({ text: `Ticket #${ticketNr} | ${kat.label}` })
      .setTimestamp();

    kat.fields.forEach(f => {
      const value = fieldValues[f.id];
      if (value) embed.addFields({ name: f.label, value: value.substring(0, 1020), inline: false });
    });

    const closeBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket_schliessen').setLabel('Schließen').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
    );

    await ticketChannel.send({ content: `${member}`, embeds: [embed], components: [closeBtn] });

    await ticketLog(guild, 'erstellt', channelName, member, member.user.tag, kat.label);

    await interaction.editReply({ embeds: [createSuccessEmbed('🎫 Ticket erstellt', `Dein Ticket wurde erstellt: ${ticketChannel}\n\nEin Staff-Mitglied wird sich melden.`)] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    await interaction.editReply({ embeds: [createErrorEmbed('Fehler', `Ticket konnte nicht erstellt werden: ${msg}`)] });
  }
}

/** Schließt ein Ticket (Button oder Command) */
export async function closeTicketChannel(channel: TextChannel, member: GuildMember, interaction: ButtonInteraction | CommandInteraction): Promise<void> {
  const db = getDatabase();
  const guildId = channel.guildId;

  const ticket = db.prepare('SELECT id, user_id FROM tickets WHERE guild_id = ? AND thread_id = ? AND status = ?')
    .get(guildId, channel.id, 'offen') as { id: number; user_id: string } | undefined;

  if (!ticket) {
    if ('reply' in interaction && !('replied' in interaction && (interaction as { replied: boolean }).replied)) {
      await interaction.reply({ embeds: [createErrorEmbed('Kein Ticket', 'Dies ist kein offenes Ticket.')], ephemeral: true });
    }
    return;
  }

  // Status setzen
  db.prepare("UPDATE tickets SET status = 'geschlossen', geschlossen_am = datetime('now'), geschlossen_von = ? WHERE id = ?")
    .run(member.user.tag, ticket.id);

  // Berechtigungen entziehen (User kann nicht mehr schreiben)
  try {
    await channel.permissionOverwrites.edit(ticket.user_id, { SendMessages: false });
  } catch { /* */ }

  // "Ticket Closed" Nachricht + Kontrolle-Buttons
  const closedEmbed = new EmbedBuilder()
    .setColor(config.colors.warning as ColorResolvable)
    .setDescription(`🔒 **Ticket Closed by ${member}**`);

  await ticketLog(channel.guild, 'geschlossen', channel.name, member, undefined, undefined);

  const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket_oeffnen').setLabel('Öffnen').setStyle(ButtonStyle.Success).setEmoji('🔓'),
    new ButtonBuilder().setCustomId('ticket_loeschen').setLabel('Löschen').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
  );

  const controlEmbed = new EmbedBuilder()
    .setColor(config.colors.server as ColorResolvable)
    .setDescription('Ticketkontrollen für das Support-Team');

  if ('replied' in interaction || 'deferred' in interaction) {
    try {
      if (!(interaction as { replied?: boolean }).replied && !(interaction as { deferred?: boolean }).deferred) {
        await (interaction as ButtonInteraction).update({});
      }
    } catch { /* */ }
  }

  await channel.send({ embeds: [closedEmbed, controlEmbed], components: [controlRow] });
}

/** Öffnet ein geschlossenes Ticket wieder */
export async function reopenTicketChannel(channel: TextChannel, member: GuildMember): Promise<void> {
  const db = getDatabase();
  const ticket = db.prepare('SELECT id, user_id FROM tickets WHERE guild_id = ? AND thread_id = ? AND status = ?')
    .get(channel.guildId, channel.id, 'geschlossen') as { id: number; user_id: string } | undefined;

  if (!ticket) return;

  db.prepare("UPDATE tickets SET status = 'offen', geschlossen_am = NULL, geschlossen_von = NULL WHERE id = ?").run(ticket.id);

  // Berechtigungen wiederherstellen
  try {
    await channel.permissionOverwrites.edit(ticket.user_id, { SendMessages: true });
  } catch { /* */ }

  await channel.send({ embeds: [new EmbedBuilder().setColor(config.colors.success as ColorResolvable).setDescription(`🔓 **Ticket reopened by ${member}**`)] });

  await ticketLog(channel.guild, 'geoeffnet', channel.name, member, undefined, undefined);
}

/** Löscht einen Ticket-Kanal */
export async function deleteTicketChannel(channel: TextChannel, member: GuildMember): Promise<void> {
  const db = getDatabase();
  const ticket = db.prepare("SELECT id, user_id, username, kategorie FROM tickets WHERE guild_id = ? AND thread_id = ?")
    .get(channel.guildId, channel.id) as { id: number; user_id: string; username: string; kategorie: string } | undefined;

  db.prepare("DELETE FROM tickets WHERE guild_id = ? AND thread_id = ?").run(channel.guildId, channel.id);

  await ticketLog(channel.guild, 'loeschen', channel.name, member, ticket?.username || 'Unbekannt', ticket?.kategorie || '');

  await channel.send({ embeds: [new EmbedBuilder().setColor(config.colors.error as ColorResolvable).setDescription('🗑️ Das Ticket wird in wenigen Sekunden gelöscht...')] });

  setTimeout(async () => {
    try { await channel.delete(`Ticket gelöscht von ${member.user.tag}`); } catch { /* */ }
  }, 5000);
}

/** Sendet ein Log-Embed in den Ticket-Log-Kanal */
async function ticketLog(
  guild: import('discord.js').Guild,
  aktion: 'erstellt' | 'geschlossen' | 'geoeffnet' | 'loeschen',
  ticketName: string,
  staff: GuildMember,
  ersteller?: string,
  kategorie?: string
): Promise<void> {
  try {
    const db = getDatabase();
    const settings = db.prepare('SELECT ticket_log_channel_id FROM server_settings WHERE guild_id = ?')
      .get(guild.id) as { ticket_log_channel_id: string | null } | undefined;
    if (!settings?.ticket_log_channel_id) return;

    const logChannel = await guild.channels.fetch(settings.ticket_log_channel_id).catch(() => null) as TextChannel | null;
    if (!logChannel) return;

    const colors: Record<string, number> = { erstellt: config.colors.success, geschlossen: config.colors.warning, geoeffnet: config.colors.info, loeschen: config.colors.error };
    const icons: Record<string, string> = { erstellt: '🎫', geschlossen: '🔒', geoeffnet: '🔓', loeschen: '🗑️' };
    const labels: Record<string, string> = { erstellt: 'Ticket erstellt', geschlossen: 'Ticket geschlossen', geoeffnet: 'Ticket geöffnet', loeschen: 'Ticket gelöscht' };

    const embed = new EmbedBuilder()
      .setColor(colors[aktion] as ColorResolvable)
      .setTitle(`${icons[aktion]} ${labels[aktion]}`)
      .addFields(
        { name: 'Ticket', value: ticketName, inline: true },
        { name: 'Aktion von', value: `${staff}`, inline: true },
      );

    if (ersteller) embed.addFields({ name: 'Ersteller', value: ersteller, inline: true });
    if (kategorie) embed.addFields({ name: 'Kategorie', value: kategorie, inline: true });

    embed.setFooter({ text: 'Ticket-Log | Deutscher RP Server' }).setTimestamp();

    await logChannel.send({ embeds: [embed] });
  } catch { /* stilles Fehler — Log darf nicht crashen */ }
}

export default { data, execute };
