import {
  Client, VoiceChannel, CategoryChannel, PermissionFlagsBits, ChannelType, GuildMember,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ColorResolvable,
} from 'discord.js';
import { getDatabase } from '../database/database';
import { LogService } from './logService';
import { config } from '../config/config';

/** Baut das TempVoice-Steuerungs-Interface (Embed + Buttons) */
export function buildTempVoiceInterface(): { embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] } {
  const embed = new EmbedBuilder()
    .setColor(config.colors.server as ColorResolvable)
    .setTitle('🎙️ TempVoice Interface')
    .setDescription(
      'Dieses **Interface** kann verwendet werden, um deinen temporären Kanal zu bearbeiten.\n\n' +
      'Nur der **Besitzer** des Kanals (oder ein Admin) kann diese Buttons nutzen.\n\n' +
      '**Verfügbare Aktionen:**\n' +
      '✏️ **Umbenennen** — Kanalname ändern\n' +
      '👥 **Benutzerlimit** — Max. Teilnehmerzahl\n' +
      '🔒 **Privatsphäre** — Kanal sperren/entsperren\n' +
      '➕ **Hinzufügen** — Benutzer Zugriff geben\n' +
      '➖ **Entfernen** — Zugriff entziehen\n' +
      '🔇 **Trennen** — Benutzer aus dem Kanal werfen\n' +
      '🚫 **Blockieren** — Benutzer sperren\n' +
      '✅ **Entblockieren** — Sperre aufheben'
    )
    .setFooter({ text: 'Deutscher RP Server | TempVoice' });

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('tempvoice_rename').setLabel('Umbenennen').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
    new ButtonBuilder().setCustomId('tempvoice_limit').setLabel('Benutzerlimit').setStyle(ButtonStyle.Secondary).setEmoji('👥'),
    new ButtonBuilder().setCustomId('tempvoice_privacy').setLabel('Privatsphäre').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
    new ButtonBuilder().setCustomId('tempvoice_add').setLabel('Hinzufügen').setStyle(ButtonStyle.Success).setEmoji('➕'),
    new ButtonBuilder().setCustomId('tempvoice_remove').setLabel('Entfernen').setStyle(ButtonStyle.Danger).setEmoji('➖'),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('tempvoice_disconnect').setLabel('Trennen').setStyle(ButtonStyle.Danger).setEmoji('🔇'),
    new ButtonBuilder().setCustomId('tempvoice_block').setLabel('Blockieren').setStyle(ButtonStyle.Danger).setEmoji('🚫'),
    new ButtonBuilder().setCustomId('tempvoice_unblock').setLabel('Entblockieren').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId('tempvoice_claim').setLabel('Übernehmen').setStyle(ButtonStyle.Secondary).setEmoji('👑'),
  );

  return { embed, components: [row1, row2] };
}

interface TempChannel {
  id: number;
  channel_id: string;
  owner_id: string;
  channel_name: string;
}

interface VoiceSettings {
  voice_create_channel_id: string | null;
  voice_category_id: string | null;
}

export class VoiceService {
  private client: Client;
  private logService: LogService;

  constructor(client: Client) {
    this.client = client;
    this.logService = new LogService(client);
  }

  async handleVoiceJoin(member: GuildMember, channelId: string): Promise<void> {
    const db = getDatabase();
    const settings = db.prepare('SELECT voice_create_channel_id, voice_category_id FROM server_settings WHERE guild_id = ?').get(member.guild.id) as VoiceSettings | undefined;

    if (!settings?.voice_create_channel_id || channelId !== settings.voice_create_channel_id) return;

    try {
      const category = settings.voice_category_id
        ? await this.client.channels.fetch(settings.voice_category_id) as CategoryChannel
        : null;

      const channelName = `🎭│ ${member.displayName}'s RP Channel`;

      const newChannel = await member.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: category?.id,
        permissionOverwrites: [
          {
            id: member.id,
            allow: [
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.MoveMembers,
              PermissionFlagsBits.MuteMembers,
              PermissionFlagsBits.DeafenMembers,
            ],
          },
        ],
      });

      // In DB speichern
      db.prepare('INSERT INTO temp_voice_channels (guild_id, channel_id, owner_id, channel_name) VALUES (?, ?, ?, ?)')
        .run(member.guild.id, newChannel.id, member.id, channelName);

      // Benutzer verschieben
      await member.voice.setChannel(newChannel);

      // TempVoice-Interface in den Voice-Kanal-Chat posten
      try {
        const { embed, components } = buildTempVoiceInterface();
        await newChannel.send({
          content: `${member} — willkommen in deinem Kanal!`,
          embeds: [embed],
          components,
        });
      } catch (interfaceErr) {
        console.warn('TempVoice-Interface konnte nicht gepostet werden:', interfaceErr);
      }

      await this.logService.log(member.guild.id, 'Temp. Voice-Kanal erstellt', member.id, `Kanal: ${channelName}`);
    } catch (err) {
      console.error('Fehler beim Erstellen des Voice-Kanals:', err);
    }
  }

  async handleVoiceLeave(guildId: string, channelId: string): Promise<void> {
    const db = getDatabase();
    const tempChannel = db.prepare('SELECT * FROM temp_voice_channels WHERE channel_id = ?').get(channelId) as TempChannel | undefined;

    if (!tempChannel) return;

    try {
      const channel = await this.client.channels.fetch(channelId) as VoiceChannel | null;
      if (!channel) {
        db.prepare('DELETE FROM temp_voice_channels WHERE channel_id = ?').run(channelId);
        return;
      }

      if (channel.members.size === 0) {
        await channel.delete('Temporärer Kanal leer');
        db.prepare('DELETE FROM temp_voice_channels WHERE channel_id = ?').run(channelId);
        await this.logService.log(guildId, 'Temp. Voice-Kanal gelöscht', tempChannel.owner_id, `Kanal: ${tempChannel.channel_name}`);
      }
    } catch (err) {
      console.error('Fehler beim Löschen des Voice-Kanals:', err);
    }
  }

  async cleanupOnStartup(): Promise<void> {
    const db = getDatabase();
    const channels = db.prepare('SELECT * FROM temp_voice_channels').all() as unknown as TempChannel[];

    for (const ch of channels) {
      try {
        const channel = await this.client.channels.fetch(ch.channel_id) as VoiceChannel | null;
        if (!channel || channel.members.size === 0) {
          if (channel) await channel.delete('Cleanup beim Start');
          db.prepare('DELETE FROM temp_voice_channels WHERE channel_id = ?').run(ch.channel_id);
        }
      } catch {
        db.prepare('DELETE FROM temp_voice_channels WHERE channel_id = ?').run(ch.channel_id);
      }
    }
    console.log('✅ Voice-Kanal Cleanup abgeschlossen.');
  }
}
