# ⚖️ Deutscher RP Server — Discord Bot

Ein vollständiger, produktionsbereiter Discord-Bot für den **Deutschen RP Server** (Roblox-Roleplay).  
Gebaut mit Node.js, TypeScript, discord.js v14 und SQLite.

---

## 📋 Funktionen

### ⚖️ Justiz- & Verfahrenssystem
- Neue Verfahren per Button-Panel oder `/verfahren erstellen` öffnen
- Automatische Aktenzeichen-Vergabe (`RP-JU-2026-001`, `RP-JU-2026-002`, ...)
- Verfahrens-Embeds mit allen Daten im Forum-Kanal
- Status-System: 🟡 Offen → 🟠 Ermittlung → 🔴 Strafverfahren → ⚖️ Gerichtsverfahren → 🟢 Abgeschlossen
- Automatische Übertragung ins Aktenarchiv beim Abschließen
- Notizen, Bearbeitung, Sperren über Buttons

### 📁 Aktenverwaltung
- Separater Forum-Kanal für archivierte Akten
- Automatische Erstellung beim Verfahrensabschluss
- Vollständige Datenübertragung inkl. Notizen

### 🎓 Ausbildungs-Embeds
- `/ausbildung-polizei`, `/ausbildung-feuerwehr`, `/ausbildung-rettungsdienst`, `/ausbildung-justiz`
- Professionelle, farbige Embeds pro Fraktion

### 🎙️ Temporäre Voice-Kanäle
- Automatische Erstellung beim Beitreten eines "Erstell-Kanals"
- Besitzer erhält Kanal-Verwaltungsrechte
- Automatisches Löschen wenn leer

### ⚙️ Konfiguration & Setup
- `/setup kanale` — Forum-/Log-Kanäle konfigurieren
- `/setup rolle` — Rollen-Berechtigungen zuweisen
- `/voice-setup` — Voice-System einrichten
- `/config statistiken` — Server-Statistiken

---

## 🚀 Installation

