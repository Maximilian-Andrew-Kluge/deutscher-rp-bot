import { Client, EmbedBuilder, TextChannel, ColorResolvable } from 'discord.js';
import { getDatabase } from '../database/database';
import { config } from '../config/config';

interface ServerSettings {
  log_channel_id: string | null;
}

export class LogService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async log(guildId: string, aktion: string, benutzerId: string, details?: string): Promise<void> {
    const db = getDatabase();

    // In DB speichern
    db.prepare(`
      INSERT INTO logs (guild_id, aktion, benutzer_id, details)
      VALUES (?, ?, ?, ?)
    `).run(guildId, aktion, benutzerId, details || null);

    // In Discord-Kanal senden
    try {
      const settings = db.prepare('SELECT log_channel_id FROM server_settings WHERE guild_id = ?').get(guildId) as ServerSettings | undefined;

      if (!settings?.log_channel_id) return;

      const channel = await this.client.channels.fetch(settings.log_channel_id) as TextChannel | null;
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(config.colors.info as ColorResolvable)
        .setTitle('📋 Bot-Log')
        .addFields(
          { name: '🎯 Aktion', value: aktion, inline: true },
          { name: '👤 Benutzer', value: `<@${benutzerId}>`, inline: true },
        );

      if (details) {
        embed.addFields({ name: '📝 Details', value: details.substring(0, 1020), inline: false });
      }

      embed
        .setFooter({ text: 'Deutscher RP Server | Logging' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Log-Fehler:', err);
    }
  }
}
