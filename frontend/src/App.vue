<script setup lang="ts">
import { computed, watch } from 'vue';
import { LoaderCircle } from '@lucide/vue';
import FloatingFairy from '@/components/fairy/FloatingFairy.vue';
import WorkbenchView from '@/views/WorkbenchView.vue';
import { useBackendStatusStore } from '@/stores/backendStatusStore';
import { useWindowModeStore } from '@/stores/windowModeStore';
import { uiText } from '@/config/uiText';

const windowModeStore = useWindowModeStore();
const backendStatusStore = useBackendStatusStore();
const windowMode = computed(() => windowModeStore.windowMode);
const isFairyWindow = computed(() => windowMode.value === 'fairy');
const backendReady = computed(() => backendStatusStore.ready);

watch(
  windowMode,
  (mode) => {
    document.documentElement.dataset.windowMode = mode;
    document.body.dataset.windowMode = mode;
  },
  { immediate: true },
);
</script>

<template>
  <!-- 后端未就绪时的加载占位（仅工作台窗口显示） -->
  <div v-if="!backendReady && !isFairyWindow" class="backend-connecting">
    <div class="backend-connecting__card">
      <LoaderCircle :size="32" class="backend-connecting__spinner" />
      <p class="backend-connecting__title">{{ uiText.backend.connecting }}</p>
      <p class="backend-connecting__hint">{{ uiText.backend.connectingHint }}</p>
    </div>
  </div>
  <template v-else>
    <FloatingFairy v-if="isFairyWindow" :window-mode="windowMode" />
    <WorkbenchView v-else />
  </template>
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
  color: var(--color-accent, #5b7cff);
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

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
