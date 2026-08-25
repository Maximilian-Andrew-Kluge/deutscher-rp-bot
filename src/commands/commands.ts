import {
  CommandInteraction, SlashCommandBuilder, EmbedBuilder,
  ColorResolvable, GuildMember
} from 'discord.js';
import { config } from '../config/config';
import { hasAdminPermission } from '../utils/permissions';
import { createErrorEmbed } from '../utils/embeds';

export const data = new SlashCommandBuilder()
  .setName('commands')
  .setDescription('Postet eine Übersicht aller Befehle als Embed in diesen Kanal');

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;

  // Nur Admins dürfen die öffentliche Übersicht posten
  if (!hasAdminPermission(member)) {
    await interaction.reply({
      embeds: [createErrorEmbed('Keine Berechtigung', 'Nur Administratoren können die Befehlsübersicht posten.')],
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(config.colors.server as ColorResolvable)
    .setTitle('📖 Befehlsübersicht | Deutscher RP Server')
    .setDescription('Hier findest du alle verfügbaren Bot-Befehle des Servers.')
    .addFields(
      {
        name: '🛡️ Administration',
        value: [
          '`/admin` — Öffnet das Admin-Menü (Warn, Kick, Ban, Chat leeren, Server-Info)',
          '`/help` — Zeigt dir deine verfügbaren Befehle (nur für dich sichtbar)',
        ].join('\n'),
        inline: false,
      },
      {
        name: '⚖️ Justiz',
        value: [
          '`/verfahren panel` — Erstellt das Verfahrens-Panel mit ➕ Button',
          '`/embed erstellen` — Erstellt ein Embed in einem Kanal',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🎭 Rollen',
        value: [
          '`/rollen-panel erstellen` — Rollen-Konfigurationspanel',
          '`/rollenmenu erstellen` — Selbstzuweisungs-Menü für Mitglieder',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🎙️ Voice',
        value: [
          '`/voice-setup` — Voice-System einrichten',
          '`/voice-config` — Voice-Konfiguration verwalten',
          '**TempVoice:** Betritt den Erstell-Kanal → dein eigener Kanal wird erstellt mit Steuerungs-Interface (umbenennen, sperren, Benutzer verwalten).',
        ].join('\n'),
        inline: false,
      },
      {
        name: '⚙️ Setup & Konfiguration',
        value: [
          '`/setup kanale` — Bot-Kanäle konfigurieren',
          '`/setup voice` — Voice-System einrichten',
          '`/setup rolle` — Rollen zuweisen',
          '`/setup info` — Aktuelle Konfiguration anzeigen',
          '`/config` — Bot-Einstellungen & Statistiken',
        ].join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: 'Deutscher RP Server | Bot' })
    .setTimestamp();

  // Öffentlich in den Kanal posten
  await interaction.reply({ embeds: [embed] });
}

export default { data, execute };
