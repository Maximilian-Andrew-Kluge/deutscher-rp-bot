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
        'SELECT willkommen_channel_id FROM server_settings WHERE guild_id = ?'
      ).get(member.guild.id) as { willkommen_channel_id: string | null } | undefined;

      if (!settings?.willkommen_channel_id) return;

      const channel = await this.client.channels.fetch(settings.willkommen_channel_id).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const memberCount = member.guild.memberCount;

      const embed = new EmbedBuilder()
        .setColor(config.colors.success as ColorResolvable)
        .setTitle('🇩🇪 Willkommen beim Deutschen RP Server!')
        .setDescription(
          `Willkommen, ${member}! 👋\n\n` +
          'Schön, dass du den Weg zu uns gefunden hast!\n\n' +
          'Der Deutsche RP Server ist ein deutscher Roblox-Roleplay-Server mit ' +
          'verschiedenen Fraktionen und einer aktiven Community.\n\n' +
          '⚖️ **Justiz**\n' +
          '🚓 **Polizei**\n' +
          '🚒 **Feuerwehr**\n' +
          '🚑 **Rettungsdienst**\n\n' +
          'Bevor du loslegst, lies bitte unsere Regeln und hole dir deine benötigten Rollen.\n\n' +
          'Wir wünschen dir viel Spaß beim Roleplay! 🇩🇪'
        )
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: `Deutscher RP Server • Roleplay • Community • ${memberCount} Mitglieder` })
        .setTimestamp();

      await (channel as TextChannel).send({
        content: `${member}`,
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

      const name = member.user?.tag ?? member.displayName ?? 'Ein Mitglied';
      const embed = new EmbedBuilder()
        .setColor(config.colors.error as ColorResolvable)
        .setDescription(`👋 **${name}** hat den Server verlassen.`)
        .setTimestamp();

      await (channel as TextChannel).send({ embeds: [embed] });
    } catch (err) {
      console.error('Fehler beim Senden der Abschiedsnachricht:', err);
    }
  }
}
