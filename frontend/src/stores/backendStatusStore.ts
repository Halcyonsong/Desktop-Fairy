import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * 后端就绪状态 store
 *
 * Electron 启动时主进程不再等待后端就绪才创建窗口，
 * 而是先显示界面，后端在后台启动。
 * 后端 health check 通过后，主进程通过 IPC 发送 'backend:ready' 事件，
 * 前端监听到后更新此 store，触发界面从"连接中"加载态恢复到正常工作态。
 *
 * 非 Electron 环境（如纯浏览器开发）默认 ready = true。
 */
export const useBackendStatusStore = defineStore('backend-status', () => {
  // 非 Electron 环境默认就绪；Electron 环境等待 IPC 通知
  const isElectron = typeof window !== 'undefined' && Boolean(window.desktopFairy);
  const ready = ref(!isElectron);

  function markReady() {
    ready.value = true;
  }

  return {
    ready,
    markReady,
  };
});
