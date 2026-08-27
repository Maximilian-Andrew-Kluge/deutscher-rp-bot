import {
  Client, GuildMember, TextChannel, EmbedBuilder, ColorResolvable,
} from 'discord.js';
import { getDatabase } from '../database/database';
import { config } from '../config/config';

export class WelcomeService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /** Wird aufgerufen wenn ein neues Mitglied dem Server beitritt */
  async handleMemberJoin(member: GuildMember): Promise<void> {
    try {
      const db = getDatabase();
      const settings = db.prepare(
        'SELECT willkommen_channel_id, auto_role_id FROM server_settings WHERE guild_id = ?'
      ).get(member.guild.id) as { willkommen_channel_id: string | null; auto_role_id: string | null } | undefined;

      // Auto-Rolle zuweisen (z.B. "Zivil")
      if (settings?.auto_role_id) {
        try {
          await member.roles.add(settings.auto_role_id);
          console.log(`✅ Auto-Rolle vergeben an ${member.user.tag}`);
        } catch (err) {
          console.error(`❌ Fehler beim Zuweisen der Auto-Rolle an ${member.user.tag}:`, err);
        }
      }

      if (!settings?.willkommen_channel_id) return;

      const channel = await this.client.channels.fetch(settings.willkommen_channel_id).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const memberCount = member.guild.memberCount;
      const guildName = member.guild.name;

      const embed = new EmbedBuilder()
        .setColor(config.colors.success as ColorResolvable)
        .setAuthor({ name: '🎉 Neues Mitglied', iconURL: member.guild.iconURL({ size: 128 }) ?? undefined })
        .setTitle(`🇩🇪 Willkommen auf dem Deutschen RP Server!`)
        .setDescription(
          `Hey ${member}, schön dass du da bist! 👋\n\n` +
          `Du bist unser **${memberCount}. Mitglied** — herzlich willkommen in unserer Community! ` +
          `Bei uns erlebst du realistisches deutsches Roblox-Roleplay mit voll ausgestalteten Fraktionen.`
        )
        .addFields(
          {
            name: '🚀 Deine ersten Schritte',
            value:
              '📜 Lies dir unsere **Regeln** durch\n' +
              '🎭 Hol dir im **Rollen-Menü** deine Rollen\n' +
              '💬 Stell dich gern der Community vor',
            inline: false,
          },
          {
            name: '🏛️ Unsere Fraktionen',
            value:
              '⚖️ Justiz\n' +
              '🚓 Polizei\n' +
              '🚒 Feuerwehr\n' +
              '🚑 Rettungsdienst',
            inline: true,
          },
          {
            name: '✨ Was dich erwartet',
            value:
              '🎬 Aktives Roleplay\n' +
              '👥 Freundliche Community\n' +
              '📈 Aufstiegsmöglichkeiten\n' +
              '🎉 Regelmäßige Events',
            inline: true,
          },
        )
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: `${guildName} • Viel Spaß beim Roleplay! 🇩🇪` })
        .setTimestamp();

      await (channel as TextChannel).send({
        content: `Willkommen an Bord, ${member}! 🎉`,
        embeds: [embed],
      });
    } catch (err) {
      console.error('Fehler beim Senden der Willkommensnachricht:', err);
    }
  }

  /** Optional: Abschiedsnachricht wenn jemand geht */
  async handleMemberLeave(member: GuildMember): Promise<void> {
    try {
      const db = getDatabase();
      const settings = db.prepare(
        'SELECT willkommen_channel_id FROM server_settings WHERE guild_id = ?'
      ).get(member.guild.id) as { willkommen_channel_id: string | null } | undefined;

      if (!settings?.willkommen_channel_id) return;

      const channel = await this.client.channels.fetch(settings.willkommen_channel_id).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const name = member.user?.username ?? member.displayName ?? 'Ein Mitglied';
      const memberCount = member.guild.memberCount;

      const embed = new EmbedBuilder()
        .setColor(config.colors.error as ColorResolvable)
        .setAuthor({ name: '👋 Mitglied verlassen', iconURL: member.guild.iconURL({ size: 128 }) ?? undefined })
        .setTitle('Auf Wiedersehen!')
        .setDescription(
          `**${name}** hat den Deutschen RP Server verlassen.\n\n` +
          'Schade, dass du gehst — die Türen stehen dir jederzeit wieder offen. 🇩🇪'
        )
        .setThumbnail(member.user?.displayAvatarURL({ size: 256 }) ?? null)
        .setFooter({ text: `Wir sind jetzt noch ${memberCount} Mitglieder` })
        .setTimestamp();

      await (channel as TextChannel).send({ embeds: [embed] });
    } catch (err) {
      console.error('Fehler beim Senden der Abschiedsnachricht:', err);
    }
  }
}
