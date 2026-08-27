import {
  Client, ChannelType, CategoryChannel, VoiceChannel, GuildMember,
} from 'discord.js';
import { getDatabase } from '../database/database';

const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 Minuten

interface CounterSettings {
  guild_id: string;
  counter_category_id: string | null;
  counter_members_id: string | null;
  counter_online_id: string | null;
  counter_boosts_id: string | null;
  counter_clock_id: string | null;
}

export class CounterService {
  private client: Client;
  private interval: NodeJS.Timeout | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  /** Startet die automatische Aktualisierung alle 5 Minuten */
  start(): void {
    // Sofort einmal updaten
    setTimeout(() => this.updateAll(), 5000);
    // Dann alle 5 Minuten
    this.interval = setInterval(() => this.updateAll(), UPDATE_INTERVAL);
    console.log('📊 Counter-Service gestartet (alle 5 Min.)');
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
  }

  /** Erstellt die Counter-Kanäle in einer Kategorie */
  async setup(guildId: string): Promise<string> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) throw new Error('Guild nicht gefunden.');

    const db = getDatabase();

    // Kategorie erstellen
    const category = await guild.channels.create({
      name: '📊 STATISTIKEN',
      type: ChannelType.GuildCategory,
      position: 0,
    });

    // Voice-Kanäle erstellen (gesperrt — niemand kann joinen)
    const denyConnect = [{ id: guild.roles.everyone.id, deny: ['Connect' as const] }];

    const now = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
    const clockChannel = await guild.channels.create({
      name: `🕐 ${now} Uhr`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: denyConnect,
    });

    const membersChannel = await guild.channels.create({
      name: `👥 Mitglieder: ${guild.memberCount}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: denyConnect,
    });

    const onlineCount = guild.members.cache.filter(m => !m.user.bot && m.presence?.status !== 'offline').size;
    const onlineChannel = await guild.channels.create({
      name: `🟢 Online: ${onlineCount}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: denyConnect,
    });

    const boostsChannel = await guild.channels.create({
      name: `💎 Boosts: ${guild.premiumSubscriptionCount ?? 0}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: denyConnect,
    });

    // In DB speichern
    db.prepare(`
      UPDATE server_settings SET
        counter_category_id = ?,
        counter_members_id = ?,
        counter_online_id = ?,
        counter_boosts_id = ?,
        counter_clock_id = ?
      WHERE guild_id = ?
    `).run(category.id, membersChannel.id, onlineChannel.id, boostsChannel.id, clockChannel.id, guildId);

    return category.id;
  }

  /** Aktualisiert alle Counter-Kanäle für alle Guilds */
  private async updateAll(): Promise<void> {
    const db = getDatabase();
    const rows = db.prepare(
      'SELECT guild_id, counter_category_id, counter_members_id, counter_online_id, counter_boosts_id, counter_clock_id FROM server_settings WHERE counter_category_id IS NOT NULL'
    ).all() as unknown as CounterSettings[];

    for (const row of rows) {
      try {
        await this.updateGuild(row);
      } catch (err) {
        console.error(`Counter-Update fehlgeschlagen für ${row.guild_id}:`, err);
      }
    }
  }

  /** Aktualisiert die Counter für eine Guild */
  private async updateGuild(settings: CounterSettings): Promise<void> {
    const guild = this.client.guilds.cache.get(settings.guild_id);
    if (!guild) return;

    // Mitglieder fetchen (für Online-Count)
    await guild.members.fetch({ withPresences: true }).catch(() => null);

    const memberCount = guild.memberCount;
    const onlineCount = guild.members.cache.filter(m => !m.user.bot && m.presence?.status && m.presence.status !== 'offline').size;
    const boostCount = guild.premiumSubscriptionCount ?? 0;
    const now = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

    // Kanäle umbenennen (mit Rate-Limit-Schutz)
    if (settings.counter_members_id) {
      await this.renameChannel(settings.counter_members_id, `👥 Mitglieder: ${memberCount}`);
    }
    if (settings.counter_online_id) {
      await this.renameChannel(settings.counter_online_id, `🟢 Online: ${onlineCount}`);
    }
    if (settings.counter_boosts_id) {
      await this.renameChannel(settings.counter_boosts_id, `💎 Boosts: ${boostCount}`);
    }
    if (settings.counter_clock_id) {
      await this.renameChannel(settings.counter_clock_id, `🕐 ${now} Uhr`);
    }
  }

  /** Benennt einen Kanal um (nur wenn sich der Name geändert hat) */
  private async renameChannel(channelId: string, newName: string): Promise<void> {
    try {
      const channel = this.client.channels.cache.get(channelId) as VoiceChannel | undefined;
      if (!channel) return;
      if (channel.name === newName) return; // Kein Update nötig
      await channel.setName(newName);
    } catch (err) {
      // Rate-Limit oder fehlende Berechtigung — ignorieren
    }
  }
}
