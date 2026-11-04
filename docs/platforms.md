# 多平台版本与安装

Zuad 信发助手共用素材管理、节目布局、播放安排和设备操作代码。各平台的区别在安装方式、插件展示和登录入口。保存的节目可以在原信发后台继续编辑；保存不会自动下发到设备。

## 选择安装方式

| 平台 | 分发格式 | 当前验证范围 |
| --- | --- | --- |
| DeepSeek Harness | 原有 `dsh-plugin-zuad-media` 包、Cordis 配置与详情页 | 原生注册、账号登录及业务回归测试 |
| Codex | `.codex-plugin/plugin.json`、MCP、Skill | 原生插件安装流程与 MCP 测试；保留原有登录目录 |
| Claude Code | `.claude-plugin/plugin.json`、`.mcp.json`、Skill | 生成适配文件并验证 MCP；需在目标客户端安装验收 |
| Cursor | `.cursor-plugin/plugin.json`、`.mcp.json`、Skill | 生成适配文件并验证 MCP；需在目标客户端安装验收 |
| Gemini CLI | 根目录 `gemini-extension.json`、Skill | 生成适配文件并验证 MCP；需在目标客户端安装验收 |
| 其他 MCP 客户端 | 标准 stdio MCP 配置 | 可发现 14 个工具，提供本地登录入口 |
| Agent Plugins 1.0 | 根目录 `plugin.json`、`mcp.json`、Skill | 采用标准清单；客户端须支持该标准及相应变量展开 |

生成安装包不代表已被任何官方插件市场收录。各平台的市场提交、审核与更新渠道需要分别办理。当前没有部署远程 MCP 服务，也没有发布新的 npm 包。

## DSH 和 Codex

DSH 继续使用原有包名、插件索引和安装入口，无需修改后台接口。Codex 从项目源码安装：

```sh
npm ci
npm run build
npm run install:codex
```

安装脚本只安装 MCP 所需的生产依赖，不再复制整个开发环境或 DSH 工具链。账号保存在插件目录之外，更新插件不会清除原有 Codex 登录信息。详情参见项目内的 `docs/codex.md`。

## 生成其他平台安装包

构建与运行使用 Node.js 24.15 或更新版本，推荐 24.22.1；需要 npm。不同系统应在各自系统上安装依赖，以获取匹配操作系统和 CPU 的图片渲染库。

```sh
npm ci
npm run check
npm run build:platforms
```

项目的 `dist/` 下会生成 `codex/`、`claude/`、`cursor/`、`gemini/`、`mcp/` 和 `agent/`。每个目录都包含同一份运行代码、字体、Skill、独立的生产依赖清单和锁文件。可移动整个目录；不要只移动清单文件。

这些可移植包不内置 `node_modules`。在目标系统的相应目录中先执行一次：

```sh
npm ci --omit=dev --ignore-scripts
```

此后插件运行不需要启动 DSH 或准备本地节目编辑器。需要本地 Node.js，并能访问用户的信发后台。

每个分发目录还提供 `npm run connect`，可单独打开该平台的本地账号连接页面；`npm start` 则启动对应平台的 stdio MCP。两个命令使用同一平台的账号目录。

Claude Code 可以通过其本地插件加载方式测试生成的 `claude/` 目录，例如 `claude --plugin-dir /absolute/path/to/claude`。Cursor 使用其本地插件安装入口加载 `cursor/`。Gemini CLI 可以运行 `gemini extensions install /absolute/path/to/gemini`，安装后重新开始会话。第三方客户端的完整安装、升级及市场审核需在目标环境验收。

通用 MCP 客户端可按 `mcp.example.json` 配置：把示例绝对路径替换为解压目录，使用 `node` 执行 `lib/mcp/stdio.js --host mcp`。Claude、Cursor 和 Gemini 的清单已分别使用各平台的插件目录变量，避免依赖当前工作目录。Codex 使用宿主解析的插件工作目录。

需要压缩包和校验值时运行：

```sh
npm run package:platforms
```

`dist/artifacts/` 会包含原 DSH `.tgz`、各平台的 `.tar.gz` 和 `SHA256SUMS`。`.tar.gz` 解压后，插件清单位于根目录。发布工作流会构建这些附件，不会自动发布 npm 或申请其他平台的市场收录。

## 登录与账号保存

安装完成后，在对话中说“连接我的 Zuad 信发系统，给我一个登录入口”。助手调用 `zuad_connection` 获取本地页面链接。在页面填写后台地址、账号和密码，成功后回到对话即可管理素材、制作节目、安排播放和操作设备。

登录链接只在本次 MCP 进程运行期间有效。进程重启后重新获取链接；已保存的账号仍然保留。Windows 使用当前系统账号的 DPAPI 加密密码，其他系统使用仅当前用户可访问的凭据文件。密码不作为 AI 工具参数传递。

各平台默认单独保存登录状态：

| 平台 | 默认账号目录 |
| --- | --- |
| Codex | `~/.codex/zuad-media`；兼容 `CODEX_HOME` 和原有 `ZUAD_CODEX_DATA_DIR` |
| Claude Code | `~/.zuad-media/claude` |
| Cursor | `~/.zuad-media/cursor` |
| Gemini CLI | `~/.zuad-media/gemini` |
| 通用 MCP / Agent Plugins | `~/.zuad-media/mcp` |

非 Codex 平台可通过 `ZUAD_DATA_DIR` 修改账号目录的父目录，平台子目录仍分开。如果宿主过滤环境变量，需在其 MCP 配置中明确允许该变量；默认安装无需设置它。DSH 继续使用自身配置，不读取这些账号文件。

素材工作目录位于对应账号目录的 `files/` 下，调用连接状态工具即可查询。先上传登记素材库，再在节目中引用返回的素材信息。接口权限与组织范围由登录账号决定；下发后查询异步任务结果，不能把任务创建成功当成设备播放成功。

## 开发与后续平台接入

共享业务模块仍位于 `src/`，公共配置与工具契约位于 `src/core/`；通用 MCP 服务及本地登录位于 `src/mcp/`。`src/tools.ts`、`src/config.ts`、`src/index.ts` 和 `src/connection.ts` 只负责 DSH 宿主接入。`src/codex/` 与原 `lib/mcp.js` 为旧入口保留兼容层。

`adapters/platforms.mjs` 负责生成不同平台的清单和路径变量。新增平台时复用现有 MCP 工具与 Skill，只增加宿主适配、打包和该平台的安装验证。业务修复无需在多个平台重复实现。

源码、发布包与运行账号数据分开管理。构建使用明确的文件清单，不包含账号文件、`.env`、上传素材、测试截图、开发依赖或机器路径。生成的 MCP 包暂设为私有，避免未经配置误发到 npm。

未来若提供免本地 Node.js 的服务，可另加 Streamable HTTP 与 OAuth 授权适配；届时本地文件上传和账号隔离也需同步设计，不能将本地路径直接用于远程服务。
