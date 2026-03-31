export type TargetOs = 'linux' | 'macos' | 'windows'
export type ProviderId = 'azure' | 'custom' | 'local'
export type McpProtocol = 'stdio' | 'http'
export type LocalProviderKind = 'ollama' | 'lmstudio' | 'custom'
export type Locale = 'zh' | 'en'

export interface LinkCard {
  title: string
  method: string
  href: string
  note: string
  highlight?: string
  copyable?: boolean
}

export interface StepDefinition {
  id: string
  title: string
  description: string
}

export interface Artifact {
  filename: string
  label: string
  content: string
}

export interface EnvPersistenceGuide {
  title: string
  bullets: string[]
}

export interface McpPreset {
  id: string
  label: string
  description: string
  protocol: McpProtocol
  command?: string
  args?: string[]
  url?: string
  bearerTokenEnvVar?: string
  secretFieldLabel?: string
  secretHelpText?: string
  stdioSecretEnvVar?: string
}

export interface CustomMcpEntry {
  id: string
  name: string
  protocol: McpProtocol
  command: string
  args: string
  env: string
  url: string
  bearerTokenEnvVar: string
  expanded: boolean
}

export interface SetupState {
  targetOs: TargetOs
  installCli: boolean
  installApp: boolean
  provider: ProviderId
  model: string
  apiKeyEnvVar: string
  apiKeyValue: string
  azureBaseUrl: string
  azureApiVersion: string
  customProviderId: string
  customProviderName: string
  customProviderBaseUrl: string
  customProviderEnvKey: string
  localProviderKind: LocalProviderKind
  localProviderName: string
  localProviderBaseUrl: string
  localProviderEnvKey: string
  selectedMcpPresetIds: string[]
  presetMcpSecrets: Record<string, string>
  customMcps: CustomMcpEntry[]
}

