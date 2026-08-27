import {
  CommandInteraction, SlashCommandBuilder, EmbedBuilder,
  ColorResolvable, GuildMember,
} from 'discord.js';
import { getDatabase } from '../database/database';
import { config } from '../config/config';
import { createErrorEmbed, createSuccessEmbed } from '../utils/embeds';

const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export const data = new SlashCommandBuilder()
  .setName('dienstplan')
  .setDescription('Dienstplan-Verwaltung')
  .addSubcommand(sub => sub
    .setName('eintragen')
    .setDescription('Trage dich in den Dienstplan ein')
    .addStringOption(o => o.setName('tag').setDescription('Wochentag').setRequired(true).addChoices(
      ...TAGE.map(t => ({ name: t, value: t }))
    ))
    .addStringOption(o => o.setName('von').setDescription('Von (Uhrzeit, z.B. 14:00)').setRequired(true).setMaxLength(5))
    .addStringOption(o => o.setName('bis').setDescription('Bis (Uhrzeit, z.B. 18:00)').setRequired(true).setMaxLength(5))
  )
  .addSubcommand(sub => sub
    .setName('austragen')
    .setDescription('Loesche einen deiner Dienstplan-Eintraege')
    .addStringOption(o => o.setName('tag').setDescription('Wochentag').setRequired(true).addChoices(
      ...TAGE.map(t => ({ name: t, value: t }))
    ))
  )
  .addSubcommand(sub => sub
    .setName('anzeigen')
    .setDescription('Zeigt den Dienstplan der Woche')
    .addStringOption(o => o.setName('fraktion').setDescription('Filter nach Fraktion').addChoices(
      { name: 'Alle', value: 'alle' },
      { name: 'Polizei', value: 'Polizei' },
      { name: 'Feuerwehr', value: 'Feuerwehr' },
      { name: 'Rettungsdienst', value: 'Rettungsdienst' },
      { name: 'Justiz', value: 'Justiz' },
      { name: 'Support', value: 'Support' },
      { name: 'ADAC', value: 'ADAC' },
      { name: 'Administration', value: 'Administration' },
    ))
  );

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;
  const guildId = interaction.guildId!;
  const db = getDatabase();
  const sub = interaction.options.getSubcommand();

  // Fraktion des Nutzers erkennen
  const fraktion = detectFraktion(member);

  if (sub === 'eintragen') {
    const tag = interaction.options.getString('tag', true);
    const von = interaction.options.getString('von', true);
    const bis = interaction.options.getString('bis', true);

    // Prüfen ob bereits am gleichen Tag eingetragen
    const existing = db.prepare('SELECT id FROM dienstplan WHERE guild_id = ? AND user_id = ? AND tag = ?')
      .get(guildId, member.id, tag);
    if (existing) {
      // Update
      db.prepare('UPDATE dienstplan SET von_uhrzeit = ?, bis_uhrzeit = ? WHERE guild_id = ? AND user_id = ? AND tag = ?')
        .run(von, bis, guildId, member.id, tag);
    } else {
      db.prepare('INSERT INTO dienstplan (guild_id, user_id, username, fraktion, tag, von_uhrzeit, bis_uhrzeit) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(guildId, member.id, member.user.tag, fraktion, tag, von, bis);
    }

    await interaction.reply({ embeds: [createSuccessEmbed('📋 Dienstplan eingetragen', `**${tag}** ${von} — ${bis}\nFraktion: ${fraktion}`)], ephemeral: true });

  } else if (sub === 'austragen') {
    const tag = interaction.options.getString('tag', true);
    const result = db.prepare('DELETE FROM dienstplan WHERE guild_id = ? AND user_id = ? AND tag = ?')
      .run(guildId, member.id, tag);

    if (result.changes === 0) {
      await interaction.reply({ embeds: [createErrorEmbed('Nicht gefunden', `Du hast keinen Eintrag am ${tag}.`)], ephemeral: true });
      return;
    }
    await interaction.reply({ embeds: [createSuccessEmbed('Ausgetragen', `Dein Eintrag am **${tag}** wurde entfernt.`)], ephemeral: true });

  } else if (sub === 'anzeigen') {
    const filter = interaction.options.getString('fraktion') || 'alle';
    const where = filter === 'alle' ? '' : `AND fraktion = '${filter}'`;

    const rows = db.prepare(`SELECT user_id, username, fraktion, tag, von_uhrzeit, bis_uhrzeit FROM dienstplan WHERE guild_id = ? ${where} ORDER BY CASE tag WHEN 'Montag' THEN 1 WHEN 'Dienstag' THEN 2 WHEN 'Mittwoch' THEN 3 WHEN 'Donnerstag' THEN 4 WHEN 'Freitag' THEN 5 WHEN 'Samstag' THEN 6 WHEN 'Sonntag' THEN 7 END, von_uhrzeit`)
      .all(guildId) as Array<{ user_id: string; username: string; fraktion: string; tag: string; von_uhrzeit: string; bis_uhrzeit: string }>;

    if (rows.length === 0) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(config.colors.info as ColorResolvable).setTitle('📋 Dienstplan').setDescription('Keine Einträge vorhanden.').setTimestamp()], ephemeral: true });
      return;
    }

    // Nach Tagen gruppieren
    const grouped: Record<string, typeof rows> = {};
    rows.forEach(r => { if (!grouped[r.tag]) grouped[r.tag] = []; grouped[r.tag].push(r); });

    const embed = new EmbedBuilder()
      .setColor(config.colors.server as ColorResolvable)
      .setTitle(`📋 Dienstplan${filter !== 'alle' ? ` — ${filter}` : ''}`)
      .setFooter({ text: 'Deutscher RP Server | Dienstplan' })
      .setTimestamp();

    TAGE.forEach(tag => {
      if (grouped[tag] && grouped[tag].length > 0) {
        embed.addFields({
          name: `📅 ${tag}`,
          value: grouped[tag].map(r => `> <@${r.user_id}> — ${r.von_uhrzeit} bis ${r.bis_uhrzeit} (${r.fraktion})`).join('\n'),
          inline: false,
        });
      }
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

function detectFraktion(member: GuildMember): string {
  const roleNames = member.roles.cache.map(r => r.name.toLowerCase());
  if (roleNames.some(r => r.includes('justiz') || r.includes('richter') || r.includes('staatsanwalt'))) return 'Justiz';
  if (roleNames.some(r => r.includes('polizei'))) return 'Polizei';
  if (roleNames.some(r => r.includes('feuerwehr'))) return 'Feuerwehr';
  if (roleNames.some(r => r.includes('rettung'))) return 'Rettungsdienst';
  if (roleNames.some(r => r.includes('adac'))) return 'ADAC';
  if (roleNames.some(r => r.includes('support'))) return 'Support';
  if (roleNames.some(r => r.includes('admin') || r.includes('moderator'))) return 'Administration';
  return 'Sonstige';
}

export default { data, execute };
