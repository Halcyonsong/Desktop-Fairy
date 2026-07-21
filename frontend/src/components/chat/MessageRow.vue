<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Bot, ChevronDown, LoaderCircle, UserRound, Wrench } from '@lucide/vue';
import MessageActions from '@/components/chat/MessageActions.vue';
import RichMessageContent from '@/components/chat/RichMessageContent.vue';
import { uiText } from '@/config/uiText';
import { stripControlMarkers } from '@/utils/chatMessages';
import { formatTime } from '@/utils/date';
import type { ChatMessage, ChatMessageBlock } from '@/types/chat';

const props = defineProps<{
  message: ChatMessage;
  reasoningOpen: boolean;
  speakerLabel: string;
  statusText: string;
  showRollback: boolean;
  showDelete: boolean;
  sending: boolean;
}>();

const emit = defineEmits<{
  toggleReasoning: [];
  rollback: [];
  delete: [];
}>();

const displayContent = computed(() => stripControlMarkers(props.message.content));

// 使用 blocks 序列渲染，如果没有 blocks 则兜底为单 content
const blocks = computed<ChatMessageBlock[]>(() => {
  if (props.message.blocks?.length) {
    return props.message.blocks;
  }
  if (props.message.role === 'assistant' && props.message.status === 'streaming') {
    return [];
  }
  if (!displayContent.value) {
    return [];
  }
  return [{ id: `fallback-${props.message.id}`, type: 'content' as const, round: 1, text: displayContent.value }];
});

// 每个 reasoning 块独立控制展开/收起
const reasoningOpenState = reactive<Record<string, boolean>>({});

function toggleReasoningBlock(blockId: string) {
  reasoningOpenState[blockId] = !reasoningOpenState[blockId];
}

function isReasoningBlockOpen(blockId: string) {
  return reasoningOpenState[blockId] ?? false;
}

function stageLabel(stage: string): string {
  return (uiText.toolCall.stages as Record<string, string>)[stage] ?? stage;
}

// 判断某个 block 是否是最后一个且消息正在流式中
function isStreamingBlock(index: number) {
  return props.message.status === 'streaming' && index === blocks.value.length - 1;
}

// 判断是否需要显示轮次分隔线（当前 block 的 round 和下一个 block 的 round 不同）
function showRoundDivider(index: number) {
  if (index >= blocks.value.length - 1) {
    return false;
  }
  return blocks.value[index].round !== blocks.value[index + 1].round;
}
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
          </span>
          <span class="message-bubble__status">
            <LoaderCircle v-if="message.status === 'streaming'" :size="13" class="spin-icon" />
            {{ statusText }} · {{ formatTime(message.createTime) }}
          </span>
        </div>

        <template v-if="message.role === 'assistant' && blocks.length">
          <template v-for="(block, index) in blocks" :key="block.id">
            <!-- reasoning 块：每个独立控制展开 -->
            <div v-if="block.type === 'reasoning'" class="message-block message-block--reasoning">
              <button
                class="reasoning-toggle-button"
                type="button"
                :title="isReasoningBlockOpen(block.id) ? '收起思考内容' : '展开思考内容'"
                @click="toggleReasoningBlock(block.id)"
              >
                <ChevronDown :size="14" :class="{ 'rotate-180': isReasoningBlockOpen(block.id) }" />
                思考
                <span v-if="isStreamingBlock(index)" class="message-block__streaming-hint">
                  <LoaderCircle :size="11" class="spin-icon" />
                </span>
              </button>
              <Transition name="reasoning-collapse">
                <p v-if="isReasoningBlockOpen(block.id)" class="reasoning-inline-body">
                  {{ block.text }}
                </p>
              </Transition>
            </div>

            <!-- content 块 -->
            <div v-else-if="block.type === 'content'" class="message-block message-block--content">
              <RichMessageContent v-if="block.text.trim()" :content="block.text" />
              <div v-else-if="isStreamingBlock(index)" class="message-block__placeholder">
                ...
              </div>
            </div>

            <!-- tool 块 -->
            <div v-else-if="block.type === 'tool'" class="message-block message-block--tool">
              <div class="message-block__tool">
                <Wrench :size="12" />
                <span class="message-block__tool-stage">{{ stageLabel(block.toolStatus?.stage ?? '') }}</span>
                <span class="message-block__tool-message">{{ block.text }}</span>
              </div>
            </div>

            <!-- 轮次分隔线 -->
            <div v-if="showRoundDivider(index)" class="message-round__divider">
              <span>第 {{ block.round }} 轮结束，进入下一轮</span>
            </div>
          </template>
        </template>
        <RichMessageContent v-else :content="displayContent || '...'" />
      </div>

      <MessageActions
        :show-rollback="showRollback"
        :show-delete="showDelete"
        :sending="sending"
        :content="message.content"
        @rollback="emit('rollback')"
        @delete="emit('delete')"
      />
    </div>
  </article>
</template>
