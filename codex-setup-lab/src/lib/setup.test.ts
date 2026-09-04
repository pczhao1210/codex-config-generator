import { describe, expect, it } from 'vitest'
import {
  buildConfigToml,
  buildPowerShellScript,
  buildShellScript,
  createCustomMcpEntry,
  defaultState,
  validateStep,
  type SetupState,
} from './setup'

function createValidState(overrides: Partial<SetupState> = {}): SetupState {
  return {
    ...defaultState,
    customProviderBaseUrl: 'https://proxy.example.com/v1',
    ...overrides,
  }
}

describe('buildConfigToml', () => {
  it('uses the new model and pragmatic personality by default', () => {
    const config = buildConfigToml(createValidState())

    expect(config).toContain('model = "gpt-5.6-sol"')
    expect(config).toContain('personality = "pragmatic"')
    expect(config).toContain('wire_api = "responses"')
    expect(config).not.toContain('model_context_window')
  })

  it('writes the optional 272K context limit', () => {
    const config = buildConfigToml(createValidState({ contextWindowLimit: '272k' }))

    expect(config).toContain('model_context_window = 272000')
  })

  it('allows extra startup time for npx-based default MCP servers', () => {
    const config = buildConfigToml(createValidState())

    expect(config).toMatch(/\[mcp_servers\.context7\][\s\S]*?startup_timeout_sec = 60/)
    expect(config).toMatch(/\[mcp_servers\.sequential_thinking\][\s\S]*?startup_timeout_sec = 60/)
  })

  it('generates the New API provider preset values', () => {
    const config = buildConfigToml(createValidState({
      customProviderPreset: 'newapi',
      customProviderId: 'newapi',
      customProviderName: 'New API',
      customProviderBaseUrl: 'https://new-api.example.com/v1',
      customProviderEnvKey: 'NEW_API_KEY',
    }))

    expect(config).toContain('model_provider = "newapi"')
    expect(config).toContain('[model_providers.newapi]')
    expect(config).toContain('name = "New API"')
    expect(config).toContain('env_key = "NEW_API_KEY"')
    expect(config).toContain('wire_api = "responses"')
  })
})

describe('HTTP MCP bearer tokens', () => {
  const token = "token-$value'quoted"
  const httpMcp = {
    ...createCustomMcpEntry(1),
    name: 'secure-http',
    protocol: 'http' as const,
    url: 'https://mcp.example.com/mcp',
    bearerTokenEnvVar: 'MCP_TOKEN',
    bearerTokenValue: token,
  }
  const state = createValidState({ customMcps: [httpMcp] })

  it('references the environment variable without writing the token to TOML', () => {
    const config = buildConfigToml(state)

    expect(config).toContain('bearer_token_env_var = "MCP_TOKEN"')
    expect(config).not.toContain(token)
  })

  it('persists the token safely in the Unix setup script', () => {
    const script = buildShellScript(state)

    expect(script).toContain("ENV_NAME_1='MCP_TOKEN'")
    expect(script).toContain(`ENV_VALUE_1='token-$value'"'"'quoted'`)
    expect(script).toContain('umask 077')
    expect(script).toContain('chmod 600 "$CODEX_HOME/env.sh"')
  })

  it('persists the token safely in the PowerShell setup script', () => {
    const script = buildPowerShellScript({ ...state, targetOs: 'windows' })

    expect(script).toContain("$EnvName1 = 'MCP_TOKEN'")
    expect(script).toContain("$EnvValue1 = 'token-$value''quoted'")
  })

  it('prompts for a missing token at script runtime', () => {
    const promptState = createValidState({
      customMcps: [{ ...httpMcp, bearerTokenValue: '' }],
    })

    expect(buildShellScript(promptState)).toContain('Enter ${ENV_NAME_1}:')
    const powerShellScript = buildPowerShellScript({ ...promptState, targetOs: 'windows' })
    expect(powerShellScript).toContain('Read-Host $Prompt -AsSecureString')
    expect(powerShellScript).toContain('Read-SecretValue "Enter $EnvName1"')
  })
})

describe('validateStep', () => {
  it('rejects invalid bearer token environment variable names', () => {
    const state = createValidState({
      customMcps: [{
        ...createCustomMcpEntry(1),
        name: 'secure-http',
        protocol: 'http',
        url: 'https://mcp.example.com/mcp',
        bearerTokenEnvVar: 'INVALID-NAME',
      }],
    })

    expect(validateStep(3, state, 'en')).toContain('invalid bearer token environment variable name')
  })

  it('rejects MCP names that collide after normalization', () => {
    const state = createValidState({
      selectedMcpPresetIds: ['context7'],
      customMcps: [{ ...createCustomMcpEntry(1), name: 'Context7' }],
    })

    expect(validateStep(3, state, 'en')).toContain('same config ID')
  })
})