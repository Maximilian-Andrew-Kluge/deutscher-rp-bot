import { Client, GatewayIntentBits, Partials, GuildMember } from 'discord.js';
import dotenv from 'dotenv';
import { CommandManager } from './managers/commandManager';
import { PanelManager } from './managers/panelManager';
import { runMigrations } from './database/migrations';
import { VoiceService } from './services/voiceService';
import { WelcomeService } from './services/welcomeService';
import { TikTokService } from './services/tiktokService';
import { initDatabase, closeDatabase, getDatabase } from './database/database';
import { config } from './config/config';
import { startWebServer } from './web/server';

dotenv.config();

// Validierung der Umgebungsvariablen
if (!config.token) {
  console.error('❌ DISCORD_TOKEN ist nicht gesetzt! Bitte .env Datei prüfen.');
  process.exit(1);
}
if (!config.clientId) {
  console.error('❌ CLIENT_ID ist nicht gesetzt! Bitte .env Datei prüfen.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
});

const commandManager = new CommandManager(client);
const panelManager = new PanelManager(client);

async function main(): Promise<void> {
  console.log('🚀 Starte Deutschen RP Bot...');

  // Datenbank initialisieren (async wegen sql.js WASM)
  await initDatabase();
  runMigrations();

  // Commands laden
  await commandManager.loadCommands();

  // Event: Bot bereit
  client.once('clientReady', async (readyClient) => {
    console.log(`\n✅ Bot eingeloggt als: ${readyClient.user.tag}`);
    console.log(`📡 Verbunden mit ${readyClient.guilds.cache.size} Server(n)`);

    readyClient.user.setPresence({
      activities: [{ name: 'Deutscher RP Server | /setup' }],
      status: 'online',
    });

    // Temporäre Voice-Kanäle beim Start bereinigen
    const voiceService = new VoiceService(readyClient);
    await voiceService.cleanupOnStartup();

    // Admin-Panel starten
    await startWebServer(readyClient);

    // TikTok Live-Überwachung starten
    const tiktokService = new TikTokService(readyClient);
    tiktokService.start();

    console.log('✅ Bot ist vollständig bereit!\n');
  });

  // Event: Interaktion erstellt
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await commandManager.executeCommand(interaction);
      } else {
        await panelManager.handleInteraction(interaction);
      }
    } catch (err) {
      console.error('Interaction-Fehler:', err);
    }
  });

  // Event: Neues Mitglied tritt bei → Willkommensnachricht
  client.on('guildMemberAdd', async (member) => {
    const welcomeService = new WelcomeService(client);
    await welcomeService.handleMemberJoin(member);
  });

  // Event: Mitglied verlässt den Server → Abschiedsnachricht
  client.on('guildMemberRemove', async (member) => {
    const welcomeService = new WelcomeService(client);
    await welcomeService.handleMemberLeave(member as GuildMember);
  });

  // Event: Voice-Status Änderung
  client.on('voiceStateUpdate', async (oldState, newState) => {
    const voiceService = new VoiceService(client);

    // Benutzer betritt Voice-Kanal (erstmalig)
    if (!oldState.channelId && newState.channelId && newState.member) {
      await voiceService.handleVoiceJoin(newState.member, newState.channelId);
    }

    // Benutzer verlässt Voice-Kanal (oder wechselt)
    if (oldState.channelId && (!newState.channelId || newState.channelId !== oldState.channelId)) {
      await voiceService.handleVoiceLeave(oldState.guild.id, oldState.channelId);
    }
  });

  // Event: Forum-Thread gelöscht → Akte/Verfahren aus DB entfernen (Server → Website)
  client.on('threadDelete', (thread) => {
    try {
      const db = getDatabase();
      // Akte anhand des Discord-Thread-IDs finden
      const akte = db.prepare('SELECT id, aktenzeichen, verfahren_id FROM akten WHERE forum_post_id = ?')
        .get(thread.id) as { id: number; aktenzeichen: string; verfahren_id: number | null } | undefined;

      if (akte) {
        db.prepare('DELETE FROM akten WHERE id = ?').run(akte.id);
        if (akte.verfahren_id) {
          db.prepare('DELETE FROM verfahren WHERE id = ?').run(akte.verfahren_id);
        }
        console.log(`🗑️  Akte ${akte.aktenzeichen} aus DB entfernt (Discord-Thread gelöscht).`);
        return;
      }

      // Falls es ein offener Verfahrens-Thread war
      const verfahren = db.prepare('SELECT id, aktenzeichen FROM verfahren WHERE forum_post_id = ?')
        .get(thread.id) as { id: number; aktenzeichen: string } | undefined;
      if (verfahren) {
        db.prepare('DELETE FROM verfahren WHERE id = ?').run(verfahren.id);
        console.log(`🗑️  Verfahren ${verfahren.aktenzeichen} aus DB entfernt (Discord-Thread gelöscht).`);
      }
    } catch (err) {
      console.error('Fehler beim Synchronisieren des gelöschten Threads:', err);
    }
  });

  // Fehlerbehandlung
  client.on('error', (err) => {
    console.error('Discord-Client-Fehler:', err);
  });

  client.on('warn', (msg) => {
    console.warn('Discord-Warnung:', msg);
  });

  // Graceful Shutdown
  process.on('SIGINT', () => {
    console.log('\n⛔ SIGINT empfangen - Bot wird heruntergefahren...');
    client.destroy();
    closeDatabase();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n⛔ SIGTERM empfangen - Bot wird heruntergefahren...');
    client.destroy();
    closeDatabase();
    process.exit(0);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unbehandelte Promise-Ablehnung:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('Unbehandelter Ausnahmefehler:', err);
  });

  // Bot einloggen
  await client.login(config.token);
}

main().catch(err => {
  console.error('❌ Kritischer Startfehler:', err);
  process.exit(1);
});
