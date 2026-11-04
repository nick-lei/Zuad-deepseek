# 在 Codex 中使用 Zuad 信发助手

Codex 版本提供原生插件“Zuad 信发助手”，包含 MCP 工具、配套使用指令和插件详情。它与 DSH 版本共用素材上传、节目编译、布局保存、播放安排和设备操作代码。运行 Codex 版本不需要启动 DSH，也不需要本地节目编辑器。

## 本地安装

需要 Node.js 24 和已安装的 Codex。下载当前项目源码后，在项目目录运行：

```sh
npm install
npm run build
npm run install:codex
```

安装脚本通过 Codex CLI 添加本地插件源 `zuad-local` 并安装 `zuad-media` 原生插件。插件显示名称是“Zuad 信发助手”，可在“自定义 → 插件”中搜索 `Zuad` 查看介绍和管理启用状态。修改前在 Codex 配置目录备份 `config.toml`。

所需程序和字体会复制到 Codex 的插件目录，再按锁文件安装 MCP 所需的生产依赖；不会复制 DSH 或开发依赖。Node 使用安装时的完整可执行文件路径。之后移动项目源码不会影响已安装的插件。更新 Node 的安装位置后需要重新执行安装脚本。账号和素材工作目录独立保存，不打包进插件。多平台打包与其他客户端的验证范围见 [多平台说明](platforms.md)。

如果以前使用过单独的 MCP 安装方式，应在确认原生插件可用后移除旧的 `zuad-media` MCP 注册，并备份后移走全局 `skills/zuad-signage`，以免重复加载；原生插件已经包含这两部分。

重新打开插件页面；如列表未更新，重新启动 Codex。开始新对话以加载插件工具，可以这样说：

> 使用 Zuad 信发助手，给我一个登录入口。

也可以先运行 `npm run connect:codex`，在它输出的本地页面地址中完成账号连接，再回到 Codex 使用。关闭这个命令会使该页面地址失效，已保存的账号配置仍然保留。

在返回的本地网页中填写信发后台地址、账号和密码，点击“登录并连接”。页面会显示当前账号及自动识别的组织。登录后回到 Codex，可以继续说：

> 列出我已有的节目和设备，先不做修改。

## 日常使用

- 制作节目：使用已有素材或上传图片，说明画布尺寸、布局和播放时长，保存后可在原后台编辑。
- 下发和排程：说明节目、目标设备或设备组、时间安排。下发后查询任务状态确认执行结果。
- 切换账号：让 Codex 提供新的登录入口，在网页中选择“切换账号”。
- 退出登录：在连接网页退出，或让 Codex 调用连接工具退出。

账号密码通过本地登录页面输入，不作为 AI 工具参数，也不回显给 AI。登录入口仅绑定 `127.0.0.1`，带临时访问凭据；不要把这个链接转发给其他人。MCP 进程退出后，原链接失效，应重新获取。

Windows 密码通过当前 Windows 账号的 DPAPI 加密后保存；其他系统使用仅当前用户可读写的凭据文件。默认目录是 `~/.codex/zuad-media/`，设置 `CODEX_HOME` 时跟随该目录。退出登录会清除保存的密码。素材工作目录位于其中的 `files/`，可以由 `zuad_connection` 查询。不同 Codex 进程共享保存的连接信息，但各自维护后台会话；新的调用会读取最新的账号设置。

已有 DSH 登录信息不会自动导入 Codex。两边分别登录，避免隐式共用账号。MCP 进程重启后可以使用已保存的凭据重新连接；后台权限及设备限制仍然生效。

## 只使用 MCP 的替代安装

这种方式不会出现在“自定义 → 插件”列表中。已安装原生插件时无需重复注册。

也可以使用实际的 Node 可执行文件和编译后入口路径：

```sh
codex mcp add zuad-media -- /absolute/path/to/node /absolute/path/to/Zuad-deepseek/lib/mcp.js
```

将 `skills/zuad-signage` 安装到 Codex 的 `skills` 目录。用 `codex mcp get zuad-media` 检查注册结果。高级部署可以通过 `ZUAD_CODEX_DATA_DIR` 指定独立的连接与素材目录。

卸载原生插件：

```sh
codex plugin remove zuad-media@zuad-local
```

卸载手工 MCP 注册：

```sh
codex mcp remove zuad-media
```

需要同时移除 Skill 时，删除 Codex 的 `skills/zuad-signage` 目录。需要清除登录信息时，先在连接页面退出登录。不要把本地凭据目录、配置备份或临时登录链接提交到 GitHub。
