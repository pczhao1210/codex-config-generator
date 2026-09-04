#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/codex-setup-lab"
DIST_DIR="$APP_DIR/dist"

if [[ ! -d "$APP_DIR" ]]; then
  echo "Error: frontend app not found at $APP_DIR"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: pnpm is required for deployment."
  echo "Install it with: npm install -g pnpm"
  exit 1
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "Error: Codex CLI is required for deployment validation."
  echo "Install the validated version with: npm install -g @openai/codex@0.153.2"
  exit 1
fi

cd "$APP_DIR"

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies..."
  pnpm install
fi

echo "Running frontend and Codex configuration release gates..."
pnpm test
pnpm lint
pnpm test:codex
pnpm test:codex:live

echo "Building Codex Configurator..."
pnpm build

if [[ ! -d "$DIST_DIR" ]]; then
  echo "Error: build output not found at $DIST_DIR"
  exit 1
fi

DEPLOY_TOKEN="${SWA_CLI_DEPLOYMENT_TOKEN:-${AZURE_STATIC_WEB_APPS_API_TOKEN:-}}"
APP_NAME="${AZURE_STATIC_WEB_APPS_APP_NAME:-}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-}"
DEPLOY_ENV="${AZURE_STATIC_WEB_APPS_ENVIRONMENT:-production}"

if [[ -z "$DEPLOY_TOKEN" ]] && [[ -n "$APP_NAME" ]] && command -v az >/dev/null 2>&1; then
  echo "Fetching deployment token from Azure CLI..."
  TOKEN_ARGS=(staticwebapp secrets list --name "$APP_NAME" --query "properties.apiKey" -o tsv)
  if [[ -n "$RESOURCE_GROUP" ]]; then
    TOKEN_ARGS+=(--resource-group "$RESOURCE_GROUP")
  fi
  DEPLOY_TOKEN="$(az "${TOKEN_ARGS[@]}")"
fi

if [[ -z "$DEPLOY_TOKEN" ]]; then
  echo "Error: missing deployment token."
  echo "Set SWA_CLI_DEPLOYMENT_TOKEN or AZURE_STATIC_WEB_APPS_API_TOKEN."
  echo "Alternatively set AZURE_STATIC_WEB_APPS_APP_NAME and authenticate Azure CLI so the script can fetch the token."
  exit 1
fi

echo "Deploying dist/ to Azure Static Web Apps environment: $DEPLOY_ENV"
pnpm dlx @azure/static-web-apps-cli@latest deploy "$DIST_DIR" \
  --deployment-token "$DEPLOY_TOKEN" \
  --env "$DEPLOY_ENV"
