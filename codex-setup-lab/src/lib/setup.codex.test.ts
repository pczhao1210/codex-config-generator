import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir, tmpdir } from 'node:os'
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
const modelDiscoveryProbeSlug = 'local-auth-command-discovery-probe'

function buildModelDiscoveryResponse(): Record<string, unknown> {
  const result = spawnSync('codex', ['debug', 'models', '--bundled'], {
    encoding: 'utf8',
  })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`Could not read the bundled Codex model schema:\n${result.stderr}`)
  }

  const catalog = JSON.parse(result.stdout) as { models?: unknown[] }
  const bundledModel = catalog.models?.[0]
  if (!bundledModel || typeof bundledModel !== 'object') {
    throw new Error('The bundled Codex model catalog did not contain a model')
  }

  return {
    models: [{
      ...(bundledModel as Record<string, unknown>),
      display_name: 'Local Auth Command Discovery Probe',
      slug: modelDiscoveryProbeSlug,
    }],
  }
}

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

async function runCodexRequest(
  overrides: Partial<SetupState>,
  endpoint: 'responses' | 'models' = 'responses',
): Promise<Record<string, unknown>> {
  const codexHome = mkdtempSync(join(homedir(), '.codex-request-gate-'))
  const modelDiscoveryResponse = endpoint === 'models' ? buildModelDiscoveryResponse() : null
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
      const requestPath = new URL(request.url ?? '/', 'http://localhost').pathname
      if (!requestPath.endsWith(`/${endpoint}`)) {
        response.writeHead(404, { connection: 'close' })
        response.end('Not found')
        return
      }

      if (endpoint === 'models') {
        resolveRequest({
          capturedAuthorization: request.headers.authorization,
          capturedMethod: request.method,
          capturedUrl: request.url,
        })
        response.writeHead(200, { connection: 'close', 'content-type': 'application/json' })
        response.end(JSON.stringify(modelDiscoveryResponse))
        return
      }

      if (!body) {
        response.writeHead(400, { connection: 'close' })
        response.end('Missing request body')
        return
      }

      resolveRequest({
        ...(JSON.parse(body) as Record<string, unknown>),
        capturedAuthorization: request.headers.authorization,
      })
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

    const args = endpoint === 'models'
      ? ['debug', 'models']
      : ['--strict-config', 'exec', '--skip-git-repo-check', '--json', 'Reply with OK.']
    const child = spawn('codex', args, {
      cwd: codexHome,
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
        CUSTOM_API_KEY: 'release-gate-placeholder',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    const childClosed = new Promise<number | null>((resolve, reject) => {
      child.on('error', reject)
      child.on('close', (exitCode) => resolve(exitCode))
    })
    let timeout: ReturnType<typeof setTimeout> | undefined
    const requestTimeout = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        child.kill()
        reject(new Error(`Timed out waiting for a Codex request:\n${stderr}`))
      }, 10_000)
    })

    try {
      const request = await Promise.race([
        requestReceived,
        childClosed.then((exitCode) => {
          throw new Error(`Codex exited with code ${exitCode} before sending a ${endpoint} API request:\n${stderr}`)
        }),
        requestTimeout,
      ])

      if (endpoint === 'models') {
        const exitCode = await Promise.race([childClosed, requestTimeout])
        return {
          ...request,
          codexExitCode: exitCode,
          codexStderr: stderr,
          codexStdout: stdout,
        }
      }

      return request
    } finally {
      clearTimeout(timeout)
      if (child.exitCode === null && child.signalCode === null) {
        child.kill()
      }
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

  it('loads custom provider auth.command configuration', () => {
    expectConfigLoaded(runDoctor(createGateState({ customProviderUseAuthCommand: true })))
  })

  it('uses the auth.command output as the Responses API bearer token', async () => {
    const request = await runCodexRequest({ customProviderUseAuthCommand: true })

    expect(request.capturedAuthorization).toBe('Bearer release-gate-placeholder')
  }, 15_000)

  it('uses the auth.command output to fetch the remote model catalog', async () => {
    const request = await runCodexRequest({ customProviderUseAuthCommand: true }, 'models')
    const catalog = JSON.parse(request.codexStdout as string) as {
      models?: Array<{ slug?: string }>
    }

    expect(request.capturedMethod).toBe('GET')
    expect(request.capturedUrl).toMatch(/^\/v1\/models\?client_version=/)
    expect(request.capturedAuthorization).toBe('Bearer release-gate-placeholder')
    expect(request.codexExitCode).toBe(0)
    expect(request.codexStderr).toBe('')
    expect(catalog.models?.some((model) => model.slug === modelDiscoveryProbeSlug)).toBe(true)
  }, 15_000)

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