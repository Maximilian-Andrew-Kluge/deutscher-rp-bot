import {
  Client, ForumChannel, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ThreadChannel, ColorResolvable,
  ChannelType
} from 'discord.js';
import { getDatabase } from '../database/database';
import { generateAktenzeichen } from '../utils/aktenzeichen';
import { createVerfahrenEmbed, getStatusEmoji, getStatusText, NotizData } from '../utils/embeds';
import { LogService } from './logService';
import { config } from '../config/config';

interface ServerSettings {
  verfahren_channel_id: string | null;
  akten_channel_id: string | null;
}

export interface VerfahrenRow {
  id: number;
  aktenzeichen: string;
  forum_post_id: string;
  forum_channel_id: string;
  verfahrensart: string;
  status: string;
  gesperrt: number;
  beschuldigter: string;
  roblox_name: string;
  roblox_id: string;
  fraktion?: string;
  geburtsdatum?: string;
  zustaendiges_gericht?: string;
  geschaedigter: string;
  zeugen: string;
  ermittler: string;
  weitere_beteiligte?: string;
  richter: string;
  staatsanwalt: string;
  anwalt: string;
  vorwurf: string;
  tatzeit: string;
  tatort: string;
  sachverhalt: string;
  beweise?: string;
  zusatzinfo: string;
  erstellt_von: string;
  erstellt_am: string;
  // Abschluss-Felder
  urteil?: string;
  strafe?: string;
  abgeschlossen_am?: string;
  abgeschlossen_von?: string;
}

export interface VerfahrenCreateData {
  guildId: string;
  verfahrensart: string;
  beschuldigter: string;
  robloxName: string;
  robloxId: string;
  fraktion?: string;
  zustaendigesGericht?: string;
  geschaedigter: string;
  zeugen: string;
  ermittler: string;
  richter: string;
  staatsanwalt: string;
  anwalt: string;
  vorwurf: string;
  tatzeit: string;
  tatort: string;
  sachverhalt: string;
  beweise?: string;
  weitereBeeteiligte?: string;
  zusatzinfo: string;
  erstelltVon: string;
}

export class VerfahrenService {
  private client: Client;
  private logService: LogService;

  constructor(client: Client) {
    this.client = client;
    this.logService = new LogService(client);
  }

