import {
  CommandInteraction, SlashCommandBuilder, EmbedBuilder, ColorResolvable,
  GuildMember, TextChannel, PermissionsBitField,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder, ButtonInteraction, StringSelectMenuInteraction,
  ModalBuilder, TextInputBuilder, TextInputStyle, ModalSubmitInteraction, User,
} from 'discord.js';
import { getDatabase } from '../database/database';
import { hasAdminPermission, hasModPermission } from '../utils/permissions';
import { createErrorEmbed, createSuccessEmbed } from '../utils/embeds';
import { config } from '../config/config';

// ── Command: /admin und /admin panel ──────────────────────────────────────────
export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin-Verwaltung')
  .addSubcommand(sub => sub.setName('menu').setDescription('Öffnet das Admin-Menü (nur für dich sichtbar)'))
  .addSubcommand(sub => sub.setName('panel').setDescription('Postet ein permanentes Admin-Panel in diesen Kanal'));

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;

  if (!hasAdminPermission(member) && !hasModPermission(member)) {
    await interaction.reply({
      embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst mindestens Moderator-Rechte.')],
      ephemeral: true,
    });
    return;
  }

  const isAdmin = hasAdminPermission(member);
  const sub = interaction.options.getSubcommand();

  // ── /admin panel → permanentes Panel in den Kanal posten ──
  if (sub === 'panel') {
    if (!isAdmin) {
      await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Nur Admins können das Panel posten.')], ephemeral: true });
      return;
    }

    const channel = interaction.channel as TextChannel;
    const panelEmbed = new EmbedBuilder()
      .setColor(config.colors.server as ColorResolvable)
      .setTitle('🛡️ Admin-Panel')
      .setDescription(
        'Verwende die Buttons unten, um Moderations-Aktionen auszuführen.\n\n' +
        '**Verfügbare Aktionen:**\n' +
        '👤 Spieler-Info anzeigen\n' +
        '⚠️ Spieler verwarnen\n' +
        '📋 Verwarnungen eines Spielers anzeigen\n' +
        '🦶 Spieler kicken\n' +
        '🔨 Spieler bannen\n' +
        '✅ Spieler entbannen\n' +
        '🗑️ Verwarnung entfernen\n' +
        '🧹 Chat leeren\n' +
        '📊 Server-Statistiken'
      )
      .setFooter({ text: 'Deutscher RP Server | Admin-Panel' })
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_panel_spieler').setLabel('Spieler-Info').setStyle(ButtonStyle.Secondary).setEmoji('👤'),
      new ButtonBuilder().setCustomId('admin_panel_warn').setLabel('Verwarnen').setStyle(ButtonStyle.Danger).setEmoji('⚠️'),
      new ButtonBuilder().setCustomId('admin_panel_warnungen').setLabel('Warns anzeigen').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
      new ButtonBuilder().setCustomId('admin_panel_kick').setLabel('Kick').setStyle(ButtonStyle.Danger).setEmoji('🦶'),
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_panel_ban').setLabel('Ban').setStyle(ButtonStyle.Danger).setEmoji('🔨'),
      new ButtonBuilder().setCustomId('admin_panel_unban').setLabel('Entbannen').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId('admin_panel_warn_entf').setLabel('Warn entfernen').setStyle(ButtonStyle.Secondary).setEmoji('🗑️'),
      new ButtonBuilder().setCustomId('admin_panel_chat').setLabel('Chat leeren').setStyle(ButtonStyle.Secondary).setEmoji('🧹'),
    );

    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_panel_server_info').setLabel('Server-Info').setStyle(ButtonStyle.Primary).setEmoji('📊'),
    );

    await channel.send({ embeds: [panelEmbed], components: [row1, row2, row3] });
    await interaction.reply({ embeds: [createSuccessEmbed('Panel gepostet', 'Das Admin-Panel wurde in diesen Kanal gesendet.')], ephemeral: true });
    return;
  }

  // ── /admin menu → ephemeral Menü (wie bisher) ──
  await interaction.reply({
    embeds: [buildMenuEmbed(interaction.user.username, isAdmin)],
    components: buildMenuComponents(isAdmin),
    ephemeral: true,
  });
}

