import { Client, Collection, CommandInteraction } from 'discord.js';
import fs from 'fs';
import path from 'path';

export interface BotCommand {
  data: { name: string; toJSON(): object };
  execute(interaction: CommandInteraction): Promise<void>;
}

export class CommandManager {
  private client: Client;
  public commands: Collection<string, BotCommand> = new Collection();

  constructor(client: Client) {
    this.client = client;
  }

  async loadCommands(): Promise<void> {
    const commandsPath = path.join(__dirname, '..', 'commands');

    const loadDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (item.endsWith('.d.ts')) continue;
          if (stat.isDirectory()) {
            loadDir(itemPath);
          } else if (item.endsWith('.ts') || item.endsWith('.js')) {
          // Skip deploy-commands file if it ends up in commands dir
          if (item === 'deploy-commands.ts' || item === 'deploy-commands.js') continue;

          const command = require(itemPath);
          const cmd = command.default || command;
          if (cmd && cmd.data && cmd.execute) {
            this.commands.set(cmd.data.name, cmd);
            console.log(`  📦 Command geladen: ${cmd.data.name}`);
          }
        }
      }
    };

    loadDir(commandsPath);
    console.log(`✅ ${this.commands.size} Commands geladen.`);
  }

  async executeCommand(interaction: CommandInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);

    if (!command) {
      await interaction.reply({ content: '❌ Dieser Befehl ist nicht bekannt.', ephemeral: true });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Fehler bei Command ${interaction.commandName}:`, err);
      const errorMsg = { content: '❌ Bei der Ausführung des Befehls ist ein Fehler aufgetreten.', ephemeral: true };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMsg);
      } else {
        await interaction.reply(errorMsg);
      }
    }
  }
}
