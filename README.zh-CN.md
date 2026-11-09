# Codex Config Generator

[English](./README.md)

Codex Config Generator 是一个静态 Web 应用，用来为 Linux、macOS 和 Windows 生成 Codex 配置产物。它可以帮助用户整理安装说明、Provider 配置、`config.toml` 以及 MCP 片段，整个过程不依赖后端服务。

线上地址： [codex-config.thingsbud.com](https://codex-config.thingsbud.com/)

## 功能概览

- 识别浏览器 OS，并允许手动切换目标平台。
- 生成 Codex CLI 与 Codex App 场景下的配置输出。
- 默认使用 `gpt-5.6-sol` 与 `pragmatic` personality，并提供可选的 272K 上下文限制。
- 支持 Azure OpenAI、New API、自定义 OpenAI 兼容 Provider、本地 OpenAI 兼容 Provider。
- 自定义 Provider 可选用 `auth.command` Bearer 认证，让 Codex 读取远端模型目录。
- 提供 MCP 预设、自定义 MCP 条目，以及基于环境变量的 HTTP MCP Bearer 认证。
- 所有输入都只保存在浏览器内存中，不落库。
- 提供可选的 CLI 终端标题、状态栏与状态栏颜色设置，未选中时保留 Codex 默认行为。
- 以纯静态站点方式交付，可部署到 Azure Static Web Apps。

## 项目结构

```text
.
├── codex-setup-lab/          # Vite + React 前端
├── .github/workflows/        # GitHub Actions 部署流程
├── start.sh                  # 本地开发启动脚本
└── deploy.sh                 # 生产构建与 Azure Static Web Apps 部署脚本
```

## 本地开发

### 环境要求

- Node.js 20+
- pnpm

### 启动项目

```bash
./start.sh
```

脚本会在需要时自动安装依赖，并启动 Vite 开发服务器，默认地址为 `http://localhost:5173`。

也可以直接进入前端目录运行：

```bash
cd codex-setup-lab
pnpm install
pnpm dev --host 0.0.0.0
```

## 构建

```bash
cd codex-setup-lab
pnpm build
```

## 本地提交前验证

```bash
cd codex-setup-lab
pnpm test
pnpm lint
pnpm test:codex
pnpm test:codex:live
```

提交前请在本地运行以上检查。发布流程不执行测试，只安装依赖、构建已提交源码并部署生成产物。

`test:codex` 调用已安装的 Codex CLI，验证每个高级参数值和 Provider 类型生成的 `config.toml` 均可加载，并通过本地探针核对 Provider 认证、远端模型发现、推理强度与回答详细度是否进入真实请求。它要求 `PATH` 中存在 `codex`。

`test:codex:live` 默认读取 `~/.codex/config.toml` 中的活动模型与 Provider，生成隔离的临时配置，并执行四次最小真实 API 调用，覆盖全部对外开放值。它不会把 API Key 写入 TOML，也不会修改源配置。

## 自定义 Provider `auth.command`

自定义 Provider 默认继续使用 `env_key`。当 Provider 提供远端 `/models` 目录，并希望 Codex 刷新该目录时，可在 Provider 表单中勾选 **使用 auth.command 获取 Bearer token**。生成结果会移除 `env_key`、保持 `requires_openai_auth = false`，并通过嵌套认证配置读取同一个 API Key 环境变量：

```toml
[model_providers.proxy.auth]
command = "printenv"
args = ["CUSTOM_API_KEY"]
timeout_ms = 5000
refresh_interval_ms = 0
```

Linux 与 macOS 使用 `printenv`，Windows 输出改用非交互式 `powershell.exe` 命令。生成脚本仍会把原始 token 持久化到所选环境变量中，请不要添加 `Bearer ` 前缀。`refresh_interval_ms = 0` 表示不定时重跑命令；收到 `401` 后 Codex 仍可重新认证。

远端接口必须返回顶层包含 `models` 数组及完整模型元数据的 Codex 目录结构。当前 Codex 不能把标准 OpenAI 兼容的 `{"object":"list","data":[...]}` 响应作为该目录使用；收到这种结构时会静默回退到内置模型目录。

## HTTP MCP Bearer Token

当配置为 `bearer_token_env_var = "MCP_TOKEN"` 时，请填写不带 `Bearer ` 前缀的原始 token。Codex 会从自身进程环境读取 `MCP_TOKEN` 并自动添加认证方案。生成脚本写入新变量后，需要重新启动终端、Codex App 或 VS Code。

## MCP 兼容性与更新

HTTP MCP 使用 `url` 和可选的 `bearer_token_env_var`；只有本地 stdio MCP 才需要 `command`。不要给远程 HTTP MCP 添加虚假的 command。

若启动时报 `missing field command in mcp_servers.<name>`，请先确认实际运行的可执行文件。Codex CLI 0.41.0 对 URL 配置可复现这一报错，并非新版 HTTP 配置增加了 command 要求。请通过原安装方式更新：

```bash
codex --version
# 如果使用 npm 安装：
npm install -g @openai/codex@latest
codex --version
```

Linux/macOS 可用 `type -a codex` 排查多个安装路径，更新后用 `hash -r` 清除 shell 命令缓存；Windows 可用 `Get-Command codex -All`。`codex update` 不是通用的 CLI 更新命令，应使用原包管理器更新。无需将 HTTP MCP 改成 stdio。

## 可选 TUI 配置

在 **第 4 步 → TUI 终端显示（可选）** 中，可分别启用终端标题、状态栏，并按需覆盖状态栏颜色。默认不生成 `[tui]`。这些选项只影响 CLI 终端界面，不影响 Codex App 或模型能力。

无需手输字段标识：启用自定义后，直接勾选带中英文名称的显示项目。选中项置顶，编号就是输出顺序，可用上移/下移按钮调整；下方可滚动查看全部选项。取消全部项目会写入 `[]`，关闭对应显示；取消上方的自定义勾选则不写入该键，保留 Codex 默认值。

颜色也使用复选框：不勾选“自定义状态栏颜色”时使用默认值；勾选后，通过“启用彩色状态栏”选择明确输出 `true` 或 `false`。部分显示项目仅在 Git 或额度数据可用时出现。

```toml
[tui]
terminal_title = ["thread-name", "activity", "project-name", "context-remaining", "total-input-tokens", "total-output-tokens", "model-with-reasoning"]
status_line = ["model-with-reasoning", "current-dir", "thread-name", "branch-changes", "permissions", "context-remaining", "used-tokens"]
status_line_use_colors = true
```

独立 TOML 与各平台生成脚本使用相同配置。`screen_reader_detection_done` 和 `model_availability_nux` 是 Codex 自动维护的检测/引导状态，并非显示偏好，因此不生成。

可选字段已对照 [Codex v0.167.0 schema](https://github.com/openai/codex/blob/rust-v0.167.0/codex-rs/core/config.schema.json)、[终端标题字段](https://github.com/openai/codex/blob/rust-v0.167.0/codex-rs/tui/src/bottom_pane/title_setup.rs)和[状态栏字段](https://github.com/openai/codex/blob/rust-v0.167.0/codex-rs/tui/src/bottom_pane/status_line_setup.rs)核对。旧版可能不支持新增配置或字段，请参考[官方配置文档](https://developers.openai.com/codex/config-reference/)。

## 部署

仓库已经包含 GitHub Actions 工作流 `.github/workflows/deploy-azure-static-web-app.yml`，也提供了手动部署脚本：

```bash
./deploy.sh
```

部署时需要满足以下任一条件：

- 设置 `SWA_CLI_DEPLOYMENT_TOKEN`
- 设置 `AZURE_STATIC_WEB_APPS_API_TOKEN`
- 或设置 `AZURE_STATIC_WEB_APPS_APP_NAME`，并确保 Azure CLI 已登录，以便脚本自动拉取 token

可选环境变量：

- `AZURE_RESOURCE_GROUP`
- `AZURE_STATIC_WEB_APPS_ENVIRONMENT`