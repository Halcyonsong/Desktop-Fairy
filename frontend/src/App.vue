<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { LoaderCircle, WifiOff } from '@lucide/vue';
import FloatingFairy from '@/components/fairy/FloatingFairy.vue';
import MinimizeDialog from '@/components/common/MinimizeDialog.vue';
import ToastContainer from '@/components/common/ToastContainer.vue';
import WorkbenchView from '@/views/WorkbenchView.vue';
import { useBackendStatusStore } from '@/stores/backendStatusStore';
import { useMinimizePreferencesStore } from '@/stores/minimizePreferencesStore';
import { useWindowModeStore } from '@/stores/windowModeStore';
import { uiText } from '@/config/uiText';

const windowModeStore = useWindowModeStore();
const backendStatusStore = useBackendStatusStore();
const minimizePrefs = useMinimizePreferencesStore();
const windowMode = computed(() => windowModeStore.windowMode);
const isFairyWindow = computed(() => windowMode.value === 'fairy');
const backendStatus = computed(() => backendStatusStore.status);

// 最小化弹窗状态
const minimizeDialogOpen = ref(false);

watch(
  windowMode,
  (mode) => {
    document.documentElement.dataset.windowMode = mode;
    document.body.dataset.windowMode = mode;
  },
  { immediate: true },
);

onMounted(() => {
  // 加载最小化偏好
  void minimizePrefs.load();

  // 监听主进程的最小化询问事件
  window.desktopFairy?.onAskMinimize?.(() => {
    minimizeDialogOpen.value = true;
  });
});
</script>

<template>
  <!-- 后端未就绪时的加载占位（仅工作台窗口显示） -->
  <div v-if="backendStatus !== 'ready' && !isFairyWindow" class="backend-connecting">
    <div class="backend-connecting__card">
      <!-- 首次连接：spinner -->
      <LoaderCircle v-if="backendStatus === 'connecting'" :size="32" class="backend-connecting__spinner" />
      <!-- 断线重连：wifi-off 图标 + spinner -->
      <div v-else class="backend-connecting__reconnect-icon">
        <WifiOff :size="28" />
        <LoaderCircle :size="16" class="backend-connecting__reconnect-spinner" />
      </div>

      <p class="backend-connecting__title">
        {{ backendStatus === 'reconnecting' ? uiText.backend.reconnecting : uiText.backend.connecting }}
      </p>
      <p class="backend-connecting__hint">
        {{ backendStatus === 'reconnecting' ? uiText.backend.reconnectingHint : uiText.backend.connectingHint }}
      </p>
    </div>
  </div>
  <template v-else>
    <FloatingFairy v-if="isFairyWindow" :window-mode="windowMode" />
    <WorkbenchView v-else />
  </template>

  <!-- 最小化行为选择弹窗（仅工作台窗口） -->
  <MinimizeDialog v-if="!isFairyWindow" :open="minimizeDialogOpen" @close="minimizeDialogOpen = false" />

  <!-- 全局 Toast 通知 -->
  <ToastContainer />
</template>

<style scoped>
.backend-connecting {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--color-bg-primary, #f7f7f8);
}

.backend-connecting__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 48px;
  text-align: center;
}

.backend-connecting__spinner {
  color: var(--color-accent);
  animation: spin 1.2s linear infinite;
}

.backend-connecting__reconnect-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary, #8a9099);
}

.backend-connecting__reconnect-spinner {
  position: absolute;
  bottom: -2px;
  right: -2px;
  color: var(--color-accent);
  animation: spin 1.2s linear infinite;
}

.backend-connecting__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary, #1f2329);
}

.backend-connecting__hint {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary, #8a9099);
  max-width: 280px;
  line-height: 1.5;
}
</style>
