import { execFileSync } from 'node:child_process'

export type BuildSource = 'vite-build' | 'vite-dev'

export interface BuildCiInfo {
  provider: 'github-actions'
  repository: string | null
  runId: string | null
  runNumber: string | null
  runUrl: string | null
}

export interface BuildInfo {
  app: string
  source: BuildSource
  builtAt: string
  commit: string | null
  shortCommit: string | null
  branch: string | null
  ci: BuildCiInfo | null
}

export type GitRunner = (args: string[]) => string | null

export interface CreateBuildInfoOptions {
  source?: BuildSource
  env?: Record<string, string | undefined>
  now?: Date
  git?: GitRunner
}

const appName = 'codex-config-generator'
const commitPattern = /^[0-9a-f]{40}$/i

function runGit(args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    })
  } catch {
    return null
  }
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeCommit(value: string | null | undefined): string | null {
  const commit = clean(value)
  return commit && commitPattern.test(commit) ? commit.toLowerCase() : null
}

function readCi(env: Record<string, string | undefined>): BuildCiInfo | null {
  if (env.GITHUB_ACTIONS !== 'true') {
    return null
  }

  const repository = clean(env.GITHUB_REPOSITORY)
  const runId = clean(env.GITHUB_RUN_ID)
  const serverUrl = clean(env.GITHUB_SERVER_URL)?.replace(/\/+$/, '') ?? 'https://github.com'

  return {
    provider: 'github-actions',
    repository,
    runId,
    runNumber: clean(env.GITHUB_RUN_NUMBER),
    runUrl: repository && runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : null,
  }
}

export function createBuildInfo(options: CreateBuildInfoOptions = {}): BuildInfo {
  const env = options.env ?? process.env
  const git = options.git ?? runGit
  const ci = readCi(env)

  // GitHub Actions exposes the exact pushed ref; local builds fall back to the checked-out repository.
  const commit = normalizeCommit(ci ? env.GITHUB_SHA : null) ?? normalizeCommit(git(['rev-parse', 'HEAD']))
  const ciBranch = ci ? clean(env.GITHUB_HEAD_REF) ?? clean(env.GITHUB_REF_NAME) : null
  const gitBranch = ciBranch ? null : clean(git(['rev-parse', '--abbrev-ref', 'HEAD']))

  return {
    app: appName,
    source: options.source ?? 'vite-build',
    builtAt: (options.now ?? new Date()).toISOString(),
    commit,
    shortCommit: commit ? commit.slice(0, 7) : null,
    branch: ciBranch ?? (gitBranch === 'HEAD' ? null : gitBranch),
    ci,
  }
}

export function serializeBuildInfo(info: BuildInfo): string {
  return `${JSON.stringify(info, null, 2)}\n`
}
