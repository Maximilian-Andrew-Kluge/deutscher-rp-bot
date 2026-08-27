import {
  CommandInteraction, SlashCommandBuilder, EmbedBuilder,
  ColorResolvable, GuildMember,
} from 'discord.js';
import { getDatabase } from '../../database/database';
import { config } from '../../config/config';
import { createErrorEmbed, createSuccessEmbed } from '../../utils/embeds';
import { hasAdminPermission, hasModPermission } from '../../utils/permissions';

export const data = new SlashCommandBuilder()
  .setName('ausbildung')
  .setDescription('Ausbildungs-Verwaltung')
  .addSubcommand(sub => sub
    .setName('starten')
    .setDescription('Startet eine Ausbildung für ein Mitglied')
    .addUserOption(o => o.setName('mitglied').setDescription('Wer wird ausgebildet?').setRequired(true))
    .addStringOption(o => o.setName('fraktion').setDescription('Fraktion').setRequired(true).addChoices(
      { name: 'Polizei', value: 'Polizei' },
      { name: 'Feuerwehr', value: 'Feuerwehr' },
      { name: 'Rettungsdienst', value: 'Rettungsdienst' },
      { name: 'Justiz', value: 'Justiz' },
      { name: 'Support', value: 'Support' },
      { name: 'ADAC', value: 'ADAC' },
      { name: 'Administration', value: 'Administration' },
    ))
    .addStringOption(o => o.setName('ausbildung').setDescription('Art der Ausbildung (z.B. Grundausbildung, Spezialausbildung)').setRequired(true).setMaxLength(100))
  )
  .addSubcommand(sub => sub
    .setName('abschliessen')
    .setDescription('Schliesst eine laufende Ausbildung ab')
    .addUserOption(o => o.setName('mitglied').setDescription('Wer hat abgeschlossen?').setRequired(true))
  )
  .addSubcommand(sub => sub
    .setName('liste')
    .setDescription('Zeigt alle Ausbildungen (laufend + abgeschlossen)')
    .addStringOption(o => o.setName('filter').setDescription('Filter').addChoices(
      { name: 'Laufend', value: 'laufend' },
      { name: 'Abgeschlossen', value: 'abgeschlossen' },
      { name: 'Alle', value: 'alle' },
    ))
  )
  .addSubcommand(sub => sub
    .setName('profil')
    .setDescription('Zeigt Ausbildungen eines Mitglieds')
    .addUserOption(o => o.setName('mitglied').setDescription('Welches Mitglied?').setRequired(true))
  );

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;
  const guildId = interaction.guildId!;
  const db = getDatabase();
  const sub = interaction.options.getSubcommand();

  // Starten + Abschliessen: Mod-Rechte nötig
  if ((sub === 'starten' || sub === 'abschliessen') && !hasAdminPermission(member) && !hasModPermission(member)) {
    await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst Moderator- oder Admin-Rechte.')], ephemeral: true });
    return;
  }

  if (sub === 'starten') {
    const target = interaction.options.getUser('mitglied', true);
    const fraktion = interaction.options.getString('fraktion', true);
    const ausbildung = interaction.options.getString('ausbildung', true);

    // Prüfen ob bereits eine laufende Ausbildung in dieser Fraktion
    const existing = db.prepare('SELECT id FROM ausbildungen WHERE guild_id = ? AND user_id = ? AND fraktion = ? AND status = ?')
      .get(guildId, target.id, fraktion, 'laufend');
    if (existing) {
      await interaction.reply({ embeds: [createErrorEmbed('Bereits in Ausbildung', `${target} hat bereits eine laufende Ausbildung bei ${fraktion}.`)], ephemeral: true });
      return;
    }

    db.prepare(`
      INSERT INTO ausbildungen (guild_id, user_id, username, fraktion, ausbildung, ausbilder_id, ausbilder_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(guildId, target.id, target.tag, fraktion, ausbildung, member.id, member.user.tag);

    const embed = new EmbedBuilder()
      .setColor(config.colors.info as ColorResolvable)
      .setTitle('📚 Ausbildung gestartet')
      .addFields(
        { name: 'Azubi', value: `${target}`, inline: true },
        { name: 'Fraktion', value: fraktion, inline: true },
        { name: 'Ausbildung', value: ausbildung, inline: true },
        { name: 'Ausbilder', value: `${member}`, inline: true },
      )
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .setFooter({ text: 'Deutscher RP Server | Ausbildung' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } else if (sub === 'abschliessen') {
    const target = interaction.options.getUser('mitglied', true);

    const row = db.prepare('SELECT id, fraktion, ausbildung FROM ausbildungen WHERE guild_id = ? AND user_id = ? AND status = ? ORDER BY gestartet_am DESC LIMIT 1')
      .get(guildId, target.id, 'laufend') as { id: number; fraktion: string; ausbildung: string } | undefined;

    if (!row) {
      await interaction.reply({ embeds: [createErrorEmbed('Keine Ausbildung', `${target} hat keine laufende Ausbildung.`)], ephemeral: true });
      return;
    }

    db.prepare("UPDATE ausbildungen SET status = 'abgeschlossen', abgeschlossen_am = datetime('now') WHERE id = ?").run(row.id);

    const embed = new EmbedBuilder()
      .setColor(config.colors.success as ColorResolvable)
      .setTitle('🎓 Ausbildung abgeschlossen!')
      .setDescription(`Herzlichen Glückwunsch, ${target}!`)
      .addFields(
        { name: 'Fraktion', value: row.fraktion, inline: true },
        { name: 'Ausbildung', value: row.ausbildung, inline: true },
        { name: 'Abgenommen von', value: `${member}`, inline: true },
      )
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .setFooter({ text: 'Deutscher RP Server | Ausbildung' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } else if (sub === 'liste') {
    const filter = interaction.options.getString('filter') || 'laufend';
    const where = filter === 'alle' ? '' : `AND status = '${filter}'`;
    const rows = db.prepare(`SELECT user_id, username, fraktion, ausbildung, status, gestartet_am, abgeschlossen_am FROM ausbildungen WHERE guild_id = ? ${where} ORDER BY gestartet_am DESC LIMIT 25`)
      .all(guildId) as Array<{ user_id: string; username: string; fraktion: string; ausbildung: string; status: string; gestartet_am: string; abgeschlossen_am: string | null }>;

    if (rows.length === 0) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(config.colors.info as ColorResolvable).setTitle('📚 Keine Ausbildungen').setDescription(`Keine ${filter === 'alle' ? '' : filter + 'en'} Ausbildungen gefunden.`).setTimestamp()], ephemeral: true });
      return;
    }

    const statusIcon = (s: string) => s === 'laufend' ? '🔄' : '✅';
    const embed = new EmbedBuilder()
      .setColor(config.colors.info as ColorResolvable)
      .setTitle(`📚 Ausbildungen (${rows.length})`)
      .setDescription(rows.map(r =>
        `${statusIcon(r.status)} **<@${r.user_id}>** — ${r.fraktion}: ${r.ausbildung}`
      ).join('\n').substring(0, 4000))
      .setFooter({ text: `Filter: ${filter} | Deutscher RP Server` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (sub === 'profil') {
    const target = interaction.options.getUser('mitglied', true);
    const rows = db.prepare('SELECT fraktion, ausbildung, status, ausbilder_name, gestartet_am, abgeschlossen_am FROM ausbildungen WHERE guild_id = ? AND user_id = ? ORDER BY gestartet_am DESC')
      .all(guildId, target.id) as Array<{ fraktion: string; ausbildung: string; status: string; ausbilder_name: string; gestartet_am: string; abgeschlossen_am: string | null }>;

    if (rows.length === 0) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(config.colors.info as ColorResolvable).setTitle(`📚 ${target.tag}`).setDescription('Keine Ausbildungen vorhanden.').setThumbnail(target.displayAvatarURL()).setTimestamp()], ephemeral: true });
      return;
    }

    const laufend = rows.filter(r => r.status === 'laufend');
    const fertig = rows.filter(r => r.status === 'abgeschlossen');

    const embed = new EmbedBuilder()
      .setColor(config.colors.info as ColorResolvable)
      .setTitle(`📚 Ausbildungsprofil — ${target.tag}`)
      .setThumbnail(target.displayAvatarURL({ size: 128 }));

    if (laufend.length > 0) {
      embed.addFields({ name: `🔄 Laufend (${laufend.length})`, value: laufend.map(r => `**${r.fraktion}:** ${r.ausbildung} (Ausbilder: ${r.ausbilder_name})`).join('\n'), inline: false });
    }
    if (fertig.length > 0) {
      embed.addFields({ name: `✅ Abgeschlossen (${fertig.length})`, value: fertig.map(r => `**${r.fraktion}:** ${r.ausbildung}`).join('\n').substring(0, 1020), inline: false });
    }

    embed.setFooter({ text: 'Deutscher RP Server | Ausbildung' }).setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

export default { data, execute };
