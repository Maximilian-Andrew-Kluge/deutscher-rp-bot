#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Deutscher RP Bot — Update Script
# Ausführen mit: bash update.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

INSTALL_DIR="/opt/deutscher-rp-bot"

echo -e "${YELLOW}[1/3] Neueste Version wird heruntergeladen...${NC}"
cd "$INSTALL_DIR"
git pull

echo -e "${YELLOW}[2/3] Container wird neu gebaut...${NC}"
docker-compose build --no-cache

echo -e "${YELLOW}[3/3] Container wird neu gestartet...${NC}"
docker-compose up -d

echo -e "${GREEN}Update abgeschlossen!${NC}"
docker-compose ps
