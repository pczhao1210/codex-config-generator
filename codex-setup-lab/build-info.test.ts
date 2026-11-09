import { describe, expect, it, vi } from 'vitest'
import { createBuildInfo, serializeBuildInfo, type GitRunner } from './build-info'

const sha = '8D59F3DEF0285917076440D6D08EEC4907795DAD'
const now = new Date('2026-11-09T06:15:58.000Z')

function gitStub(outputs: Record<string, string | null>): GitRunner {
  return vi.fn((args: string[]) => outputs[args.join(' ')] ?? null)
}

describe('createBuildInfo', () => {
  it('uses GitHub Actions metadata without calling git', () => {
    const git = gitStub({})
    const info = createBuildInfo({
      env: {
        GITHUB_ACTIONS: 'true',
        GITHUB_SHA: sha,
        GITHUB_REF_NAME: 'main',
        GITHUB_REPOSITORY: 'pczhao1210/codex-config-generator',
        GITHUB_RUN_ID: '42571978981',
        GITHUB_RUN_NUMBER: '27',
        GITHUB_SERVER_URL: 'https://github.com/',
      },
      git,
      now,
    })

    expect(info).toEqual({
      app: 'codex-config-generator',
      source: 'vite-build',
      builtAt: '2026-11-09T06:15:58.000Z',
      commit: sha.toLowerCase(),
      shortCommit: '8d59f3d',
      branch: 'main',
      ci: {
        provider: 'github-actions',
        repository: 'pczhao1210/codex-config-generator',
        runId: '42571978981',
        runNumber: '27',
        runUrl: 'https://github.com/pczhao1210/codex-config-generator/actions/runs/42571978981',
      },
    })
    expect(git).not.toHaveBeenCalled()
  })

  it('prefers the pull request head branch in GitHub Actions', () => {
    const info = createBuildInfo({
      env: { GITHUB_ACTIONS: 'true', GITHUB_SHA: sha, GITHUB_HEAD_REF: 'feature/tui', GITHUB_REF_NAME: '12/merge' },
      git: gitStub({}),
      now,
    })

    expect(info.branch).toBe('feature/tui')
    expect(info.ci?.runUrl).toBeNull()
  })

  it('falls back to local git for non-CI builds', () => {
    const info = createBuildInfo({
      source: 'vite-dev',
      env: {},
      git: gitStub({ 'rev-parse HEAD': `${sha}\n`, 'rev-parse --abbrev-ref HEAD': 'main\n' }),
      now,
    })

    expect(info).toMatchObject({
      source: 'vite-dev',
      commit: sha.toLowerCase(),
      shortCommit: '8d59f3d',
      branch: 'main',
      ci: null,
    })
  })

  it('ignores GitHub variables outside GitHub Actions', () => {
    const info = createBuildInfo({
      env: { GITHUB_SHA: sha, GITHUB_REF_NAME: 'spoofed' },
      git: gitStub({}),
      now,
    })

    expect(info).toMatchObject({ commit: null, shortCommit: null, branch: null, ci: null })
  })

  it('reports a detached HEAD or unavailable git as unknown', () => {
    const detached = createBuildInfo({
      env: {},
      git: gitStub({ 'rev-parse HEAD': sha, 'rev-parse --abbrev-ref HEAD': 'HEAD' }),
      now,
    })
    const noGit = createBuildInfo({ env: {}, git: () => null, now })

    expect(detached.branch).toBeNull()
    expect(noGit).toMatchObject({ commit: null, shortCommit: null, branch: null })
  })

  it('rejects malformed commit values', () => {
    const info = createBuildInfo({
      env: { GITHUB_ACTIONS: 'true', GITHUB_SHA: 'not-a-sha' },
      git: gitStub({ 'rev-parse HEAD': 'fatal: not a git repository' }),
      now,
    })

    expect(info.commit).toBeNull()
  })
})

describe('serializeBuildInfo', () => {
  it('emits formatted JSON with a trailing newline', () => {
    const info = createBuildInfo({ env: {}, git: () => null, now })
    const json = serializeBuildInfo(info)

    expect(json.endsWith('}\n')).toBe(true)
    expect(JSON.parse(json)).toEqual(info)
  })
})