  // ── Verfahren erstellen ─────────────────────────────────────────────────────
  async createVerfahren(data: VerfahrenCreateData): Promise<string> {
    const db = getDatabase();
    const aktenzeichen = generateAktenzeichen(data.guildId, config.prefixes.verfahren);

    const settings = db.prepare(
      'SELECT verfahren_channel_id FROM server_settings WHERE guild_id = ?'
    ).get(data.guildId) as ServerSettings | undefined;

    if (!settings?.verfahren_channel_id) {
      throw new Error('Verfahrens-Kanal ist nicht konfiguriert. Bitte führe `/setup kanale` aus.');
    }

    // In DB speichern
    const result = db.prepare(`
      INSERT INTO verfahren (
        guild_id, aktenzeichen, verfahrensart, status, gesperrt,
        beschuldigter, roblox_name, roblox_id, fraktion,
        geschaedigter, zeugen, ermittler, richter, staatsanwalt, anwalt,
        vorwurf, tatzeit, tatort, sachverhalt, beweise,
        zustaendiges_gericht, weitere_beteiligte, zusatzinfo, erstellt_von
      ) VALUES (?, ?, ?, 'offen', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.guildId, aktenzeichen, data.verfahrensart,
      data.beschuldigter, data.robloxName, data.robloxId, data.fraktion ?? null,
      data.geschaedigter, data.zeugen, data.ermittler,
      data.richter, data.staatsanwalt, data.anwalt,
      data.vorwurf, data.tatzeit, data.tatort, data.sachverhalt,
      data.beweise ?? null, data.zustaendigesGericht ?? null,
      data.weitereBeeteiligte ?? null, data.zusatzinfo,
      data.erstelltVon
    );

    const verfahrenId = result.lastInsertRowid as number;

    // Forum-Post erstellen
    try {
      const channel = await this.client.channels.fetch(settings.verfahren_channel_id) as ForumChannel;
      if (!channel || channel.type !== ChannelType.GuildForum) {
        throw new Error('Verfahrens-Kanal ist kein Forum-Kanal.');
      }

      const verfahrenData = db.prepare('SELECT * FROM verfahren WHERE id = ?').get(verfahrenId) as unknown as VerfahrenRow;
      const notizen = this.getNotizenFull(verfahrenId);
      const embed = createVerfahrenEmbed(verfahrenData, notizen);
      const buttons = this.createVerfahrenButtons(false);

      const tag = channel.availableTags.find(t => t.name === '🟡 Offen');
      const tagIds = tag ? [tag.id] : [];

      const thread = await channel.threads.create({
        name: `📁 ${aktenzeichen} | ${data.beschuldigter || 'Unbekannt'}`,
        message: { embeds: [embed], components: [buttons] },
        appliedTags: tagIds,
      });

      db.prepare('UPDATE verfahren SET forum_post_id = ?, forum_channel_id = ? WHERE id = ?')
        .run(thread.id, settings.verfahren_channel_id, verfahrenId);

      await this.logService.log(
        data.guildId, 'Verfahren erstellt', data.erstelltVon,
        `Aktenzeichen: ${aktenzeichen}, Art: ${data.verfahrensart}`
      );
    } catch (err) {
      console.error('Fehler beim Erstellen des Forum-Posts:', err);
    }

    return aktenzeichen;
  }

  // ── Status aktualisieren ────────────────────────────────────────────────────
  async updateStatus(guildId: string, aktenzeichen: string, status: string, userId: string): Promise<void> {
    const db = getDatabase();

    db.prepare(`
      UPDATE verfahren SET status = ?, aktualisiert_am = datetime('now')
      WHERE guild_id = ? AND aktenzeichen = ?
    `).run(status, guildId, aktenzeichen);

    const verfahren = db.prepare(
      'SELECT * FROM verfahren WHERE aktenzeichen = ? AND guild_id = ?'
    ).get(aktenzeichen, guildId) as unknown as VerfahrenRow | undefined;
    if (!verfahren) return;

    const notizen = this.getNotizenFull(verfahren.id);
    await this.updateForumPost(verfahren, notizen);

    // Forum-Tag setzen
    if (verfahren.forum_post_id && verfahren.forum_channel_id) {
      try {
        const channel = await this.client.channels.fetch(verfahren.forum_channel_id) as ForumChannel;
        if (channel?.type === ChannelType.GuildForum) {
          const tagName = `${getStatusEmoji(status)} ${getStatusText(status)}`;
          const tag = channel.availableTags.find(t => t.name === tagName);
          if (tag) {
            const thread = await this.client.channels.fetch(verfahren.forum_post_id) as ThreadChannel;
            if (thread) await thread.setAppliedTags([tag.id]);
          }
        }
      } catch (err) {
        console.error('Fehler beim Tag-Update:', err);
      }
    }

    await this.logService.log(guildId, 'Status aktualisiert', userId, `${aktenzeichen}: ${status}`);
  }

  // ── Verfahren bearbeiten ────────────────────────────────────────────────────
  async updateVerfahren(verfahrenId: number, updates: Partial<VerfahrenRow>, userId: string): Promise<void> {
    const db = getDatabase();

    const fields = [
      'verfahrensart', 'beschuldigter', 'roblox_name', 'roblox_id',
      'geschaedigter', 'zeugen', 'ermittler', 'richter',
      'staatsanwalt', 'anwalt', 'vorwurf', 'tatzeit', 'tatort',
      'sachverhalt', 'zusatzinfo',
    ] as const;

    const setParts: string[] = [`aktualisiert_am = datetime('now')`];
    const values: unknown[] = [];

    for (const field of fields) {
      if (updates[field] !== undefined) {
        setParts.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }

    values.push(verfahrenId);
    db.prepare(`UPDATE verfahren SET ${setParts.join(', ')} WHERE id = ?`).run(...values);

    const verfahren = db.prepare('SELECT * FROM verfahren WHERE id = ?').get(verfahrenId) as unknown as VerfahrenRow | undefined;
    if (verfahren) {
      const notizen = this.getNotizenFull(verfahrenId);
      await this.updateForumPost(verfahren, notizen);
      await this.logService.log(verfahren.forum_channel_id || '', 'Verfahren bearbeitet', userId, `ID: ${verfahrenId}`);
    }
  }

  // ── Notiz hinzufügen ────────────────────────────────────────────────────────
  async addNotiz(verfahrenId: number, notiz: string, userId: string, userName: string): Promise<void> {
    const db = getDatabase();
    db.prepare(
      'INSERT INTO verfahren_notizen (verfahren_id, notiz, erstellt_von, erstellt_von_id) VALUES (?, ?, ?, ?)'
    ).run(verfahrenId, notiz, userName, userId);

    const verfahren = db.prepare('SELECT * FROM verfahren WHERE id = ?').get(verfahrenId) as unknown as VerfahrenRow | undefined;
    if (verfahren) {
      const notizen = this.getNotizenFull(verfahrenId);
      await this.updateForumPost(verfahren, notizen);
    }
  }

  // ── Notiz löschen ───────────────────────────────────────────────────────────
  async deleteNotiz(notizId: number, userId: string): Promise<void> {
    const db = getDatabase();
    const notiz = db.prepare('SELECT * FROM verfahren_notizen WHERE id = ?').get(notizId) as { verfahren_id: number } | undefined;
    if (!notiz) return;

    db.prepare('DELETE FROM verfahren_notizen WHERE id = ?').run(notizId);

    const verfahren = db.prepare('SELECT * FROM verfahren WHERE id = ?').get(notiz.verfahren_id) as unknown as VerfahrenRow | undefined;
    if (verfahren) {
      const notizen = this.getNotizenFull(notiz.verfahren_id);
      await this.updateForumPost(verfahren, notizen);
    }
  }

  // ── Sperren / Entsperren ────────────────────────────────────────────────────
  async setGesperrt(guildId: string, aktenzeichen: string, gesperrt: boolean, userId: string): Promise<void> {
    const db = getDatabase();

    db.prepare(`
      UPDATE verfahren SET gesperrt = ?, aktualisiert_am = datetime('now')
      WHERE guild_id = ? AND aktenzeichen = ?
    `).run(gesperrt ? 1 : 0, guildId, aktenzeichen);

    const verfahren = db.prepare(
      'SELECT * FROM verfahren WHERE aktenzeichen = ? AND guild_id = ?'
    ).get(aktenzeichen, guildId) as unknown as VerfahrenRow | undefined;
    if (!verfahren) return;

    // Forum-Thread sperren/entsperren
    if (verfahren.forum_post_id) {
      try {
        const thread = await this.client.channels.fetch(verfahren.forum_post_id) as ThreadChannel;
        if (thread) await thread.setLocked(gesperrt);
      } catch (err) {
        console.error('Fehler beim Sperren des Threads:', err);
      }
    }

    // Embed aktualisieren (zeigt 🔒 an)
    const notizen = this.getNotizenFull(verfahren.id);
    await this.updateForumPost(verfahren, notizen);

    await this.logService.log(
      guildId,
      gesperrt ? 'Verfahren gesperrt' : 'Verfahren entsperrt',
      userId,
      `Aktenzeichen: ${aktenzeichen}`
    );
  }

  // ── Verfahren abschließen ───────────────────────────────────────────────────
  async abschliessen(guildId: string, aktenzeichen: string, userId: string): Promise<void> {
    const db = getDatabase();

    const verfahren = db.prepare(
      'SELECT * FROM verfahren WHERE aktenzeichen = ? AND guild_id = ?'
    ).get(aktenzeichen, guildId) as unknown as VerfahrenRow | undefined;
    if (!verfahren) throw new Error('Verfahren nicht gefunden.');

    if (verfahren.status === 'abgeschlossen') throw new Error('Dieses Verfahren ist bereits abgeschlossen.');

    const settings = db.prepare(
      'SELECT akten_channel_id FROM server_settings WHERE guild_id = ?'
    ).get(guildId) as { akten_channel_id: string | null } | undefined;
    if (!settings?.akten_channel_id) throw new Error('Akten-Kanal nicht konfiguriert. Bitte `/setup kanale` ausführen.');

    // Status in DB setzen
    db.prepare(`
      UPDATE verfahren SET status = 'abgeschlossen', archiviert = 1, gesperrt = 1,
        abgeschlossen_am = datetime('now'), abgeschlossen_von = ?,
        aktualisiert_am = datetime('now')
      WHERE id = ?
    `).run(userId, verfahren.id);

    const notizen = this.getNotizenFull(verfahren.id);

    let aktenThreadUrl = '';

    // ── Akten-Post erstellen ──
    try {
      const aktenChannel = await this.client.channels.fetch(settings.akten_channel_id) as ForumChannel;
      if (!aktenChannel || aktenChannel.type !== ChannelType.GuildForum) {
        throw new Error('Akten-Kanal ist kein Forum-Kanal.');
      }

      const aktenEmbed = new EmbedBuilder()
        .setColor(config.colors.success as ColorResolvable)
        .setTitle(`📁 Akte | ${verfahren.aktenzeichen}`)
        .setDescription('✅ Dieses Verfahren wurde abgeschlossen und archiviert.')
        .addFields(
          { name: '📋 Aktenzeichen', value: verfahren.aktenzeichen, inline: true },
          { name: '⚖️ Verfahrensart', value: verfahren.verfahrensart, inline: true },
          { name: '🟢 Status', value: 'Abgeschlossen', inline: true },
        );

      if (verfahren.beschuldigter) aktenEmbed.addFields({ name: '👤 Beschuldigter', value: verfahren.beschuldigter, inline: true });
      if (verfahren.roblox_name) aktenEmbed.addFields({ name: '🎮 Roblox-Name', value: verfahren.roblox_name, inline: true });
      if (verfahren.roblox_id) aktenEmbed.addFields({ name: '🆔 ID', value: verfahren.roblox_id, inline: true });
      if (verfahren.geschaedigter) aktenEmbed.addFields({ name: '🧑‍⚖️ Geschädigter', value: verfahren.geschaedigter, inline: false });
      if (verfahren.zeugen) aktenEmbed.addFields({ name: '👁️ Zeugen', value: verfahren.zeugen, inline: false });
      if (verfahren.ermittler) aktenEmbed.addFields({ name: '🔍 Ermittler', value: verfahren.ermittler, inline: false });
      if (verfahren.richter) aktenEmbed.addFields({ name: '⚖️ Richter', value: verfahren.richter, inline: true });
      if (verfahren.staatsanwalt) aktenEmbed.addFields({ name: '👨‍💼 Staatsanwalt', value: verfahren.staatsanwalt, inline: true });
      if (verfahren.anwalt) aktenEmbed.addFields({ name: '🏛️ Anwalt', value: verfahren.anwalt, inline: true });
      if (verfahren.vorwurf) aktenEmbed.addFields({ name: '⚠️ Vorwurf', value: verfahren.vorwurf, inline: false });
      if (verfahren.tatzeit) aktenEmbed.addFields({ name: '🕐 Tatzeit', value: verfahren.tatzeit, inline: true });
      if (verfahren.tatort) aktenEmbed.addFields({ name: '📍 Tatort', value: verfahren.tatort, inline: true });
      if (verfahren.sachverhalt) aktenEmbed.addFields({ name: '📝 Sachverhalt', value: verfahren.sachverhalt.substring(0, 1020), inline: false });
      if (verfahren.zusatzinfo) aktenEmbed.addFields({ name: '📌 Zusatzinfos', value: verfahren.zusatzinfo, inline: false });

      if (notizen.length > 0) {
        const notizText = notizen.map((n, i) =>
          `**${i + 1}.** ${n.notiz}\n　└ *${n.erstellt_von}, <t:${Math.floor(new Date(n.erstellt_am).getTime() / 1000)}:d>*`
        ).join('\n').substring(0, 1020);
        aktenEmbed.addFields({ name: `📒 Notizen (${notizen.length})`, value: notizText, inline: false });
      }

      aktenEmbed
        .addFields({ name: '🔒 Abgeschlossen durch', value: `<@${userId}>`, inline: true })
        .setFooter({ text: 'Deutscher RP Server | Archiv' })
        .setTimestamp();

      const abgeschlossenTag = aktenChannel.availableTags.find(t => t.name === '🟢 Abgeschlossen');
      const tagIds = abgeschlossenTag ? [abgeschlossenTag.id] : [];

      const aktenThread = await aktenChannel.threads.create({
        name: `📁 ${verfahren.aktenzeichen} | ${verfahren.beschuldigter || 'Unbekannt'}`,
        message: { embeds: [aktenEmbed] },
        appliedTags: tagIds,
      });

      aktenThreadUrl = aktenThread.url;

      // Akte in DB speichern
      db.prepare(`
        INSERT INTO akten (guild_id, aktenzeichen, verfahren_id, forum_post_id, forum_channel_id, status, erstellt_von)
        VALUES (?, ?, ?, ?, ?, 'abgeschlossen', ?)
      `).run(guildId, verfahren.aktenzeichen, verfahren.id, aktenThread.id, settings.akten_channel_id, userId);

    } catch (err) {
      console.error('Fehler beim Erstellen der Akte:', err);
      throw err;
    }

    // ── Ursprünglichen Verfahrens-Thread LÖSCHEN (nicht nur archivieren) ──
    if (verfahren.forum_post_id) {
      try {
        const origThread = await this.client.channels.fetch(verfahren.forum_post_id) as ThreadChannel;
        if (origThread) {
          // Kurzen Hinweis senden, dann löschen
          if (aktenThreadUrl) {
            await origThread.send({
              embeds: [new EmbedBuilder()
                .setColor(config.colors.success as ColorResolvable)
                .setTitle('✅ Verfahren abgeschlossen')
                .setDescription(`Dieses Verfahren wurde abgeschlossen.\n📁 **Akte:** ${aktenThreadUrl}`)
                .setTimestamp()
              ]
            });
          }
          // Thread löschen → verschwindet aus dem Verfahrens-Forum
          await origThread.delete('Verfahren abgeschlossen — in Akten übertragen');
        }
      } catch (err) {
        console.error('Fehler beim Löschen des Verfahrens-Threads:', err);
      }
    }

    await this.logService.log(guildId, 'Verfahren abgeschlossen', userId, `Aktenzeichen: ${aktenzeichen}`);
  }

  // ── Forum-Post aktualisieren ────────────────────────────────────────────────
  async updateForumPost(verfahren: VerfahrenRow, notizen: NotizData[]): Promise<void> {
    if (!verfahren.forum_post_id) return;

    try {
      const thread = await this.client.channels.fetch(verfahren.forum_post_id) as ThreadChannel;
      if (!thread) return;

      const embed = createVerfahrenEmbed(verfahren, notizen);
      const buttons = this.createVerfahrenButtons(verfahren.gesperrt === 1);

      const messages = await thread.messages.fetch({ limit: 5 });
      const botMessage = messages.find(m => m.author.id === this.client.user?.id);

      if (botMessage) {
        await botMessage.edit({ embeds: [embed], components: [buttons] });
      }
    } catch (err) {
      console.error('Fehler beim Aktualisieren des Forum-Posts:', err);
    }
  }

  // ── Buttons ─────────────────────────────────────────────────────────────────
  private createVerfahrenButtons(gesperrt: boolean): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('verfahren_bearbeiten')
          .setLabel('Bearbeiten')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('✏️')
          .setDisabled(gesperrt),
        new ButtonBuilder()
          .setCustomId('verfahren_notiz')
          .setLabel('Notiz')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📝')
          .setDisabled(gesperrt),
        new ButtonBuilder()
          .setCustomId('verfahren_status')
          .setLabel('Status')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚖️'),
        new ButtonBuilder()
          .setCustomId('verfahren_abschliessen')
          .setLabel('Abschließen')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        gesperrt
          ? new ButtonBuilder()
              .setCustomId('verfahren_entsperren')
              .setLabel('Entsperren')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('🔓')
          : new ButtonBuilder()
              .setCustomId('verfahren_sperren')
              .setLabel('Sperren')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🔒'),
      );
  }

  // ── Getter ───────────────────────────────────────────────────────────────────
  getVerfahrenByAktenzeichen(guildId: string, aktenzeichen: string): VerfahrenRow | undefined {
    return getDatabase().prepare(
      'SELECT * FROM verfahren WHERE guild_id = ? AND aktenzeichen = ?'
    ).get(guildId, aktenzeichen) as unknown as VerfahrenRow | undefined;
  }

  getVerfahrenById(id: number): VerfahrenRow | undefined {
    return getDatabase().prepare('SELECT * FROM verfahren WHERE id = ?').get(id) as unknown as VerfahrenRow | undefined;
  }

  getVerfahrenByThreadId(threadId: string): VerfahrenRow | undefined {
    return getDatabase().prepare('SELECT * FROM verfahren WHERE forum_post_id = ?').get(threadId) as unknown as VerfahrenRow | undefined;
  }

  getNotizenFull(verfahrenId: number): NotizData[] {
    return getDatabase().prepare(
      'SELECT id, notiz, erstellt_von, erstellt_von_id, erstellt_am FROM verfahren_notizen WHERE verfahren_id = ? ORDER BY id ASC'
    ).all(verfahrenId) as unknown as NotizData[];
  }

  // Rückwärtskompatibel
  getNotizen(verfahrenId: number): string[] {
    return this.getNotizenFull(verfahrenId).map(n => n.notiz);
  }
}
