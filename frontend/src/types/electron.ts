/**
 * Electron 预加载桥接（window.desktopFairy）相关的业务与 IPC 类型定义。
 *
 * 这些类型原先定义在 src/main.ts 中，为避免入口文件承担类型职责、并便于
 * 其他模块（api/stores/components）按需引用而迁移至此。
 */

/**
 * 最小化行为类型：
 *   - 'taskbar'：最小化到任务栏
 *   - 'tray'：最小化到系统托盘
 */
export type MinimizeBehavior = 'taskbar' | 'tray';

/**
 * 最小化行为偏好。
 * behavior 表示用户选择的最小化方式，askAgain 控制是否每次最小化时弹窗询问。
 */
export interface MinimizePrefs {
  behavior: MinimizeBehavior;
  askAgain: boolean;
}

/** 后端 SessionFileReferenceVO 对应的前端类型 */
export interface SessionFileReference {
  fileReferenceId: string;
  sessionId: string;
  absolutePath: string;
  originalFileName: string;
  contentType: string;
  fileSize: number;
  lastKnownModifiedTime: string;
  status: string;
  createTime: string;
  updateTime: string;
}

/** 后端 SessionFolderReferenceVO 对应的前端类型 */
export interface SessionFolderReference {
  folderReferenceId: string;
  sessionId: string;
  absolutePath: string;
  folderName: string;
  status: string;
  createTime: string;
  updateTime: string;
}

export interface FilePathsResult {
  home: string;
  localAppData: string;
  userData: string;
  paths: Array<{
    key: string;
    label: string;
    path: string;
    description: string;
  }>;
}

/**
 * 后端日志读取结果：判别联合。
 *   - exists=true：日志文件存在，携带文件大小与行数
 *   - exists=false：日志文件不存在，携带错误信息
 */
export type BackendLogResult =
  | { path: string; content: string; exists: true; fileSize: number; lines: number }
  | { path: string; content: string; exists: false; message: string };

/**
 * 通过 preload.cjs 暴露在 window.desktopFairy 上的桌面桥接接口。
 *
 * 在 Electron 环境下由 preload.cjs 注入；纯浏览器环境（如直接访问 Vite
 * dev server）下该对象不存在，因此所有方法均为可选。
 */
declare global {
  interface Window {
    desktopFairy?: {
      getWindowMode?: () => Promise<string>;
      getFairyPreferences?: () => Promise<{
        enabled?: boolean;
      }>;
      resetFairyPosition?: () => Promise<{ x: number; y: number; width: number; height: number }>;
      beginFairyDrag?: (payload: { screenX: number; screenY: number }) => void;
      updateFairyDrag?: (payload: { screenX: number; screenY: number }) => void;
      endFairyDrag?: () => void;
      setFairyMouseIgnore?: (ignore: boolean) => void;
      setFairyDragging?: (dragging: boolean) => void;
      setFairyEnabled?: (enabled: boolean) => void;
      onForceDisableResidentChat?: (callback: () => void) => void;
      onEnableFairyFromTray?: (callback: () => void) => void;
      onBackendReady?: (callback: () => void) => void;
      onBackendNotReady?: (callback: () => void) => void;
      getFilePaths?: () => Promise<FilePathsResult>;
      readBackendLog?: (lines: number) => Promise<BackendLogResult>;
      // 最小化行为偏好
      getMinimizePrefs?: () => Promise<MinimizePrefs>;
      setMinimizePrefs?: (prefs: Partial<MinimizePrefs>) => Promise<MinimizePrefs>;
      executeMinimize?: (behavior: MinimizeBehavior) => Promise<void>;
      onAskMinimize?: (callback: () => void) => void;
      // 文件选择对话框
      showOpenFileDialog?: () => Promise<string[] | null>;
      // 文件夹选择对话框
      showOpenFolderDialog?: () => Promise<string | null>;
      // 截图捕获（options: { hideWindow?: boolean }）
      captureScreenshot?: (options?: { hideWindow?: boolean }) => Promise<string | null>;
      // 读取文件为 Data URL（图片预览）
      readFileAsDataUrl?: (filePath: string) => Promise<string | null>;
      // 读取文件为文本（文本预览）
      readFileAsText?: (filePath: string) => Promise<string | null>;
    };
  }
}

export {};
