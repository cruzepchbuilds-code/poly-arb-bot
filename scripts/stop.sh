#!/usr/bin/env bash
# Stops the bot. No new orders will be placed until you start it again.
pm2 stop poly-arb-sim
pm2 status