const copy = {
  zh: {
    steps: [
      {
        id: 'os',
        title: 'OS 与目标',
        description: '读取浏览器所在 OS，并允许你覆盖目标系统与安装范围。',
      },
      {
        id: 'install',
        title: '安装入口',
        description: '按目标平台展示 CLI 与 App 的官方安装路径与执行方式。',
      },
      {
        id: 'auth',
        title: 'API Key 与 Provider',
        description: '只保留 API Key 认证，并配置 Azure、自定义 OpenAI 兼容或本地 OpenAI 兼容 Provider。',
      },
      {
        id: 'mcp',
        title: 'MCP 模板',
        description: '选择热门 MCP 模板，并按需添加多个可折叠的自定义 MCP。',
      },
      {
        id: 'review',
        title: '生成结果',
        description: '生成脚本、config.toml，并解释各系统下 env key 的持久化方式。',
      },
    ] satisfies StepDefinition[],
    providerLabels: {
      azure: 'Azure OpenAI',
      custom: '自定义 OpenAI 兼容 Provider',
      local: '本地 OpenAI 兼容 Provider',
    } satisfies Record<ProviderId, string>,
    installCatalog: {
      linux: {
        cli: {
          title: 'Codex CLI',
          method: 'npm i -g @openai/codex',
          href: 'https://developers.openai.com/codex/cli/',
          note: '页面提供 CLI 安装命令参考，生成脚本只负责写入配置，不会自动安装。',
        },
        app: {
          title: 'Codex App',
          method: 'Linux 桌面版 App 暂不可用',
          href: 'https://developers.openai.com/codex/quickstart?setup=app',
          note: '当前没有稳定的 Linux 桌面版下载入口，保留官方 App 指引页作为后续参考。',
          copyable: false,
        },
      },
      macos: {
        cli: {
          title: 'Codex CLI',
          method: 'npm i -g @openai/codex',
          href: 'https://developers.openai.com/codex/cli/',
          note: '页面提供 CLI 安装命令参考，生成脚本只负责写入配置，不会自动安装。',
        },
        app: {
          title: 'Codex App',
          method: 'brew install --cask codex-app',
          href: 'https://developers.openai.com/codex/quickstart?setup=app',
          note: 'macOS 可通过 Homebrew cask 安装，结果页脚本仍只负责写入配置。',
        },
      },
      windows: {
        cli: {
          title: 'Codex CLI',
          method: 'npm i -g @openai/codex',
          href: 'https://developers.openai.com/codex/windows',
          highlight: '建议在WSL2中使用',
          note: '页面提供 CLI 安装命令参考，生成脚本只负责写入配置。Windows 原生支持仍属实验性。',
        },
        app: {
          title: 'Codex App',
          method: 'winget install Codex -s msstore',
          href: 'https://developers.openai.com/codex/app/windows',
          note: 'PowerShell 脚本与 bat 脚本会保留 App 安装提示，但不会自动执行安装。',
        },
      },
    } satisfies Record<TargetOs, { cli: LinkCard; app: LinkCard }>,
    mcpPresets: [
      {
        id: 'context7',
        label: 'Context7',
        description: '为 Codex 注入最新开发文档。',
        protocol: 'stdio',
        command: 'npx',
        args: ['-y', '@upstash/context7-mcp'],
      },
      {
        id: 'figma',
        label: 'Figma',
        description: '接入 Figma 设计稿与设计系统上下文。',
        protocol: 'http',
        url: 'https://mcp.figma.com/mcp',
        bearerTokenEnvVar: 'FIGMA_OAUTH_TOKEN',
        secretFieldLabel: 'Figma OAuth Token',
        secretHelpText: '如果填写，生成的脚本会持久化 FIGMA_OAUTH_TOKEN。',
      },
      {
        id: 'microsoft-docs',
        label: 'Microsoft Docs',
        description: '连接官方 Microsoft Learn MCP，检索最新文档与代码示例。',
        protocol: 'http',
        url: 'https://learn.microsoft.com/api/mcp',
      },
      {
        id: 'tavily',
        label: 'Tavily / Travily Search',
        description: '为外部搜索与研究流程提供检索工具。',
        protocol: 'stdio',
        command: 'npx',
        args: ['-y', 'tavily-mcp@latest'],
        stdioSecretEnvVar: 'TAVILY_API_KEY',
        secretFieldLabel: 'Tavily API Key',
        secretHelpText: '如果填写，key 会写入对应 MCP 的 env 配置块。',
      },
      {
        id: 'brave-search',
        label: 'Brave Search',
        description: '提供基于 Brave Search 的搜索能力。',
        protocol: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        stdioSecretEnvVar: 'BRAVE_API_KEY',
        secretFieldLabel: 'Brave Search API Key',
        secretHelpText: '如果填写，key 会写入对应 MCP 的 env 配置块。',
      },
      {
        id: 'sequential-thinking',
        label: 'Sequential Thinking',
        description: '为复杂规划任务加入链式思考辅助。',
        protocol: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
      },
      {
        id: 'playwright',
        label: 'Playwright',
        description: '让 Codex 可操作浏览器完成验证和抓取。',
        protocol: 'stdio',
        command: 'npx',
        args: ['-y', '@playwright/mcp'],
      },
    ] satisfies McpPreset[],
  },
  en: {
    steps: [
      {
        id: 'os',
        title: 'OS And Targets',
        description: 'Detect the browser OS, then let you override the target platform and install scope.',
      },
      {
        id: 'install',
        title: 'Install Entry',
        description: 'Show the official CLI and App install paths for the selected platform.',
      },
      {
        id: 'auth',
        title: 'API Key And Provider',
        description: 'Keep API key auth only and configure Azure, custom OpenAI-compatible, or local OpenAI-compatible providers.',
      },
      {
        id: 'mcp',
        title: 'MCP Templates',
        description: 'Pick common MCP templates and add multiple collapsible custom MCP entries if needed.',
      },
      {
        id: 'review',
        title: 'Generated Output',
        description: 'Generate scripts and config.toml, then explain how env keys persist on each OS.',
      },
    ] satisfies StepDefinition[],
    providerLabels: {
      azure: 'Azure OpenAI',
      custom: 'Custom OpenAI-Compatible Provider',
      local: 'Local OpenAI-Compatible Provider',
    } satisfies Record<ProviderId, string>,
    installCatalog: {
      linux: {
        cli: {
          title: 'Codex CLI',
          method: 'npm i -g @openai/codex',
          href: 'https://developers.openai.com/codex/cli/',
          note: 'The page keeps the CLI install reference visible. Generated scripts only write configuration and never install Codex automatically.',
        },
        app: {
          title: 'Codex App',
          method: 'No Linux desktop app yet',
          href: 'https://developers.openai.com/codex/quickstart?setup=app',
          note: 'A stable Linux desktop app download is not available right now, so the official App quickstart page is kept only as a reference.',
          copyable: false,
        },
      },
      macos: {
        cli: {
          title: 'Codex CLI',
          method: 'npm i -g @openai/codex',
          href: 'https://developers.openai.com/codex/cli/',
          note: 'The page keeps the CLI install reference visible. Generated scripts only write configuration and never install Codex automatically.',
        },
        app: {
          title: 'Codex App',
          method: 'brew install --cask codex-app',
          href: 'https://developers.openai.com/codex/quickstart?setup=app',
          note: 'On macOS, the app can be installed through Homebrew cask. Generated scripts still only write configuration.',
        },
      },
      windows: {
        cli: {
          title: 'Codex CLI',
          method: 'npm i -g @openai/codex',
          href: 'https://developers.openai.com/codex/windows',
          highlight: 'Recommended to use WSL2',
          note: 'The page keeps the CLI install reference visible. Generated scripts only write configuration. Native Windows CLI support is still experimental.',
        },
        app: {
          title: 'Codex App',
          method: 'winget install Codex -s msstore',
          href: 'https://developers.openai.com/codex/app/windows',
          note: 'The generated PowerShell and bat files keep the App install reference, but they do not install it automatically.',
        },
      },
    } satisfies Record<TargetOs, { cli: LinkCard; app: LinkCard }>,
    mcpPresets: [
      {
        id: 'context7',
        label: 'Context7',
        description: 'Inject up-to-date development documentation into Codex.',
        protocol: 'stdio',
        command: 'npx',
        args: ['-y', '@upstash/context7-mcp'],
      },
      {
        id: 'figma',
        label: 'Figma',
        description: 'Attach Figma files and design-system context.',
        protocol: 'http',
        url: 'https://mcp.figma.com/mcp',
        bearerTokenEnvVar: 'FIGMA_OAUTH_TOKEN',
        secretFieldLabel: 'Figma OAuth Token',
        secretHelpText: 'If provided, the generated script will persist FIGMA_OAUTH_TOKEN.',
      },
      {
        id: 'microsoft-docs',
        label: 'Microsoft Docs',
        description: 'Connect to the official Microsoft Learn MCP for current docs and code samples.',
        protocol: 'http',
        url: 'https://learn.microsoft.com/api/mcp',
      },
      {
        id: 'tavily',
        label: 'Tavily / Travily Search',
        description: 'Add web search tools for external research workflows.',
        protocol: 'stdio',
        command: 'npx',
        args: ['-y', 'tavily-mcp@latest'],
        stdioSecretEnvVar: 'TAVILY_API_KEY',
        secretFieldLabel: 'Tavily API Key',
        secretHelpText: 'If provided, the key is written into that MCP env block.',
      },
      {
        id: 'brave-search',
        label: 'Brave Search',
        description: 'Enable search powered by Brave Search.',
        protocol: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        stdioSecretEnvVar: 'BRAVE_API_KEY',
        secretFieldLabel: 'Brave Search API Key',
        secretHelpText: 'If provided, the key is written into that MCP env block.',
      },
      {
        id: 'sequential-thinking',
        label: 'Sequential Thinking',
        description: 'Add structured reasoning support for complex planning tasks.',
        protocol: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
      },
      {
        id: 'playwright',
        label: 'Playwright',
        description: 'Let Codex drive a browser for validation and retrieval tasks.',
        protocol: 'stdio',
        command: 'npx',
        args: ['-y', '@playwright/mcp'],
      },
    ] satisfies McpPreset[],
  },
} satisfies Record<Locale, {
  steps: StepDefinition[]
  providerLabels: Record<ProviderId, string>
  installCatalog: Record<TargetOs, { cli: LinkCard; app: LinkCard }>
  mcpPresets: McpPreset[]
}>

