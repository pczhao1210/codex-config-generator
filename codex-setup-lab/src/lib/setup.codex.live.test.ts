/// <reference types="node" />

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse, TomlDate, type TomlTable, type TomlValue } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { buildConfigToml, defaultState, type SetupState } from './setup'

const liveGateEnabled = process.env.CODEX_LIVE_GATE === '1'
const successMarker = 'CODEX_LIVE_GATE_OK'

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`The live Codex gate requires ${path} in the source config`)
  }
  return value
}

function isTomlTable(value: TomlValue | undefined): value is TomlTable {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof TomlDate)
}

function readSourceConfig(): TomlTable {
  const inlineConfig = process.env.CODEX_LIVE_CONFIG_TOML
  const configText = inlineConfig ?? readFileSync(
    process.env.CODEX_LIVE_CONFIG ?? join(homedir(), '.codex', 'config.toml'),
    'utf8',
  )
  return parse(configText)
}

function createLiveState(overrides: Partial<SetupState>): { state: SetupState, envKey: string } {
  const source = readSourceConfig()
  const model = requireString(source.model, 'model')
  const providerId = requireString(source.model_provider, 'model_provider')
  const providers = source.model_providers
  if (!isTomlTable(providers)) {
    throw new Error('The live Codex gate requires a model_providers table')
  }

  const provider = providers[providerId]
  if (!isTomlTable(provider)) {
    throw new Error(`The live Codex gate requires model_providers.${providerId}`)
  }
  const providerTable = provider as TomlTable

  const baseUrl = requireString(providerTable.base_url, `model_providers.${providerId}.base_url`)
  const envKey = requireString(providerTable.env_key, `model_providers.${providerId}.env_key`)
  if (!process.env.CODEX_LIVE_API_KEY && !process.env[envKey]) {
    throw new Error(`The live Codex gate requires CODEX_LIVE_API_KEY or the ${envKey} environment variable`)
  }

  const common: SetupState = {
    ...defaultState,
    targetOs: 'linux',
    installApp: false,
    model,
    selectedMcpPresetIds: [],
    customMcps: [],
    ...overrides,
  }

  if (providerId === 'azure') {
    const queryParams = providerTable.query_params
    const apiVersion = isTomlTable(queryParams)
      ? queryParams['api-version']
      : undefined
    return {
      envKey,
      state: {
        ...common,
        provider: 'azure',
        apiKeyEnvVar: envKey,
        azureBaseUrl: baseUrl,
        azureApiVersion: typeof apiVersion === 'string' ? apiVersion : '',
      },
    }
  }

  return {
    envKey,
    state: {
      ...common,
      provider: 'custom',
      customProviderId: providerId,
      customProviderName: typeof providerTable.name === 'string' ? providerTable.name : providerId,
      customProviderBaseUrl: baseUrl,
      customProviderEnvKey: envKey,
    },
  }
}

function runLiveCodex(overrides: Partial<SetupState>): void {
  const codexHome = mkdtempSync(join(tmpdir(), 'codex-live-gate-'))

  try {
    const { state, envKey } = createLiveState(overrides)
    writeFileSync(join(codexHome, 'config.toml'), buildConfigToml(state), { mode: 0o600 })
    const result = spawnSync('codex', [
      '--strict-config',
      'exec',
      '--skip-git-repo-check',
      '--json',
      `Do not use tools. Reply with exactly ${successMarker}.`,
    ], {
      cwd: codexHome,
      encoding: 'utf8',
      env: {
        ...process.env,
        [envKey]: process.env.CODEX_LIVE_API_KEY ?? process.env[envKey],
        CODEX_HOME: codexHome,
      },
      input: '',
      timeout: 120_000,
    })

    if (result.error) {
      throw result.error
    }

    const events = result.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type?: string, message?: string, item?: { type?: string, text?: string } })
    const diagnostic = [
      result.stderr,
      ...events
        .filter((event) => event.type === 'error')
        .map((event) => event.message ?? 'Unknown Codex error'),
    ]
      .join('\n')
      .replaceAll(/https?:\/\/\S+/g, '[REDACTED_URL]')
      .replaceAll(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    expect(result.status, diagnostic).toBe(0)
    const responseText = events
      .filter((event) => event.item?.type === 'agent_message')
      .map((event) => event.item?.text ?? '')
      .join('\n')
    expect(responseText).toContain(successMarker)
  } finally {
    rmSync(codexHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}

describe.skipIf(!liveGateEnabled)('Codex live API release gate', () => {
  it.each([
    ['low', {
      modelReasoningEffort: 'low',
      modelVerbosity: 'low',
      approvalPolicy: 'on-request',
      sandboxMode: 'read-only',
      contextWindowLimit: '272k',
      requestMaxRetries: '0',
      streamMaxRetries: '0',
      streamIdleTimeoutMs: '120000',
    }],
    ['medium', {
      modelReasoningEffort: 'medium',
      modelVerbosity: 'medium',
      approvalPolicy: 'never',
      sandboxMode: 'workspace-write',
      requestMaxRetries: '3',
      streamMaxRetries: '2',
      streamIdleTimeoutMs: '120000',
    }],
    ['high', {
      modelReasoningEffort: 'high',
      modelVerbosity: 'high',
      approvalPolicy: 'on-request',
      sandboxMode: 'danger-full-access',
      requestMaxRetries: '9223372036854775807',
      streamMaxRetries: '9223372036854775807',
      streamIdleTimeoutMs: '9223372036854775807',
    }],
    ['xhigh', {
      modelReasoningEffort: 'xhigh',
      modelVerbosity: 'medium',
      approvalPolicy: 'never',
      sandboxMode: 'workspace-write',
    }],
  ] satisfies Array<[string, Partial<SetupState>]>)('starts a real turn with the %s profile', (_name, overrides) => {
    runLiveCodex(overrides)
  }, 125_000)
})