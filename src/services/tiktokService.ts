import { Client, TextChannel, EmbedBuilder, ColorResolvable, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { TikTokLiveConnection } from 'tiktok-live-connector';
import { getDatabase } from '../database/database';
import { config } from '../config/config';

interface StreamerRow {
  id: number;
  guild_id: string;
  tiktok_username: string;
  anzeige_name: string | null;
  ist_live: number;
}

/**
 * TikTok Live-Überwachung.
 * Pollt regelmäßig alle konfigurierten Streamer und schickt eine
 * Benachrichtigung in den Live-Kanal wenn jemand live geht.
 *
 * Hinweis: nutzt die inoffizielle tiktok-live-connector Library.
 */
export class TikTokService {
  private client: Client;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly INTERVALL_MS = 90_000; // alle 90 Sekunden prüfen
  private pruefeGerade = false;

  constructor(client: Client) {
    this.client = client;
  }

  /** Startet den Poller */
  start(): void {
    if (this.pollInterval) return;
    // Erste Prüfung nach 20 Sek (Bot muss erst ready sein)
    setTimeout(() => this.pruefeAlle(), 20_000);
    this.pollInterval = setInterval(() => this.pruefeAlle(), this.INTERVALL_MS);
    console.log('📡 TikTok Live-Überwachung gestartet.');
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /** Prüft ob ein bestimmter TikTok-User live ist */
  async istLive(username: string): Promise<boolean> {
    try {
      const clean = username.replace(/^@/, '').trim();
      const conn = new TikTokLiveConnection(clean, {});
      // fetchIsLive gibt true/false zurück ohne die Verbindung aufzubauen
      const live = await conn.fetchIsLive();
      return !!live;
    } catch {
      return false;
    }
  }

  /** Prüft alle überwachten Streamer aller Guilds */
  private async pruefeAlle(): Promise<void> {
    if (this.pruefeGerade) return; // keine Überlappung
    this.pruefeGerade = true;

    try {
      const db = getDatabase();
      const streamer = db.prepare('SELECT * FROM tiktok_streamer').all() as unknown as StreamerRow[];

      for (const s of streamer) {
        try {
          const liveJetzt = await this.istLive(s.tiktok_username);
          const warLive = s.ist_live === 1;

          if (liveJetzt && !warLive) {
            // Gerade live gegangen → Benachrichtigung senden
            db.prepare('UPDATE tiktok_streamer SET ist_live = 1 WHERE id = ?').run(s.id);
            await this.sendeLiveBenachrichtigung(s);
          } else if (!liveJetzt && warLive) {
            // Stream beendet
            db.prepare('UPDATE tiktok_streamer SET ist_live = 0 WHERE id = ?').run(s.id);
          }
        } catch (err) {
          // Einzelnen Streamer-Fehler ignorieren, nächsten prüfen
          console.warn(`TikTok-Prüfung fehlgeschlagen für ${s.tiktok_username}:`, err instanceof Error ? err.message : err);
        }

        // Kurze Pause zwischen den Anfragen um Rate-Limits zu vermeiden
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error('TikTok pruefeAlle Fehler:', err);
    } finally {
      this.pruefeGerade = false;
    }
  }

  /** Sendet die Live-Benachrichtigung in den konfigurierten Kanal */
  private async sendeLiveBenachrichtigung(streamer: StreamerRow): Promise<void> {
    try {
      const db = getDatabase();
      const settings = db.prepare('SELECT live_channel_id FROM server_settings WHERE guild_id = ?')
        .get(streamer.guild_id) as { live_channel_id: string | null } | undefined;

      if (!settings?.live_channel_id) return;

      const channel = await this.client.channels.fetch(settings.live_channel_id).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const username = streamer.tiktok_username.replace(/^@/, '');
      const anzeigeName = streamer.anzeige_name || username;
      const url = `https://www.tiktok.com/@${username}/live`;

      const embed = new EmbedBuilder()
        .setColor(0xFE2C55 as ColorResolvable) // TikTok-Rot
        .setAuthor({ name: '🔴 LIVE auf TikTok!' })
        .setTitle(`${anzeigeName} ist jetzt LIVE!`)
        .setDescription(
          `**@${username}** streamt gerade live auf TikTok! 🎥\n\n` +
          'Schaut vorbei und supportet den Stream! 💜'
        )
        .addFields(
          { name: '👤 Streamer', value: `@${username}`, inline: true },
          { name: '📱 Plattform', value: 'TikTok', inline: true },
        )
        .setFooter({ text: 'Deutscher RP Server | Live-Ankündigungen' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('🔴 Auf TikTok ansehen')
          .setStyle(ButtonStyle.Link)
          .setURL(url)
      );

      await (channel as TextChannel).send({
        content: `@everyone 🔴 **${anzeigeName}** ist jetzt **LIVE** auf TikTok!`,
        embeds: [embed],
        components: [row],
      });
    } catch (err) {
      console.error('Fehler beim Senden der Live-Benachrichtigung:', err);
    }
  }
}