export const defaultState: SetupState = {
  targetOs: 'linux',
  installCli: true,
  installApp: true,
  provider: 'custom',
  model: 'gpt-5.4',
  apiKeyEnvVar: 'AZURE_OPENAI_API_KEY',
  apiKeyValue: '',
  azureBaseUrl: 'https://YOUR_RESOURCE_NAME.openai.azure.com/openai/v1',
  azureApiVersion: '',
  customProviderId: 'proxy',
  customProviderName: 'Custom OpenAI-Compatible Provider',
  customProviderBaseUrl: '',
  customProviderEnvKey: 'CUSTOM_API_KEY',
  localProviderKind: 'ollama',
  localProviderName: 'Ollama',
  localProviderBaseUrl: 'http://localhost:11434/v1',
  localProviderEnvKey: 'CUSTOM_API_KEY',
  selectedMcpPresetIds: ['context7', 'sequential-thinking'],
  presetMcpSecrets: {},
  customMcps: [],
}

export const osLabels: Record<TargetOs, string> = {
  linux: 'Linux',
  macos: 'macOS',
  windows: 'Windows',
}

export function getSteps(locale: Locale): StepDefinition[] {
  return copy[locale].steps
}

export function getProviderLabels(locale: Locale): Record<ProviderId, string> {
  return copy[locale].providerLabels
}

export function getInstallCatalog(locale: Locale): Record<TargetOs, { cli: LinkCard; app: LinkCard }> {
  return copy[locale].installCatalog
}

export function getMcpPresets(locale: Locale): McpPreset[] {
  return copy[locale].mcpPresets
}

export function createCustomMcpEntry(seed: number): CustomMcpEntry {
  return {
    id: `custom-mcp-${seed}`,
    name: `custom-mcp-${seed}`,
    protocol: 'stdio',
    command: 'npx',
    args: '',
    env: '',
    url: '',
    bearerTokenEnvVar: 'MCP_TOKEN',
    expanded: true,
  }
}

