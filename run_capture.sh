#!/bin/bash

# Absolute paths — required since cron has a minimal PATH (no nvm)
NODE="/Users/rinchindugar/.nvm/versions/node/v23.6.1/bin/node"
DIR="/Users/rinchindugar/Dev/ai-subtitle/youtube-screenshots"
LOG="$DIR/capture.log"

cd "$DIR" || exit 1

echo "--- $(date '+%Y-%m-%d %H:%M:%S') ---" >> "$LOG"
"$NODE" capture.js >> "$LOG" 2>&1
echo "Exit code: $?" >> "$LOG"
