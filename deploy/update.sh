#!/bin/sh
# Pulls the newest Bragboard image and restarts it. Your data in ./pb_data is kept.
# Run by hand, or nightly from cron:  0 4 * * * /home/pi/bragboard/deploy/update.sh >> /home/pi/bragboard-update.log 2>&1
set -e
cd "$(dirname "$0")"
docker compose pull bragboard
docker compose up -d
docker image prune -f
echo "Bragboard updated: $(date)"
