import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const testGuildId = process.env.TEST_GUILD_ID;

if (!token || !clientId) {
  console.error('❌ DISCORD_TOKEN und CLIENT_ID müssen in der .env Datei gesetzt sein!');
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
    // ── Global deployen (auf ALLEN Servern sichtbar, kann bis zu 1h dauern) ──
    console.log(`\n🌍 Deploye ${commands.length} Slash Command(s) GLOBAL (alle Server)...`);
    const globalData = await rest.put(
      Routes.applicationCommands(clientId!),
      { body: commands }
    );
    console.log(`✅ ${(globalData as object[]).length} globale Slash Command(s) deployed!`);
    console.log('   ℹ️  Globale Commands können bis zu 1 Stunde brauchen bis sie überall erscheinen.');

    // ── Zusätzlich sofort auf dem Hauptserver (falls GUILD_ID gesetzt) ──
    if (guildId) {
      console.log(`\n🚀 Deploye zusätzlich sofort auf Hauptserver ${guildId}...`);
      const guildData = await rest.put(
        Routes.applicationGuildCommands(clientId!, guildId),
        { body: commands }
      );
      console.log(`✅ ${(guildData as object[]).length} Command(s) sofort auf dem Hauptserver verfügbar!`);
    }

    // ── Zusätzlich sofort auf dem Testserver (falls TEST_GUILD_ID gesetzt) ──
    if (testGuildId && testGuildId !== guildId) {
      console.log(`\n🧪 Deploye zusätzlich sofort auf Testserver ${testGuildId}...`);
      const testData = await rest.put(
        Routes.applicationGuildCommands(clientId!, testGuildId),
        { body: commands }
      );
      console.log(`✅ ${(testData as object[]).length} Command(s) sofort auf dem Testserver verfügbar!`);
    }

    console.log('\nDeployete Commands:');
    commands.forEach(cmd => console.log(`  • /${(cmd as { name: string }).name}`));

  } catch (err) {
    console.error('❌ Fehler beim Deployen der Commands:', err);
    process.exit(1);
  }
})();