export function detectBrowserOs(): TargetOs | null {
  if (typeof navigator === 'undefined') {
    return null
  }

  const signature = `${navigator.userAgent} ${navigator.platform}`.toLowerCase()

  if (signature.includes('mac')) {
    return 'macos'
  }

  if (signature.includes('win')) {
    return 'windows'
  }

  if (signature.includes('linux') || signature.includes('x11')) {
    return 'linux'
  }

  return null
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return 'en'
  }

  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function getRecommendedThemeName(): string {
  return 'Midnight Monochrome'
}

export function getProviderEnvDefault(provider: ProviderId): string {
  switch (provider) {
    case 'azure':
      return 'AZURE_OPENAI_API_KEY'
    case 'custom':
      return 'CUSTOM_API_KEY'
    case 'local':
      return 'CUSTOM_API_KEY'
    default:
      return 'CUSTOM_API_KEY'
  }
}

export function getActiveProviderEnvVar(state: SetupState): string {
  if (state.provider === 'azure') {
    return state.apiKeyEnvVar
  }

  if (state.provider === 'custom') {
    return state.customProviderEnvKey
  }

  return state.localProviderEnvKey
}

export function setActiveProviderEnvVar(state: SetupState, value: string): SetupState {
  if (state.provider === 'azure') {
    return { ...state, apiKeyEnvVar: value }
  }

  if (state.provider === 'custom') {
    return { ...state, customProviderEnvKey: value }
  }

  return { ...state, localProviderEnvKey: value }
}

export function getSelectedPresetSecrets(state: SetupState, locale: Locale): McpPreset[] {
  const selectedIds = new Set(state.selectedMcpPresetIds)
  return getMcpPresets(locale).filter((preset) => selectedIds.has(preset.id) && (preset.bearerTokenEnvVar || preset.stdioSecretEnvVar))
}

export function validateStep(stepIndex: number, state: SetupState, locale: Locale): string | null {
  if (stepIndex <= 0) {
    return null
  }

  if (stepIndex === 1 && !state.installCli && !state.installApp) {
    return locale === 'zh'
      ? '至少选择一个安装目标，CLI、App 或两者都选。'
      : 'Select at least one install target: CLI, App, or both.'
  }

  if (stepIndex === 2) {
    if (state.provider === 'azure') {
      if (!state.azureBaseUrl.trim()) {
        return locale === 'zh'
          ? 'Azure OpenAI 需要填写 v1 endpoint。'
          : 'Azure OpenAI requires a v1 endpoint.'
      }
      if (!state.apiKeyEnvVar.trim()) {
        return locale === 'zh'
          ? 'Azure OpenAI 需要填写 API key 对应的环境变量名。'
          : 'Azure OpenAI requires the API key environment variable name.'
      }
    }

    if (state.provider === 'custom') {
      if (!state.customProviderId.trim()) {
        return locale === 'zh'
          ? '自定义 OpenAI 兼容 Provider 需要一个 provider ID。'
          : 'A custom OpenAI-compatible provider requires a provider ID.'
      }
      if (!state.customProviderBaseUrl.trim()) {
        return locale === 'zh'
          ? '自定义 OpenAI 兼容 Provider 需要填写 base URL。'
          : 'A custom OpenAI-compatible provider requires a base URL.'
      }
      if (!state.customProviderEnvKey.trim()) {
        return locale === 'zh'
          ? '自定义 OpenAI 兼容 Provider 需要填写 env_key。'
          : 'A custom OpenAI-compatible provider requires an env_key.'
      }
    }

    if (state.provider === 'local' && !state.localProviderBaseUrl.trim()) {
      return locale === 'zh'
        ? '本地 OpenAI 兼容 Provider 需要填写 base URL。'
        : 'A local OpenAI-compatible provider requires a base URL.'
    }
  }

  if (stepIndex === 3) {
    for (const entry of state.customMcps) {
      if (!entry.name.trim()) {
        return locale === 'zh'
          ? '每个自定义 MCP 都需要填写名称。'
          : 'Each custom MCP entry needs a name.'
      }

      if (entry.protocol === 'stdio' && !entry.command.trim()) {
        return locale === 'zh'
          ? `自定义 MCP ${entry.name} 缺少 command。`
          : `Custom MCP ${entry.name} is missing a command.`
      }

      if (entry.protocol === 'http' && !entry.url.trim()) {
        return locale === 'zh'
          ? `自定义 MCP ${entry.name} 缺少 url。`
          : `Custom MCP ${entry.name} is missing a URL.`
      }
    }
  }

  return null
}

export function getActiveEnvVarName(state: SetupState): string {
  if (state.provider === 'azure') {
    return state.apiKeyEnvVar.trim()
  }

  if (state.provider === 'custom') {
    return state.customProviderEnvKey.trim()
  }

  return state.localProviderEnvKey.trim()
}

