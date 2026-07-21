<script setup lang="ts">
import { BotMessageSquare, Check, RefreshCw } from '@lucide/vue';
import { appConfig } from '@/config/appConfig';
import { uiText } from '@/config/uiText';
import type { ChatSession } from '@/types/chat';

defineProps<{
  session?: ChatSession;
  historyTotal: number;
  refreshing: boolean;
  refreshSuccess?: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
}>();
</script>

<template>
  <header class="chat-header">
    <div class="chat-header__title-group">
      <div class="chat-header__icon" aria-hidden="true">
        <BotMessageSquare :size="18" />
      </div>
      <div>
        <span class="chat-header__status">{{ appConfig.workbenchSubtitle }}</span>
        <h2>{{ session?.title ?? uiText.chat.untitledSession }}</h2>
      </div>
    </div>

    <div class="chat-header__meta">
      <button
        class="chat-header__refresh"
        :class="{ 'chat-header__refresh--success': refreshSuccess }"
        type="button"
        :title="refreshing ? '正在刷新历史' : refreshSuccess ? '已刷新历史' : uiText.chat.refreshHistory"
        :disabled="refreshing || !session"
        @click="emit('refresh')"
      >
        <Transition name="refresh-icon-fade" mode="out-in">
          <Check v-if="refreshSuccess && !refreshing" :key="'check'" :size="14" />
          <RefreshCw v-else :key="'refresh'" :size="14" :class="{ 'spin-icon': refreshing }" />
        </Transition>
      </button>
      <span>{{ historyTotal }} 条消息</span>
    </div>
  </header>
</template>

<style scoped>
.chat-header__refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}

.chat-header__refresh:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface) 92%);
}

.chat-header__refresh--success {
  border-color: color-mix(in srgb, var(--color-success, #10b981) 50%, var(--color-border) 50%);
  color: var(--color-success, #10b981);
  background: color-mix(in srgb, var(--color-success, #10b981) 10%, var(--color-surface) 90%);
}

.refresh-icon-fade-enter-active,
.refresh-icon-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.refresh-icon-fade-enter-from,
.refresh-icon-fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
