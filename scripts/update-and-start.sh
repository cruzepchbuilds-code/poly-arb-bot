#!/usr/bin/env bash
# Pulls the latest code, installs any new deps, and (re)starts the bot.
set -e
cd ~/poly-arb-bot

echo "--- pulling latest ---"
git fetch origin claude/elegant-keller-y58cjr
git merge --ff-only origin/claude/elegant-keller-y58cjr

echo "--- installing dependencies ---"
npm install --silent

echo "--- checking syntax ---"
find src -name "*.js" | xargs -I{} node --check {}

echo "--- restarting ---"
pm2 restart ecosystem.config.cjs --update-env
pm2 save

echo "--- done ---"
pm2 status
