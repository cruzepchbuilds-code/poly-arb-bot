#!/usr/bin/env bash
# (Re)starts the bot with whatever code is already on disk — no git pull.
set -e
cd ~/poly-arb-bot
pm2 restart ecosystem.config.cjs --update-env
pm2 save
pm2 status
