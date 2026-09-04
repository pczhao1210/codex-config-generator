# Codex Config Generator

[English](./README.md)

Codex Config Generator 是一个静态 Web 应用，用来为 Linux、macOS 和 Windows 生成 Codex 配置产物。它可以帮助用户整理安装说明、Provider 配置、`config.toml` 以及 MCP 片段，整个过程不依赖后端服务。

线上地址： [codex-config.thingsbud.com](https://codex-config.thingsbud.com/)

## 功能概览

- 识别浏览器 OS，并允许手动切换目标平台。
- 生成 Codex CLI 与 Codex App 场景下的配置输出。
- 默认使用 `gpt-5.6-sol` 与 `pragmatic` personality，并提供可选的 272K 上下文限制。
- 支持 Azure OpenAI、New API、自定义 OpenAI 兼容 Provider、本地 OpenAI 兼容 Provider。
- 提供 MCP 预设、自定义 MCP 条目，以及基于环境变量的 HTTP MCP Bearer 认证。
- 所有输入都只保存在浏览器内存中，不落库。
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

`test:codex` 调用已安装的 Codex CLI，验证每个高级参数值和 Provider 类型生成的 `config.toml` 均可加载，并通过本地探针启动 `codex exec`，核对推理强度与回答详细度是否进入真实请求。它要求 `PATH` 中存在 `codex`。

`test:codex:live` 默认读取 `~/.codex/config.toml` 中的活动模型与 Provider，生成隔离的临时配置，并执行四次最小真实 API 调用，覆盖全部对外开放值。它不会把 API Key 写入 TOML，也不会修改源配置。

## HTTP MCP Bearer Token

当配置为 `bearer_token_env_var = "MCP_TOKEN"` 时，请填写不带 `Bearer ` 前缀的原始 token。Codex 会从自身进程环境读取 `MCP_TOKEN` 并自动添加认证方案。生成脚本写入新变量后，需要重新启动终端、Codex App 或 VS Code。

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