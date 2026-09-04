import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildConfigToml, defaultState, type SetupState } from './setup'

interface DoctorCheck {
  id: string
  status: string
  details: Record<string, string>
}

interface DoctorReport {
  codexVersion: string
  checks: Record<string, DoctorCheck>
}

const releaseGateEnabled = process.env.CODEX_RELEASE_GATE === '1'

function createGateState(overrides: Partial<SetupState>): SetupState {
  return {
    ...defaultState,
    targetOs: 'linux',
    selectedMcpPresetIds: [],
    customProviderBaseUrl: 'http://127.0.0.1:9/v1',
    ...overrides,
  }
}

function runDoctor(state: SetupState): DoctorReport {
  const codexHome = mkdtempSync(join(tmpdir(), 'codex-config-gate-'))

  try {
    writeFileSync(join(codexHome, 'config.toml'), buildConfigToml(state))
    const result = spawnSync('codex', ['--strict-config', 'doctor', '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        AZURE_OPENAI_API_KEY: 'release-gate-placeholder',
        CODEX_HOME: codexHome,
        CUSTOM_API_KEY: 'release-gate-placeholder',
      },
    })

    if (result.error) {
      throw result.error
    }

    expect(result.stdout, result.stderr).not.toBe('')
    return JSON.parse(result.stdout) as DoctorReport
  } finally {
    rmSync(codexHome, { recursive: true, force: true })
  }
}

function expectConfigLoaded(report: DoctorReport): DoctorCheck {
  const configCheck = report.checks['config.load']
  expect(configCheck, `Codex ${report.codexVersion} did not report config.load`).toBeDefined()
  expect(configCheck?.status).toBe('ok')
  expect(configCheck?.details['config.toml parse']).toBe('ok')
  return configCheck as DoctorCheck
}

async function runCodexRequest(overrides: Partial<SetupState>): Promise<Record<string, unknown>> {
  const codexHome = mkdtempSync(join(tmpdir(), 'codex-request-gate-'))
  let resolveRequest: (body: Record<string, unknown>) => void = () => undefined
  const requestReceived = new Promise<Record<string, unknown>>((resolve) => {
    resolveRequest = resolve
  })
  const server = createServer((request, response) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      body += chunk
    })
    request.on('end', () => {
      resolveRequest(JSON.parse(body) as Record<string, unknown>)
      response.writeHead(503, { connection: 'close' })
      response.end('Release gate captured the request')
    })
  })

  try {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Local Responses API gate did not acquire a TCP port')
    }

    const state = createGateState({
      ...overrides,
      customProviderBaseUrl: `http://127.0.0.1:${address.port}/v1`,
    })
    writeFileSync(join(codexHome, 'config.toml'), buildConfigToml(state))

    const child = spawn('codex', [
      '--strict-config',
      'exec',
      '--skip-git-repo-check',
      '--json',
      'Reply with OK.',
    ], {
      cwd: codexHome,
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
        CUSTOM_API_KEY: 'release-gate-placeholder',
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    const childClosed = new Promise<void>((resolve, reject) => {
      child.on('error', reject)
      child.on('close', () => resolve())
    })
    let timeout: ReturnType<typeof setTimeout> | undefined
    const requestTimeout = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        child.kill()
        reject(new Error(`Timed out waiting for a Codex request:\n${stderr}`))
      }, 10_000)
    })

    try {
      return await Promise.race([
        requestReceived,
        childClosed.then(() => {
          throw new Error(`Codex exited before sending a Responses API request:\n${stderr}`)
        }),
        requestTimeout,
      ])
    } finally {
      clearTimeout(timeout)
      child.kill()
      await childClosed
    }
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    rmSync(codexHome, { recursive: true, force: true })
  }
}

