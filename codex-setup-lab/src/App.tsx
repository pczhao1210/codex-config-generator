import { useState } from 'react'
import './App.css'
import {
  buildArtifacts,
  createCustomMcpEntry,
  defaultState,
  detectBrowserLocale,
  detectBrowserOs,
  getActiveProviderEnvVar,
  getEnvPersistenceGuide,
  getInstallCatalog,
  getKeyModeLabel,
  getMcpPresets,
  getProviderEnvDefault,
  getProviderLabels,
  getSelectedPresetSecrets,
  getSteps,
  getSummaryItems,
  osLabels,
  setActiveProviderEnvVar,
  validateStep,
  type Artifact,
  type CustomMcpEntry,
  type Locale,
  type LocalProviderKind,
  type McpPreset,
  type McpProtocol,
  type ProviderId,
  type SetupState,
  type TargetOs,
} from './lib/setup'

const localProviderDefaults: Record<Exclude<LocalProviderKind, 'custom'>, { name: string; baseUrl: string; envKey: string }> = {
  ollama: {
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    envKey: 'CUSTOM_API_KEY',
  },
  lmstudio: {
    name: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    envKey: 'CUSTOM_API_KEY',
  },
}

const githubRepoUrl = 'https://github.com/pczhao1210/codex-config-generator'

