import { Client, Events, Interaction } from 'discord.js';
import { CommandManager } from '../managers/commandManager';
import { PanelManager } from '../managers/panelManager';

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(
    client: Client,
    interaction: Interaction,
    commandManager: CommandManager,
    panelManager: PanelManager
  ): Promise<void> {
    try {
      if (interaction.isChatInputCommand()) {
        await commandManager.executeCommand(interaction);
      } else {
        await panelManager.handleInteraction(interaction);
      }
    } catch (err) {
      console.error('Unbehandelter Interaktionsfehler:', err);
    }
  },
};
