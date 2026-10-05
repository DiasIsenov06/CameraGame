#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Install Node.js LTS from https://nodejs.org/ and run this script again.'
  exit 1
fi
exec node scripts/start-game.mjs
