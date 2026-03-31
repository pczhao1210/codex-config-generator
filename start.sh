#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/codex-setup-lab"

if [[ ! -d "$APP_DIR" ]]; then
  echo "Error: frontend app not found at $APP_DIR"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: pnpm is required to start the app."
  echo "Install it with: npm install -g pnpm"
  exit 1
fi

cd "$APP_DIR"

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies..."
  pnpm install
fi

echo "Starting Codex Setup Lab..."
echo "Open http://localhost:5173 after the dev server is ready."

exec pnpm dev --host 0.0.0.0