### Voraussetzungen
- Node.js v18+ (empfohlen: v20 LTS)
- npm v8+
- Einen Discord-Bot (erstellt im [Discord Developer Portal](https://discord.com/developers/applications))

### 1. Repository klonen / entpacken

```bash
cd deutscher-rp-bot
```

### 2. Abhängigkeiten installieren

```bash
npm install --ignore-scripts
```

> **Hinweis Windows:** `better-sqlite3` benötigt kein manuelles Kompilieren,
> da Prebuilt-Binaries genutzt werden.

### 3. Umgebungsvariablen setzen

```bash
cp .env.example .env
```

Öffne `.env` und trage deine Werte ein:

```env
DISCORD_TOKEN=dein_bot_token_hier
CLIENT_ID=deine_application_id
GUILD_ID=deine_server_id
DATABASE_PATH=./data/database.db
```

**Wo finde ich diese Werte?**
- `DISCORD_TOKEN`: [Discord Developer Portal](https://discord.com/developers/applications) → Deine App → Bot → Token
- `CLIENT_ID`: Developer Portal → Deine App → General Information → Application ID
- `GUILD_ID`: Discord → Rechtsklick auf deinen Server → "ID kopieren" (Entwicklermodus muss aktiv sein)

### 4. Build kompilieren

```bash
npm run build
```

### 5. Slash Commands deployen

```bash
npm run deploy
```

### 6. Bot starten

```bash
npm start
```

**Für Entwicklung (mit Hot-Reload-ähnlichem ts-node):**
```bash
npm run dev
```

---

## ⚙️ Erstkonfiguration (Setup)

Nach dem Start führe folgende Schritte auf deinem Discord-Server durch:

### Schritt 1: Kanäle konfigurieren

```
/setup kanale verfahren:#⚖️・verfahren akten:#📁・akten logs:#🤖・bot-logs
```

> Die Kanäle `⚖️・verfahren` und `📁・akten` müssen **Forum-Kanäle** sein!

**Forum-Tags anlegen** (muss manuell in Discord gemacht werden):

Für beide Forum-Kanäle diese Tags anlegen:
- `🟡 Offen`
- `🟠 Ermittlung`
- `🔴 Strafverfahren`
- `⚖️ Gerichtsverfahren`
- `🟢 Abgeschlossen`

### Schritt 2: Rollen konfigurieren

```
/setup rolle key:Justiz-Leitung rolle:@JUSTIZ-LΞITUNG
/setup rolle key:Richter rolle:@RICHTΞR
/setup rolle key:Staatsanwalt rolle:@STΛΛTSΛNWΛLT
/setup rolle key:Polizei-Leitung rolle:@POLIZΞI-LΞITUNG
/setup rolle key:Administrator rolle:@ΛDMINISTRΛTOR
```

### Schritt 3: Voice-System einrichten

```
/voice-setup erstell-kanal:#〣│➕・Channel-erstellen kategorie:#RP-Channels
```

### Schritt 4: Verfahrens-Panel erstellen

Gehe in einen gewünschten Kanal und führe aus:

```
/verfahren panel
```

Dies erstellt ein permanentes Panel mit dem **➕ Neues Verfahren** Button.

---

## 📖 Slash Commands Übersicht

| Command | Beschreibung | Berechtigung |
|---------|-------------|--------------|
| `/verfahren erstellen` | Neues Verfahren erstellen | Justiz |
| `/verfahren panel` | Panel im aktuellen Kanal erstellen | Admin |
| `/verfahren-bearbeiten` | Verfahren bearbeiten | Justiz |
| `/verfahren-abschliessen` | Verfahren abschließen + archivieren | Justiz |
| `/verfahren-anzeigen` | Verfahren Details anzeigen | Justiz |
| `/akte-erstellen` | Akte manuell erstellen | Justiz |
| `/akte-anzeigen` | Akte anzeigen | Justiz |
| `/ausbildung-polizei` | Polizei-Ausbildungs-Embed | Polizei/Admin |
| `/ausbildung-feuerwehr` | Feuerwehr-Ausbildungs-Embed | Feuerwehr/Admin |
| `/ausbildung-rettungsdienst` | Rettungsdienst-Ausbildungs-Embed | RD/Admin |
| `/ausbildung-justiz` | Justiz-Ausbildungs-Embed | Justiz/Admin |
| `/voice-setup` | Voice-System einrichten | Admin |
| `/voice-config info` | Voice-Konfiguration anzeigen | Admin |
| `/voice-config liste` | Aktive Voice-Kanäle anzeigen | Admin |
| `/setup kanale` | Bot-Kanäle konfigurieren | Admin |
| `/setup rolle` | Rollen-Berechtigungen setzen | Admin |
| `/setup info` | Aktuelle Konfiguration anzeigen | Admin |
| `/config logs-anzeigen` | Bot-Logs anzeigen | Admin |
| `/config statistiken` | Server-Statistiken | Admin |
| `/config reset` | Alle Einstellungen zurücksetzen | Admin |

---

## 🔐 Berechtigungssystem

| Berechtigung | Rollen |
|---|---|
| **Justiz** | JUSTIZ-LΞITUNG, OBΞR-RICHTΞR, RICHTΞR, STΛΛTSΛNWΛLT, GERICHTSSCHREIBER |
| **Anwalt** | ΛNWΛLT + alle Justiz-Rollen |
| **Polizei** | POLIZΞI-LΞITUNG, POLIZΞI, POLIZΞI-ANWÄRTΞR |
| **Feuerwehr** | FΞUΞRWΞHR-LΞITUNG, FΞUΞRWΞHR, FΞUΞRWΞHR-ANWÄRTΞR |
| **Rettungsdienst** | RΞTTUNGSDIΞNST-LΞITUNG, RΞTTUNGSDIΞNST, RΞTTUNGSDIΞNST-ANWÄRTΞR |
| **Admin** | OWNΞR, CO-OWNΞR, ΛDMINISTRΛTOR + Discord-Admins |

---

## 🐳 Docker

### Mit docker-compose starten

```bash
# .env Datei anlegen
cp .env.example .env
# Tokens eintragen, dann:

docker-compose up -d
```

### Logs anzeigen

```bash
docker-compose logs -f
```

### Bot stoppen

```bash
docker-compose down
```

---

## 🗄️ Datenbankstruktur

Die SQLite-Datenbank wird automatisch in `./data/database.db` erstellt.

| Tabelle | Beschreibung |
|---------|-------------|
| `server_settings` | Kanal-IDs und Bot-Einstellungen pro Server |
| `role_config` | Rollen-Berechtigungsmapping |
| `aktenzeichen_counter` | Zähler für automatische Aktenzeichen |
| `verfahren` | Alle Verfahren mit allen Feldern |
| `verfahren_notizen` | Notizen zu Verfahren |
| `akten` | Archivierte Akten |
| `temp_voice_channels` | Aktive temporäre Voice-Kanäle |
| `logs` | Bot-Aktivitäts-Logs |

---

## 🤖 Benötigte Bot-Berechtigungen

Wenn du den Bot einlädst, benötigt er folgende Berechtigungen:

- `Read Messages / View Channels`
- `Send Messages`
- `Send Messages in Threads`
- `Create Public Threads`
- `Manage Threads`
- `Embed Links`
- `Attach Files`
- `Read Message History`
- `Manage Channels` (für Voice-System)
- `Move Members` (für Voice-System)
- `Use Application Commands`

**OAuth2-Scopes:** `bot`, `applications.commands`

**Einladungs-URL generieren:**  
Developer Portal → Deine App → OAuth2 → URL Generator → Scopes: `bot`, `applications.commands` → Permissions: wie oben

---

## 🏗️ Projektstruktur

```
src/
├── commands/
│   ├── akte/           # Akten-Commands
│   ├── ausbildung/     # Ausbildungs-Embeds
│   ├── verfahren/      # Verfahrens-Commands
│   ├── voice/          # Voice-System Commands
│   ├── config.ts       # Erweiterte Konfiguration
│   └── setup.ts        # Bot-Setup
├── config/
│   └── config.ts       # Zentrale Konfiguration
├── database/
│   ├── database.ts     # Datenbankverbindung
│   └── migrations.ts   # Tabellen-Erstellung
├── events/
│   ├── interactionCreate.ts
│   ├── ready.ts
│   └── voiceStateUpdate.ts
├── managers/
│   ├── commandManager.ts   # Command-Loader & -Handler
│   └── panelManager.ts     # Button/Modal/Select-Handler
├── services/
│   ├── aktenService.ts     # Akten-Logik
│   ├── logService.ts       # Logging
│   ├── verfahrenService.ts # Verfahrens-Logik
│   └── voiceService.ts     # Voice-Kanal-Logik
├── utils/
│   ├── aktenzeichen.ts     # Aktenzeichen-Generator
│   ├── embeds.ts           # Embed-Builder
│   └── permissions.ts      # Berechtigungsprüfung
├── deploy-commands.ts      # Slash Command Deployment
└── index.ts                # Bot-Einstiegspunkt
```

---

## 🔧 Fehlerbehebung

**Bot antwortet nicht auf Commands:**
- Stelle sicher, dass `/deploy` ausgeführt wurde
- Prüfe ob der Bot die richtigen Berechtigungen hat
- Bot muss auf dem Server sein

**"Verfahrens-Kanal nicht konfiguriert":**
- Führe `/setup kanale` aus und gib Forum-Kanäle an

**Voice-Kanäle werden nicht erstellt:**
- Führe `/voice-setup` aus
- Bot benötigt `Manage Channels` Berechtigung

**better-sqlite3 Build-Fehler:**
- Nutze `npm install --ignore-scripts`
- Auf Windows: Visual Studio Build Tools oder Node.js LTS (v20) installieren

---

## 📄 Lizenz

Dieses Projekt ist eine fiktive Vorlage für den Deutschen RP Server (Roblox-Roleplay).  
Keine echten personenbezogenen Daten eintragen.
