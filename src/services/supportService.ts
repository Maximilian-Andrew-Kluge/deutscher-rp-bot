import {
  Client, GuildMember, VoiceChannel, TextChannel, EmbedBuilder,
  ColorResolvable, VoiceState,
} from 'discord.js';
import {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, VoiceConnectionStatus, entersState,
  getVoiceConnection,
} from '@discordjs/voice';
import { getDatabase } from '../database/database';
import { config } from '../config/config';

// Google TTS (gibt eine URL zurück, die wir als Stream nutzen)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const googleTTS = require('google-tts-api');

// Support-Rollen-IDs
const SUPPORT_ROLES = [
  '1540517351370526773', // Support-Leitung
  '1542280431808806993', // Supporter
  '1542279297488658473', // Support-Azubi
];

// Cooldown pro Guild (damit der Bot nicht bei jedem Join spamt)
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 15_000; // 15 Sekunden

export class SupportService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Wird aufgerufen, wenn jemand einen Voice-Kanal betritt.
   * Prüft ob es der Support-Warteraum ist und reagiert entsprechend.
   */
  async handleVoiceJoin(member: GuildMember, channelId: string): Promise<void> {
    // Bot selbst ignorieren
    if (member.user.bot) return;

    const guildId = member.guild.id;
    const db = getDatabase();

    // Support-Warteraum aus den Einstellungen lesen
    const settings = db.prepare(
      'SELECT support_channel_id, support_notify_channel_id FROM server_settings WHERE guild_id = ?'
    ).get(guildId) as { support_channel_id: string | null; support_notify_channel_id: string | null } | undefined;

    if (!settings?.support_channel_id) return;
    if (channelId !== settings.support_channel_id) return;

    // Cooldown prüfen (damit der Bot nicht bei jedem Kanalwechsel sofort wieder spricht)
    const now = Date.now();
    const lastTrigger = cooldowns.get(guildId) ?? 0;
    if (now - lastTrigger < COOLDOWN_MS) return;
    cooldowns.set(guildId, now);

    // Voice-Kanal holen
    const voiceChannel = await this.client.channels.fetch(channelId).catch(() => null) as VoiceChannel | null;
    if (!voiceChannel) return;

    // Supporter online prüfen
    const onlineSupporters = await this.getOnlineSupporters(member.guild);
    const hasSupporter = onlineSupporters.length > 0;

    // TTS-Ansage vorbereiten
    const ansage = hasSupporter
      ? `Willkommen im Support! Ein Supporter wurde benachrichtigt und wird sich gleich um dich kümmern.`
      : `Willkommen im Support! Leider ist aktuell kein Supporter verfügbar. Bitte warte kurz oder versuche es später erneut.`;

    // Benachrichtigung NUR senden wenn Supporter online sind
    // (Zivilisten haben keinen Zugriff auf den Benachrichtigungs-Kanal)
    if (hasSupporter) {
      await this.sendNotification(member, settings.support_notify_channel_id, onlineSupporters);
    }

    // Bot in den Voice-Kanal joinen und TTS abspielen
    await this.speakInChannel(voiceChannel, ansage, guildId);
  }

  /**
   * Wird aufgerufen, wenn jemand den Voice-Kanal verlässt.
   * Wenn der Warteraum leer ist, Bot disconnecten.
   */
  async handleVoiceLeave(guildId: string, channelId: string): Promise<void> {
    const db = getDatabase();
    const settings = db.prepare(
      'SELECT support_channel_id FROM server_settings WHERE guild_id = ?'
    ).get(guildId) as { support_channel_id: string | null } | undefined;

    if (!settings?.support_channel_id || channelId !== settings.support_channel_id) return;

    // Prüfen ob noch User (außer dem Bot) im Kanal sind
    const channel = await this.client.channels.fetch(channelId).catch(() => null) as VoiceChannel | null;
    if (!channel) return;

    const humanMembers = channel.members.filter(m => !m.user.bot);
    if (humanMembers.size === 0) {
      // Bot disconnecten wenn keiner mehr da ist
      const connection = getVoiceConnection(guildId);
      if (connection) connection.destroy();
    }
  }

  /**
   * Alle online Supporter im Server finden (Status: online, idle oder dnd).
   * Ein Mitglied gilt als Supporter wenn es MINDESTENS EINE der Support-Rollen hat.
   */
  private async getOnlineSupporters(guild: import('discord.js').Guild): Promise<GuildMember[]> {
    const supporters: GuildMember[] = [];

    try {
      // Alle Mitglieder mit Presence laden
      const members = await guild.members.fetch({ withPresences: true });

      members.forEach(m => {
        if (m.user.bot) return;
        // Prüfen ob mindestens EINE der Support-Rollen vorhanden ist
        const hasRole = SUPPORT_ROLES.some(roleId => m.roles.cache.has(roleId));
        if (!hasRole) return;
        // Nur explizit online/idle/dnd zählt als erreichbar
        const status = m.presence?.status;
        if (status === 'online' || status === 'idle' || status === 'dnd') {
          supporters.push(m);
        }
      });
    } catch (err) {
      console.error('Fehler beim Laden der Supporter:', err);
    }

    return supporters;
  }

  /**
   * Benachrichtigung in den Support-Textkanal senden (nur wenn Supporter online).
   */
  private async sendNotification(
    member: GuildMember,
    notifyChannelId: string | null,
    onlineSupporters: GuildMember[]
  ): Promise<void> {
    if (!notifyChannelId) return;

    const channel = await this.client.channels.fetch(notifyChannelId).catch(() => null) as TextChannel | null;
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(config.colors.info as ColorResolvable)
      .setAuthor({ name: '🎧 Support-Warteraum' })
      .setTitle('📞 Neue Support-Anfrage')
      .setDescription(
        `${member} wartet im Support-Warteraum.\n\n` +
        `**Online Supporter (${onlineSupporters.length}):**\n` +
        onlineSupporters.map(s => `> ${s} (${s.presence?.status ?? 'online'})`).join('\n')
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
      .setFooter({ text: `Deutscher RP Server • Support` })
      .setTimestamp();

    // Nur die online Supporter direkt pingen (nicht die Rollen)
    const pings = onlineSupporters.map(s => `${s}`).join(' ');

    await channel.send({
      content: `${pings} — Jemand wartet im Support!`,
      embeds: [embed],
    });
  }

  /**
   * Bot joint den Voice-Kanal, spricht per TTS und spielt danach Wartemusik.
   */
  private async speakInChannel(voiceChannel: VoiceChannel, text: string, guildId: string): Promise<void> {
    try {
      // Audio-URL von Google TTS holen (deutsch)
      const ttsUrl = googleTTS.getAudioUrl(text, {
        lang: 'de',
        slow: false,
        host: 'https://translate.google.com',
      });

      // Voice-Connection aufbauen (oder bestehende nutzen)
      let connection = getVoiceConnection(guildId);
      if (!connection) {
        connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guildId,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });
      }

      // Warten bis verbunden
      await entersState(connection, VoiceConnectionStatus.Ready, 10_000);

      // Player erstellen
      const player = createAudioPlayer();
      connection.subscribe(player);

      // Erst TTS abspielen
      const ttsResource = createAudioResource(ttsUrl);
      player.play(ttsResource);

      // Nach TTS → Wartemusik starten
      player.once(AudioPlayerStatus.Idle, () => {
        // Kurze Pause, dann Musik
        setTimeout(() => {
          const channel = this.client.channels.cache.get(voiceChannel.id) as VoiceChannel | undefined;
          const humanMembers = channel?.members.filter(m => !m.user.bot).size ?? 0;
          if (humanMembers === 0) {
            connection?.destroy();
            return;
          }
          this.playWaitingMusic(player, guildId, voiceChannel.id);
        }, 1500);
      });

      player.on('error', (err) => {
        console.error('Support-TTS Audio-Fehler:', err);
        // Bei TTS-Fehler trotzdem Musik versuchen
        setTimeout(() => this.playWaitingMusic(player, guildId, voiceChannel.id), 1000);
      });
    } catch (err) {
      console.error('Support-TTS Fehler:', err);
      const conn = getVoiceConnection(guildId);
      if (conn) conn.destroy();
    }
  }

  /**
   * Spielt Lofi-Wartemusik in Schleife, bis der Kanal leer ist.
   */
  private playWaitingMusic(player: ReturnType<typeof createAudioPlayer>, guildId: string, channelId: string): void {
    // Lofi/Chill Radio-Stream (öffentlich, stabil, endlos)
    const MUSIC_URL = 'https://streams.ilovemusic.de/iloveradio17.mp3'; // Lofi Hip Hop

    try {
      const resource = createAudioResource(MUSIC_URL);
      player.play(resource);

      // Wenn der Stream unerwartet endet → neu starten (solange User da sind)
      player.once(AudioPlayerStatus.Idle, () => {
        const channel = this.client.channels.cache.get(channelId) as VoiceChannel | undefined;
        const humanMembers = channel?.members.filter(m => !m.user.bot).size ?? 0;
        if (humanMembers > 0) {
          // Stream neu starten
          setTimeout(() => this.playWaitingMusic(player, guildId, channelId), 2000);
        } else {
          const conn = getVoiceConnection(guildId);
          if (conn) conn.destroy();
        }
      });

      player.once('error', (err) => {
        console.error('Wartemusik-Fehler:', err);
        // Nach Fehler nochmal versuchen
        setTimeout(() => {
          const channel = this.client.channels.cache.get(channelId) as VoiceChannel | undefined;
          const humanMembers = channel?.members.filter(m => !m.user.bot).size ?? 0;
          if (humanMembers > 0) {
            this.playWaitingMusic(player, guildId, channelId);
          } else {
            const conn = getVoiceConnection(guildId);
            if (conn) conn.destroy();
          }
        }, 5000);
      });
    } catch (err) {
      console.error('Wartemusik konnte nicht gestartet werden:', err);
    }
  }
}