// ── Menü-Embed ────────────────────────────────────────────────────────────────
function buildMenuEmbed(username: string, isAdmin: boolean): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(config.colors.server as ColorResolvable)
    .setTitle('🛡️ Admin-Verwaltung')
    .setDescription(
      `Willkommen, **${username}**!\n\n` +
      'Wähle eine Aktion aus dem Menü unten aus.\n\n' +
      '**Verfügbare Aktionen:**\n' +
      '👤 **Spieler** — Info, Warn, Kick, Ban\n' +
      '🧹 **Chat leeren** — Nachrichten löschen\n' +
      '📊 **Server-Info** — Statistiken anzeigen\n' +
      (isAdmin ? '⚠️ **Verwarnungen** — Warns verwalten\n' : '') +
      '\n*Wähle eine Aktion im Dropdown-Menü.*'
    )
    .setFooter({ text: 'Deutscher RP Server | Admin-Panel' })
    .setTimestamp();
}

// ── Menü-Buttons & Select ─────────────────────────────────────────────────────
function buildMenuComponents(isAdmin: boolean): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  const options = [
    new StringSelectMenuOptionBuilder().setValue('spieler_info').setLabel('👤 Spieler-Info').setDescription('Zeigt Infos über einen Spieler').setEmoji('👤'),
    new StringSelectMenuOptionBuilder().setValue('warn').setLabel('⚠️ Spieler verwarnen').setDescription('Erteilt eine Verwarnung').setEmoji('⚠️'),
    new StringSelectMenuOptionBuilder().setValue('warnungen').setLabel('📋 Verwarnungen anzeigen').setDescription('Zeigt alle Warns eines Spielers').setEmoji('📋'),
    new StringSelectMenuOptionBuilder().setValue('chat_leeren').setLabel('🧹 Chat leeren').setDescription('Löscht Nachrichten aus einem Kanal').setEmoji('🧹'),
    new StringSelectMenuOptionBuilder().setValue('server_info').setLabel('📊 Server-Info').setDescription('Zeigt Server-Statistiken').setEmoji('📊'),
    new StringSelectMenuOptionBuilder().setValue('kick').setLabel('🦶 Spieler kicken').setDescription('Kickt einen Spieler vom Server').setEmoji('🦶'),
  ];

  if (isAdmin) {
    options.push(
      new StringSelectMenuOptionBuilder().setValue('ban').setLabel('🔨 Spieler bannen').setDescription('Bannt einen Spieler permanent').setEmoji('🔨'),
      new StringSelectMenuOptionBuilder().setValue('unban').setLabel('✅ Spieler entbannen').setDescription('Entbannt einen Spieler per ID').setEmoji('✅'),
      new StringSelectMenuOptionBuilder().setValue('warn_entfernen').setLabel('🗑️ Verwarnung entfernen').setDescription('Entfernt eine Warn per ID').setEmoji('🗑️'),
    );
  }

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('admin_menu_aktion')
      .setPlaceholder('🛡️ Aktion auswählen...')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options)
  );

  return [selectRow];
}

// ── PanelManager registriert diese Handlers ───────────────────────────────────
// customId-Schema:
//   admin_menu_aktion         → StringSelectMenu → zeigt Modal oder direkte Antwort
//   modal_admin_warn          → Modal
//   modal_admin_warn_entf     → Modal
//   modal_admin_kick          → Modal
//   modal_admin_ban           → Modal
//   modal_admin_unban         → Modal
//   modal_admin_spieler       → Modal
//   modal_admin_chat          → Modal

