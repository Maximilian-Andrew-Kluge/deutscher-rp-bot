import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error('❌ DISCORD_TOKEN, CLIENT_ID und GUILD_ID müssen in der .env Datei gesetzt sein!');
  process.exit(1);
}

const commands: object[] = [];

function loadCommands(dir: string): void {
  if (!fs.existsSync(dir)) {
    console.warn(`⚠️  Verzeichnis nicht gefunden: ${dir}`);
    return;
  }

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      loadCommands(itemPath);
    } else if ((item.endsWith('.ts') || item.endsWith('.js')) && !item.endsWith('.d.ts') && item !== 'deploy-commands.ts' && item !== 'deploy-commands.js') {
      try {
        const cmd = require(itemPath);
        const command = cmd.default || cmd;
        if (command?.data?.toJSON) {
          const json = command.data.toJSON();
          commands.push(json);
          console.log(`  ✅ Command geladen: /${json.name}`);
        }
      } catch (err) {
        console.error(`  ❌ Fehler beim Laden von ${itemPath}:`, err);
      }
    }
  }
}

const commandsPath = path.join(__dirname, 'commands');
console.log(`📂 Lade Commands aus: ${commandsPath}\n`);
loadCommands(commandsPath);

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`\n🚀 Deploye ${commands.length} Slash Command(s) auf Server ${guildId}...`);

    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log(`✅ ${(data as object[]).length} Slash Command(s) erfolgreich deployed!`);
    console.log('\nDeployete Commands:');
    commands.forEach(cmd => console.log(`  • /${(cmd as { name: string }).name}`));

  } catch (err) {
    console.error('❌ Fehler beim Deployen der Commands:', err);
    process.exit(1);
  }
})();
