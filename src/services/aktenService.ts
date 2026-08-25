import { Client, ForumChannel, EmbedBuilder, ColorResolvable, ChannelType } from 'discord.js';
import { getDatabase } from '../database/database';
import { generateAktenzeichen } from '../utils/aktenzeichen';
import { LogService } from './logService';
import { config } from '../config/config';

interface AkteRow {
  id: number;
  guild_id: string;
  aktenzeichen: string;
  verfahren_id: number | null;
  forum_post_id: string | null;
  forum_channel_id: string | null;
  status: string;
  inhalt: string | null;
  erstellt_von: string;
  erstellt_am: string;
}

export interface AkteCreateData {
  guildId: string;
  verfahrenId?: number;
  inhalt: string;
  erstelltVon: string;
}

export class AktenService {
  private client: Client;
  private logService: LogService;

  constructor(client: Client) {
    this.client = client;
    this.logService = new LogService(client);
  }

  async createAkte(data: AkteCreateData): Promise<string> {
    const db = getDatabase();
    const aktenzeichen = generateAktenzeichen(data.guildId, config.prefixes.akte);

    const settings = db.prepare('SELECT akten_channel_id FROM server_settings WHERE guild_id = ?').get(data.guildId) as { akten_channel_id: string | null } | undefined;
    if (!settings?.akten_channel_id) {
      throw new Error('Akten-Kanal ist nicht konfiguriert. Bitte führe `/setup kanale` aus.');
    }

    const result = db.prepare(`
      INSERT INTO akten (guild_id, aktenzeichen, verfahren_id, inhalt, erstellt_von)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.guildId, aktenzeichen, data.verfahrenId ?? null, data.inhalt, data.erstelltVon);

    const akteId = result.lastInsertRowid as number;

    try {
      const channel = await this.client.channels.fetch(settings.akten_channel_id) as ForumChannel;
      if (!channel || channel.type !== ChannelType.GuildForum) {
        throw new Error('Akten-Kanal ist kein Forum-Kanal.');
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.justiz as ColorResolvable)
        .setTitle(`📁 Akte | ${aktenzeichen}`)
        .setDescription(data.inhalt.substring(0, 4000))
        .addFields(
          { name: '📋 Aktenzeichen', value: aktenzeichen, inline: true },
          { name: '🟢 Status', value: 'Abgeschlossen', inline: true },
          { name: '📝 Erstellt von', value: data.erstelltVon, inline: true },
        )
        .setFooter({ text: 'Deutscher RP Server | Aktenarchiv' })
        .setTimestamp();

      const thread = await channel.threads.create({
        name: `📁 ${aktenzeichen}`,
        message: { embeds: [embed] },
      });

      db.prepare('UPDATE akten SET forum_post_id = ?, forum_channel_id = ? WHERE id = ?')
        .run(thread.id, settings.akten_channel_id, akteId);

    } catch (err) {
      console.error('Fehler beim Erstellen des Akten-Posts:', err);
    }

    await this.logService.log(data.guildId, 'Akte erstellt', data.erstelltVon, `Aktenzeichen: ${aktenzeichen}`);
    return aktenzeichen;
  }

  getAkteByAktenzeichen(guildId: string, aktenzeichen: string): AkteRow | undefined {
    return getDatabase().prepare('SELECT * FROM akten WHERE guild_id = ? AND aktenzeichen = ?').get(guildId, aktenzeichen) as AkteRow | undefined;
  }

  getAllAkten(guildId: string): AkteRow[] {
    return getDatabase().prepare('SELECT * FROM akten WHERE guild_id = ? ORDER BY erstellt_am DESC').all(guildId) as unknown as AkteRow[];
  }
}
