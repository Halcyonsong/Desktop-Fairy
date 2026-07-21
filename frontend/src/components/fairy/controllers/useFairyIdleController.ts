import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue';

interface IdleControllerOptions {
  enabled: Ref<boolean>;
  /**
   * 当前自动闲聊触发时间（毫秒）。
   * 由 fairyStore.idleTriggerMs 提供；当用户在设置中调整滑动条时，
   * 这里会自动重新调度下一次空闲检测。
   */
  idleDelayMs: Ref<number>;
  onActivity: () => void;
  onIdleCheck: () => void | Promise<void>;
  onWindowPointerDown?: (event: MouseEvent) => void;
}

/**
 * 空闲检测控制器（单次 timeout 动态调度版）。
 *
 * 旧实现是固定 5 秒 setInterval 轮询，存在两个问题：
 * 1. 用户把闲聊时间设为 30 秒时，体感上会有明显误差，且测试难以验证是否真正按配置触发；
 * 2. 持续轮询会在整个应用生命周期内不断唤醒，即使用户完全不需要自动闲聊。
 *
 * 新实现改为：
 * - 每次用户活动后，重新按 idleDelayMs 安排一次 setTimeout
 * - timeout 到点时执行一次 onIdleCheck；若 onIdleCheck 内部判定无需触发，可由外层再次安排
 * - 当 idleDelayMs（滑动条）变化时，自动清理旧 timeout 并按新值重排
 */
export function useFairyIdleController({
  enabled,
  idleDelayMs,
  onActivity,
  onIdleCheck,
  onWindowPointerDown,
}: IdleControllerOptions) {
  let idleCheckTimer: number | null = null;

  function clearIdleCheckTimer() {
    if (idleCheckTimer !== null) {
      window.clearTimeout(idleCheckTimer);
      idleCheckTimer = null;
    }
  }

  function scheduleIdleCheck() {
    clearIdleCheckTimer();
    if (!enabled.value) {
      return;
    }

    idleCheckTimer = window.setTimeout(() => {
      idleCheckTimer = null;
      void onIdleCheck();
    }, idleDelayMs.value);
  }

  function handleActivity() {
    onActivity();
    scheduleIdleCheck();
  }

  onMounted(() => {
    window.addEventListener('pointerdown', handleActivity, true);
    window.addEventListener('keydown', handleActivity, true);
    window.addEventListener('focus', handleActivity, true);
    document.addEventListener('visibilitychange', handleActivity);
    if (onWindowPointerDown) {
      window.addEventListener('mousedown', onWindowPointerDown);
    }
    scheduleIdleCheck();
  });

  // 启停自动闲聊时，重新调度
  watch(enabled, () => {
    scheduleIdleCheck();
  });

  // 用户调整滑动条时，下一次空闲检测立即按新值重排
  watch(idleDelayMs, () => {
    scheduleIdleCheck();
  });

  onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', handleActivity, true);
    window.removeEventListener('keydown', handleActivity, true);
    window.removeEventListener('focus', handleActivity, true);
    document.removeEventListener('visibilitychange', handleActivity);
    if (onWindowPointerDown) {
      window.removeEventListener('mousedown', onWindowPointerDown);
    }
    clearIdleCheckTimer();
  });

  return {
    scheduleIdleCheck,
    clearIdleCheckTimer,
  };
}
