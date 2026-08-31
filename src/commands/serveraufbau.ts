import {
  CommandInteraction, SlashCommandBuilder, GuildMember, EmbedBuilder,
  ColorResolvable, ChannelType, PermissionFlagsBits, Guild, Role,
  ButtonBuilder, ButtonStyle, ActionRowBuilder, ButtonInteraction,
  OverwriteResolvable,
} from 'discord.js';
import { createErrorEmbed } from '../utils/embeds';
import { hasAdminPermission } from '../utils/permissions';
import { getDatabase } from '../database/database';
import { config } from '../config/config';
import { ROLE_BLUEPRINT, CATEGORY_BLUEPRINT } from '../config/serverBlueprint';

export const data = new SlashCommandBuilder()
  .setName('serveraufbau')
  .setDescription('Baut den kompletten Server automatisch auf (Rollen, Kanäle, Rechte)');

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;

  if (!hasAdminPermission(member)) {
    await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst Administrator-Rechte.')], ephemeral: true });
    return;
  }

  // Sicherheitsabfrage — großer Eingriff
  const warnEmbed = new EmbedBuilder()
    .setColor(config.colors.warning as ColorResolvable)
    .setTitle('⚠️ Server-Aufbau starten?')
    .setDescription(
      'Dieser Befehl erstellt automatisch:\n\n' +
      `• **${ROLE_BLUEPRINT.length} Rollen** (mit Farben & Rechten)\n` +
      `• **${CATEGORY_BLUEPRINT.length} Kategorien** mit allen Kanälen\n` +
      '• Alle Berechtigungen (privat/öffentlich)\n' +
      '• Bot-Rollen-Zuordnung (role_config)\n\n' +
      '**Bereits existierende Rollen/Kanäle mit gleichem Namen werden übersprungen** — es wird nichts gelöscht.\n\n' +
      'Möchtest du fortfahren?'
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('serveraufbau_start').setLabel('Ja, aufbauen').setStyle(ButtonStyle.Success).setEmoji('🏗️'),
    new ButtonBuilder().setCustomId('serveraufbau_abbrechen').setLabel('Abbrechen').setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({ embeds: [warnEmbed], components: [row], ephemeral: true });
}

