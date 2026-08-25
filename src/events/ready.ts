import { Client, Events } from 'discord.js';
import { VoiceService } from '../services/voiceService';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client): Promise<void> {
    console.log(`✅ Bot eingeloggt als: ${client.user?.tag}`);

    client.user?.setPresence({
      activities: [{ name: 'Deutscher RP Server | /setup' }],
      status: 'online',
    });

    // Temporäre Voice-Kanäle beim Start bereinigen
    const voiceService = new VoiceService(client);
    await voiceService.cleanupOnStartup();

    console.log('✅ Bot ist bereit!');
  },
};