export async function handleAdminSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!hasAdminPermission(member) && !hasModPermission(member)) {
    await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', '')], ephemeral: true });
    return;
  }

  const isAdmin = hasAdminPermission(member);
  const aktion = interaction.values[0];

  // Aktionen die ein Modal öffnen
  const modalAktionen: Record<string, () => ModalBuilder> = {
    spieler_info:   () => buildModal('modal_admin_spieler',   '👤 Spieler-Info',           [{ id: 'user_id', label: 'Discord-ID oder @Erwähnung', placeholder: '123456789012345678', required: true }]),
    warn:           () => buildModal('modal_admin_warn',      '⚠️ Spieler verwarnen',       [{ id: 'user_id', label: 'Discord-ID', placeholder: '123456789012345678', required: true }, { id: 'grund', label: 'Begründung', placeholder: 'Grund der Verwarnung...', style: TextInputStyle.Paragraph, required: true }]),
    warnungen:      () => buildModal('modal_admin_warnungen', '📋 Verwarnungen anzeigen',   [{ id: 'user_id', label: 'Discord-ID', placeholder: '123456789012345678', required: true }]),
    kick:           () => buildModal('modal_admin_kick',      '🦶 Spieler kicken',          [{ id: 'user_id', label: 'Discord-ID', placeholder: '123456789012345678', required: true }, { id: 'grund', label: 'Begründung (optional)', placeholder: 'Kein Grund angegeben', required: false }]),
    ban:            () => buildModal('modal_admin_ban',       '🔨 Spieler bannen',          [{ id: 'user_id', label: 'Discord-ID', placeholder: '123456789012345678', required: true }, { id: 'grund', label: 'Begründung (optional)', placeholder: 'Kein Grund angegeben', required: false }, { id: 'tage', label: 'Nachrichten löschen (0-7 Tage)', placeholder: '0', required: false }]),
    unban:          () => buildModal('modal_admin_unban',     '✅ Spieler entbannen',        [{ id: 'user_id', label: 'Discord User-ID', placeholder: '123456789012345678', required: true }]),
    warn_entfernen: () => buildModal('modal_admin_warn_entf', '🗑️ Verwarnung entfernen',    [{ id: 'warn_id', label: 'Warn-ID', placeholder: 'z.B. 42', required: true }]),
    chat_leeren:    () => buildModal('modal_admin_chat',      '🧹 Chat leeren',             [{ id: 'menge', label: 'Anzahl Nachrichten (1–100)', placeholder: '10', required: true }]),
  };

  // Server-Info braucht kein Modal
  if (aktion === 'server_info') {
    await interaction.deferUpdate();
    const guild = interaction.guild!;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const embed = new EmbedBuilder()
      .setColor(config.colors.server as ColorResolvable)
      .setTitle(`📊 Server-Info: ${guild.name}`)
      .setThumbnail(guild.iconURL())
      .addFields(
        { name: '👥 Mitglieder', value: `${guild.memberCount}`, inline: true },
        { name: '🤖 Bots', value: `${bots}`, inline: true },
        { name: '👤 Menschen', value: `${guild.memberCount - bots}`, inline: true },
        { name: '💬 Text-Kanäle', value: `${guild.channels.cache.filter(c => c.type === 0).size}`, inline: true },
        { name: '🎙️ Voice-Kanäle', value: `${guild.channels.cache.filter(c => c.type === 2).size}`, inline: true },
        { name: '📂 Kategorien', value: `${guild.channels.cache.filter(c => c.type === 4).size}`, inline: true },
        { name: '🎭 Rollen', value: `${guild.roles.cache.size}`, inline: true },
        { name: '💎 Boost-Level', value: `Stufe ${guild.premiumTier}`, inline: true },
        { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount ?? 0}`, inline: true },
        { name: '📅 Erstellt', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: '🌍 Sprache', value: guild.preferredLocale, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed], components: buildMenuComponents(isAdmin) });
    return;
  }

  if (!isAdmin && (aktion === 'ban' || aktion === 'unban' || aktion === 'warn_entfernen')) {
    await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Diese Aktion erfordert Admin-Rechte.')], ephemeral: true });
    return;
  }

  const modalFn = modalAktionen[aktion];
  if (modalFn) {
    await interaction.showModal(modalFn());
  }
}

// ── Modal-Ergebnisse verarbeiten ──────────────────────────────────────────────
export async function handleAdminModal(interaction: ModalSubmitInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!hasAdminPermission(member) && !hasModPermission(member)) {
    await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', '')], ephemeral: true });
    return;
  }

  const guild = interaction.guild!;
  const isAdmin = hasAdminPermission(member);
  const id = interaction.customId;

  // ── SPIELER-INFO ──
  if (id === 'modal_admin_spieler') {
    const rawId = interaction.fields.getTextInputValue('user_id').trim().replace(/[<@!>]/g, '');
    let targetMember: GuildMember | null = null;
    let user: User | null = null;

    try {
      targetMember = await guild.members.fetch(rawId);
      user = targetMember.user;
    } catch {
      try { user = await interaction.client.users.fetch(rawId); } catch { /* nicht gefunden */ }
    }

    if (!user) {
      await interaction.reply({ embeds: [createErrorEmbed('Nicht gefunden', `Kein Benutzer mit ID \`${rawId}\` gefunden.`)], ephemeral: true });
      return;
    }

    const db = getDatabase();
    const warnCount = (db.prepare('SELECT COUNT(*) as c FROM warns WHERE guild_id = ? AND benutzer_id = ?').get(guild.id, user.id) as { c: number }).c;
    const letzteWarns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND benutzer_id = ? ORDER BY erstellt_am DESC LIMIT 3').all(guild.id, user.id) as unknown as WarnRow[];

    const embed = new EmbedBuilder()
      .setColor(targetMember ? config.colors.info as ColorResolvable : config.colors.warning as ColorResolvable)
      .setTitle(`👤 Spieler-Info: ${user.tag}`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'Benutzer', value: `${user} (${user.id})`, inline: false },
        { name: 'Auf Server', value: targetMember ? '✅ Ja' : '❌ Nein', inline: true },
        { name: 'Account erstellt', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
      );

    if (targetMember) {
      embed.addFields(
        { name: 'Beigetreten', value: targetMember.joinedTimestamp ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:D>` : '—', inline: true },
        { name: 'Nickname', value: targetMember.displayName, inline: true },
        { name: 'Booster', value: targetMember.premiumSinceTimestamp ? `<t:${Math.floor(targetMember.premiumSinceTimestamp / 1000)}:D>` : 'Nein', inline: true },
        {
          name: `Rollen (${targetMember.roles.cache.size - 1})`,
          value: targetMember.roles.cache.filter(r => r.name !== '@everyone').sort((a, b) => b.position - a.position).map(r => r.toString()).slice(0, 10).join(', ') || '—',
          inline: false,
        },
      );
    }

    embed.addFields({ name: '⚠️ Verwarnungen', value: `${warnCount}`, inline: true });

    if (letzteWarns.length > 0) {
      embed.addFields({
        name: 'Letzte Warns',
        value: letzteWarns.map(w => `**#${w.id}** — ${w.grund}\n> <@${w.moderator_id}> • <t:${Math.floor(new Date(w.erstellt_am).getTime() / 1000)}:R>`).join('\n'),
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // ── WARN ──
  if (id === 'modal_admin_warn') {
    const rawId = interaction.fields.getTextInputValue('user_id').trim().replace(/[<@!>]/g, '');
    const grund = interaction.fields.getTextInputValue('grund').trim();

    let user: User | null = null;
    try { user = await interaction.client.users.fetch(rawId); } catch { /* */ }
    if (!user) { await interaction.reply({ embeds: [createErrorEmbed('Nicht gefunden', `ID \`${rawId}\` nicht gefunden.`)], ephemeral: true }); return; }
    if (user.id === interaction.user.id) { await interaction.reply({ embeds: [createErrorEmbed('Fehler', 'Du kannst dich nicht selbst verwarnen.')], ephemeral: true }); return; }

    const db = getDatabase();
    const result = db.prepare('INSERT INTO warns (guild_id, benutzer_id, benutzer_name, moderator_id, moderator_name, grund) VALUES (?, ?, ?, ?, ?, ?)').run(guild.id, user.id, user.tag, interaction.user.id, interaction.user.tag, grund);
    const warnId = result.lastInsertRowid;
    const total = (db.prepare('SELECT COUNT(*) as c FROM warns WHERE guild_id = ? AND benutzer_id = ?').get(guild.id, user.id) as { c: number }).c;

    try { await user.send({ embeds: [new EmbedBuilder().setColor(config.colors.warning as ColorResolvable).setTitle('⚠️ Du wurdest verwarnt').setDescription(`Auf **${guild.name}**`).addFields({ name: 'Grund', value: grund }, { name: 'Warn-ID', value: `#${warnId}` }, { name: 'Gesamt', value: `${total}` }).setTimestamp()] }); } catch { /* DMs zu */ }

    await interaction.reply({ embeds: [createSuccessEmbed('⚠️ Verwarnung erteilt', `${user} wurde verwarnt.\n**Grund:** ${grund}\n**Warn-ID:** #${warnId} | **Gesamt:** ${total}`)], ephemeral: true });
    await sendModLogModal(interaction, '⚠️ Verwarnung', [{ name: 'Spieler', value: `${user.tag} (${user.id})`, inline: true }, { name: 'Warn-ID', value: `#${warnId}`, inline: true }, { name: 'Gesamt', value: `${total}`, inline: true }, { name: 'Grund', value: grund }], config.colors.warning);
    return;
  }

  // ── WARNUNGEN ANZEIGEN ──
  if (id === 'modal_admin_warnungen') {
    const rawId = interaction.fields.getTextInputValue('user_id').trim().replace(/[<@!>]/g, '');
    const db = getDatabase();
    const warns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND benutzer_id = ? ORDER BY erstellt_am DESC').all(guild.id, rawId) as unknown as WarnRow[];

    if (warns.length === 0) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(config.colors.success as ColorResolvable).setTitle('✅ Keine Verwarnungen').setDescription(`<@${rawId}> hat keine Verwarnungen.`)], ephemeral: true });
      return;
    }

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.warning as ColorResolvable)
        .setTitle(`⚠️ Verwarnungen von <@${rawId}>`)
        .setDescription(`**${warns.length}** Verwarnung(en) insgesamt`)
        .addFields(warns.slice(0, 10).map(w => ({ name: `#${w.id} — <t:${Math.floor(new Date(w.erstellt_am).getTime() / 1000)}:D>`, value: `**Grund:** ${w.grund}\n**Mod:** <@${w.moderator_id}>`, inline: false })))
        .setFooter({ text: 'ID zum Entfernen: /admin → Verwarnung entfernen' })
      ],
      ephemeral: true,
    });
    return;
  }

  // ── WARN ENTFERNEN ──
  if (id === 'modal_admin_warn_entf') {
    if (!isAdmin) { await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Nur Admins.')], ephemeral: true }); return; }
    const warnId = parseInt(interaction.fields.getTextInputValue('warn_id').trim());
    const db = getDatabase();
    const warn = db.prepare('SELECT * FROM warns WHERE id = ? AND guild_id = ?').get(warnId, guild.id) as WarnRow | undefined;
    if (!warn) { await interaction.reply({ embeds: [createErrorEmbed('Nicht gefunden', `Warn #${warnId} existiert nicht.`)], ephemeral: true }); return; }
    db.prepare('DELETE FROM warns WHERE id = ?').run(warnId);
    await interaction.reply({ embeds: [createSuccessEmbed('🗑️ Verwarnung entfernt', `Warn **#${warnId}** von <@${warn.benutzer_id}> entfernt.\n**Grund war:** ${warn.grund}`)], ephemeral: true });
    return;
  }

  // ── KICK ──
  if (id === 'modal_admin_kick') {
    const rawId = interaction.fields.getTextInputValue('user_id').trim().replace(/[<@!>]/g, '');
    const grund = (interaction.fields.getTextInputValue('grund') || 'Kein Grund angegeben').trim();

    let target: GuildMember | null = null;
    try { target = await guild.members.fetch(rawId); } catch { /* */ }
    if (!target) { await interaction.reply({ embeds: [createErrorEmbed('Nicht gefunden', 'Dieser Benutzer ist nicht auf dem Server.')], ephemeral: true }); return; }
    if (!target.kickable) { await interaction.reply({ embeds: [createErrorEmbed('Fehler', 'Kann nicht gekickt werden (höhere Rolle als Bot).')], ephemeral: true }); return; }

    try { await target.user.send({ embeds: [new EmbedBuilder().setColor(config.colors.error as ColorResolvable).setTitle('🦶 Du wurdest gekickt').setDescription(`Von **${guild.name}**`).addFields({ name: 'Grund', value: grund }).setTimestamp()] }); } catch { /* */ }
    await target.kick(`${interaction.user.tag}: ${grund}`);

    const db = getDatabase();
    db.prepare('INSERT INTO mod_logs (guild_id, moderator_id, moderator_name, aktion, ziel_id, ziel_name, grund) VALUES (?, ?, ?, ?, ?, ?, ?)').run(guild.id, interaction.user.id, interaction.user.tag, 'kick', target.id, target.user.tag, grund);
    await interaction.reply({ embeds: [createSuccessEmbed('🦶 Spieler gekickt', `${target} wurde gekickt.\n**Grund:** ${grund}`)], ephemeral: true });
    await sendModLogModal(interaction, '🦶 Kick', [{ name: 'Spieler', value: `${target.user.tag} (${target.id})`, inline: true }, { name: 'Grund', value: grund }], config.colors.error);
    return;
  }

  // ── BAN ──
  if (id === 'modal_admin_ban') {
    if (!isAdmin) { await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Nur Admins.')], ephemeral: true }); return; }
    const rawId = interaction.fields.getTextInputValue('user_id').trim().replace(/[<@!>]/g, '');
    const grund = (interaction.fields.getTextInputValue('grund') || 'Kein Grund angegeben').trim();
    const tage = Math.min(7, Math.max(0, parseInt(interaction.fields.getTextInputValue('tage') || '0') || 0));

    let user: User | null = null;
    try { user = await interaction.client.users.fetch(rawId); } catch { /* */ }
    if (!user) { await interaction.reply({ embeds: [createErrorEmbed('Nicht gefunden', `ID \`${rawId}\` nicht gefunden.`)], ephemeral: true }); return; }

    try { await user.send({ embeds: [new EmbedBuilder().setColor(config.colors.error as ColorResolvable).setTitle('🔨 Du wurdest gebannt').setDescription(`Von **${guild.name}**`).addFields({ name: 'Grund', value: grund }).setTimestamp()] }); } catch { /* */ }

    await guild.bans.create(rawId, { reason: `${interaction.user.tag}: ${grund}`, deleteMessageSeconds: tage * 86400 });

    const db = getDatabase();
    db.prepare('INSERT INTO mod_logs (guild_id, moderator_id, moderator_name, aktion, ziel_id, ziel_name, grund) VALUES (?, ?, ?, ?, ?, ?, ?)').run(guild.id, interaction.user.id, interaction.user.tag, 'ban', rawId, user.tag, grund);
    await interaction.reply({ embeds: [createSuccessEmbed('🔨 Gebannt', `**${user.tag}** wurde gebannt.\n**Grund:** ${grund}`)], ephemeral: true });
    await sendModLogModal(interaction, '🔨 Ban', [{ name: 'Spieler', value: `${user.tag} (${rawId})`, inline: true }, { name: 'Tage', value: `${tage}`, inline: true }, { name: 'Grund', value: grund }], config.colors.error);
    return;
  }

  // ── UNBAN ──
  if (id === 'modal_admin_unban') {
    if (!isAdmin) { await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Nur Admins.')], ephemeral: true }); return; }
    const rawId = interaction.fields.getTextInputValue('user_id').trim().replace(/[<@!>]/g, '');
    try {
      const ban = await guild.bans.fetch(rawId);
      await guild.bans.remove(rawId, `Entbannt von ${interaction.user.tag}`);
      await interaction.reply({ embeds: [createSuccessEmbed('✅ Entbannt', `**${ban.user.tag}** wurde entbannt.`)], ephemeral: true });
    } catch {
      await interaction.reply({ embeds: [createErrorEmbed('Nicht gefunden', `Kein Ban für \`${rawId}\`.`)], ephemeral: true });
    }
    return;
  }

  // ── CHAT LEEREN ──
  if (id === 'modal_admin_chat') {
    const menge = Math.min(100, Math.max(1, parseInt(interaction.fields.getTextInputValue('menge') || '10') || 10));
    const channel = interaction.channel as TextChannel;

    if (!channel?.permissionsFor(guild.members.me!)?.has(PermissionsBitField.Flags.ManageMessages)) {
      await interaction.reply({ embeds: [createErrorEmbed('Fehlende Berechtigung', 'Bot benötigt **Nachrichten verwalten** in diesem Kanal.')], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const messages = await channel.messages.fetch({ limit: menge });
      const deleted = await channel.bulkDelete(messages, true);

      const db = getDatabase();
      db.prepare('INSERT INTO mod_logs (guild_id, moderator_id, moderator_name, aktion, ziel_id, ziel_name, grund) VALUES (?, ?, ?, ?, ?, ?, ?)').run(guild.id, interaction.user.id, interaction.user.tag, 'chat_leeren', channel.id, channel.name, `${deleted.size} Nachrichten`);

      await interaction.editReply({ embeds: [createSuccessEmbed('🧹 Chat geleert', `**${deleted.size}** Nachrichten in ${channel} gelöscht.${deleted.size < menge ? `\n⚠️ Nur ${deleted.size}/${menge} (>14 Tage übersprungen)` : ''}`)] });
    } catch (err) {
      await interaction.editReply({ embeds: [createErrorEmbed('Fehler', err instanceof Error ? err.message : 'Unbekannt')] });
    }
    return;
  }
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────
function buildModal(
  customId: string,
  title: string,
  fields: { id: string; label: string; placeholder?: string; style?: TextInputStyle; required?: boolean }[]
): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  fields.forEach(f => {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(f.id)
          .setLabel(f.label)
          .setStyle(f.style ?? TextInputStyle.Short)
          .setRequired(f.required ?? true)
          .setPlaceholder(f.placeholder ?? '')
      )
    );
  });
  return modal;
}

async function sendModLogModal(
  interaction: ModalSubmitInteraction,
  titel: string,
  fields: { name: string; value: string; inline?: boolean }[],
  farbe: number
): Promise<void> {
  try {
    const db = getDatabase();
    const s = db.prepare('SELECT log_channel_id FROM server_settings WHERE guild_id = ?').get(interaction.guildId!) as { log_channel_id: string | null } | undefined;
    if (!s?.log_channel_id) return;
    const logCh = interaction.guild!.channels.cache.get(s.log_channel_id) as TextChannel | undefined;
    if (!logCh) return;
    await logCh.send({ embeds: [new EmbedBuilder().setColor(farbe as ColorResolvable).setTitle(`📋 Mod-Log | ${titel}`).addFields({ name: 'Moderator', value: `${interaction.user} (${interaction.user.id})`, inline: false }, ...fields).setTimestamp()] });
  } catch { /* */ }
}

interface WarnRow { id: number; guild_id: string; benutzer_id: string; benutzer_name: string; moderator_id: string; moderator_name: string; grund: string; erstellt_am: string; }

export default { data, execute };
