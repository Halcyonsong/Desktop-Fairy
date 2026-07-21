# Desktop Fairy Frontend

这是 Desktop Fairy 的前端与桌面壳工程，包含：

- Vue 3 + TypeScript + Vite 前端页面
- Electron 主进程与桌面窗口启动逻辑
- electron-builder 打包配置
- 桌面精灵 native 拖动能力（基于 koffi 调用 Windows user32.dll）

当前版本：`v0.2.1`

如果你只想了解整个项目，请优先阅读根目录的 [README.md](/E:/develop/idea/Desktop-Fairy/README.md)。

## 目录说明

```text
frontend
├─ src/                               # Vue 页面、组件、状态、API 封装
│  ├─ components/fairy/controllers/   # 桌面精灵相关 composables
│  ├─ modules/vosk/                   # Vosk 语音识别模块
│  ├─ stores/                         # Pinia 状态管理
│  ├─ api/                            # API 封装
│  └─ styles/                         # 全局样式与主题 tokens
├─ electron/                          # Electron 主进程脚本与打包准备脚本
│  ├─ main.cjs                        # 主进程入口
│  ├─ preload.cjs                     # 预加载脚本
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
cd E:\develop\idea\Desktop-Fairy\frontend
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

这些资源会先被整理到 `bundle-staging/`，再由 electron-builder 打进安装包。

### koffi 与 asarUnpack

`koffi` 用于在 Electron 主进程中调用 Windows native API（`user32.dll`），当前主要用于桌面精灵拖动。

由于 koffi 包含 `.node` 二进制文件，不能直接封进 `app.asar`，必须通过 `asarUnpack` 解包到 `app.asar.unpacked/node_modules/koffi/` 才能在运行时加载。

### 桌面精灵拖动方案

当前拖动逻辑位于 `electron/fairyDragController.cjs`，采用两层方案：

1. Windows 优先的 native 方案：通过 `GetCursorPos` + `MoveWindow` 在物理像素坐标系下操作窗口
2. 轮询 fallback：非 Windows 平台或 koffi 加载失败时，回退到 Electron 原生 API 轮询方案

渲染进程入口位于 `src/components/fairy/controllers/useFairyDragController.ts`，鼠标穿透管理位于 `src/components/fairy/controllers/useFairyMouseIgnoreController.ts`。

## 当前约定

- 开发环境前端端口：`5173`
- 后端健康检查地址：`http://127.0.0.1:18765/api/health`
- 生产环境前端资源使用相对路径，避免 `file://` 场景白屏
- Electron 主进程优先使用内置 JRE，而不是依赖系统 Java
- 版本说明以根目录 `README.md` 和 `frontend/package.json` 为准

## 维护建议

如果你后续继续维护这个目录，建议遵守下面几条：

- 页面逻辑放 `src/`
- Electron 启动与打包逻辑只放 `electron/`
- 不把后端业务说明堆进前端 README
- 任何桌面打包相关改动，都同步更新根 README 的“打包/分发”部分
- 如果版本号变更，同时同步 `frontend/package.json` 与相关 README
