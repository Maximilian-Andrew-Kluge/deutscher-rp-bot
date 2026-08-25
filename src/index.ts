import { Client, GatewayIntentBits, Partials, GuildMember } from 'discord.js';
import dotenv from 'dotenv';
import { CommandManager } from './managers/commandManager';
import { PanelManager } from './managers/panelManager';
import { runMigrations } from './database/migrations';
import { VoiceService } from './services/voiceService';
import { WelcomeService } from './services/welcomeService';
import { initDatabase, closeDatabase } from './database/database';
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
