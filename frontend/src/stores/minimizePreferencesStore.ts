import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { MinimizeBehavior, MinimizePrefs } from '@/types/electron';

/**
 * 最小化行为偏好 Store
 *
 * 管理用户在点击最小化时的行为选择：
 *   - behavior: 'taskbar'（最小化到任务栏）| 'tray'（最小化到托盘）
 *   - askAgain: 是否每次最小化时弹窗询问
 *
 * 偏好持久化由 Electron 主进程负责（fairy-preferences.json），
 * 前端通过 IPC 读写。
 */
export const useMinimizePreferencesStore = defineStore('minimizePreferences', () => {
  const behavior = ref<MinimizeBehavior>('taskbar');
  const askAgain = ref(true);
  const loaded = ref(false);

  /** 从主进程加载偏好 */
  async function load() {
    if (!window.desktopFairy?.getMinimizePrefs) {
      return;
    }
    try {
      const prefs = await window.desktopFairy.getMinimizePrefs();
      behavior.value = prefs.behavior;
      askAgain.value = prefs.askAgain;
      loaded.value = true;
    } catch {
      // 非 Electron 环境，忽略
    }
  }

  /** 设置行为偏好并持久化 */
  async function setBehavior(next: MinimizeBehavior) {
    behavior.value = next;
    await persist();
  }

  /** 设置是否再次询问并持久化 */
  async function setAskAgain(next: boolean) {
    askAgain.value = next;
    await persist();
  }

  /** 一次性设置行为和询问标记 */
  async function setPrefs(next: { behavior?: MinimizeBehavior; askAgain?: boolean }) {
    if (next.behavior !== undefined) behavior.value = next.behavior;
    if (next.askAgain !== undefined) askAgain.value = next.askAgain;
    await persist();
  }

  /** 执行实际最小化操作 */
  async function executeMinimize(targetBehavior?: MinimizeBehavior) {
    const target = targetBehavior ?? behavior.value;
    await window.desktopFairy?.executeMinimize?.(target);
  }

  async function persist() {
    await window.desktopFairy?.setMinimizePrefs?.({
      behavior: behavior.value,
      askAgain: askAgain.value,
    });
  }

  return {
    behavior,
    askAgain,
    loaded,
    load,
    setBehavior,
    setAskAgain,
    setPrefs,
    executeMinimize,
  };
});
