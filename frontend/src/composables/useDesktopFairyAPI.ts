import type { BackendLogResult, FilePathsResult } from '@/main';

/**
 * 封装对 window.desktopFairy Electron bridge 的访问
 *
 * 在 Electron 环境下，window.desktopFairy 由 preload.cjs 注入
 * 在纯浏览器环境（如 Vite dev server 直接访问），该对象不存在
 *
 * 本 composable 提供：
 *   - isAvailable(): 判断是否在 Electron 环境
 *   - getFilePaths(): 获取所有文件存储路径
 *   - readBackendLog(lines): 读取后端日志文件尾部
 */
export function useDesktopFairyAPI() {
  function isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.desktopFairy;
  }

  async function getFilePaths(): Promise<FilePathsResult> {
    if (!window.desktopFairy?.getFilePaths) {
      throw new Error('Electron bridge 不可用，请在桌面应用环境下使用此功能');
    }
    return window.desktopFairy.getFilePaths();
  }

  async function readBackendLog(lines = 500): Promise<BackendLogResult> {
    if (!window.desktopFairy?.readBackendLog) {
      throw new Error('Electron bridge 不可用，请在桌面应用环境下使用此功能');
    }
    return window.desktopFairy.readBackendLog(lines);
  }

  return {
    isAvailable,
    getFilePaths,
    readBackendLog,
  };
}
