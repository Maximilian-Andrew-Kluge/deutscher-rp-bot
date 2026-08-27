import {
  CommandInteraction, SlashCommandBuilder, EmbedBuilder, ColorResolvable,
  GuildMember, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { getDatabase } from '../database/database';
import { config } from '../config/config';
import { createErrorEmbed, createSuccessEmbed } from '../utils/embeds';
import { hasPolizeiPermission, hasAdminPermission } from '../utils/permissions';

export const data = new SlashCommandBuilder()
  .setName('fahndung')
  .setDescription('Fahndungs-Verwaltung')
  .addSubcommand(sub => sub
    .setName('erstellen')
    .setDescription('Erstellt eine neue Fahndung')
    .addStringOption(o => o.setName('name').setDescription('Name des Gesuchten (RP-Name)').setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName('grund').setDescription('Grund der Fahndung').setRequired(true).setMaxLength(200))
    .addStringOption(o => o.setName('beschreibung').setDescription('Weitere Details / Beschreibung').setRequired(false).setMaxLength(500))
    .addStringOption(o => o.setName('roblox').setDescription('Roblox-Name (optional)').setRequired(false).setMaxLength(50))
  )
  .addSubcommand(sub => sub
    .setName('gefasst')
    .setDescription('Markiert eine Fahndung als gefasst')
    .addIntegerOption(o => o.setName('id').setDescription('Fahndungs-ID').setRequired(true))
  )
  .addSubcommand(sub => sub
    .setName('loeschen')
    .setDescription('Loescht eine Fahndung')
    .addIntegerOption(o => o.setName('id').setDescription('Fahndungs-ID').setRequired(true))
  )
  .addSubcommand(sub => sub
    .setName('liste')
    .setDescription('Zeigt alle aktiven Fahndungen')
  );

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;
  const guildId = interaction.guildId!;
  const db = getDatabase();
  const sub = interaction.options.getSubcommand();

  // Nur Polizei + Admins dürfen Fahndungen verwalten
  if ((sub === 'erstellen' || sub === 'gefasst' || sub === 'loeschen') && !hasPolizeiPermission(member) && !hasAdminPermission(member)) {
    await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst eine Polizei- oder Admin-Rolle.')], ephemeral: true });
    return;
  }

  if (sub === 'erstellen') {
    const name = interaction.options.getString('name', true);
    const grund = interaction.options.getString('grund', true);
    const beschreibung = interaction.options.getString('beschreibung') || '';
    const roblox = interaction.options.getString('roblox') || '';

    const result = db.prepare(`
      INSERT INTO fahndungen (guild_id, erstellt_von_id, erstellt_von_name, gesuchter, roblox_name, grund, beschreibung)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(guildId, member.id, member.user.tag, name, roblox || null, grund, beschreibung || null);

    const fahndungId = result.lastInsertRowid;

    const embed = buildFahndungsEmbed(Number(fahndungId), name, roblox, grund, beschreibung, 'gesucht', member.user.tag);

    // In den aktuellen Kanal posten
    const channel = interaction.channel as TextChannel;
    const msg = await channel.send({ embeds: [embed] });

    // Message-ID speichern für spätere Updates
    db.prepare('UPDATE fahndungen SET message_id = ?, channel_id = ? WHERE id = ?')
      .run(msg.id, channel.id, fahndungId);

    await interaction.reply({ embeds: [createSuccessEmbed('🚨 Fahndung erstellt', `Fahndung **#${fahndungId}** nach **${name}** wurde ausgeschrieben.`)], ephemeral: true });

  } else if (sub === 'gefasst') {
    const id = interaction.options.getInteger('id', true);
    const row = db.prepare('SELECT * FROM fahndungen WHERE id = ? AND guild_id = ?')
      .get(id, guildId) as { id: number; gesuchter: string; roblox_name: string; grund: string; beschreibung: string; erstellt_von_name: string; message_id: string | null; channel_id: string | null; status: string } | undefined;

    if (!row) { await interaction.reply({ embeds: [createErrorEmbed('Nicht gefunden', `Fahndung #${id} existiert nicht.`)], ephemeral: true }); return; }
    if (row.status === 'gefasst') { await interaction.reply({ embeds: [createErrorEmbed('Bereits gefasst', 'Diese Fahndung wurde bereits als gefasst markiert.')], ephemeral: true }); return; }

    db.prepare("UPDATE fahndungen SET status = 'gefasst', aktualisiert_am = datetime('now') WHERE id = ?").run(id);

    // Original-Nachricht updaten
    if (row.message_id && row.channel_id) {
      try {
        const ch = await interaction.client.channels.fetch(row.channel_id) as TextChannel;
        const msg = await ch.messages.fetch(row.message_id);
        const updatedEmbed = buildFahndungsEmbed(row.id, row.gesuchter, row.roblox_name, row.grund, row.beschreibung, 'gefasst', row.erstellt_von_name);
        await msg.edit({ embeds: [updatedEmbed] });
      } catch { /* Nachricht evtl. gelöscht */ }
    }

    await interaction.reply({ embeds: [createSuccessEmbed('✅ Gefasst!', `**${row.gesuchter}** (Fahndung #${id}) wurde als gefasst markiert.`)] });

  } else if (sub === 'loeschen') {
    const id = interaction.options.getInteger('id', true);
    const row = db.prepare('SELECT message_id, channel_id FROM fahndungen WHERE id = ? AND guild_id = ?')
      .get(id, guildId) as { message_id: string | null; channel_id: string | null } | undefined;

    if (!row) { await interaction.reply({ embeds: [createErrorEmbed('Nicht gefunden', `Fahndung #${id} existiert nicht.`)], ephemeral: true }); return; }

    // Nachricht löschen
    if (row.message_id && row.channel_id) {
      try {
        const ch = await interaction.client.channels.fetch(row.channel_id) as TextChannel;
        const msg = await ch.messages.fetch(row.message_id);
        await msg.delete();
      } catch { /* */ }
    }

    db.prepare('DELETE FROM fahndungen WHERE id = ?').run(id);
    await interaction.reply({ embeds: [createSuccessEmbed('🗑️ Gelöscht', `Fahndung #${id} wurde entfernt.`)], ephemeral: true });

  } else if (sub === 'liste') {
    const rows = db.prepare("SELECT id, gesuchter, roblox_name, grund, status, erstellt_von_name FROM fahndungen WHERE guild_id = ? AND status = 'gesucht' ORDER BY id DESC LIMIT 15")
      .all(guildId) as Array<{ id: number; gesuchter: string; roblox_name: string | null; grund: string; status: string; erstellt_von_name: string }>;

    if (rows.length === 0) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(config.colors.success as ColorResolvable).setTitle('✅ Keine aktiven Fahndungen').setDescription('Aktuell wird niemand gesucht.').setTimestamp()], ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.polizei as ColorResolvable)
      .setTitle(`🚨 Aktive Fahndungen (${rows.length})`)
      .setDescription(rows.map(r =>
        `**#${r.id}** — ${r.gesuchter}${r.roblox_name ? ` (${r.roblox_name})` : ''}\n> ${r.grund} — *${r.erstellt_von_name}*`
      ).join('\n\n').substring(0, 4000))
      .setFooter({ text: 'Deutscher RP Server | Polizei — Fahndung' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

function buildFahndungsEmbed(id: number, name: string, roblox: string, grund: string, beschreibung: string, status: string, ersteller: string): EmbedBuilder {
  const isGefasst = status === 'gefasst';

  const embed = new EmbedBuilder()
    .setColor((isGefasst ? config.colors.success : config.colors.polizei) as ColorResolvable)
    .setTitle(isGefasst ? `✅ GEFASST — ${name}` : `🚨 FAHNDUNG — ${name}`)
    .addFields(
      { name: 'Status', value: isGefasst ? '✅ Gefasst' : '🔴 Gesucht', inline: true },
      { name: 'Gesuchter', value: name, inline: true },
    );

  if (roblox) embed.addFields({ name: 'Roblox-Name', value: roblox, inline: true });
  embed.addFields({ name: 'Grund', value: grund, inline: false });
  if (beschreibung) embed.addFields({ name: 'Beschreibung', value: beschreibung, inline: false });
  embed.addFields({ name: 'Erstellt von', value: ersteller, inline: true });
  embed.setFooter({ text: `Fahndung #${id} | Deutscher RP Server | Polizei` }).setTimestamp();

  return embed;
}

export default { data, execute };
