<script setup lang="ts">
import { ChevronDown } from '@lucide/vue';
import HistoryPullIndicator from '@/components/chat/HistoryPullIndicator.vue';
import MessageRow from '@/components/chat/MessageRow.vue';
import { useMessageListController } from '@/components/chat/controllers/useMessageListController';
import { copyText } from '@/utils/clipboard';
import { uiText } from '@/config/uiText';
import type { ChatMessage } from '@/types/chat';

const props = defineProps<{
  sessionKey: string;
  messages: ChatMessage[];
  errorMessage: string;
  reasoningText: string;
  reasoningMessageId: string;
  historyPullMessage: string;
  loadingMoreHistory: boolean;
  sending: boolean;
}>();

const emit = defineEmits<{
  loadMore: [];
  rollbackLatestRound: [];
  deleteLatestRound: [];
}>();

const controller = useMessageListController({
  sessionKey: () => props.sessionKey,
  messages: () => props.messages,
  reasoningText: () => props.reasoningText,
  reasoningMessageId: () => props.reasoningMessageId,
  historyPullMessage: () => props.historyPullMessage,
  loadingMoreHistory: () => props.loadingMoreHistory,
  sending: () => props.sending,
  onLoadMore: () => emit('loadMore'),
});

const {
  messageListRef,
  pullDistance,
  pullText,
  latestUserMessageId,
  latestAssistantMessageId,
  showBackToBottom,
  isLatestRoundMessage,
  isReasoningMessage,
  isReasoningOpen,
  toggleReasoning,
  reasoningLabel,
  reasoningBody,
  scrollToBottom,
  handleScroll,
  handleWheel,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
} = controller;

function speakerLabel(role: ChatMessage['role']) {
  return role === 'user' ? uiText.chat.speakerUser : uiText.chat.speakerAssistant;
}

function statusText(status: ChatMessage['status']) {
  return uiText.messageStatus[status];
}
</script>

<template>
  <section
    ref="messageListRef"
    class="message-list"
    aria-label="会话消息"
    @scroll="handleScroll"
    @wheel="handleWheel"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerUp"
    @mouseleave="handlePointerUp"
  >
    <HistoryPullIndicator :pull-distance="pullDistance" :text="pullText" />

    <Transition name="content-fade" mode="out-in">
      <div :key="sessionKey" class="message-list__content">
        <div v-if="errorMessage" class="message-alert">{{ errorMessage }}</div>
        <div v-if="messages.length === 0" class="empty-message">{{ uiText.chat.emptyMessage }}</div>

        <MessageRow
          v-for="message in messages"
          :key="message.id"
          :message="message"
          :reasoning-open="isReasoningOpen(message)"
          :speaker-label="speakerLabel(message.role)"
          :status-text="statusText(message.status)"
          :show-rollback="message.id === latestUserMessageId && isLatestRoundMessage(message)"
          :show-delete="message.id === latestAssistantMessageId && isLatestRoundMessage(message)"
          :sending="sending"
          @toggle-reasoning="toggleReasoning(message)"
          @rollback="emit('rollbackLatestRound')"
          @delete="emit('deleteLatestRound')"
        />
      </div>
    </Transition>

    <button
      v-if="showBackToBottom"
      class="back-to-bottom-button"
      type="button"
      :title="uiText.chat.backToBottom"
      @click="scrollToBottom()"
    >
      <ChevronDown :size="18" />
    </button>
  </section>
</template>
