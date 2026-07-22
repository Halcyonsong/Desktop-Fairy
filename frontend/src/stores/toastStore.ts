import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
}

let nextId = 0;

/**
 * 全局 Toast 通知 Store
 *
 * 提供统一的用户操作反馈机制，替代各组件内联的 message-alert。
 * 支持四种类型：success / error / warning / info
 *
 * 用法：
 *   const toast = useToastStore();
 *   toast.success('保存成功');
 *   toast.error('删除失败');
 */
export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastItem[]>([]);
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  const DEFAULT_DURATION: Record<ToastType, number> = {
    success: 2000,
    info: 3000,
    warning: 4000,
    error: 5000,
  };

  function show(message: string, type: ToastType = 'info', duration?: number) {
    const id = ++nextId;
    const actualDuration = duration ?? DEFAULT_DURATION[type];
    items.value.push({ id, type, message, duration: actualDuration });

    // 自动消失
    const timer = setTimeout(() => {
      dismiss(id);
    }, actualDuration);
    timers.set(id, timer);

    // 最多保留 5 条
    if (items.value.length > 5) {
      const oldest = items.value[0];
      dismiss(oldest.id);
    }

    return id;
  }

  function success(message: string, duration?: number) {
    return show(message, 'success', duration);
  }

  function error(message: string, duration?: number) {
    return show(message, 'error', duration);
  }

  function warning(message: string, duration?: number) {
    return show(message, 'warning', duration);
  }

  function info(message: string, duration?: number) {
    return show(message, 'info', duration);
  }

  function dismiss(id: number) {
    const index = items.value.findIndex((item) => item.id === id);
    if (index !== -1) {
      items.value.splice(index, 1);
    }
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
  }

  function clear() {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    items.value = [];
  }

  return {
    items,
    show,
    success,
    error,
    warning,
    info,
    dismiss,
    clear,
  };
});
