import {
  Client, EmbedBuilder, TextChannel, ColorResolvable, GuildMember,
  GuildChannel, Role, Message, GuildBan, PartialMessage,
} from 'discord.js';
import { getDatabase } from '../database/database';
import { config } from '../config/config';

/**
 * Automatisches Log-System: fängt Discord-Events ab und loggt sie
 * als schöne Embeds im konfigurierten Log-Kanal.
 */
export class AuditLogService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /** Registriert alle Event-Listener */
  registerEvents(): void {
    // Rollen-Änderungen
    this.client.on('guildMemberUpdate', (oldMember, newMember) => {
      this.handleRoleChange(oldMember as GuildMember, newMember as GuildMember);
    });

    // Kanal erstellt
    this.client.on('channelCreate', (channel) => {
      if ('guild' in channel && channel.guild) {
        this.handleChannelCreate(channel as GuildChannel);
      }
    });

    // Kanal gelöscht
    this.client.on('channelDelete', (channel) => {
      if ('guild' in channel && channel.guild) {
        this.handleChannelDelete(channel as GuildChannel);
      }
    });

    // Nachricht gelöscht
    this.client.on('messageDelete', (message) => {
      if (message.guild) {
        this.handleMessageDelete(message as Message | PartialMessage);
      }
    });

    // Ban
    this.client.on('guildBanAdd', (ban) => {
      this.handleBan(ban);
    });

    // Unban
    this.client.on('guildBanRemove', (ban) => {
      this.handleUnban(ban);
    });

    // Kick (via guildMemberRemove + Audit Log check)
    // Discord hat kein dediziertes Kick-Event, aber wir loggen Leaves separat nicht,
    // da Kicks bereits über das Admin-Panel/Mod-Logs erfasst werden.

    console.log('📋 Audit-Log-Service: Events registriert');
  }

  // ── Rollen-Änderung ─────────────────────────────────────────────────────────
  private async handleRoleChange(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    if (!oldMember.roles || !newMember.roles) return;

    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id) && r.name !== '@everyone');
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id) && r.name !== '@everyone');

    if (addedRoles.size === 0 && removedRoles.size === 0) return;

    const fields: { name: string; value: string; inline: boolean }[] = [
      { name: 'Mitglied', value: `${newMember} (${newMember.user.tag})`, inline: true },
    ];

    if (addedRoles.size > 0) {
      fields.push({ name: '➕ Hinzugefügt', value: addedRoles.map(r => r.toString()).join(', '), inline: false });
    }
    if (removedRoles.size > 0) {
      fields.push({ name: '➖ Entfernt', value: removedRoles.map(r => r.toString()).join(', '), inline: false });
    }

    await this.sendLog(newMember.guild.id, {
      color: config.colors.info,
      title: '🎭 Rollen geändert',
      fields,
    });
  }

  // ── Kanal erstellt ──────────────────────────────────────────────────────────
  private async handleChannelCreate(channel: GuildChannel): Promise<void> {
    const typeMap: Record<number, string> = { 0: 'Text', 2: 'Voice', 4: 'Kategorie', 5: 'Ankündigung', 13: 'Stage', 15: 'Forum' };
    await this.sendLog(channel.guild.id, {
      color: config.colors.success,
      title: '📁 Kanal erstellt',
      fields: [
        { name: 'Kanal', value: `${channel} (${channel.name})`, inline: true },
        { name: 'Typ', value: typeMap[channel.type] || `${channel.type}`, inline: true },
      ],
    });
  }

  // ── Kanal gelöscht ──────────────────────────────────────────────────────────
  private async handleChannelDelete(channel: GuildChannel): Promise<void> {
    await this.sendLog(channel.guild.id, {
      color: config.colors.error,
      title: '🗑️ Kanal gelöscht',
      fields: [
        { name: 'Kanal', value: `#${channel.name}`, inline: true },
        { name: 'ID', value: channel.id, inline: true },
      ],
    });
  }

  // ── Nachricht gelöscht ──────────────────────────────────────────────────────
  private async handleMessageDelete(message: Message | PartialMessage): Promise<void> {
    // Bot-Nachrichten und leere Nachrichten ignorieren
    if (message.author?.bot) return;
    if (!message.content && !message.attachments?.size) return;

    const fields: { name: string; value: string; inline: boolean }[] = [
      { name: 'Kanal', value: `<#${message.channelId}>`, inline: true },
    ];

    if (message.author) {
      fields.push({ name: 'Autor', value: `${message.author} (${message.author.tag})`, inline: true });
    }

    if (message.content) {
      fields.push({ name: 'Inhalt', value: message.content.substring(0, 1020) || '*Kein Text*', inline: false });
    }

    if (message.attachments && message.attachments.size > 0) {
      fields.push({ name: 'Anhänge', value: `${message.attachments.size} Datei(en)`, inline: true });
    }

    await this.sendLog(message.guildId!, {
      color: config.colors.warning,
      title: '🗑️ Nachricht gelöscht',
      fields,
    });
  }

  // ── Ban ─────────────────────────────────────────────────────────────────────
  private async handleBan(ban: GuildBan): Promise<void> {
    await this.sendLog(ban.guild.id, {
      color: config.colors.error,
      title: '🔨 Mitglied gebannt',
      fields: [
        { name: 'Benutzer', value: `${ban.user} (${ban.user.tag})`, inline: true },
        { name: 'Grund', value: ban.reason || 'Kein Grund angegeben', inline: false },
      ],
    });
  }

  // ── Unban ───────────────────────────────────────────────────────────────────
  private async handleUnban(ban: GuildBan): Promise<void> {
    await this.sendLog(ban.guild.id, {
      color: config.colors.success,
      title: '✅ Mitglied entbannt',
      fields: [
        { name: 'Benutzer', value: `${ban.user} (${ban.user.tag})`, inline: true },
      ],
    });
  }

  // ── Log-Embed senden ────────────────────────────────────────────────────────
  private async sendLog(guildId: string, opts: {
    color: number;
    title: string;
    fields: { name: string; value: string; inline: boolean }[];
  }): Promise<void> {
    try {
      const db = getDatabase();
      const settings = db.prepare('SELECT log_channel_id FROM server_settings WHERE guild_id = ?')
        .get(guildId) as { log_channel_id: string | null } | undefined;

      if (!settings?.log_channel_id) return;

      const channel = await this.client.channels.fetch(settings.log_channel_id).catch(() => null) as TextChannel | null;
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(opts.color as ColorResolvable)
        .setTitle(opts.title)
        .addFields(opts.fields)
        .setFooter({ text: 'Audit-Log | Deutscher RP Server' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      // Stille Fehler — Logging darf den Bot nicht crashen
    }
  }
}
