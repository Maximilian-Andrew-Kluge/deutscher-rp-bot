#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Deutscher RP Bot — Proxmox/Linux Setup Script
# Ausführen mit: bash setup-proxmox.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Bei Fehler abbrechen

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_URL="https://github.com/Maximilian-Andrew-Kluge/deutscher-rp-bot.git"
INSTALL_DIR="/opt/deutscher-rp-bot"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════╗"
echo "║    Deutscher RP Bot — Setup                  ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Root-Check ────────────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Bitte als root ausführen: sudo bash setup-proxmox.sh${NC}"
  exit 1
fi

# ── System-Updates ────────────────────────────────────────────────────────────
echo -e "${YELLOW}[1/6] System wird aktualisiert...${NC}"
apt-get update -q
apt-get install -y -q curl git ca-certificates gnupg

# ── Docker installieren ───────────────────────────────────────────────────────
echo -e "${YELLOW}[2/6] Docker wird installiert...${NC}"
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo -e "${GREEN}Docker installiert!${NC}"
else
  echo -e "${GREEN}Docker bereits installiert ($(docker --version))${NC}"
fi

# ── Docker Compose installieren ───────────────────────────────────────────────
if ! command -v docker-compose &> /dev/null; then
  echo -e "${YELLOW}Docker Compose wird installiert...${NC}"
  curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
    -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
fi

# ── Repository klonen / aktualisieren ─────────────────────────────────────────
echo -e "${YELLOW}[3/6] Repository wird geklont...${NC}"
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Repository bereits vorhanden — update..."
  cd "$INSTALL_DIR"
  git pull
else
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ── .env erstellen falls nicht vorhanden ──────────────────────────────────────
echo -e "${YELLOW}[4/6] Konfiguration wird geprüft...${NC}"
if [ ! -f "$INSTALL_DIR/.env" ]; then
  echo -e "${YELLOW}Keine .env Datei gefunden — wird aus .env.example erstellt.${NC}"
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  echo ""
  echo -e "${RED}══════════════════════════════════════════════════════${NC}"
  echo -e "${RED}WICHTIG: Bitte jetzt die .env Datei bearbeiten!${NC}"
  echo -e "${RED}nano ${INSTALL_DIR}/.env${NC}"
  echo -e "${RED}══════════════════════════════════════════════════════${NC}"
  echo ""
  read -p "Drücke ENTER wenn du die .env bearbeitet hast..."
else
  echo -e "${GREEN}.env Datei gefunden!${NC}"
fi

# ── Daten-Verzeichnisse erstellen ─────────────────────────────────────────────
mkdir -p "$INSTALL_DIR/data" "$INSTALL_DIR/logs"

# ── Docker Container bauen & starten ─────────────────────────────────────────
echo -e "${YELLOW}[5/6] Docker Container wird gebaut (kann einige Minuten dauern)...${NC}"
cd "$INSTALL_DIR"
docker-compose build --no-cache
docker-compose up -d

# ── Status prüfen ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[6/6] Status wird geprüft...${NC}"
sleep 5
docker-compose ps

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Bot wurde erfolgreich gestartet!                    ║${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}║  Admin-Panel: http://$(hostname -I | awk '{print $1}'):3000    ║${NC}"
echo -e "${GREEN}║  Login:       admin / admin123                       ║${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}║  Logs anzeigen:  docker-compose logs -f              ║${NC}"
echo -e "${GREEN}║  Stoppen:        docker-compose down                 ║${NC}"
echo -e "${GREEN}║  Neustart:       docker-compose restart              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
