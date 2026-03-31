# Codex Config Generator

[中文说明](./README.zh-CN.md)

Codex Config Generator is a static web application for generating Codex setup artifacts across Linux, macOS, and Windows. It helps users assemble install guidance, provider configuration, `config.toml`, and MCP snippets without relying on a backend service.

The live site is available at [codex-config.thingsbud.com](https://codex-config.thingsbud.com/).

## What It Does

- Detects the browser OS and lets the user switch the target platform manually.
- Generates setup output for Codex CLI and Codex App scenarios.
- Supports Azure OpenAI, custom OpenAI-compatible providers, and local OpenAI-compatible providers.
- Includes MCP presets and custom MCP entry management.
- Keeps all user input in browser memory only.
- Ships as a static site that can be deployed to Azure Static Web Apps.

## Project Structure

```text
.
├── codex-setup-lab/          # Vite + React frontend
├── .github/workflows/        # GitHub Actions deployment workflow
├── start.sh                  # Local development entrypoint
└── deploy.sh                 # Production build and Azure Static Web Apps deployment
```

## Local Development

### Requirements

- Node.js 20+
- pnpm

### Start The App

```bash
./start.sh
```

The script installs dependencies if needed and starts the Vite dev server on `http://localhost:5173`.

You can also run the frontend directly:

```bash
cd codex-setup-lab
pnpm install
pnpm dev --host 0.0.0.0
```

## Build

```bash
cd codex-setup-lab
pnpm build
```

## Deployment

The repository includes a GitHub Actions workflow at `.github/workflows/deploy-azure-static-web-app.yml` and a deployment helper script:

```bash
./deploy.sh
```

Deployment expects one of the following:

- `SWA_CLI_DEPLOYMENT_TOKEN`
- `AZURE_STATIC_WEB_APPS_API_TOKEN`
- Or `AZURE_STATIC_WEB_APPS_APP_NAME` plus an authenticated Azure CLI session so the script can fetch the token

Optional environment variables:

- `AZURE_RESOURCE_GROUP`
- `AZURE_STATIC_WEB_APPS_ENVIRONMENT`