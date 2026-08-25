import { Client, Events, VoiceState } from 'discord.js';
import { VoiceService } from '../services/voiceService';

export default {
  name: Events.VoiceStateUpdate,
  once: false,
  async execute(client: Client, oldState: VoiceState, newState: VoiceState): Promise<void> {
    const voiceService = new VoiceService(client);

    // Benutzer betritt einen Voice-Kanal (frisch)
    if (!oldState.channelId && newState.channelId && newState.member) {
      await voiceService.handleVoiceJoin(newState.member, newState.channelId);
    }

    // Benutzer verlässt einen Voice-Kanal (komplett oder wechselt)
    if (oldState.channelId && (!newState.channelId || newState.channelId !== oldState.channelId)) {
      await voiceService.handleVoiceLeave(oldState.guild.id, oldState.channelId);
    }
  },
};
