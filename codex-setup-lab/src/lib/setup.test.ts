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
  it('uses provider defaults for optional model behavior', () => {
    const config = buildConfigToml(createValidState())

    expect(config).toContain('model = "gpt-5.6-sol"')
    expect(config).toContain('wire_api = "responses"')
    expect(config).not.toContain('model_reasoning_effort')
    expect(config).not.toContain('model_reasoning_summary')
    expect(config).not.toContain('model_verbosity')
    expect(config).not.toContain('personality')
    expect(config).not.toContain('model_context_window')
  })

  it('writes explicitly selected API and local execution settings', () => {
    const config = buildConfigToml(createValidState({
      modelReasoningEffort: 'high',
      modelVerbosity: 'low',
      approvalPolicy: 'on-request',
      sandboxMode: 'workspace-write',
      requestMaxRetries: '3',
      streamMaxRetries: '2',
      streamIdleTimeoutMs: '120000',
    }))

    expect(config).toContain('model_reasoning_effort = "high"')
    expect(config).toContain('model_verbosity = "low"')
    expect(config).toContain('approval_policy = "on-request"')
    expect(config).toContain('sandbox_mode = "workspace-write"')
    expect(config).toContain('request_max_retries = 3')
    expect(config).toContain('stream_max_retries = 2')
    expect(config).toContain('stream_idle_timeout_ms = 120000')
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

  it('uses auth.command instead of env_key for a custom provider when enabled', () => {
    const state = createValidState({ customProviderUseAuthCommand: true })
    const config = buildConfigToml(state)

    expect(config).not.toContain('env_key = "CUSTOM_API_KEY"')
    expect(config).toContain('requires_openai_auth = false')
    expect(config).toContain('[model_providers.proxy.auth]')
    expect(config).toContain('command = "printenv"')
    expect(config).toContain('args = ["CUSTOM_API_KEY"]')
    expect(config).toContain('timeout_ms = 5000')
    expect(config).toContain('refresh_interval_ms = 0')
    expect(buildShellScript(state)).toContain("ENV_NAME_0='CUSTOM_API_KEY'")
  })

  it('uses a non-interactive PowerShell auth command for a Windows custom provider', () => {
    const config = buildConfigToml(createValidState({
      customProviderUseAuthCommand: true,
      targetOs: 'windows',
    }))

    expect(config).toContain('command = "powershell.exe"')
    expect(config).toContain('args = ["-NoProfile", "-NonInteractive", "-Command", "[Console]::Out.Write($env:CUSTOM_API_KEY)"]')
    expect(config).not.toContain('command = "printenv"')
  })

  it.each(['ollama', 'lmstudio'] as const)('uses a non-reserved provider ID for %s', (localProviderKind) => {
    const config = buildConfigToml(createValidState({
      provider: 'local',
      localProviderKind,
      localProviderName: localProviderKind === 'ollama' ? 'Ollama' : 'LM Studio',
      localProviderBaseUrl: 'http://localhost:11434/v1',
    }))

    expect(config).toContain(`model_provider = "local_${localProviderKind}"`)
    expect(config).toContain(`[model_providers.local_${localProviderKind}]`)
    expect(config).not.toContain(`[model_providers.${localProviderKind}]`)
  })
})

describe('Context7 API key', () => {
  const key = 'ctx-secret-value'
  const state = createValidState({
    enabledPresetSecrets: { context7: true },
    presetMcpSecrets: { context7: key },
  })

  it('whitelists the environment variable without writing the key to TOML', () => {
    const config = buildConfigToml(state)

    expect(config).toMatch(/\[mcp_servers\.context7\][\s\S]*?env_vars = \["CONTEXT7_API_KEY"\]/)
    expect(config).not.toContain(key)
  })

  it('omits the environment variable until the optional key is enabled', () => {
    const config = buildConfigToml(createValidState())

    expect(config).not.toContain('CONTEXT7_API_KEY')
  })

  it('persists the key through generated setup scripts', () => {
    expect(buildShellScript(state)).toContain("ENV_NAME_1='CONTEXT7_API_KEY'")
    expect(buildShellScript(state)).toContain("ENV_VALUE_1='ctx-secret-value'")

    const powerShellScript = buildPowerShellScript({ ...state, targetOs: 'windows' })
    expect(powerShellScript).toContain("$EnvName1 = 'CONTEXT7_API_KEY'")
    expect(powerShellScript).toContain("$EnvValue1 = 'ctx-secret-value'")
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
  it('accepts Codex uint64 boundaries for provider retry and timeout settings', () => {
    const state = createValidState({
      requestMaxRetries: '0',
      streamMaxRetries: '9223372036854775807',
      streamIdleTimeoutMs: '1',
    })

    expect(validateStep(2, state, 'en')).toBeNull()
  })

  it('rejects provider retry and timeout values above uint64', () => {
    const state = createValidState({ requestMaxRetries: '9223372036854775808' })

    expect(validateStep(2, state, 'en')).toContain('0 to 9223372036854775807')
  })

  it('rejects a zero stream idle timeout that would immediately end live SSE streams', () => {
    const state = createValidState({ streamIdleTimeoutMs: '0' })

    expect(validateStep(2, state, 'en')).toContain('stream timeout must start at 1')
  })

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