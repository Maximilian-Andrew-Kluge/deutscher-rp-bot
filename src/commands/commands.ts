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
          '`/admin menu` — Admin-Menü (nur für dich sichtbar)',
          '`/admin panel` — Permanentes Admin-Panel mit Buttons in den Kanal posten',
          '`/help` — Zeigt deine verfügbaren Befehle',
        ].join('\n'),
        inline: false,
      },
      {
        name: '⚖️ Justiz & Akten',
        value: [
          '`/verfahren panel` — Verfahrens-Panel mit ➕ Button erstellen',
          '**Verfahrens-Buttons:** Bearbeiten, Notiz, Status ändern, Abschließen, Sperren',
          '**PDFs:** Beim Abschluss werden automatisch Justizakte + Polizei-Verfahrensakte generiert',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📝 Embeds',
        value: [
          '`/embed erstellen` — Embed in einen Kanal senden (mit Vorlagen)',
          '`/embed bearbeiten` — Bereits erstellte Embeds nachträglich bearbeiten',
          '**Rechtsklick → Apps → Embed bearbeiten** — Jedes Bot-Embed per Kontextmenü bearbeiten',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🎭 Rollen',
        value: [
          '`/rollen-panel erstellen` — Rollen-Konfigurationspanel für Admins',
          '`/rollenmenu erstellen` — Selbstzuweisungs-Menü für Mitglieder',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🎙️ Voice',
        value: [
          '`/voice-setup` — Voice-System einrichten',
          '`/voice-config` — Voice-Konfiguration verwalten',
          '**TempVoice:** Betritt den Erstell-Kanal → eigener Kanal mit Interface (umbenennen, sperren, Benutzer verwalten)',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📱 TikTok Live',
        value: [
          '`/tiktok` — TikTok-Streamer zur Live-Überwachung hinzufügen/entfernen',
          'Bei Live-Start wird automatisch eine Benachrichtigung im Live-Kanal gesendet.',
        ].join('\n'),
        inline: false,
      },
      {
        name: '⚙️ Setup & Konfiguration',
        value: [
          '`/setup kanale` — Bot-Kanäle konfigurieren (Verfahren, Akten, Log, Willkommen, ...)',
          '`/setup ausbildung` — Ausbildungs-Kanäle konfigurieren',
          '`/setup voice` — Voice-System einrichten',
          '`/setup rolle` — Discord-Rollen Berechtigungsebenen zuweisen',
          '`/setup support` — Support-Warteraum + Benachrichtigungskanal setzen',
          '`/setup counter` — Statistik-Counter erstellen (Uhrzeit, Mitglieder, Online, Boosts)',
          '`/setup info` — Aktuelle Konfiguration anzeigen',
          '`/config` — Bot-Einstellungen & Statistiken',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🎧 Support-System',
        value: [
          'Jemand betritt den Support-Warteraum → Bot spricht TTS-Ansage → Wartemusik',
          'Online Supporter werden automatisch per Ping benachrichtigt.',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🎫 Ticket-System',
        value: [
          '`/ticket panel` — Ticket-Panel mit Button in den Kanal posten',
          '`/ticket schliessen` — Offenes Ticket schliessen',
          '**Button:** User klickt → privater Thread wird erstellt → Staff wird informiert',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📅 Abwesenheit',
        value: [
          '`/abwesend melden` — Als abwesend melden (Von/Bis/Grund)',
          '`/abwesend beenden` — Abwesenheit vorzeitig beenden',
          '`/abwesend liste` — Alle aktuell Abwesenden anzeigen',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📚 Ausbildung',
        value: [
          '`/ausbildung starten` — Ausbildung für ein Mitglied starten',
          '`/ausbildung abschliessen` — Laufende Ausbildung abschliessen',
          '`/ausbildung liste` — Alle Ausbildungen anzeigen (laufend/abgeschlossen)',
          '`/ausbildung profil` — Ausbildungen eines Mitglieds anzeigen',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📋 Dienstplan',
        value: [
          '`/dienstplan eintragen` — Schicht eintragen (Tag + Uhrzeit)',
          '`/dienstplan austragen` — Eintrag entfernen',
          '`/dienstplan anzeigen` — Wochenübersicht (Filter nach Fraktion)',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🚨 Fahndung',
        value: [
          '`/fahndung erstellen` — Neue Fahndung ausschreiben (nur Polizei)',
          '`/fahndung gefasst` — Fahndung als gefasst markieren',
          '`/fahndung loeschen` — Fahndung entfernen',
          '`/fahndung liste` — Alle aktiven Fahndungen anzeigen',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📊 Statistik-Counter',
        value: [
          'Voice-Kanäle die alle 5 Min. aktualisiert werden:',
          '🕐 Uhrzeit | 👥 Mitglieder | 🟢 Online | 💎 Boosts',
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
