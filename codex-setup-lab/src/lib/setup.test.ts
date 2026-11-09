import { describe, expect, it } from 'vitest'
import { parse } from 'smol-toml'
import {
  buildArtifacts,
  buildConfigToml,
  buildPowerShellScript,
  buildShellScript,
  createCustomMcpEntry,
  defaultState,
  statusLineItems,
  terminalTitleItems,
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
    expect(parse(config)).not.toHaveProperty('tui')
  })

  describe('optional TUI configuration', () => {
    it('preserves the selected order and serializes arrays and booleans in a root TUI table', () => {
      const config = parse(buildConfigToml(createValidState({
        customProviderUseAuthCommand: true,
        customMcps: [{ ...createCustomMcpEntry(1), env: 'REGION=test' }],
        tuiTerminalTitleEnabled: true,
        tuiStatusLineEnabled: true,
        tuiStatusLineUseColors: 'enabled',
      })))

      expect(config.tui).toEqual({
        terminal_title: [
          'thread-name', 'activity', 'project-name', 'context-remaining',
          'total-input-tokens', 'total-output-tokens', 'model-with-reasoning',
        ],
        status_line: [
          'model-with-reasoning', 'current-dir', 'thread-name', 'branch-changes',
          'permissions', 'context-remaining', 'used-tokens',
        ],
        status_line_use_colors: true,
      })
      expect(config).not.toHaveProperty('model_providers.proxy.auth.tui')
      expect(config).not.toHaveProperty('mcp_servers.custom_mcp_1.env.tui')
      expect(config.tui).not.toHaveProperty('screen_reader_detection_done')
      expect(config.tui).not.toHaveProperty('model_availability_nux')
    })

    it.each([
      [{ tuiTerminalTitleEnabled: true, tuiTerminalTitle: ['activity', 'thread-name'] }, { terminal_title: ['activity', 'thread-name'] }],
      [{ tuiStatusLineEnabled: true, tuiStatusLine: ['used-tokens', 'model-with-reasoning'] }, { status_line: ['used-tokens', 'model-with-reasoning'] }],
      [{ tuiTerminalTitleEnabled: true, tuiTerminalTitle: [] }, { terminal_title: [] }],
      [{ tuiStatusLineEnabled: true, tuiStatusLine: [] }, { status_line: [] }],
      [{ tuiStatusLineUseColors: 'enabled' }, { status_line_use_colors: true }],
      [{ tuiStatusLineUseColors: 'disabled' }, { status_line_use_colors: false }],
    ] satisfies Array<[Partial<SetupState>, Record<string, unknown>]>)('writes only explicitly configured TUI settings: %j', (overrides, expected) => {
      const state = createValidState(overrides)
      expect(validateStep(3, state, 'en')).toBeNull()
      expect(parse(buildConfigToml(state)).tui).toEqual(expected)
    })

    it('omits disabled lists even if their draft values are invalid', () => {
      const state = createValidState({
        tuiTerminalTitle: ['permissions'],
        tuiStatusLine: ['activity'],
      })
      expect(validateStep(3, state, 'en')).toBeNull()
      expect(parse(buildConfigToml(state))).not.toHaveProperty('tui')
    })

    it('accepts all offered items and rejects items on the wrong surface', () => {
      expect(validateStep(3, createValidState({
        tuiTerminalTitleEnabled: true,
        tuiTerminalTitle: [...terminalTitleItems],
        tuiStatusLineEnabled: true,
        tuiStatusLine: [...statusLineItems],
      }), 'en')).toBeNull()
      expect(validateStep(3, createValidState({
        tuiStatusLineEnabled: true,
        tuiStatusLine: ['activity'],
      }), 'en')).toContain('tui.status_line contains unsupported items: activity')
      expect(validateStep(3, createValidState({
        tuiTerminalTitleEnabled: true,
        tuiTerminalTitle: ['permissions'],
      }), 'zh')).toContain('tui.terminal_title 包含不支持的字段：permissions')
    })

    it('serializes only selected items in their chosen order without mutating state', () => {
      const state = createValidState({
        tuiTerminalTitleEnabled: true,
        tuiTerminalTitle: ['model-with-reasoning', 'thread-name'],
        tuiStatusLineEnabled: true,
        tuiStatusLine: ['used-tokens'],
      })
      const original = structuredClone(state)
      expect(parse(buildConfigToml(state)).tui).toEqual({
        terminal_title: ['model-with-reasoning', 'thread-name'],
        status_line: ['used-tokens'],
      })
      expect(state).toEqual(original)
    })

    it.each(['linux', 'macos', 'windows'] as const)('embeds the same TUI configuration in %s artifacts', (targetOs) => {
      const state = createValidState({
        targetOs,
        tuiTerminalTitleEnabled: true,
        tuiStatusLineEnabled: true,
        tuiStatusLineUseColors: 'disabled',
      })
      const config = buildConfigToml(state)
      const artifacts = buildArtifacts(state, 'en')
      expect(artifacts.find((artifact) => artifact.filename === 'config.toml')?.content).toBe(config)
      const script = artifacts.find((artifact) => /\.(sh|ps1)$/.test(artifact.filename))
      expect(script?.content).toContain(config.trim())
    })
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

describe('buildShellScript', () => {
  it('prompts Linux users to reload bashrc after writing the configuration', () => {
    const script = buildShellScript(createValidState({ targetOs: 'linux' }))
    const reloadPrompt = 'echo "Run in your current terminal: source ~/.bashrc"'

    expect(script).toContain(reloadPrompt)
    expect(script.indexOf(reloadPrompt)).toBeGreaterThan(script.indexOf('Configuration complete.'))
    expect(script.indexOf(reloadPrompt)).toBeLessThan(script.indexOf('Press any key to exit...'))
  })

  it('does not prompt macOS users to reload bashrc', () => {
    const script = buildShellScript(createValidState({ targetOs: 'macos' }))

    expect(script).not.toContain('source ~/.bashrc')
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

  it('keeps URL-based MCP entries separate from stdio command entries', () => {
    const config = parse(buildConfigToml({
      ...state,
      selectedMcpPresetIds: ['context7', 'microsoft-docs'],
    }))

    expect(config).toHaveProperty('mcp_servers.secure_http', {
      url: 'https://mcp.example.com/mcp',
      bearer_token_env_var: 'MCP_TOKEN',
    })
    expect(config).toHaveProperty('mcp_servers.microsoft_docs', {
      url: 'https://learn.microsoft.com/api/mcp',
    })
    expect(config).toHaveProperty('mcp_servers.context7.command', 'npx')
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