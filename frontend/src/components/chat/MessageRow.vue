<script setup lang="ts">
import { watch } from 'vue';
import { Bot, LoaderCircle, UserRound } from '@lucide/vue';
import MessageActions from '@/components/chat/MessageActions.vue';
import ReasoningToggle from '@/components/chat/ReasoningToggle.vue';
import RichMessageContent from '@/components/chat/RichMessageContent.vue';
import { formatTime } from '@/utils/date';
import type { ChatMessage } from '@/types/chat';

const props = defineProps<{
  message: ChatMessage;
  showReasoningToggle: boolean;
  reasoningOpen: boolean;
  reasoningLabel: string;
  reasoningBody: string;
  speakerLabel: string;
  statusText: string;
  showRollback: boolean;
  showDelete: boolean;
  sending: boolean;
}>();

const emit = defineEmits<{
  toggleReasoning: [];
  copy: [content: string];
  rollback: [];
  delete: [];
}>();

watch(
  () => [props.reasoningOpen, props.sending, props.message.status] as const,
  ([reasoningOpen, sending, status], previous) => {
    const [previousOpen, previousSending, previousStatus] = previous ?? [false, false, 'completed'];
    const justFinished = (previousSending || previousStatus === 'streaming') && !sending && status !== 'streaming';
    if (reasoningOpen && previousOpen && justFinished) {
      emit('toggleReasoning');
    }
  },
);
</script>

<template>
  <article class="message-row" :class="`message-row--${message.role}`">
    <div class="message-avatar" aria-hidden="true">
      <UserRound v-if="message.role === 'user'" :size="18" />
      <Bot v-else :size="18" />
    </div>

    <div class="message-cell">
      <div class="message-bubble">
        <div class="message-bubble__meta">
          <span class="message-bubble__speaker">
            <span>{{ speakerLabel }}</span>
            <ReasoningToggle
              v-if="showReasoningToggle"
              :open="reasoningOpen"
              :label="reasoningLabel"
              title="查看思考内容"
              @click="emit('toggleReasoning')"
            />
          </span>
          <span class="message-bubble__status">
            <LoaderCircle v-if="message.status === 'streaming'" :size="13" class="spin-icon" />
            {{ statusText }} · {{ formatTime(message.createTime) }}
          </span>
        </div>


        <Transition name="reasoning-collapse">
          <p v-if="showReasoningToggle && reasoningOpen" class="reasoning-inline-body">
            {{ reasoningBody }}
          </p>
        </Transition>
        <RichMessageContent :content="message.content || '...'" />
      </div>

      <MessageActions
        :show-rollback="showRollback"
        :show-delete="showDelete"
        :sending="sending"
        @copy="emit('copy', message.content)"
        @rollback="emit('rollback')"
        @delete="emit('delete')"
      />
    </div>
  </article>
</template>
