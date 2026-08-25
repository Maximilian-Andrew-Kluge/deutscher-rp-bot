import {
  CommandInteraction, SlashCommandBuilder, EmbedBuilder,
  ColorResolvable, GuildMember
} from 'discord.js';
import { config } from '../config/config';
import { hasAdminPermission, hasModPermission, hasJustizPermission } from '../utils/permissions';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Zeigt alle verfügbaren Befehle');

export async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const member = interaction.member as GuildMember;

  const isAdmin = hasAdminPermission(member);
  const isMod = hasModPermission(member);
  const isJustiz = hasJustizPermission(member);

  const embeds: EmbedBuilder[] = [];

  // ── Übersicht ──
  const overview = new EmbedBuilder()
    .setColor(config.colors.server as ColorResolvable)
    .setTitle('📖 Deutscher RP Bot — Befehlsübersicht')
    .setDescription('🔒 = Admins/Mods | ⚖️ = Justiz')
    .addFields(
      {
        name: '🛡️ Administration',
        value: '`/admin` — Admin-Menü öffnen (Warn, Kick, Ban, Chat leeren, Server-Info) 🔒',
        inline: false,
      },
      {
        name: '⚖️ Justiz',
        value: [
          '`/verfahren panel` — Verfahrens-Panel erstellen ⚖️',
          '`/embed erstellen` — Embed in Kanal senden ⚖️',
        ].join('\n'),
        inline: false,
      },
      {
        name: '⚙️ Setup',
        value: [
          '`/setup kanale` — Bot-Kanäle konfigurieren 🔒',
          '`/setup voice` — Voice-System einrichten 🔒',
          '`/setup info` — Konfiguration anzeigen 🔒',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🎭 Rollen',
        value: [
          '`/rollen-panel erstellen` — Rollen verknüpfen 🔒',
          '`/rollenmenu erstellen` — Selbstzuweisungs-Menü posten 🔒',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🎙️ Voice',
        value: [
          '`/voice-setup` — Voice einrichten 🔒',
          '`/voice-config info` — Voice-Status 🔒',
        ].join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: 'Deutscher RP Server | Bot v1.0' })
    .setTimestamp();

  embeds.push(overview);

  // Admin-Details nur für Mods/Admins
  if (isAdmin || isMod) {
    embeds.push(new EmbedBuilder()
      .setColor(config.colors.server as ColorResolvable)
      .setTitle('🛡️ /admin — Popup-Menü')
      .setDescription('Tippe `/admin` um das Verwaltungs-Menü zu öffnen. Dort kannst du per Dropdown auswählen:')
      .addFields(
        { name: '👤 Spieler-Info', value: 'Zeigt Beitritt, Rollen und Verwarnungen', inline: true },
        { name: '⚠️ Verwarnen', value: 'Erteilt eine Verwarnung + DM', inline: true },
        { name: '📋 Warnungen', value: 'Alle Warns eines Spielers', inline: true },
        { name: '🧹 Chat leeren', value: 'Bis zu 100 Nachrichten löschen', inline: true },
        { name: '📊 Server-Info', value: 'Mitglieder, Kanäle, Boosts', inline: true },
        { name: '🦶 Kick', value: 'Spieler kicken + DM', inline: true },
        ...(isAdmin ? [
          { name: '🔨 Ban', value: 'Permanent bannen + DM', inline: true },
          { name: '✅ Unban', value: 'Ban aufheben per ID', inline: true },
          { name: '🗑️ Warn entfernen', value: 'Verwarnung per ID löschen', inline: true },
        ] : []),
      )
      .setFooter({ text: 'Alle Aktionen werden im Log-Kanal protokolliert' })
    );
  }

  await interaction.reply({ embeds, ephemeral: true });
}

export default { data, execute };