export function getKeyModeLabel(state: SetupState, locale: Locale): string {
  const currentEnv = getActiveEnvVarName(state)

  if (!currentEnv) {
    return state.apiKeyValue.trim()
      ? locale === 'zh'
        ? '本地 OpenAI 兼容 Provider 使用临时 Key，不做环境变量持久化'
        : 'The local OpenAI-compatible provider will use a temporary key without persisting an environment variable.'
      : locale === 'zh'
        ? '本地 OpenAI 兼容 Provider 可不配置 API Key'
        : 'The local OpenAI-compatible provider can run without an API key.'
  }

  return state.apiKeyValue.trim()
    ? locale === 'zh'
      ? `脚本将使用已填写的 Key 写入 ${currentEnv}`
      : `The script will write the provided key into ${currentEnv}.`
    : locale === 'zh'
      ? `脚本执行时弹出输入框采集 Key，并写入 ${currentEnv}`
      : `The script will prompt for the key at runtime and write it into ${currentEnv}.`
}

export function getSummaryItems(state: SetupState, detectedOs: TargetOs | null, locale: Locale): string[] {
  const providerLabels = getProviderLabels(locale)
  const presets = getMcpPresets(locale)
  const presetLabels = state.selectedMcpPresetIds
    .map((id) => presets.find((preset) => preset.id === id)?.label)
    .filter(Boolean)
  const customCount = state.customMcps.length
  const mcpSummary = presetLabels.length + customCount > 0
    ? `${presetLabels.join(' + ')}${presetLabels.length > 0 && customCount > 0 ? ' + ' : ''}${customCount > 0 ? locale === 'zh' ? `${customCount} 个自定义 MCP` : `${customCount} custom MCP entries` : ''}`
    : locale === 'zh' ? '未启用' : 'Disabled'

  return [
    `${locale === 'zh' ? '浏览器识别 OS' : 'Browser OS'}: ${detectedOs ? osLabels[detectedOs] : locale === 'zh' ? '未识别' : 'Unknown'}`,
    `${locale === 'zh' ? '目标系统' : 'Target OS'}: ${osLabels[state.targetOs]}`,
    `${locale === 'zh' ? '安装目标' : 'Install Targets'}: ${[
      state.installCli ? 'Codex CLI' : '',
      state.installApp ? 'Codex App' : '',
    ].filter(Boolean).join(' + ')}`,
    `Provider: ${providerLabels[state.provider]}`,
    `${locale === 'zh' ? 'API Key' : 'API Key'}: ${getKeyModeLabel(state, locale)}`,
    `MCP: ${mcpSummary}`,
  ]
}

export function getEnvPersistenceGuide(os: TargetOs, locale: Locale): EnvPersistenceGuide {
  if (os === 'windows') {
    return {
      title: locale === 'zh' ? '环境变量持久化说明' : 'Environment Persistence',
      bullets: [
        locale === 'zh' ? '保存到当前用户的环境变量。' : 'Persisted into the current user environment variables.',
        locale === 'zh' ? '重新打开终端后生效。' : 'Takes effect after opening a new terminal session.',
      ],
    }
  }

  if (os === 'macos') {
    return {
      title: locale === 'zh' ? '环境变量持久化说明' : 'Environment Persistence',
      bullets: [
        locale === 'zh' ? '保存到当前用户的 shell 配置文件。' : 'Persisted into the current user shell profile.',
        locale === 'zh' ? '重新打开终端后生效。' : 'Takes effect after opening a new terminal session.',
      ],
    }
  }

  return {
    title: locale === 'zh' ? '环境变量持久化说明' : 'Environment Persistence',
    bullets: [
      locale === 'zh' ? '保存到当前用户的 shell 配置文件。' : 'Persisted into the current user shell profile.',
      locale === 'zh' ? '重新打开终端后生效。' : 'Takes effect after opening a new terminal session.',
    ],
  }
}

function slugify(value: string): string {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
  return cleaned.replace(/^_+|_+$/g, '') || 'provider'
}

function splitArgs(args: string): string[] {
  return args
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function parseKeyValueLines(source: string): Record<string, string> {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, line) => {
      const separatorIndex = line.indexOf('=')
      if (separatorIndex === -1) {
        return accumulator
      }

      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim()

      if (key) {
        accumulator[key] = value
      }

      return accumulator
    }, {})
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function pushTomlRecord(header: string, record: Record<string, string>, lines: string[]): void {
  const entries = Object.entries(record)
  if (entries.length === 0) {
    return
  }

  lines.push(header)
  entries.forEach(([key, value]) => {
    lines.push(`${key} = ${tomlString(value)}`)
  })
  lines.push('')
}

