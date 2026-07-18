# Desktop Fairy Frontend

这是 Desktop Fairy 的前端与桌面壳工程，包含：

- Vue 3 + TypeScript + Vite 前端页面
- Electron 主进程与桌面窗口启动逻辑
- electron-builder 打包配置

如果你只想了解整个项目，请优先阅读仓库根目录的 [README.md](E:\develop\idea\Desktop-Fairy\README.md)。

## 目录说明

```text
frontend
├─ src/                    # Vue 页面、组件、状态、API 封装
├─ electron/               # Electron 主进程脚本与打包准备脚本
├─ dist/                   # 前端构建产物
├─ bundle-staging/         # 打包前整理好的后端/JRE/脚本资源
├─ release/                # electron-builder 输出目录
├─ package.json            # 前端与打包配置
├─ vite.config.ts          # Vite 配置
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

这些资源会先被整理到 `bundle-staging/`，再由 electron-builder 打进安装包。

## 当前约定

- 开发环境前端端口：`5173`
- 后端健康检查地址：`http://127.0.0.1:18765/api/health`
- 生产环境前端资源使用相对路径，避免 `file://` 场景白屏
- Electron 主进程优先使用内置 JRE，而不是依赖系统 Java

## 建议

如果你后续继续维护这个目录，建议遵守下面几条：

- 页面逻辑放 `src/`
- Electron 启动与打包逻辑只放 `electron/`
- 不把后端业务说明堆进前端 README
- 任何桌面打包相关改动，都同步更新根 README 的“打包/分发”部分
