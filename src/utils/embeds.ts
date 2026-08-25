import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { config } from '../config/config';

export interface VerfahrenData {
  aktenzeichen: string;
  verfahrensart: string;
  status: string;
  gesperrt?: number;
  beschuldigter?: string;
  roblox_name?: string;
  roblox_id?: string;
  geschaedigter?: string;
  zeugen?: string;
  ermittler?: string;
  richter?: string;
  staatsanwalt?: string;
  anwalt?: string;
  vorwurf?: string;
  tatzeit?: string;
  tatort?: string;
  sachverhalt?: string;
  zusatzinfo?: string;
  erstellt_von: string;
  erstellt_am: string;
}

export interface NotizData {
  id: number;
  notiz: string;
  erstellt_von: string;
  erstellt_von_id?: string;
  erstellt_am: string;
}

export function getStatusEmoji(status: string): string {
  const map: Record<string, string> = {
    'offen': '🟡',
    'ermittlung': '🟠',
    'strafverfahren': '🔴',
    'gerichtsverfahren': '⚖️',
    'abgeschlossen': '🟢',
  };
  return map[status.toLowerCase()] || '🟡';
}

export function getStatusText(status: string): string {
  const map: Record<string, string> = {
    'offen': 'Offen',
    'ermittlung': 'Ermittlung',
    'strafverfahren': 'Strafverfahren',
    'gerichtsverfahren': 'Gerichtsverfahren',
    'abgeschlossen': 'Abgeschlossen',
  };
  return map[status.toLowerCase()] || 'Offen';
}

export function createVerfahrenEmbed(data: VerfahrenData, notizen?: NotizData[]): EmbedBuilder {
  const statusEmoji = getStatusEmoji(data.status);
  const statusText = getStatusText(data.status);
  const gesperrt = data.gesperrt === 1;

  const embed = new EmbedBuilder()
    .setColor(config.colors.justiz as ColorResolvable)
    .setTitle(`⚖️ Verfahrensakte | ${data.aktenzeichen}`)
    .setDescription(
      `**${statusEmoji} Status:** ${statusText}${gesperrt ? '  🔒 **Gesperrt**' : ''}`
    )
    .addFields(
      { name: '📋 Aktenzeichen', value: data.aktenzeichen, inline: true },
      { name: '⚖️ Verfahrensart', value: data.verfahrensart, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
    );

  if (data.beschuldigter) {
    embed.addFields({ name: '👤 Beschuldigter / Antragsteller', value: data.beschuldigter, inline: true });
  }
  if (data.roblox_name) {
    embed.addFields({ name: '🎮 Roblox-Name', value: data.roblox_name, inline: true });
  }
  if (data.roblox_id) {
    embed.addFields({ name: '🆔 ID', value: data.roblox_id, inline: true });
  }
  if (data.geschaedigter) {
    embed.addFields({ name: '🧑‍⚖️ Geschädigter / Gegenpartei', value: data.geschaedigter, inline: false });
  }
  if (data.zeugen) {
    embed.addFields({ name: '👁️ Zeugen', value: data.zeugen, inline: false });
  }

  embed.addFields({ name: '\u200B', value: '**👨‍⚖️ Zuständige Personen**', inline: false });

  if (data.richter) embed.addFields({ name: '⚖️ Richter', value: data.richter, inline: true });
  if (data.staatsanwalt) embed.addFields({ name: '👨‍💼 Staatsanwalt', value: data.staatsanwalt, inline: true });
  if (data.anwalt) embed.addFields({ name: '🏛️ Anwalt', value: data.anwalt, inline: true });
  if (data.ermittler) embed.addFields({ name: '🔍 Ermittler', value: data.ermittler, inline: false });

  embed.addFields({ name: '\u200B', value: '**📍 Tatvorwurf**', inline: false });

  if (data.vorwurf) embed.addFields({ name: '⚠️ Vorwurf / Antrag', value: data.vorwurf, inline: false });
  if (data.tatzeit) embed.addFields({ name: '🕐 Tatzeit / Zeitraum', value: data.tatzeit, inline: true });
  if (data.tatort) embed.addFields({ name: '📍 Tatort', value: data.tatort, inline: true });
  if (data.sachverhalt) {
    const sv = data.sachverhalt.length > 1020 ? data.sachverhalt.substring(0, 1020) + '…' : data.sachverhalt;
    embed.addFields({ name: '📝 Sachverhalt', value: sv, inline: false });
  }
  if (data.zusatzinfo) {
    embed.addFields({ name: '📌 Zusätzliche Informationen', value: data.zusatzinfo, inline: false });
  }

  // Notizen mit Autor + Datum
  if (notizen && notizen.length > 0) {
    const notizText = notizen.map((n, i) => {
      const datum = n.erstellt_am ? ` — <t:${Math.floor(new Date(n.erstellt_am).getTime() / 1000)}:d>` : '';
      return `**${i + 1}.** ${n.notiz}\n　└ *${n.erstellt_von}${datum}*`;
    }).join('\n').substring(0, 1020);

    embed.addFields({ name: `📒 Notizen (${notizen.length})`, value: notizText, inline: false });
  }

  embed
    .setFooter({ text: `Deutscher RP Server | Erstellt von ${data.erstellt_von}` })
    .setTimestamp(new Date(data.erstellt_am));

  return embed;
}

export function createErrorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(config.colors.error as ColorResolvable)
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setFooter({ text: 'Deutscher RP Server' })
    .setTimestamp();
}

export function createSuccessEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(config.colors.success as ColorResolvable)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setFooter({ text: 'Deutscher RP Server' })
    .setTimestamp();
}

export function createInfoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(config.colors.info as ColorResolvable)
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description)
    .setFooter({ text: 'Deutscher RP Server' })
    .setTimestamp();
}

export function createWarningEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(config.colors.warning as ColorResolvable)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setFooter({ text: 'Deutscher RP Server' })
    .setTimestamp();
}