function pushPresetMcp(preset: McpPreset, state: SetupState, lines: string[]): void {
  lines.push(`[mcp_servers.${slugify(preset.id)}]`)

  if (preset.protocol === 'stdio') {
    lines.push(`command = ${tomlString(preset.command ?? 'npx')}`)
    if (preset.args && preset.args.length > 0) {
      lines.push(`args = [${preset.args.map(tomlString).join(', ')}]`)
    }
    if (preset.stdioSecretEnvVar && state.presetMcpSecrets[preset.id]?.trim()) {
      lines.push('')
      lines.push(`[mcp_servers.${slugify(preset.id)}.env]`)
      lines.push(`${preset.stdioSecretEnvVar} = ${tomlString(state.presetMcpSecrets[preset.id].trim())}`)
    }
  } else if (preset.url) {
    lines.push(`url = ${tomlString(preset.url)}`)
    if (preset.bearerTokenEnvVar) {
      lines.push(`bearer_token_env_var = ${tomlString(preset.bearerTokenEnvVar)}`)
    }
  }

  lines.push('')
}

function pushCustomMcp(entry: CustomMcpEntry, lines: string[]): void {
  const serverName = slugify(entry.name)
  lines.push(`[mcp_servers.${serverName}]`)

  if (entry.protocol === 'stdio') {
    lines.push(`command = ${tomlString(entry.command.trim())}`)
    const args = splitArgs(entry.args)
    if (args.length > 0) {
      lines.push(`args = [${args.map(tomlString).join(', ')}]`)
    }
    pushTomlRecord(`[mcp_servers.${serverName}.env]`, parseKeyValueLines(entry.env), lines)
  } else {
    lines.push(`url = ${tomlString(entry.url.trim())}`)
    if (entry.bearerTokenEnvVar.trim()) {
      lines.push(`bearer_token_env_var = ${tomlString(entry.bearerTokenEnvVar.trim())}`)
    }
    lines.push('')
  }
}

export function buildConfigToml(state: SetupState): string {
  const mcpPresets = getMcpPresets('en')
  const lines: string[] = [
    `model = ${tomlString(state.model)}`,
    'model_reasoning_effort = "high"',
    'personality = "friendly"',
    'model_reasoning_summary = "auto"',
  ]

  if (state.provider === 'azure') {
    lines.push('model_provider = "azure"')
    lines.push('')
    lines.push('[model_providers.azure]')
    lines.push('name = "Azure OpenAI"')
    lines.push(`base_url = ${tomlString(state.azureBaseUrl.trim())}`)
    lines.push(`env_key = ${tomlString(state.apiKeyEnvVar.trim() || 'AZURE_OPENAI_API_KEY')}`)
    if (state.azureApiVersion.trim()) {
      lines.push(`query_params = { api-version = ${tomlString(state.azureApiVersion.trim())} }`)
    }
  }

  if (state.provider === 'custom') {
    const providerId = slugify(state.customProviderId)
    lines.push(`model_provider = ${tomlString(providerId)}`)
    lines.push('')
    lines.push(`[model_providers.${providerId}]`)
    lines.push(`name = ${tomlString(state.customProviderName.trim() || 'Custom OpenAI-Compatible Provider')}`)
    lines.push(`base_url = ${tomlString(state.customProviderBaseUrl.trim())}`)
    lines.push(`env_key = ${tomlString(state.customProviderEnvKey.trim())}`)
  }

  if (state.provider === 'local') {
    const providerId = slugify(state.localProviderKind === 'custom' ? state.localProviderName : state.localProviderKind)
    lines.push(`model_provider = ${tomlString(providerId)}`)
    lines.push('')
    lines.push(`[model_providers.${providerId}]`)
    lines.push(`name = ${tomlString(state.localProviderName.trim() || 'Local OpenAI-Compatible Provider')}`)
    lines.push(`base_url = ${tomlString(state.localProviderBaseUrl.trim())}`)
    if (state.localProviderEnvKey.trim()) {
      lines.push(`env_key = ${tomlString(state.localProviderEnvKey.trim())}`)
    }
  }

  if (state.targetOs === 'windows') {
    lines.push('')
    lines.push('[windows]')
    lines.push('sandbox = "elevated"')
  }

  const presetMap = new Set(state.selectedMcpPresetIds)
  mcpPresets.forEach((preset) => {
    if (presetMap.has(preset.id)) {
      lines.push('')
      pushPresetMcp(preset, state, lines)
    }
  })

  state.customMcps.forEach((entry) => {
    lines.push('')
    pushCustomMcp(entry, lines)
  })

  return `${lines.join('\n').trim()}\n`
}

function getUnixStartupFiles(os: TargetOs): string[] {
  if (os === 'macos') {
    return ['$HOME/.zshrc', '$HOME/.bash_profile']
  }

  return ['$HOME/.bashrc', '$HOME/.profile']
}

