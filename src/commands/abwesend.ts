import {
  CommandInteraction, SlashCommandBuilder, EmbedBuilder,
  ColorResolvable, GuildMember, ChannelType,
} from 'discord.js';
import { getDatabase } from '../database/database';
import { config } from '../config/config';
import { createErrorEmbed, createSuccessEmbed } from '../utils/embeds';

export const data = new SlashCommandBuilder()
  .setName('abwesend')
  .setDescription('Abwesenheits-Verwaltung')
  .addSubcommand(sub => sub
    .setName('melden')
    .setDescription('Melde dich als abwesend')
    .addStringOption(o => o.setName('von').setDescription('Ab wann (z.B. 25.08.2026)').setRequired(true))
    .addStringOption(o => o.setName('bis').setDescription('Bis wann (z.B. 01.09.2026)').setRequired(true))
    .addStringOption(o => o.setName('grund').setDescription('Grund der Abwesenheit').setRequired(true).setMaxLength(200))
  )
  .addSubcommand(sub => sub
    .setName('beenden')
    .setDescription('Beende deine Abwesenheit vorzeitig')
  )
  .addSubcommand(sub => sub
    .setName('liste')
    .setDescription('Zeigt alle aktuell abwesenden Mitglieder')
  );

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;
  const guildId = interaction.guildId!;
  const db = getDatabase();
  const sub = interaction.options.getSubcommand();

  if (sub === 'melden') {
    const von = interaction.options.getString('von', true);
    const bis = interaction.options.getString('bis', true);
    const grund = interaction.options.getString('grund', true);

    // Prüfen ob bereits abwesend
    const existing = db.prepare('SELECT id FROM abwesenheiten WHERE guild_id = ? AND user_id = ? AND aktiv = 1')
      .get(guildId, member.id);
    if (existing) {
      await interaction.reply({ embeds: [createErrorEmbed('Bereits abwesend', 'Du bist bereits als abwesend gemeldet. Beende zuerst deine aktuelle Abwesenheit mit `/abwesend beenden`.')], ephemeral: true });
      return;
    }

    // Fraktion/Rolle ermitteln
    const fraktion = detectFraktion(member);

    db.prepare(`
      INSERT INTO abwesenheiten (guild_id, user_id, username, fraktion, von, bis, grund, aktiv)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(guildId, member.id, member.user.tag, fraktion, von, bis, grund);

    const embed = new EmbedBuilder()
      .setColor(config.colors.warning as ColorResolvable)
      .setTitle('📅 Abwesenheit gemeldet')
      .setDescription(`${member} ist abwesend.`)
      .addFields(
        { name: 'Von', value: von, inline: true },
        { name: 'Bis', value: bis, inline: true },
        { name: 'Fraktion', value: fraktion || 'Keine', inline: true },
        { name: 'Grund', value: grund, inline: false },
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
      .setFooter({ text: 'Deutscher RP Server | Abwesenheit' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } else if (sub === 'beenden') {
    const result = db.prepare('UPDATE abwesenheiten SET aktiv = 0 WHERE guild_id = ? AND user_id = ? AND aktiv = 1')
      .run(guildId, member.id);

    if (result.changes === 0) {
      await interaction.reply({ embeds: [createErrorEmbed('Nicht abwesend', 'Du bist aktuell nicht als abwesend gemeldet.')], ephemeral: true });
      return;
    }

    await interaction.reply({ embeds: [createSuccessEmbed('✅ Willkommen zurück!', `${member} ist wieder da und nicht mehr als abwesend gemeldet.`)] });

  } else if (sub === 'liste') {
    const rows = db.prepare(
      'SELECT user_id, username, fraktion, von, bis, grund FROM abwesenheiten WHERE guild_id = ? AND aktiv = 1 ORDER BY rowid DESC'
    ).all(guildId) as Array<{ user_id: string; username: string; fraktion: string; von: string; bis: string; grund: string }>;

    if (rows.length === 0) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(config.colors.success as ColorResolvable).setTitle('✅ Keine Abwesenheiten').setDescription('Aktuell ist niemand abwesend.').setTimestamp()], ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.info as ColorResolvable)
      .setTitle(`📅 Aktuelle Abwesenheiten (${rows.length})`)
      .setDescription(rows.map(r =>
        `**<@${r.user_id}>** ${r.fraktion ? `(${r.fraktion})` : ''}\n> ${r.von} — ${r.bis}: ${r.grund}`
      ).join('\n\n').substring(0, 4000))
      .setFooter({ text: 'Deutscher RP Server | Abwesenheit' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

/** Erkennt die Fraktion anhand der Rollen des Mitglieds */
function detectFraktion(member: GuildMember): string {
  const roleNames = member.roles.cache.map(r => r.name.toLowerCase());
  if (roleNames.some(r => r.includes('justiz') || r.includes('richter') || r.includes('staatsanwalt') || r.includes('anwalt'))) return 'Justiz';
  if (roleNames.some(r => r.includes('polizei'))) return 'Polizei';
  if (roleNames.some(r => r.includes('feuerwehr'))) return 'Feuerwehr';
  if (roleNames.some(r => r.includes('rettungsdienst') || r.includes('rettung'))) return 'Rettungsdienst';
  if (roleNames.some(r => r.includes('admin') || r.includes('moderator') || r.includes('support'))) return 'Staff';
  return 'Zivilist';
}

export default { data, execute };
