import { onBeforeUnmount, onMounted, type Ref } from 'vue';

interface IdleControllerOptions {
  enabled: Ref<boolean>;
  onActivity: () => void;
  onIdleCheck: () => void | Promise<void>;
  onWindowPointerDown?: (event: MouseEvent) => void;
  intervalMs?: number;
}

export function useFairyIdleController({
  enabled,
  onActivity,
  onIdleCheck,
  onWindowPointerDown,
  intervalMs = 5000,
}: IdleControllerOptions) {
  let idleCheckTimer: number | null = null;

  function clearIdleCheckTimer() {
    if (idleCheckTimer !== null) {
      window.clearInterval(idleCheckTimer);
      idleCheckTimer = null;
    }
  }

  function startIdleWatcher() {
    clearIdleCheckTimer();
    if (!enabled.value) {
      return;
    }

    idleCheckTimer = window.setInterval(() => {
      void onIdleCheck();
    }, intervalMs);
  }

  onMounted(() => {
    window.addEventListener('pointerdown', onActivity, true);
    window.addEventListener('keydown', onActivity, true);
    window.addEventListener('focus', onActivity, true);
    document.addEventListener('visibilitychange', onActivity);
    if (onWindowPointerDown) {
      window.addEventListener('mousedown', onWindowPointerDown);
    }
    startIdleWatcher();
  });

  onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', onActivity, true);
    window.removeEventListener('keydown', onActivity, true);
    window.removeEventListener('focus', onActivity, true);
    document.removeEventListener('visibilitychange', onActivity);
    if (onWindowPointerDown) {
      window.removeEventListener('mousedown', onWindowPointerDown);
    }
    clearIdleCheckTimer();
  });

  return {
    startIdleWatcher,
    clearIdleCheckTimer,
  };
}
