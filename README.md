# Codex Config Generator

[中文说明](./README.zh-CN.md)

Codex Config Generator is a static web application for generating Codex setup artifacts across Linux, macOS, and Windows. It helps users assemble install guidance, provider configuration, `config.toml`, and MCP snippets without relying on a backend service.

The live site is available at [codex-config.thingsbud.com](https://codex-config.thingsbud.com/).

## What It Does

- Detects the browser OS and lets the user switch the target platform manually.
- Generates setup output for Codex CLI and Codex App scenarios.
- Defaults to `gpt-5.6-sol` with the `pragmatic` personality and offers an optional 272K context limit.
- Supports Azure OpenAI, New API, custom OpenAI-compatible providers, and local OpenAI-compatible providers.
- Includes MCP presets, custom MCP entry management, and environment-backed bearer authentication for HTTP MCP servers.
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

## Validation

```bash
cd codex-setup-lab
pnpm test
pnpm lint
pnpm test:codex
pnpm test:codex:live
```

`test:codex` is a required release gate. It uses the installed Codex CLI to load generated `config.toml` variants for every exposed advanced value and provider type, then starts `codex exec` against a local probe to verify the model reasoning and verbosity request values. The deployment workflow installs the validated baseline, `@openai/codex@0.153.2`; local deployment requires `codex` on `PATH`.

`test:codex:live` is the final release gate. By default, it reads the active model and provider from `~/.codex/config.toml`, generates isolated temporary configs, and runs four minimal real API turns that cover every exposed value. It never copies the API key into TOML or modifies the source config. CI must provide `CODEX_LIVE_CONFIG_TOML` and `CODEX_LIVE_API_KEY` as repository secrets; the config secret should contain only the model and active provider definition needed by the gate.

## HTTP MCP Bearer Tokens

For `bearer_token_env_var = "MCP_TOKEN"`, enter the raw token without the `Bearer ` prefix. Codex reads `MCP_TOKEN` from its process environment and adds the authorization scheme automatically. Restart the terminal, Codex App, or VS Code after the generated setup script persists a new variable.

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