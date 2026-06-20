#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Polymarket Arb Bot — One-command VPS setup
# Tested on Ubuntu 22.04 LTS (DigitalOcean / Vultr / Hetzner $5/mo droplet)
#
# Usage (run as root):
#   curl -sL <paste your raw GitHub URL> | bash
#   — OR —
#   bash vps-setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RESET="\033[0m"
log()  { echo -e "${GREEN}[setup]${RESET} $*"; }
warn() { echo -e "${YELLOW}[warn]${RESET}  $*"; }

# ── 1. System update ──────────────────────────────────────────────────────────
log "Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Node.js 22 (LTS) via NodeSource ───────────────────────────────────────
log "Installing Node.js 22..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null 2>&1
  apt-get install -y nodejs -qq
fi
log "Node $(node -v)  |  npm $(npm -v)"

# ── 3. PM2 process manager ────────────────────────────────────────────────────
log "Installing PM2 globally..."
npm install -g pm2 --silent
pm2 install pm2-logrotate --silent 2>/dev/null || true
# Rotate logs > 10 MB, keep 7 days
pm2 set pm2-logrotate:max_size 10M  2>/dev/null || true
pm2 set pm2-logrotate:retain  7     2>/dev/null || true

# ── 4. Bot directory ──────────────────────────────────────────────────────────
BOT_DIR="/root/poly-arb-bot"
log "Creating bot directory at $BOT_DIR..."
mkdir -p "$BOT_DIR/src/data" "$BOT_DIR/src/strategies" "$BOT_DIR/src/live" \
         "$BOT_DIR/src/indicators" "$BOT_DIR/src/paper" "$BOT_DIR/src/engines" \
         "$BOT_DIR/logs"

# ── 5. Copy files (if running from the project directory) ────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
if [[ -f "$SCRIPT_DIR/package.json" && "$SCRIPT_DIR" != "$BOT_DIR" ]]; then
  log "Copying project files from $SCRIPT_DIR → $BOT_DIR ..."
  rsync -a --exclude node_modules --exclude .git --exclude logs \
    "$SCRIPT_DIR/" "$BOT_DIR/"
elif [[ -f "$BOT_DIR/package.json" ]]; then
  log "Project files already in $BOT_DIR — skipping copy."
else
  warn "No project files found. Copy your poly-arb-bot folder to $BOT_DIR manually."
  warn "Then run:  cd $BOT_DIR && npm install && pm2 start ecosystem.config.cjs"
  exit 0
fi

# ── 6. npm install ────────────────────────────────────────────────────────────
log "Installing npm dependencies..."
cd "$BOT_DIR"
npm install --silent

# ── 7. PM2 startup (survives reboots) ────────────────────────────────────────
log "Configuring PM2 to start on boot..."
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash || true

# ── 8. Launch bot in SIM mode ────────────────────────────────────────────────
log "Starting bot in SIM mode..."
pm2 start ecosystem.config.cjs
pm2 save

# ── 9. Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}║         Polymarket Arb Bot — VPS Setup Done!         ║${RESET}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${RESET}"
echo -e "${GREEN}║${RESET}  Useful commands:                                    ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}    pm2 status             — running processes        ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}    pm2 logs poly-arb-sim  — live log output          ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}    pm2 restart poly-arb-sim                          ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}    pm2 stop poly-arb-sim                             ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}                                                      ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}  Logs stored at:                                     ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}    $BOT_DIR/logs/                     ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}                                                      ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}  To switch to LIVE trading:                          ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}    1. Edit .env: set LIVE_MODE=true and fill in keys ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}    2. pm2 restart ecosystem.config.cjs --update-env  ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}       (restart by name reuses cached env — must use  ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}        the config file path to pick up .env changes) ${GREEN}║${RESET}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""
pm2 status