/** Wird vom PanelManager aufgerufen wenn der Bestätigen-Button gedrückt wird */
export async function handleServeraufbauButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId === 'serveraufbau_abbrechen') {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(config.colors.info as ColorResolvable).setTitle('Abgebrochen').setDescription('Der Server-Aufbau wurde abgebrochen.')], components: [] });
    return;
  }

  if (interaction.customId !== 'serveraufbau_start') return;

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(config.colors.info as ColorResolvable).setTitle('🏗️ Server wird aufgebaut...').setDescription('Das kann eine Minute dauern. Bitte warten...')],
    components: [],
  });

  const guild = interaction.guild!;
  const log: string[] = [];

  try {
    // ── 1. ROLLEN erstellen ────────────────────────────────────────────────
    await guild.roles.fetch();
    const roleNameToId = new Map<string, string>();

    // Bestehende Rollen merken
    for (const r of guild.roles.cache.values()) {
      roleNameToId.set(r.name, r.id);
    }

    let rollenErstellt = 0;
    // Blueprint ist von oben nach unten sortiert → wir erstellen von unten nach oben,
    // damit die Positionen stimmen (neue Rollen landen oben)
    const reversed = [...ROLE_BLUEPRINT].reverse();
    for (const rb of reversed) {
      if (roleNameToId.has(rb.name)) continue; // existiert schon
      try {
        const permBits = rb.permissions.reduce((acc, p) => acc | p, 0n);
        const role: Role = await guild.roles.create({
          name: rb.name,
          color: rb.color,
          hoist: rb.hoist,
          mentionable: rb.mentionable,
          permissions: permBits,
          reason: 'Server-Aufbau durch Bot',
        });
        roleNameToId.set(rb.name, role.id);
        rollenErstellt++;
      } catch (e) {
        log.push(`⚠️ Rolle "${rb.name}" konnte nicht erstellt werden: ${e instanceof Error ? e.message : 'Fehler'}`);
      }
    }
    log.push(`✅ ${rollenErstellt} neue Rollen erstellt (${ROLE_BLUEPRINT.length - rollenErstellt} existierten bereits)`);

    // ── 2. role_config befüllen ──────────────────────────────────────────────
    const db = getDatabase();
    db.prepare(`INSERT INTO server_settings (guild_id) VALUES (?) ON CONFLICT(guild_id) DO NOTHING`).run(guild.id);
    let zugeordnet = 0;
    for (const rb of ROLE_BLUEPRINT) {
      if (!rb.key) continue;
      const roleId = roleNameToId.get(rb.name);
      if (!roleId) continue;
      db.prepare(`INSERT INTO role_config (guild_id, role_key, role_id) VALUES (?, ?, ?)
        ON CONFLICT(guild_id, role_key) DO UPDATE SET role_id = excluded.role_id`)
        .run(guild.id, rb.key, roleId);
      zugeordnet++;
    }
    log.push(`✅ ${zugeordnet} Rollen im Bot zugeordnet (role_config)`);

    // ── 3. KATEGORIEN + KANÄLE erstellen ─────────────────────────────────────
    await guild.channels.fetch();
    const everyoneId = guild.roles.everyone.id;
    let katErstellt = 0;
    let chErstellt = 0;

    for (const cat of CATEGORY_BLUEPRINT) {
      // Kategorie-Overwrites bauen
      const overwrites: OverwriteResolvable[] = [];
      if (cat.privat) {
        overwrites.push({ id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] });
        for (const rolleName of cat.rollen) {
          const rid = roleNameToId.get(rolleName);
          if (rid) {
            overwrites.push({
              id: rid,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            });
          }
        }
      }

      // Existiert die Kategorie schon?
      let category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === cat.name
      );

      if (!category) {
        category = await guild.channels.create({
          name: cat.name,
          type: ChannelType.GuildCategory,
          permissionOverwrites: overwrites,
          reason: 'Server-Aufbau durch Bot',
        });
        katErstellt++;
      }

      // Kanäle in der Kategorie
      for (const ch of cat.channels) {
        const exists = guild.channels.cache.find(
          c => c.name === ch.name && c.parentId === category!.id
        );
        if (exists) continue;

        // Ankündigungs- (5) und Bühnen-Kanäle (13) lassen sich nicht zuverlässig
        // per API in einer Kategorie erstellen → auf Text/Voice abbilden.
        let createType: ChannelType.GuildText | ChannelType.GuildVoice | ChannelType.GuildForum;
        if (ch.type === ChannelType.GuildAnnouncement) {
          createType = ChannelType.GuildText;
        } else if (ch.type === ChannelType.GuildStageVoice) {
          createType = ChannelType.GuildVoice;
        } else {
          createType = ch.type;
        }

        try {
          await guild.channels.create({
            name: ch.name,
            type: createType,
            parent: category!.id,
            reason: 'Server-Aufbau durch Bot',
            // Kanäle erben die Rechte der Kategorie automatisch
          });
          chErstellt++;
        } catch (e) {
          log.push(`⚠️ Kanal "${ch.name}" nicht erstellt: ${e instanceof Error ? e.message : 'Fehler'}`);
        }
      }
    }
    log.push(`✅ ${katErstellt} Kategorien und ${chErstellt} Kanäle erstellt`);

    // ── Fertig ───────────────────────────────────────────────────────────────
    const doneEmbed = new EmbedBuilder()
      .setColor(config.colors.success as ColorResolvable)
      .setTitle('✅ Server-Aufbau abgeschlossen!')
      .setDescription(log.join('\n'))
      .addFields({
        name: '📌 Nächste Schritte',
        value:
          '1. Zieh die **Bot-Rolle** in den Server-Einstellungen ganz nach oben\n' +
          '2. Nutze `/setup kanale`, `/setup voice`, `/ticket setup` für die Kanal-Zuordnung\n' +
          '3. Setze mit `/setup autorolle rolle:@ZIVILIST` die Auto-Rolle',
      })
      .setFooter({ text: 'Deutscher RP Server | Server-Aufbau' })
      .setTimestamp();

    await interaction.editReply({ embeds: [doneEmbed] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    await interaction.editReply({
      embeds: [createErrorEmbed('Fehler beim Aufbau', `${msg}\n\nBisheriger Fortschritt:\n${log.join('\n')}`)],
    });
  }
}

export default { data, execute };
