# Desktop Fairy Frontend

这是 Desktop Fairy 的前端与桌面壳工程，包含：

- Vue 3 + TypeScript + Vite 前端页面
- Electron 主进程与桌面窗口启动逻辑
- electron-builder 打包配置
- 桌面精灵 native 拖动能力（基于 koffi 调用 Windows user32.dll）
- 会话附件、目录授权与工具调用状态展示相关前端实现

当前版本：`v0.3.1`

如果你只想了解整个项目，请优先阅读根目录的 [README.md](../README.md)。

## 目录说明

```text
frontend
├─ src/                               # Vue 页面、组件、状态、API 封装
│  ├─ components/chat/composer/       # 聊天输入区组件（附件 chips、文件预览、目录授权确认等）
│  ├─ components/fairy/controllers/   # 桌面精灵相关 composables
│  ├─ stores/                         # Pinia 状态管理（含 sessionFileStore / sessionFolderStore）
│  ├─ api/                            # API 封装（聊天、文件授权、目录授权、SSE）
│  └─ styles/                         # 全局样式与主题 tokens
├─ electron/                          # Electron 主进程脚本与打包准备脚本
│  ├─ main.cjs                        # 主进程入口（含文件对话框、截图捕获、文件预览 IPC）
│  ├─ preload.cjs                     # 预加载脚本（暴露文件选择、截图、预览 API）
│  ├─ screenshot-overlay.html         # 截图区域选择覆盖窗口 UI
│  ├─ screenshot-preload.cjs          # 截图覆盖窗口 preload
│  ├─ fairyDragController.cjs         # 精灵拖动控制器（native + fallback）
│  └─ prepare-package.cjs             # 打包资源整理脚本
├─ dist/                              # 前端构建产物
├─ bundle-staging/                    # 打包前整理好的后端/JRE/脚本资源
├─ release/                           # electron-builder 输出目录
├─ package.json                       # 前端与打包配置
├─ vite.config.ts                     # Vite 配置
├─ tsconfig.json
└─ tsconfig.node.json
```

## 本地开发

安装依赖：

```powershell
cd <repo-root>/frontend
npm install
```

启动前端开发服务器：

```powershell
npm run dev
```

启动 Electron 开发模式：

```powershell
npm run desktop:dev
```

## 构建

构建前端静态资源：

```powershell
npm run desktop:build
```

准备桌面打包资源：

```powershell
npm run desktop:prepare
```

打包 Windows 安装包：

```powershell
npm run desktop:pack
```

## 打包说明

打包时会把以下资源一并带入：

- 后端 Jar
- 本地模型脚本目录
- `runtime/` 下的 JRE
- `koffi` native 模块

这些资源会先整理到 `bundle-staging/`，再由 electron-builder 打进安装包。

### koffi 与 asarUnpack

`koffi` 用于在 Electron 主进程中调用 Windows native API（`user32.dll`），当前主要用于桌面精灵拖动。

由于 koffi 包含 `.node` 二进制文件，不能直接封进 `app.asar`，必须通过 `asarUnpack` 解包到 `app.asar.unpacked/node_modules/koffi/` 才能在运行时加载。

### 桌面精灵拖动方案

当前拖动逻辑位于 `electron/fairyDragController.cjs`，采用两层方案：

1. Windows 优先的 native 方案：通过 `GetCursorPos` + `MoveWindow` 在物理像素坐标系下操作窗口
2. 轮询 fallback：非 Windows 平台或 koffi 加载失败时，回退到 Electron 原生 API 轮询方案

渲染进程入口位于 `src/components/fairy/controllers/useFairyBubbleController.ts`，鼠标穿透管理位于 `src/components/fairy/controllers/useFairyMouseIgnoreController.ts`。

## 当前约定

- 开发环境前端端口：`5173`
- 后端健康检查地址：`http://127.0.0.1:18765/api/health`
- 生产环境前端资源使用相对路径，避免 `file://` 场景白屏
- Electron 主进程优先使用内置 JRE，而不是依赖系统 Java
- 版本说明以根目录 `README.md` 和 `frontend/package.json` 为准

## Electron IPC 通道

当前通过 `preload.cjs` 暴露到渲染进程的 IPC 通道：

| 通道 | 说明 |
|------|------|
| `dialog:open-file` | 文件选择对话框，支持多选，返回路径数组 |
| `dialog:open-folder` | 文件夹选择对话框，用于工作空间授权 |
| `screenshot:capture` | 区域截图捕获，支持 `hideWindow` 选项隐藏主窗口后截图 |
| `file:read-as-data-url` | 读取文件为 base64 Data URL（用于图片预览） |
| `file:read-as-text` | 读取文件为 UTF-8 文本（用于文本文件预览，限制 50000 字符） |

截图流程：先捕获全屏画面 → 创建透明覆盖窗口让用户拖拽选择区域 → 按 DPI 缩放裁剪 → 保存到系统临时目录。

## 附件与工作空间前端架构

当前资源授权前端由以下部分组成：

- `stores/sessionFileStore.ts`：管理当前会话的已授权文件列表
- `stores/sessionFolderStore.ts`：管理当前会话的已授权目录列表
- `api/sessionApi.ts`：与 `/session-file`、`/session-folder`、聊天流接口交互
- `components/chat/composer/AttachmentChips.vue`：附件 chip 展示
- `components/chat/composer/FilePreview.vue`：附件预览弹窗
- `components/chat/composer/FolderAuthorizeConfirm.vue`：目录授权确认
- `components/chat/AuthorizedPathsBar.vue`：展示当前已授权文件/目录资源

资源授权与聊天请求解耦：文件和目录先通过 REST API 授权到会话，再由后端工具调用链路按需读取。

## 工具调用前端对齐点

当前工具调用流不再依赖正文中的 `@Continue@ / @Finish@ / @Missing@` 标识，前端应按事件流处理过程状态。

主要状态包括：

- `LOOP_START`
- `ROUND_START`
- `TOOL_CALL`
- `TOOL_RESULT`
- `ROUND_CONTINUE`
- `ROUND_FINISH`
- `ROUND_LIMIT`
- `TOOL_LIMIT`
- `TIME_LIMIT`
- `MEDIA_REQUEST_START`

这些状态仅用于过程展示，不应写入最终聊天正文历史。

## 维护建议

如果你后续继续维护这个目录，建议遵守下面几条：

- 页面逻辑放 `src/`
- Electron 启动与打包逻辑只放 `electron/`
- 截图覆盖窗口的 HTML/preload 也放 `electron/`
- 新增 IPC 通道时同步更新 `preload.cjs`、`src/main.ts` 类型声明、本 README 的 IPC 通道表
- 不把后端业务说明堆进前端 README
- 任何桌面打包相关改动，都同步更新根 README 的打包与分发说明
- 如果版本号变更，同时同步 `frontend/package.json` 与相关 README
