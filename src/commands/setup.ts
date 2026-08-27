import {
  CommandInteraction, SlashCommandBuilder, EmbedBuilder,
  ColorResolvable, ChannelType, GuildMember
} from 'discord.js';
import { getDatabase } from '../database/database';
import { CounterService } from '../services/counterService';
import { createErrorEmbed, createSuccessEmbed } from '../utils/embeds';
import { hasAdminPermission } from '../utils/permissions';
import { config } from '../config/config';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Bot-Einstellungen für diesen Server')
  .addSubcommand(sub => sub
    .setName('kanale')
    .setDescription('Konfiguriert die Bot-Kanäle')
    .addChannelOption(o => o.setName('verfahren').setDescription('Forum-Kanal für Verfahren').setRequired(false).addChannelTypes(ChannelType.GuildForum))
    .addChannelOption(o => o.setName('akten').setDescription('Forum-Kanal für Akten').setRequired(false).addChannelTypes(ChannelType.GuildForum))
    .addChannelOption(o => o.setName('logs').setDescription('Text-Kanal für Logs').setRequired(false).addChannelTypes(ChannelType.GuildText))
    .addChannelOption(o => o.setName('ankuendigung').setDescription('Ankündigungs-Kanal').setRequired(false).addChannelTypes(ChannelType.GuildText))
    .addChannelOption(o => o.setName('willkommen').setDescription('Willkommens-Kanal für neue Mitglieder').setRequired(false).addChannelTypes(ChannelType.GuildText))
  )
  .addSubcommand(sub => sub
    .setName('ausbildung')
    .setDescription('Konfiguriert Ausbildungs-Kanäle')
    .addChannelOption(o => o.setName('polizei').setDescription('Kanal für Polizei-Ausbildung').setRequired(false).addChannelTypes(ChannelType.GuildText))
    .addChannelOption(o => o.setName('feuerwehr').setDescription('Kanal für Feuerwehr-Ausbildung').setRequired(false).addChannelTypes(ChannelType.GuildText))
    .addChannelOption(o => o.setName('rettungsdienst').setDescription('Kanal für Rettungsdienst-Ausbildung').setRequired(false).addChannelTypes(ChannelType.GuildText))
    .addChannelOption(o => o.setName('justiz').setDescription('Kanal für Justiz-Ausbildung').setRequired(false).addChannelTypes(ChannelType.GuildText))
  )
  .addSubcommand(sub => sub
    .setName('voice')
    .setDescription('Konfiguriert das Voice-System')
    .addChannelOption(o => o.setName('erstell-kanal').setDescription('Voice-Kanal zum Erstellen temporärer Kanäle').setRequired(true).addChannelTypes(ChannelType.GuildVoice))
    .addChannelOption(o => o.setName('kategorie').setDescription('Kategorie für temporäre Kanäle').setRequired(false).addChannelTypes(ChannelType.GuildCategory))
  )
  .addSubcommand(sub => sub
    .setName('rolle')
    .setDescription('Weist einer Discord-Rolle eine Berechtigungsebene zu')
    .addStringOption(o => o.setName('key').setDescription('Berechtigungsebene').setRequired(true)
      .addChoices(
        { name: '👑 Owner',                    value: 'owner' },
        { name: '🔱 Co-Owner',                 value: 'coOwner' },
        { name: '🛡️ Administrator',            value: 'administrator' },
        { name: '🛡️ Administrator-Anwärter',   value: 'administratorAnwaerter' },
        { name: '🔨 Moderator',                value: 'moderator' },
        { name: '💻 Developer',                value: 'developer' },
        { name: '🎧 Support-Leitung',          value: 'supportLeitung' },
        { name: '🎧 Supporter',                value: 'supporter' },
        { name: '🎧 Support-Azubi',            value: 'supportAnwaerter' },
        { name: '🏛️ Fraktionsleitung',         value: 'fraktionsleitung' },
        { name: '⚖️ Justiz-Leitung',           value: 'justizLeitung' },
        { name: '⚖️ Richter',                  value: 'richter' },
        { name: '⚖️ Staatsanwalt',             value: 'staatsanwalt' },
        { name: '🏛️ Anwalt',                   value: 'anwalt' },
        { name: '📋 Justizanwärter',           value: 'justizAnwaerter' },
        { name: '🚓 Polizei-Leitung',          value: 'polizeiLeitung' },
        { name: '🚓 Polizei',                  value: 'polizei' },
        { name: '🚓 Polizeianwärter',          value: 'polizeiAnwaerter' },
        { name: '🚒 Feuerwehr-Leitung',        value: 'feuerwehrLeitung' },
        { name: '🚒 Feuerwehr',                value: 'feuerwehr' },
        { name: '🚒 Feuerwehranwärter',        value: 'feuerwehrAnwaerter' },
        { name: '🚑 Rettungsdienst-Leitung',   value: 'rettungsdienstLeitung' },
        { name: '🚑 Rettungsdienst',           value: 'rettungsdienst' },
        { name: '🚑 Rettungsdienstanwärter',   value: 'rettungsdienstAnwaerter' },
        { name: '🚗 ADAC-Leitung',             value: 'adacLeitung' },
      ))
    .addRoleOption(o => o.setName('rolle').setDescription('Die Discord-Rolle').setRequired(true))
  )
  .addSubcommand(sub => sub.setName('info').setDescription('Zeigt die aktuelle Konfiguration'))
  .addSubcommand(sub => sub
    .setName('support')
    .setDescription('Konfiguriert den Support-Warteraum (Voice + Benachrichtigungen)')
    .addChannelOption(o => o.setName('warteraum').setDescription('Voice-Kanal als Support-Warteraum').setRequired(true).addChannelTypes(ChannelType.GuildVoice))
    .addChannelOption(o => o.setName('benachrichtigung').setDescription('Textkanal für Support-Benachrichtigungen').setRequired(true).addChannelTypes(ChannelType.GuildText))
  )
  .addSubcommand(sub => sub
    .setName('counter')
    .setDescription('Erstellt Statistik-Counter als Voice-Kanäle (Mitglieder, Online, Boosts, Uhrzeit)')
  );

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;

  if (!hasAdminPermission(member)) {
    await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Du benötigst Administrator-Rechte.')], ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const db = getDatabase();

  // Sicherstellen dass settings-Eintrag existiert
  db.prepare(`INSERT INTO server_settings (guild_id) VALUES (?) ON CONFLICT(guild_id) DO NOTHING`).run(interaction.guildId!);

  if (sub === 'kanale') {
    const verfahren = interaction.options.getChannel('verfahren');
    const akten = interaction.options.getChannel('akten');
    const logs = interaction.options.getChannel('logs');
    const ankuendigung = interaction.options.getChannel('ankuendigung');
    const willkommen = interaction.options.getChannel('willkommen');

    if (!verfahren && !akten && !logs && !ankuendigung && !willkommen) {
      await interaction.reply({ embeds: [createErrorEmbed('Nichts angegeben', 'Bitte gib mindestens einen Kanal an.')], ephemeral: true });
      return;
    }

    const updates: string[] = [];
    if (verfahren) {
      db.prepare(`UPDATE server_settings SET verfahren_channel_id = ? WHERE guild_id = ?`).run(verfahren.id, interaction.guildId!);
      updates.push(`✅ **Verfahren-Kanal:** ${verfahren}`);
    }
    if (akten) {
      db.prepare(`UPDATE server_settings SET akten_channel_id = ? WHERE guild_id = ?`).run(akten.id, interaction.guildId!);
      updates.push(`✅ **Akten-Kanal:** ${akten}`);
    }
    if (logs) {
      db.prepare(`UPDATE server_settings SET log_channel_id = ? WHERE guild_id = ?`).run(logs.id, interaction.guildId!);
      updates.push(`✅ **Log-Kanal:** ${logs}`);
    }
    if (ankuendigung) {
      db.prepare(`UPDATE server_settings SET ankuendigung_channel_id = ? WHERE guild_id = ?`).run(ankuendigung.id, interaction.guildId!);
      updates.push(`✅ **Ankündigungs-Kanal:** ${ankuendigung}`);
    }
    if (willkommen) {
      db.prepare(`UPDATE server_settings SET willkommen_channel_id = ? WHERE guild_id = ?`).run(willkommen.id, interaction.guildId!);
      updates.push(`✅ **Willkommens-Kanal:** ${willkommen}`);
    }

    await interaction.reply({ embeds: [createSuccessEmbed('Kanäle konfiguriert', updates.join('\n'))], ephemeral: true });

  } else if (sub === 'ausbildung') {
    const polizei = interaction.options.getChannel('polizei');
    const feuerwehr = interaction.options.getChannel('feuerwehr');
    const rettungsdienst = interaction.options.getChannel('rettungsdienst');
    const justiz = interaction.options.getChannel('justiz');

    if (!polizei && !feuerwehr && !rettungsdienst && !justiz) {
      await interaction.reply({ embeds: [createErrorEmbed('Nichts angegeben', 'Bitte gib mindestens einen Ausbildungs-Kanal an.')], ephemeral: true });
      return;
    }

    const updates: string[] = [];
    if (polizei) {
      db.prepare(`UPDATE server_settings SET polizei_ausbildung_channel_id = ? WHERE guild_id = ?`).run(polizei.id, interaction.guildId!);
      updates.push(`✅ **🚓 Polizei-Ausbildung:** ${polizei}`);
    }
    if (feuerwehr) {
      db.prepare(`UPDATE server_settings SET feuerwehr_ausbildung_channel_id = ? WHERE guild_id = ?`).run(feuerwehr.id, interaction.guildId!);
      updates.push(`✅ **🚒 Feuerwehr-Ausbildung:** ${feuerwehr}`);
    }
    if (rettungsdienst) {
      db.prepare(`UPDATE server_settings SET rettungsdienst_ausbildung_channel_id = ? WHERE guild_id = ?`).run(rettungsdienst.id, interaction.guildId!);
      updates.push(`✅ **🚑 Rettungsdienst-Ausbildung:** ${rettungsdienst}`);
    }
    if (justiz) {
      db.prepare(`UPDATE server_settings SET justiz_ausbildung_channel_id = ? WHERE guild_id = ?`).run(justiz.id, interaction.guildId!);
      updates.push(`✅ **⚖️ Justiz-Ausbildung:** ${justiz}`);
    }

    await interaction.reply({ embeds: [createSuccessEmbed('Ausbildungs-Kanäle konfiguriert', updates.join('\n'))], ephemeral: true });

  } else if (sub === 'voice') {
    const createChannel = interaction.options.getChannel('erstell-kanal', true);
    const category = interaction.options.getChannel('kategorie');

    db.prepare(`UPDATE server_settings SET voice_create_channel_id = ?, voice_category_id = ? WHERE guild_id = ?`)
      .run(createChannel.id, category?.id ?? null, interaction.guildId!);

    await interaction.reply({
      embeds: [createSuccessEmbed('Voice-System konfiguriert',
        `**Erstell-Kanal:** ${createChannel}\n**Kategorie:** ${category ?? 'Keine'}\n\nBenutzer die den Erstell-Kanal betreten, bekommen automatisch einen eigenen RP-Channel.`
      )],
      ephemeral: true
    });

  } else if (sub === 'rolle') {
    const key = interaction.options.getString('key', true);
    const role = interaction.options.getRole('rolle', true);

    db.prepare(`INSERT INTO role_config (guild_id, role_key, role_id) VALUES (?, ?, ?) ON CONFLICT(guild_id, role_key) DO UPDATE SET role_id = excluded.role_id`)
      .run(interaction.guildId!, key, role.id);

    await interaction.reply({ embeds: [createSuccessEmbed('Rolle konfiguriert', `**${key}** → ${role}`)], ephemeral: true });

  } else if (sub === 'support') {
    const warteraum = interaction.options.getChannel('warteraum', true);
    const benachrichtigung = interaction.options.getChannel('benachrichtigung', true);

    db.prepare(`UPDATE server_settings SET support_channel_id = ?, support_notify_channel_id = ? WHERE guild_id = ?`)
      .run(warteraum.id, benachrichtigung.id, interaction.guildId!);

    await interaction.reply({
      embeds: [createSuccessEmbed('🎧 Support-System konfiguriert',
        `**Support-Warteraum:** ${warteraum}\n` +
        `**Benachrichtigungs-Kanal:** ${benachrichtigung}\n\n` +
        `Wenn jemand den Warteraum betritt, wird der Bot beitreten und per Sprachansage mitteilen, ob ein Supporter verfügbar ist. ` +
        `Gleichzeitig werden die Support-Rollen im Benachrichtigungs-Kanal gepingt.`
      )],
      ephemeral: true,
    });

  } else if (sub === 'counter') {
    if (!hasAdminPermission(member)) {
      await interaction.reply({ embeds: [createErrorEmbed('Keine Berechtigung', 'Nur Admins können Counter erstellen.')], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const counterService = new CounterService(interaction.client);
      await counterService.setup(interaction.guildId!);
      await interaction.editReply({
        embeds: [createSuccessEmbed('📊 Counter erstellt',
          'Die Statistik-Counter wurden erstellt:\n\n' +
          '**👥 Mitglieder** — Gesamtzahl\n' +
          '**🟢 Online** — Aktuell online\n' +
          '**💎 Boosts** — Server-Boosts\n' +
          '**🕐 Uhrzeit** — Aktuelle Uhrzeit (Berlin)\n\n' +
          'Die Counter werden alle 5 Minuten automatisch aktualisiert.'
        )],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      await interaction.editReply({ embeds: [createErrorEmbed('Fehler', msg)] });
    }

  } else if (sub === 'info') {
    type SettingsRow = Record<string, string | null>;
    const s = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(interaction.guildId!) as SettingsRow | undefined;
    const roles = db.prepare('SELECT role_key, role_id FROM role_config WHERE guild_id = ? ORDER BY role_key').all(interaction.guildId!) as unknown as Array<{ role_key: string; role_id: string }>;

    const ch = (id: string | null | undefined) => id ? `<#${id}>` : '❌ Nicht gesetzt';

    const embed = new EmbedBuilder()
      .setColor(config.colors.server as ColorResolvable)
      .setTitle('⚙️ Bot-Konfiguration')
      .addFields(
        { name: '⚖️ Verfahren-Kanal', value: ch(s?.verfahren_channel_id), inline: true },
        { name: '📁 Akten-Kanal', value: ch(s?.akten_channel_id), inline: true },
        { name: '📋 Log-Kanal', value: ch(s?.log_channel_id), inline: true },
        { name: '📢 Ankündigung', value: ch(s?.ankuendigung_channel_id), inline: true },
        { name: '🎙️ Voice-Erstell-Kanal', value: ch(s?.voice_create_channel_id), inline: true },
        { name: '📁 Voice-Kategorie', value: ch(s?.voice_category_id), inline: true },
        { name: '🚓 Polizei-Ausbildung', value: ch(s?.polizei_ausbildung_channel_id), inline: true },
        { name: '🚒 Feuerwehr-Ausbildung', value: ch(s?.feuerwehr_ausbildung_channel_id), inline: true },
        { name: '🚑 Rettungsdienst-Ausbildung', value: ch(s?.rettungsdienst_ausbildung_channel_id), inline: true },
        { name: '⚖️ Justiz-Ausbildung', value: ch(s?.justiz_ausbildung_channel_id), inline: true },
        { name: '🎧 Support-Warteraum', value: ch(s?.support_channel_id), inline: true },
        { name: '📄 Support-Benachrichtigung', value: ch(s?.support_notify_channel_id), inline: true },
        {
          name: `🎭 Konfigurierte Rollen (${roles.length})`,
          value: roles.length > 0
            ? roles.map(r => `• **${r.role_key}** → <@&${r.role_id}>`).join('\n').substring(0, 1020)
            : '❌ Keine Rollen konfiguriert',
          inline: false
        },
      )
      .setFooter({ text: 'Deutscher RP Server | Setup' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

export default { data, execute };