const messages = {
  zh: {
    languageLabel: '语言',
    languageZh: '中文',
    languageEn: 'English',
    githubSourceLabel: 'GitHub Source',
    memoryPill: '状态保存：仅保存在当前页面内存中，刷新后全部丢失',
    heroText: '一个完全静态的多步骤 WebUI，用来生成 Linux、macOS、Windows 下的 Codex 环境配置脚本、config.toml 和安装说明。',
    browserOs: '浏览器识别 OS',
    currentArtifacts: '当前生成产物',
    currentProvider: '当前 Provider',
    liveSummary: '实时摘要',
    outputSummary: '输出实时摘要',
    unknown: '未识别',
    shellArtifactPrefix: 'Shell',
    batchArtifactPrefix: 'bat',
    powershellArtifactPrefix: 'Powershell',
    step: 'Step',
    step1Title: '识别浏览器 OS 并确认目标系统',
    step1Lead: '页面会先读取浏览器所在 OS，再由你决定最终要生成哪一套脚本。输入只存在当前内存里，不会持久化到浏览器。',
    step1Notice: (os: string) => `浏览器识别结果：${os}。如果和你的目标环境不一致，可以手动切换下面的系统卡片。`,
    osShellMeta: '输出 shell 安装脚本',
    osWindowsMeta: '生成PS & bat脚本',
    configCliTitle: '配置 Codex CLI',
    configCliDesc: '输出 CLI 安装参考，并写入 config.toml 与认证环境。',
    configAppTitle: '配置 Codex App',
    configAppDesc: '输出对应平台的 App 安装参考与访问入口。',
    step2Title: '平台安装入口',
    step2Lead: (os: string) => `页面会按 ${os} 生成配置脚本和安装参考，下面的入口同时会映射到结果页说明。`,
    viewOfficialDocs: '查看官方文档',
    openInstallLink: '打开安装入口',
    windowsInstallNotice: 'Windows 下会同时输出 PowerShell 和 bat。CLI 原生支持仍偏实验性，结果页会额外给出 WSL 指引。',
    step3ApiKeyTitle: 'API Key',
    currentEnvKey: '当前 Provider 的 env_key',
    keyInput: 'Key 输入',
    keyPlaceholder: '留空则脚本执行时提示输入',
    providerTitle: 'Provider',
    providerLead: '去掉默认 OpenAI Provider，只保留 Azure OpenAI、自定义 OpenAI 兼容 Provider 和本地 OpenAI 兼容 Provider。',
    modelName: '模型名',
    azureEndpoint: 'Azure v1 endpoint',
    optionalApiVersion: '可选 API version',
    apiVersionPlaceholder: '留空则不写 query_params',
    providerId: 'Provider ID',
    displayName: '展示名称',
    baseUrl: 'Base URL',
    localProviderName: 'Provider 名称',
    localPresetCustom: '手动填写 base URL 与名称',
    localPresetPreset: '填充常见本地 endpoint',
    customLabel: 'Custom',
    step4Title: 'MCP 与可选扩展',
    step4Lead: '这里不做依赖自动探测，只负责把你选择的 MCP 片段与脚本动作写进最终产物。热门模板默认折叠，自定义 MCP 支持多条并行管理。',
    secretFallback: '访问凭证',
    secretPlaceholder: '留空则不写入该模板的密钥配置',
    customMcpTitle: '自定义 MCP',
    customMcpLead: '可通过点击添加，维护多个 MCP。新建项默认展开，收起后仍显示核心摘要。',
    addMcp: '添加 MCP',
    noCustomMcp: '当前没有自定义 MCP。你可以继续使用上面的热门模板，或者添加多条自定义 MCP。',
    unnamedMcp: '未命名 MCP',
    missingCommand: '未填 command',
    missingUrl: '未填 url',
    collapse: '折叠',
    expand: '展开',
    delete: '删除',
    name: '名称',
    stdioMeta: '本地命令启动',
    httpMeta: '远程 HTTP 地址接入',
    envPlaceholder: 'TOKEN=demo\nREGION=us-east-1',
    step5Title: '生成结果',
    step5Lead: '最终产物只基于当前内存里的输入生成，不会自动保存草稿，也不会调用任何后端。',
    windowsOutputNotice: 'Windows 会同时提供 PowerShell 和 bat。推荐优先运行 PowerShell，bat 适合作为兼容入口。',
    copied: '已复制',
    copy: '复制',
    download: '下载',
    previous: '上一步',
    next: '下一步',
    copyCurrent: '复制当前脚本',
    currentArtifactCopyLabel: '首个产物',
  },
  en: {
    languageLabel: 'Language',
    languageZh: '中文',
    languageEn: 'English',
    githubSourceLabel: 'GitHub Source',
    memoryPill: 'State is stored in page memory only and is lost after refresh',
    heroText: 'A fully static multi-step WebUI that generates Codex setup scripts, config.toml, and install guidance for Linux, macOS, and Windows.',
    browserOs: 'Browser OS',
    currentArtifacts: 'Current Artifacts',
    currentProvider: 'Current Provider',
    liveSummary: 'Live Summary',
    outputSummary: 'Generated Output Summary',
    unknown: 'Unknown',
    shellArtifactPrefix: 'Shell',
    batchArtifactPrefix: 'bat',
    powershellArtifactPrefix: 'Powershell',
    step: 'Step',
    step1Title: 'Detect The Browser OS And Confirm The Target Platform',
    step1Lead: 'The page detects the browser OS first, then lets you choose which platform-specific output to generate. All input stays in memory only and is never persisted in the browser.',
    step1Notice: (os: string) => `Browser detection result: ${os}. If it does not match your target environment, switch the OS cards below manually.`,
    osShellMeta: 'Generate a shell setup script',
    osWindowsMeta: 'Generate Powershell & bat scripts',
    configCliTitle: 'Configure Codex CLI',
    configCliDesc: 'Show the CLI install reference and write config.toml plus auth environment settings.',
    configAppTitle: 'Configure Codex App',
    configAppDesc: 'Show the platform-specific App install reference and entry point.',
    step2Title: 'Platform Install Paths',
    step2Lead: (os: string) => `The page tailors install guidance and generated scripts for ${os}, and the same references are echoed in the result step.`,
    viewOfficialDocs: 'Open Official Docs',
    openInstallLink: 'Open Install Entry',
    windowsInstallNotice: 'Windows outputs both PowerShell and bat. Native CLI support is still experimental, and the result step keeps the WSL guidance visible.',
    step3ApiKeyTitle: 'API Key',
    currentEnvKey: 'Active Provider env_key',
    keyInput: 'Key Input',
    keyPlaceholder: 'Leave empty to prompt during script execution',
    providerTitle: 'Provider',
    providerLead: 'The default OpenAI provider is removed. Only Azure OpenAI, custom OpenAI-compatible, and local OpenAI-compatible providers remain.',
    modelName: 'Model Name',
    azureEndpoint: 'Azure v1 endpoint',
    optionalApiVersion: 'Optional API version',
    apiVersionPlaceholder: 'Leave empty to skip query_params',
    providerId: 'Provider ID',
    displayName: 'Display Name',
    baseUrl: 'Base URL',
    localProviderName: 'Provider Name',
    localPresetCustom: 'Manually define the base URL and display name',
    localPresetPreset: 'Fill a common local endpoint automatically',
    customLabel: 'Custom',
    step4Title: 'MCP And Optional Extensions',
    step4Lead: 'This page does not auto-detect dependencies. It only writes the selected MCP blocks and script actions into the final output. Popular templates stay compact, and custom MCP entries can be managed in parallel.',
    secretFallback: 'Credential',
    secretPlaceholder: 'Leave empty to skip writing this template secret',
    customMcpTitle: 'Custom MCP',
    customMcpLead: 'Add and maintain multiple MCP entries here. New items open by default, and collapsed cards still show a short summary.',
    addMcp: 'Add MCP',
    noCustomMcp: 'No custom MCP entries yet. You can keep using the preset templates above or add multiple custom MCP entries here.',
    unnamedMcp: 'Unnamed MCP',
    missingCommand: 'missing command',
    missingUrl: 'missing URL',
    collapse: 'Collapse',
    expand: 'Expand',
    delete: 'Delete',
    name: 'Name',
    stdioMeta: 'Launch through a local command',
    httpMeta: 'Connect through a remote HTTP endpoint',
    envPlaceholder: 'TOKEN=demo\nREGION=us-east-1',
    step5Title: 'Generated Output',
    step5Lead: 'Everything below is generated from the current in-memory state only. The app does not autosave drafts and does not call any backend.',
    windowsOutputNotice: 'Windows includes both PowerShell and bat output. PowerShell is the recommended path and bat remains as a compatibility wrapper.',
    copied: 'Copied',
    copy: 'Copy',
    download: 'Download',
    previous: 'Previous',
    next: 'Next',
    copyCurrent: 'Copy Current Script',
    currentArtifactCopyLabel: 'Current artifact',
  },
} as const

