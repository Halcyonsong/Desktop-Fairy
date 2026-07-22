import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

/**
 * 后端就绪状态 store
 *
 * Electron 启动时主进程不再等待后端就绪才创建窗口，
 * 而是先显示界面，后端在后台启动。
 * 后端 health check 通过后，主进程通过 IPC 发送 'backend:ready' 事件，
 * 前端监听到后更新此 store，触发界面从"连接中"加载态恢复到正常工作态。
 *
 * 后端断开时（如系统睡眠后后端进程挂掉），主进程发送 'backend:not-ready' 事件，
 * 前端显示"后端已断开，正在重连"提示，后端恢复后自动回到正常状态。
 *
 * 非 Electron 环境（如纯浏览器开发）默认 ready = true。
 */
export const useBackendStatusStore = defineStore('backend-status', () => {
  // 非 Electron 环境默认就绪；Electron 环境等待 IPC 通知
  const isElectron = typeof window !== 'undefined' && Boolean(window.desktopFairy);
  const ready = ref(!isElectron);
  // 是否曾经就绪过（用于区分"首次启动"和"断线重连"）
  const wasReady = ref(false);

  // 判断当前应该显示哪种界面状态
  // 'connecting' — 首次启动，等待后端就绪
  // 'reconnecting' — 曾经就绪过，后端断开了，正在重连
  // 'ready' — 后端就绪，正常工作
  const status = computed<'connecting' | 'reconnecting' | 'ready'>(() => {
    if (ready.value) return 'ready';
    if (wasReady.value) return 'reconnecting';
    return 'connecting';
  });

  function markReady() {
    ready.value = true;
    wasReady.value = true;
  }

  function markNotReady() {
    ready.value = false;
  }

  return {
    ready,
    wasReady,
    status,
    markReady,
    markNotReady,
  };
});