function buildUnixInstallSection(state: SetupState): string[] {
  const lines: string[] = []
  const appUrl = getInstallCatalog('en')[state.targetOs].app.href

  if (state.installCli) {
    lines.push('echo "Manual Codex CLI install reference: npm i -g @openai/codex"')
  }

  if (state.installApp) {
    lines.push(`echo "Manual Codex App install page: ${appUrl}"`)
  }

  return lines
}

function appendUnixEnvPersistence(state: SetupState, lines: string[]): void {
  const secretPairs = [
    { name: getActiveEnvVarName(state), value: state.apiKeyValue },
    ...getSelectedPresetSecrets(state, 'en')
      .filter((preset) => preset.bearerTokenEnvVar)
      .map((preset) => ({
        name: preset.bearerTokenEnvVar ?? '',
        value: state.presetMcpSecrets[preset.id] ?? '',
      })),
  ].filter((entry) => entry.name.trim())

  if (secretPairs.length === 0) {
    return
  }

  lines.push('')
  lines.push(': > "$CODEX_HOME/env.sh"')

  secretPairs.forEach((pair, index) => {
    lines.push(`ENV_NAME_${index}=${tomlString(pair.name)}`)
    lines.push(`ENV_VALUE_${index}=${tomlString(pair.value)}`)
    lines.push(`if [ -z "$ENV_VALUE_${index}" ]; then`)
    lines.push(`  read -r -s -p "Enter \${ENV_NAME_${index}}: " ENV_VALUE_${index}`)
    lines.push('  echo')
    lines.push('fi')
    lines.push(`printf 'export %s=%q\n' "$ENV_NAME_${index}" "$ENV_VALUE_${index}" >> "$CODEX_HOME/env.sh"`)
  })

  getUnixStartupFiles(state.targetOs).forEach((file) => {
    lines.push(`touch ${file}`)
    lines.push(`if ! grep -Fq "$CODEX_HOME/env.sh" ${file}; then`)
    lines.push(`  printf '\nsource "%s/env.sh"\n' "$CODEX_HOME" >> ${file}`)
    lines.push('fi')
  })

  secretPairs.forEach((_, index) => {
    lines.push(`export "$ENV_NAME_${index}=$ENV_VALUE_${index}"`)
  })
}

export function buildShellScript(state: SetupState): string {
  const config = buildConfigToml(state).trimEnd()
  const lines: string[] = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"',
    'CONFIG_FILE="$CODEX_HOME/config.toml"',
    'mkdir -p "$CODEX_HOME"',
    '',
    ...buildUnixInstallSection(state),
  ]

  appendUnixEnvPersistence(state, lines)

  lines.push('')
  lines.push('if [ -f "$CONFIG_FILE" ]; then')
  lines.push('  if [ -t 0 ]; then')
  lines.push('    read -r -p "config.toml already exists at $CONFIG_FILE. Overwrite? [y/N] " OVERWRITE_CONFIG')
  lines.push('    case "$OVERWRITE_CONFIG" in')
  lines.push('      [yY]|[yY][eE][sS]) ;;')
  lines.push('      *)')
  lines.push('        echo "Canceled. Existing config kept."')
  lines.push('        exit 0')
  lines.push('        ;;')
  lines.push('    esac')
  lines.push('  else')
  lines.push('    echo "config.toml already exists at $CONFIG_FILE. Refusing to overwrite in non-interactive mode."')
  lines.push('    exit 1')
  lines.push('  fi')
  lines.push('fi')

  lines.push('')
  lines.push("cat > \"$CONFIG_FILE\" <<'EOF'")
  lines.push(config)
  lines.push('EOF')
  lines.push('')
  lines.push('echo "Configuration complete. config.toml written to $CONFIG_FILE"')
  lines.push('if [ -t 0 ]; then')
  lines.push("  printf 'Press any key to exit...'")
  lines.push('  read -r -n 1 -s _')
  lines.push('  echo')
  lines.push('fi')

  return `${lines.join('\n')}\n`
}