function App() {
  const [locale, setLocale] = useState<Locale>(() => detectBrowserLocale())
  const [currentStep, setCurrentStep] = useState(0)
  const [form, setForm] = useState<SetupState>(() => {
    const browserOs = detectBrowserOs()
    return browserOs ? { ...defaultState, targetOs: browserOs } : defaultState
  })
  const [error, setError] = useState('')
  const [copiedLabel, setCopiedLabel] = useState('')
  const [detectedOs] = useState<TargetOs | null>(() => detectBrowserOs())
  const [collapsedArtifacts, setCollapsedArtifacts] = useState<Record<string, boolean>>({})

  const t = messages[locale]
  const steps = getSteps(locale)
  const providerLabels = getProviderLabels(locale)
  const installCatalog = getInstallCatalog(locale)
  const mcpPresets = getMcpPresets(locale)
  const artifacts = buildArtifacts(form, locale)
  const summaryItems = getSummaryItems(form, detectedOs, locale)
  const installInfo = installCatalog[form.targetOs]
  const currentArtifact = artifacts[0]
  const envGuide = getEnvPersistenceGuide(form.targetOs, locale)
  const activeProviderEnvVar = getActiveProviderEnvVar(form)
  const selectedPresetSecrets = getSelectedPresetSecrets(form, locale)

  const isScriptArtifact = (artifact: Artifact) =>
    artifact.filename.endsWith('.ps1') || artifact.filename.endsWith('.bat') || artifact.filename.endsWith('.sh')

  const isArtifactCollapsed = (artifact: Artifact) =>
    isScriptArtifact(artifact) ? (collapsedArtifacts[artifact.filename] ?? true) : false

  const toggleArtifactCollapsed = (artifact: Artifact) => {
    if (!isScriptArtifact(artifact)) {
      return
    }

    setCollapsedArtifacts((previous) => ({
      ...previous,
      [artifact.filename]: !(previous[artifact.filename] ?? true),
    }))
  }

  const getArtifactSummaryTitle = (artifact: Artifact) => {
    if (artifact.filename.endsWith('.ps1')) {
      return `${t.powershellArtifactPrefix} - ${artifact.filename}`
    }

    if (artifact.filename.endsWith('.bat')) {
      return `${t.batchArtifactPrefix} - ${artifact.filename}`
    }

    if (artifact.filename.endsWith('.sh')) {
      return `${t.shellArtifactPrefix} - ${artifact.filename}`
    }

    return artifact.filename
  }

  const updateForm = <K extends keyof SetupState>(key: K, value: SetupState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  const updateActiveProviderEnvVar = (value: string) => {
    setForm((previous) => setActiveProviderEnvVar(previous, value))
  }

  const updatePresetSecret = (preset: McpPreset, value: string) => {
    setForm((previous) => ({
      ...previous,
      presetMcpSecrets: {
        ...previous.presetMcpSecrets,
        [preset.id]: value,
      },
    }))
  }

  const handleProviderChange = (provider: ProviderId) => {
    setForm((previous) => ({
      ...previous,
      provider,
      apiKeyEnvVar: provider === 'azure' ? getProviderEnvDefault(provider) : previous.apiKeyEnvVar,
      customProviderEnvKey: provider === 'custom' ? getProviderEnvDefault(provider) : previous.customProviderEnvKey,
      localProviderEnvKey: provider === 'local' ? getProviderEnvDefault(provider) : previous.localProviderEnvKey,
    }))
  }

  const handleLocalProviderKindChange = (kind: LocalProviderKind) => {
    setForm((previous) => {
      if (kind === 'custom') {
        return {
          ...previous,
          localProviderKind: kind,
          localProviderName: previous.localProviderName || 'Local OpenAI-Compatible Provider',
          localProviderBaseUrl: previous.localProviderBaseUrl || 'http://localhost:11434/v1',
        }
      }

      return {
        ...previous,
        localProviderKind: kind,
        localProviderName: localProviderDefaults[kind].name,
        localProviderBaseUrl: localProviderDefaults[kind].baseUrl,
        localProviderEnvKey: localProviderDefaults[kind].envKey,
      }
    })
  }

  const togglePreset = (presetId: string) => {
    setForm((previous) => ({
      ...previous,
      selectedMcpPresetIds: previous.selectedMcpPresetIds.includes(presetId)
        ? previous.selectedMcpPresetIds.filter((id) => id !== presetId)
        : [...previous.selectedMcpPresetIds, presetId],
    }))
  }

  const addCustomMcp = () => {
    setForm((previous) => ({
      ...previous,
      customMcps: [...previous.customMcps, createCustomMcpEntry(previous.customMcps.length + 1)],
    }))
  }

  const updateCustomMcp = <K extends keyof CustomMcpEntry>(id: string, key: K, value: CustomMcpEntry[K]) => {
    setForm((previous) => ({
      ...previous,
      customMcps: previous.customMcps.map((entry) =>
        entry.id === id ? { ...entry, [key]: value } : entry,
      ),
    }))
  }

  const toggleCustomMcpExpanded = (id: string) => {
    setForm((previous) => ({
      ...previous,
      customMcps: previous.customMcps.map((entry) =>
        entry.id === id ? { ...entry, expanded: !entry.expanded } : entry,
      ),
    }))
  }

  const removeCustomMcp = (id: string) => {
    setForm((previous) => ({
      ...previous,
      customMcps: previous.customMcps.filter((entry) => entry.id !== id),
    }))
  }

  const goNext = () => {
    const validationError = validateStep(currentStep, form, locale)

    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setCurrentStep((previous) => Math.min(previous + 1, steps.length - 1))
  }

  const goBack = () => {
    setError('')
    setCurrentStep((previous) => Math.max(previous - 1, 0))
  }

  const jumpToStep = (targetIndex: number) => {
    if (targetIndex > currentStep) {
      return
    }

    setError('')
    setCurrentStep(targetIndex)
  }

  const copyText = async (label: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedLabel(label)
    window.setTimeout(() => setCopiedLabel(''), 1600)
  }

  const downloadArtifact = (artifact: Artifact) => {
    const blob = new Blob([artifact.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = artifact.filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const renderCommandLine = (label: string, content: string, copyable = true) => (
    <div className="command-line-row">
      <p className="command-line">{content}</p>
      {copyable ? (
        <button className="command-copy-button" onClick={() => copyText(label, content)} type="button">
          {copiedLabel === label ? t.copied : t.copy}
        </button>
      ) : null}
    </div>
  )

  const renderStep = () => {
    if (currentStep === 0) {
      return (
        <section className="panel-grid panel-grid--two">
          <div className="stack gap-md">
            <p className="eyebrow">{t.step} 1</p>
            <h2>{t.step1Title}</h2>
            <p className="lede">{t.step1Lead}</p>
            <div className="notice-box">{t.step1Notice(detectedOs ? osLabels[detectedOs] : t.unknown)}</div>
          </div>

          <div className="stack gap-md">
            <div className="option-grid option-grid--three">
              {(['linux', 'macos', 'windows'] as const).map((os) => (
                <button
                  key={os}
                  className={`choice-card choice-card--os ${form.targetOs === os ? 'is-active' : ''}`}
                  onClick={() => updateForm('targetOs', os)}
                  type="button"
                >
                  <span className="choice-card__label">{osLabels[os]}</span>
                  <span className="choice-card__meta">{os === 'windows' ? t.osWindowsMeta : t.osShellMeta}</span>
                </button>
              ))}
            </div>

            <div className="stack gap-sm">
              <label className="switch-row">
                <input
                  checked={form.installCli}
                  onChange={(event) => updateForm('installCli', event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <strong>{t.configCliTitle}</strong>
                  <small>{t.configCliDesc}</small>
                </span>
              </label>

              <label className="switch-row">
                <input
                  checked={form.installApp}
                  onChange={(event) => updateForm('installApp', event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <strong>{t.configAppTitle}</strong>
                  <small>{t.configAppDesc}</small>
                </span>
              </label>
            </div>
          </div>
        </section>
      )
    }

    if (currentStep === 1) {
      return (
        <section className="stack gap-lg">
          <div className="stack gap-sm">
            <p className="eyebrow">{t.step} 2</p>
            <h2>{t.step2Title}</h2>
            <p className="lede">{t.step2Lead(osLabels[form.targetOs])}</p>
          </div>

          <div className="card-grid">
            {form.installCli ? (
              <article className="info-card">
                <p className="info-card__title">{installInfo.cli.title}</p>
                {renderCommandLine(`${installInfo.cli.title}-method`, installInfo.cli.method, installInfo.cli.copyable ?? true)}
                {installInfo.cli.highlight ? <p className="info-card__highlight">{installInfo.cli.highlight}</p> : null}
                <p>{installInfo.cli.note}</p>
                <a className="text-link" href={installInfo.cli.href} rel="noreferrer" target="_blank">
                  {t.viewOfficialDocs}
                </a>
              </article>
            ) : null}

            {form.installApp ? (
              <article className="info-card">
                <p className="info-card__title">{installInfo.app.title}</p>
                {renderCommandLine(`${installInfo.app.title}-method`, installInfo.app.method, installInfo.app.copyable ?? true)}
                {installInfo.app.highlight ? <p className="info-card__highlight">{installInfo.app.highlight}</p> : null}
                <p>{installInfo.app.note}</p>
                <a className="text-link" href={installInfo.app.href} rel="noreferrer" target="_blank">
                  {t.openInstallLink}
                </a>
              </article>
            ) : null}
          </div>

          {form.targetOs === 'windows' ? <div className="notice-box">{t.windowsInstallNotice}</div> : null}
        </section>
      )
    }

    if (currentStep === 2) {
      return (
        <section className="stack gap-lg">
          <div className="panel-grid panel-grid--two">
            <div className="stack gap-md">
              <div className="stack gap-sm">
                <p className="eyebrow">{t.step} 3</p>
                <h2>{t.step3ApiKeyTitle}</h2>
              </div>

              <label className="field">
                <span>{t.currentEnvKey}</span>
                <input
                  onChange={(event) => updateActiveProviderEnvVar(event.target.value)}
                  placeholder={getProviderEnvDefault(form.provider)}
                  value={activeProviderEnvVar}
                />
              </label>
              <label className="field">
                <span>{t.keyInput}</span>
                <input
                  onChange={(event) => updateForm('apiKeyValue', event.target.value)}
                  placeholder={t.keyPlaceholder}
                  type="password"
                  value={form.apiKeyValue}
                />
              </label>
              <p className="field-help">{getKeyModeLabel(form, locale)}</p>
            </div>

            <div className="stack gap-md">
              <div className="stack gap-sm">
                <h2>{t.providerTitle}</h2>
                <p className="lede">{t.providerLead}</p>
              </div>

              <div className="stack gap-sm">
                {(['azure', 'custom', 'local'] as const).map((provider) => (
                  <label className="switch-row switch-row--radio" key={provider}>
                    <input
                      checked={form.provider === provider}
                      name="provider"
                      onChange={() => handleProviderChange(provider)}
                      type="radio"
                    />
                    <span>
                      <strong>{providerLabels[provider]}</strong>
                    </span>
                  </label>
                ))}
              </div>

              <label className="field">
                <span>{t.modelName}</span>
                <input onChange={(event) => updateForm('model', event.target.value)} value={form.model} />
              </label>

              {form.provider === 'azure' ? (
                <>
                  <label className="field">
                    <span>{t.azureEndpoint}</span>
                    <input
                      onChange={(event) => updateForm('azureBaseUrl', event.target.value)}
                      value={form.azureBaseUrl}
                    />
                  </label>
                  <label className="field">
                    <span>{t.optionalApiVersion}</span>
                    <input
                      onChange={(event) => updateForm('azureApiVersion', event.target.value)}
                      placeholder={t.apiVersionPlaceholder}
                      value={form.azureApiVersion}
                    />
                  </label>
                </>
              ) : null}

              {form.provider === 'custom' ? (
                <>
                  <label className="field">
                    <span>{t.providerId}</span>
                    <input
                      onChange={(event) => updateForm('customProviderId', event.target.value)}
                      value={form.customProviderId}
                    />
                  </label>
                  <label className="field">
                    <span>{t.displayName}</span>
                    <input
                      onChange={(event) => updateForm('customProviderName', event.target.value)}
                      value={form.customProviderName}
                    />
                  </label>
                  <label className="field">
                    <span>{t.baseUrl}</span>
                    <input
                      onChange={(event) => updateForm('customProviderBaseUrl', event.target.value)}
                      placeholder="https://proxy.example.com/v1"
                      value={form.customProviderBaseUrl}
                    />
                  </label>
                </>
              ) : null}

              {form.provider === 'local' ? (
                <>
                  <div className="option-grid option-grid--three">
                    {(['ollama', 'lmstudio', 'custom'] as const).map((kind) => (
                      <button
                        className={`choice-card ${form.localProviderKind === kind ? 'is-active' : ''}`}
                        key={kind}
                        onClick={() => handleLocalProviderKindChange(kind)}
                        type="button"
                      >
                        <span className="choice-card__label">{kind === 'ollama' ? 'Ollama' : kind === 'lmstudio' ? 'LM Studio' : t.customLabel}</span>
                        <span className="choice-card__meta">{kind === 'custom' ? t.localPresetCustom : t.localPresetPreset}</span>
                      </button>
                    ))}
                  </div>
                  <label className="field">
                    <span>{t.localProviderName}</span>
                    <input
                      onChange={(event) => updateForm('localProviderName', event.target.value)}
                      value={form.localProviderName}
                    />
                  </label>
                  <label className="field">
                    <span>{t.baseUrl}</span>
                    <input
                      onChange={(event) => updateForm('localProviderBaseUrl', event.target.value)}
                      value={form.localProviderBaseUrl}
                    />
                  </label>
                </>
              ) : null}
            </div>
          </div>
        </section>
      )
    }

    if (currentStep === 3) {
      return (
        <section className="stack gap-lg">
          <div className="stack gap-sm">
            <p className="eyebrow">{t.step} 4</p>
            <h2>{t.step4Title}</h2>
            <p className="lede">{t.step4Lead}</p>
          </div>

          <div className="preset-grid">
            {mcpPresets.map((preset) => {
              const selected = form.selectedMcpPresetIds.includes(preset.id)
              return (
                <button
                  className={`choice-card choice-card--compact ${selected ? 'is-active' : ''}`}
                  key={preset.id}
                  onClick={() => togglePreset(preset.id)}
                  type="button"
                >
                  <span className="choice-card__label">{preset.label}</span>
                  <span className="choice-card__meta">{preset.description}</span>
                  <span className="choice-card__tag">{preset.protocol.toUpperCase()}</span>
                </button>
              )
            })}
          </div>

          {selectedPresetSecrets.length > 0 ? (
            <div className="card-grid">
              {selectedPresetSecrets.map((preset) => (
                <article className="info-card" key={preset.id}>
                  <p className="info-card__title">{preset.label}</p>
                  <p className="choice-card__meta">{preset.secretHelpText}</p>
                  {preset.bearerTokenEnvVar ? renderCommandLine(`${preset.id}-bearer-env`, preset.bearerTokenEnvVar) : null}
                  {preset.stdioSecretEnvVar ? renderCommandLine(`${preset.id}-stdio-env`, preset.stdioSecretEnvVar) : null}
                  <label className="field">
                    <span>{preset.secretFieldLabel ?? t.secretFallback}</span>
                    <input
                      onChange={(event) => updatePresetSecret(preset, event.target.value)}
                      placeholder={t.secretPlaceholder}
                      type="password"
                      value={form.presetMcpSecrets[preset.id] ?? ''}
                    />
                  </label>
                </article>
              ))}
            </div>
          ) : null}

          <div className="stack gap-md">
            <div className="footer-actions footer-actions--inline">
              <div>
                <h3>{t.customMcpTitle}</h3>
                <p className="lede">{t.customMcpLead}</p>
              </div>
              <button onClick={addCustomMcp} type="button">{t.addMcp}</button>
            </div>

            {form.customMcps.length === 0 ? <div className="notice-box">{t.noCustomMcp}</div> : null}

            {form.customMcps.map((entry) => {
              const collapsedSummary = entry.protocol === 'stdio'
                ? `${entry.name} · STDIO · ${entry.command || t.missingCommand}`
                : `${entry.name} · HTTP · ${entry.url || t.missingUrl}`

              return (
                <article className="mcp-card" key={entry.id}>
                  <div className="mcp-card__header">
                    <button className="mcp-card__toggle" onClick={() => toggleCustomMcpExpanded(entry.id)} type="button">
                      <span className="choice-card__label">{entry.name || t.unnamedMcp}</span>
                      <span className="choice-card__meta">{collapsedSummary}</span>
                    </button>
                    <div className="button-row">
                      <button className="button-secondary" onClick={() => toggleCustomMcpExpanded(entry.id)} type="button">
                        {entry.expanded ? t.collapse : t.expand}
                      </button>
                      <button className="button-secondary" onClick={() => removeCustomMcp(entry.id)} type="button">
                        {t.delete}
                      </button>
                    </div>
                  </div>

                  {entry.expanded ? (
                    <div className="stack gap-md">
                      <label className="field">
                        <span>{t.name}</span>
                        <input
                          onChange={(event) => updateCustomMcp(entry.id, 'name', event.target.value)}
                          value={entry.name}
                        />
                      </label>

                      <div className="option-grid option-grid--two">
                        {(['stdio', 'http'] as const).map((protocol: McpProtocol) => (
                          <button
                            className={`choice-card ${entry.protocol === protocol ? 'is-active' : ''}`}
                            key={protocol}
                            onClick={() => updateCustomMcp(entry.id, 'protocol', protocol)}
                            type="button"
                          >
                            <span className="choice-card__label">{protocol.toUpperCase()}</span>
                            <span className="choice-card__meta">{protocol === 'stdio' ? t.stdioMeta : t.httpMeta}</span>
                          </button>
                        ))}
                      </div>

                      {entry.protocol === 'stdio' ? (
                        <>
                          <label className="field">
                            <span>command</span>
                            <input
                              onChange={(event) => updateCustomMcp(entry.id, 'command', event.target.value)}
                              value={entry.command}
                            />
                          </label>
                          <label className="field">
                            <span>args</span>
                            <input
                              onChange={(event) => updateCustomMcp(entry.id, 'args', event.target.value)}
                              value={entry.args}
                            />
                          </label>
                          <label className="field">
                            <span>env</span>
                            <textarea
                              onChange={(event) => updateCustomMcp(entry.id, 'env', event.target.value)}
                              placeholder={t.envPlaceholder}
                              rows={4}
                              value={entry.env}
                            />
                          </label>
                        </>
                      ) : (
                        <>
                          <label className="field">
                            <span>url</span>
                            <input
                              onChange={(event) => updateCustomMcp(entry.id, 'url', event.target.value)}
                              value={entry.url}
                            />
                          </label>
                          <label className="field">
                            <span>bearer_token_env_var</span>
                            <input
                              onChange={(event) => updateCustomMcp(entry.id, 'bearerTokenEnvVar', event.target.value)}
                              value={entry.bearerTokenEnvVar}
                            />
                          </label>
                        </>
                      )}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </section>
      )
    }

    return (
      <section className="stack gap-lg">
        <div className="stack gap-sm">
          <p className="eyebrow">{t.step} 5</p>
          <h2>{t.step5Title}</h2>
          <p className="lede">{t.step5Lead}</p>
          {form.targetOs === 'windows' ? <div className="notice-box notice-box--strong">{t.windowsOutputNotice}</div> : null}
        </div>

        <div className="result-grid">
          {artifacts.map((artifact) => (
            <article className="result-card" key={artifact.filename}>
              <div className="result-card__head">
                <div>
                  <p className="info-card__title">{artifact.label}</p>
                  <p className="result-card__filename">{artifact.filename}</p>
                </div>
                <div className="button-row">
                  {isScriptArtifact(artifact) ? (
                    <button className="button-secondary" onClick={() => toggleArtifactCollapsed(artifact)} type="button">
                      {isArtifactCollapsed(artifact) ? t.expand : t.collapse}
                    </button>
                  ) : null}
                  <button onClick={() => copyText(artifact.label, artifact.content)} type="button">
                    {copiedLabel === artifact.label ? t.copied : t.copy}
                  </button>
                  <button className="button-secondary" onClick={() => downloadArtifact(artifact)} type="button">
                    {t.download}
                  </button>
                </div>
              </div>
              {isArtifactCollapsed(artifact) ? null : <pre>{artifact.content}</pre>}
            </article>
          ))}

          <article className="result-card">
            <div className="result-card__head">
              <div>
                <p className="info-card__title">{envGuide.title}</p>
              </div>
            </div>
            <ul className="explanation-list">
              {envGuide.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    )
  }

  return (
    <main className="shell">
      <section className="hero-block">
        <div className="hero-copy stack gap-md">
          <div className="hero-top">
            <div className="hero-badges">
              <p className="pill">{t.memoryPill}</p>
              <a className="github-link" href={githubRepoUrl} rel="noreferrer" target="_blank">
                <span className="github-link__icon" aria-hidden="true">
                  <svg viewBox="0 0 19 19">
                    <path d="M9.356 1.85C5.05 1.85 1.57 5.356 1.57 9.694a7.84 7.84 0 0 0 5.324 7.44c.387.079.528-.168.528-.376 0-.182-.013-.805-.013-1.454-2.165.467-2.616-.935-2.616-.935-.349-.91-.864-1.143-.864-1.143-.71-.48.051-.48.051-.48.787.051 1.2.805 1.2.805.695 1.194 1.817.857 2.268.649.064-.507.27-.857.49-1.052-1.728-.182-3.545-.857-3.545-3.87 0-.857.31-1.558.8-2.104-.078-.195-.349-1 .077-2.078 0 0 .657-.208 2.14.805a7.5 7.5 0 0 1 1.946-.26c.657 0 1.328.092 1.946.26 1.483-1.013 2.14-.805 2.14-.805.426 1.078.155 1.883.078 2.078.502.546.799 1.247.799 2.104 0 3.013-1.818 3.675-3.558 3.87.284.247.528.714.528 1.454 0 1.052-.012 1.896-.012 2.156 0 .208.142.455.528.377a7.84 7.84 0 0 0 5.324-7.441c.013-4.338-3.48-7.844-7.773-7.844" fill="currentColor" />
                  </svg>
                </span>
                <span className="github-link__label">{t.githubSourceLabel}</span>
              </a>
            </div>

            <div className="hero-actions">
              <div className="lang-switcher" aria-label={t.languageLabel}>
                <button
                  className={`lang-switcher__button ${locale === 'zh' ? 'is-active' : ''}`}
                  onClick={() => setLocale('zh')}
                  type="button"
                >
                  {t.languageZh}
                </button>
                <button
                  className={`lang-switcher__button ${locale === 'en' ? 'is-active' : ''}`}
                  onClick={() => setLocale('en')}
                  type="button"
                >
                  {t.languageEn}
                </button>
              </div>
            </div>
          </div>
          <h1>Codex Configurator</h1>
          <p className="hero-text">{t.heroText}</p>
          <div className="hero-metrics">
            <div>
              <strong>{detectedOs ? osLabels[detectedOs] : t.unknown}</strong>
              <span>{t.browserOs}</span>
            </div>
            <div>
              <strong>{artifacts.length}</strong>
              <span>{t.currentArtifacts}</span>
            </div>
            <div>
              <strong>{providerLabels[form.provider]}</strong>
              <span>{t.currentProvider}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="summary-panel summary-panel--wide">
        <div className="summary-panel__head">
          <p className="eyebrow">{t.liveSummary}</p>
          <div className="summary-panel__artifact">
            <p className="info-card__title">{t.outputSummary}</p>
            <span>{getArtifactSummaryTitle(currentArtifact)}</span>
            <small>{currentArtifact.label}</small>
          </div>
        </div>
        <div className="summary-panel__body">
          <ul className="summary-list">
            {summaryItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="workspace">
        <aside className="stepper">
          {steps.map((step, index) => (
            <button
              className={`stepper__item ${index === currentStep ? 'is-current' : ''} ${index < currentStep ? 'is-complete' : ''}`}
              key={step.id}
              onClick={() => jumpToStep(index)}
              type="button"
            >
              <span className="stepper__count">0{index + 1}</span>
              <span>
                <strong>{step.title}</strong>
                <small>{step.description}</small>
              </span>
            </button>
          ))}
        </aside>

        <section className="content-panel">
          {renderStep()}

          {error ? <div className="error-box">{error}</div> : null}

          <div className="footer-actions">
            <button className="button-secondary" disabled={currentStep === 0} onClick={goBack} type="button">
              {t.previous}
            </button>

            {currentStep < steps.length - 1 ? (
              <button onClick={goNext} type="button">
                {t.next}
              </button>
            ) : (
              <button onClick={() => copyText(t.currentArtifactCopyLabel, currentArtifact.content)} type="button">
                {t.copyCurrent}
              </button>
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
