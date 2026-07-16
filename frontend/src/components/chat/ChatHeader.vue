<script setup lang="ts">
import { BotMessageSquare, RefreshCw } from '@lucide/vue';
import { appConfig } from '@/config/appConfig';
import { uiText } from '@/config/uiText';
import type { ChatSession } from '@/types/chat';

defineProps<{
  session?: ChatSession;
  historyTotal: number;
  refreshing: boolean;
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
        type="button"
        :title="uiText.chat.refreshHistory"
        :disabled="refreshing || !session"
        @click="emit('refresh')"
      >
        <RefreshCw :size="14" :class="{ 'spin-icon': refreshing }" />
      </button>
      <span>{{ historyTotal }} 条消息</span>
    </div>
  </header>
</template>