describe.skipIf(!releaseGateEnabled)('Codex CLI release gate', () => {
  it.each([
    ['azure', {
      provider: 'azure',
      azureBaseUrl: 'http://127.0.0.1:9/openai/v1',
    }],
    ['custom', {}],
    ['ollama', {
      provider: 'local',
      localProviderKind: 'ollama',
    }],
    ['lmstudio', {
      provider: 'local',
      localProviderKind: 'lmstudio',
      localProviderName: 'LM Studio',
      localProviderBaseUrl: 'http://localhost:1234/v1',
    }],
    ['custom local', {
      provider: 'local',
      localProviderKind: 'custom',
      localProviderName: 'Local Gateway',
      localProviderBaseUrl: 'http://localhost:8000/v1',
    }],
  ] satisfies Array<[string, Partial<SetupState>]>)('loads all advanced settings for the %s provider', (_name, provider) => {
    expectConfigLoaded(runDoctor(createGateState({
      ...provider,
      modelReasoningEffort: 'high',
      modelVerbosity: 'medium',
      approvalPolicy: 'never',
      sandboxMode: 'workspace-write',
      contextWindowLimit: '272k',
      requestMaxRetries: '3',
      streamMaxRetries: '2',
      streamIdleTimeoutMs: '120000',
    })))
  })

  it.each(['low', 'medium', 'high', 'xhigh'] as const)(
    'loads model_reasoning_effort=%s',
    (modelReasoningEffort) => {
      expectConfigLoaded(runDoctor(createGateState({ modelReasoningEffort })))
    },
  )

  it.each(['low', 'medium', 'high'] as const)('loads model_verbosity=%s', (modelVerbosity) => {
    expectConfigLoaded(runDoctor(createGateState({ modelVerbosity })))
  })

  it.each([
    ['on-request', 'OnRequest'],
    ['never', 'Never'],
  ] as const)('applies approval_policy=%s', (approvalPolicy, expectedPolicy) => {
    const report = runDoctor(createGateState({ approvalPolicy }))
    expectConfigLoaded(report)
    const sandboxCheck = report.checks['sandbox.helpers']
    expect(sandboxCheck?.details['approval policy']).toBe(expectedPolicy)
  })

  it.each([
    ['read-only', 'restricted'],
    ['workspace-write', 'restricted'],
    ['danger-full-access', 'unrestricted'],
  ] as const)('applies sandbox_mode=%s', (sandboxMode, expectedSandbox) => {
    const report = runDoctor(createGateState({ sandboxMode }))
    expectConfigLoaded(report)
    const sandboxCheck = report.checks['sandbox.helpers']
    expect(sandboxCheck?.details['filesystem sandbox']).toBe(expectedSandbox)
  })

  it.each([
    ['model_context_window', { contextWindowLimit: '272k' }],
    ['request_max_retries=0', { requestMaxRetries: '0' }],
    ['request_max_retries=3', { requestMaxRetries: '3' }],
    ['request_max_retries=TOML_INT_MAX', { requestMaxRetries: '9223372036854775807' }],
    ['stream_max_retries=0', { streamMaxRetries: '0' }],
    ['stream_max_retries=2', { streamMaxRetries: '2' }],
    ['stream_max_retries=TOML_INT_MAX', { streamMaxRetries: '9223372036854775807' }],
    ['stream_idle_timeout_ms=1', { streamIdleTimeoutMs: '1' }],
    ['stream_idle_timeout_ms=120000', { streamIdleTimeoutMs: '120000' }],
    ['stream_idle_timeout_ms=TOML_INT_MAX', { streamIdleTimeoutMs: '9223372036854775807' }],
  ] satisfies Array<[string, Partial<SetupState>]>)('loads %s', (_name, overrides) => {
    expectConfigLoaded(runDoctor(createGateState(overrides)))
  })

  it.each(['low', 'medium', 'high', 'xhigh'] as const)(
    'sends model_reasoning_effort=%s to the Responses API',
    async (modelReasoningEffort) => {
      const request = await runCodexRequest({ modelReasoningEffort })
      expect(request.reasoning).toMatchObject({ effort: modelReasoningEffort })
    },
    15_000,
  )

  it.each(['low', 'medium', 'high'] as const)(
    'sends model_verbosity=%s to the Responses API',
    async (modelVerbosity) => {
      const request = await runCodexRequest({ modelVerbosity })
      expect(request.text).toMatchObject({ verbosity: modelVerbosity })
    },
    15_000,
  )
})