function escapePowerShellSingleQuote(value: string): string {
  return value.replace(/'/g, "''")
}

function appendWindowsEnvPersistence(state: SetupState, lines: string[]): void {
  const secretPairs = [
    { name: getActiveEnvVarName(state), value: state.apiKeyValue },
    ...getSelectedPresetSecrets(state, 'en')
      .filter((preset) => preset.bearerTokenEnvVar)
      .map((preset) => ({
        name: preset.bearerTokenEnvVar ?? '',
        value: state.presetMcpSecrets[preset.id] ?? '',
      })),
  ].filter((entry) => entry.name.trim())

  if (secretPairs.length === 0) {
    return
  }

  secretPairs.forEach((pair, index) => {
    lines.push(`$EnvName${index} = '${escapePowerShellSingleQuote(pair.name)}'`)
    lines.push(`$EnvValue${index} = @'\n${pair.value}\n'@.TrimEnd()`)
    lines.push(`if ([string]::IsNullOrWhiteSpace($EnvValue${index})) {`)
    lines.push(`  $EnvValue${index} = Read-Host "Enter $EnvName${index}"`)
    lines.push('}')
    lines.push(`[Environment]::SetEnvironmentVariable($EnvName${index}, $EnvValue${index}, "User")`)
    lines.push(`Set-Item -Path ("Env:{0}" -f $EnvName${index}) -Value $EnvValue${index}`)
  })
}

export function buildPowerShellScript(state: SetupState): string {
  const config = buildConfigToml(state).trimEnd()
  const installCatalog = getInstallCatalog('en')
  const lines: string[] = [
    '$ErrorActionPreference = "Stop"',
    '$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }',
    '$ConfigFile = Join-Path $CodexHome "config.toml"',
    'New-Item -ItemType Directory -Force -Path $CodexHome | Out-Null',
  ]

  if (state.installCli) {
    lines.push('Write-Host "Manual Codex CLI install reference: npm i -g @openai/codex"')
  }

  if (state.installApp) {
    lines.push(`Write-Host "Manual Codex App install reference: ${installCatalog.windows.app.href}"`)
  }

  appendWindowsEnvPersistence(state, lines)
  lines.push('if (Test-Path $ConfigFile) {')
  lines.push('  try {')
  lines.push('    $Overwrite = Read-Host "config.toml already exists at $ConfigFile. Overwrite? [y/N]"')
  lines.push('  } catch {')
  lines.push('    Write-Host "config.toml already exists at $ConfigFile. Refusing to overwrite without confirmation."')
  lines.push('    exit 1')
  lines.push('  }')
  lines.push('')
  lines.push('  if ($Overwrite -notmatch "^(?i:y|yes)$") {')
  lines.push('    Write-Host "Canceled. Existing config kept."')
  lines.push('    exit 0')
  lines.push('  }')
  lines.push('}')
  lines.push(`$Config = @'\n${config}\n'@`)
  lines.push('Set-Content -Path $ConfigFile -Value $Config -Encoding UTF8')
  lines.push('Write-Host "Configuration complete. config.toml written to $ConfigFile"')
  lines.push('try {')
  lines.push('  Write-Host "Press any key to exit..." -NoNewline')
  lines.push('  $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")')
  lines.push('  Write-Host ""')
  lines.push('} catch {')
  lines.push('  Write-Host ""')
  lines.push('}')

  return `${lines.join('\n')}\n`
}

export function buildBatchScript(): string {
  const lines: string[] = [
    '@echo off',
    'setlocal EnableExtensions',
    'set "SCRIPT_DIR=%~dp0"',
    'set "POWERSHELL_SCRIPT=%SCRIPT_DIR%codex-setup.ps1"',
  ]

  lines.push('if not exist "%POWERSHELL_SCRIPT%" goto :missing')
  lines.push('powershell -NoProfile -ExecutionPolicy Bypass -File "%POWERSHELL_SCRIPT%"')
  lines.push('if errorlevel 1 goto :error')
  lines.push('goto :end')

  lines.push(':missing')
  lines.push('echo Missing codex-setup.ps1 in the same folder.')
  lines.push('echo Keep codex-setup.bat and codex-setup.ps1 together.')
  lines.push('echo Press any key to exit...')
  lines.push('pause >nul')
  lines.push('exit /b 1')

  lines.push(':error')
  lines.push('echo Batch wrapper failed. Try running codex-setup.ps1 directly.')
  lines.push('echo Press any key to exit...')
  lines.push('pause >nul')
  lines.push('exit /b 1')

  lines.push(':end')
  lines.push('endlocal')

  return `${lines.join('\n')}\n`
}

export function buildArtifacts(state: SetupState, locale: Locale): Artifact[] {
  const config = buildConfigToml(state)
  const artifacts: Artifact[] = [
    {
      filename: 'config.toml',
      label: 'config.toml',
      content: config,
    },
  ]

  if (state.targetOs === 'windows') {
    artifacts.unshift(
      {
        filename: 'codex-setup.ps1',
        label: locale === 'zh' ? 'Windows PowerShell 脚本' : 'Windows PowerShell Script',
        content: buildPowerShellScript(state),
      },
      {
        filename: 'codex-setup.bat',
        label: locale === 'zh' ? 'Windows bat 脚本' : 'Windows bat Script',
        content: buildBatchScript(),
      },
    )
  } else {
    artifacts.unshift({
      filename: state.targetOs === 'macos' ? 'codex-setup-macos.sh' : 'codex-setup-linux.sh',
      label: locale === 'zh' ? 'Unix Shell 脚本' : 'Unix Shell Script',
      content: buildShellScript(state),
    })
  }

  return artifacts
}