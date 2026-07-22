<script setup lang="ts">
import { computed, reactive } from 'vue';
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, ImageIcon, LoaderCircle, UserRound, Wrench } from '@lucide/vue';
import MessageActions from '@/components/chat/MessageActions.vue';
import RichMessageContent from '@/components/chat/RichMessageContent.vue';
import { TOOL_STAGE } from '@/config/chatConstants';
import { uiText } from '@/config/uiText';
import { formatTime } from '@/utils/date';
import type { ChatMessage, ChatMessageBlock, ErrorType, ToolStage } from '@/types/chat';

const props = defineProps<{
  message: ChatMessage;
  speakerLabel: string;
  statusText: string;
  showRollback: boolean;
  showDelete: boolean;
  sending: boolean;
}>();

const emit = defineEmits<{
  rollback: [];
  delete: [];
}>();

const displayContent = computed(() => props.message.content);

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

// 每个 tool 块独立控制展开/收起（仅 TOOL_CALL 有可展开的参数）
const toolOpenState = reactive<Record<string, boolean>>({});

function toggleToolBlock(blockId: string) {
  toolOpenState[blockId] = !toolOpenState[blockId];
}

function isToolBlockOpen(blockId: string) {
  return toolOpenState[blockId] ?? false;
}

function stageLabel(stage: ToolStage | undefined): string {
  if (!stage) {
    return '';
  }
  return uiText.toolCall.stages[stage] ?? stage;
}

// 异常终止 stage：表示工具循环因限制被强制结束
const TERMINATION_STAGES: Set<string> = new Set([
  TOOL_STAGE.roundLimit,
  TOOL_STAGE.toolLimit,
  TOOL_STAGE.timeLimit,
]);

function isTerminationStage(stage: string): boolean {
  return TERMINATION_STAGES.has(stage);
}

function isToolCallStage(stage: string): boolean {
  return stage === TOOL_STAGE.toolCall;
}

function isToolResultStage(stage: string): boolean {
  return stage === TOOL_STAGE.toolResult;
}

// 判断 tool 块是否处于流式过程中（消息还在 streaming 且是最后一个 tool 块）
function isToolActive(index: number): boolean {
  return props.message.status === 'streaming' && index === blocks.value.length - 1;
}

// 错误类型标签：从 uiText.errors.errorTypes 查找，找不到则原样返回
function errorTypeLabel(errorType: ErrorType): string {
  return uiText.errors.errorTypes[errorType] ?? errorType;
}

// 从后端的 message 字段中提取纯错误提示
// 后端在有部分输出时格式为：partialContent + "\n\n[系统提示] errorTip 以上内容可能不完整。"
// 前端已单独处理 partialContent，这里只需提取 [系统提示] 后面的 errorTip
function extractErrorTip(message: string): string {
  if (!message) return '';
  // 去掉 [系统提示] 前缀和 " 以上内容可能不完整。" 后缀
  const match = message.match(/\[系统提示\]\s*(.+?)(?:\s*以上内容可能不完整。?\s*)?$/);
  return match ? match[1] : message;
}

// 格式化工具参数 JSON（如果解析失败则原样返回）
function formatToolArguments(args: string | null | undefined): string {
  if (!args) {
    return '';
  }
  try {
    return JSON.stringify(JSON.parse(args), null, 2);
  } catch {
    return args;
  }
}

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
  <article class="message-row" :class="`message-row--${message.role}`" :aria-label="message.role === 'user' ? '用户消息' : '助手消息'">
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
                :aria-expanded="isReasoningBlockOpen(block.id)"
                :aria-controls="`reasoning-${block.id}`"
                @click="toggleReasoningBlock(block.id)"
              >
                <ChevronDown :size="14" :class="{ 'rotate-180': isReasoningBlockOpen(block.id) }" />
                思考
                <span v-if="isStreamingBlock(index)" class="message-block__streaming-hint">
                  <LoaderCircle :size="11" class="spin-icon" />
                </span>
              </button>
              <Transition name="reasoning-collapse">
                <p v-if="isReasoningBlockOpen(block.id)" :id="`reasoning-${block.id}`" class="reasoning-inline-body">
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
            <div v-else-if="block.type === 'tool'" class="message-block message-block--tool" :class="{ 'message-block--tool-termination': isTerminationStage(block.toolStatus?.stage ?? ''), 'message-block--tool-result': isToolResultStage(block.toolStatus?.stage ?? '') }">
              <!-- TOOL_CALL: 带工具名和 loading 的可展开面板 -->
              <div v-if="isToolCallStage(block.toolStatus?.stage ?? '')" class="tool-panel">
                <button
                  class="tool-panel__header"
                  type="button"
                  :title="isToolBlockOpen(block.id) ? '收起参数' : '展开参数'"
                  :aria-expanded="isToolBlockOpen(block.id)"
                  :aria-controls="`tool-${block.id}`"
                  @click="toggleToolBlock(block.id)"
                >
                  <Wrench :size="13" class="tool-panel__icon" />
                  <span class="tool-panel__title">{{ block.toolStatus?.toolName || '工具调用' }}</span>
                  <LoaderCircle v-if="isToolActive(index)" :size="12" class="tool-panel__spinner spin-icon" />
                  <ChevronDown :size="12" :class="{ 'rotate-180': isToolBlockOpen(block.id) }" class="tool-panel__chevron" />
                </button>
                <Transition name="tool-collapse">
                  <pre v-if="isToolBlockOpen(block.id) && block.toolStatus?.toolArguments" :id="`tool-${block.id}`" class="tool-panel__args">{{ formatToolArguments(block.toolStatus.toolArguments) }}</pre>
                </Transition>
              </div>

              <!-- 异常终止 stage：显示警告样式 -->
              <div v-else-if="isTerminationStage(block.toolStatus?.stage ?? '')" class="tool-termination">
                <AlertTriangle :size="13" />
                <span class="tool-termination__stage">{{ stageLabel(block.toolStatus?.stage) }}</span>
                <span class="tool-termination__message">{{ block.text }}</span>
              </div>

              <!-- TOOL_RESULT：显示结果状态 -->
              <div v-else-if="isToolResultStage(block.toolStatus?.stage ?? '')" class="tool-result">
                <CheckCircle2 :size="13" class="tool-result__icon" />
                <span class="tool-result__label">{{ stageLabel(block.toolStatus?.stage) }}</span>
                <span v-if="block.toolStatus?.toolName" class="tool-result__name">{{ block.toolStatus.toolName }}</span>
              </div>

              <!-- 其他 stage：普通单行展示 -->
              <div v-else class="message-block__tool">
                <Wrench :size="12" />
                <span class="message-block__tool-stage">{{ stageLabel(block.toolStatus?.stage) }}</span>
                <span class="message-block__tool-message">{{ block.text }}</span>
              </div>
            </div>

            <!-- media-status 块：图片处理状态提示（inline，在出现位置展示） -->
            <div v-else-if="block.type === 'media-status'" class="message-block message-block--media-status" :class="{ 'message-block--media-status-completed': block.mediaStatus === 'completed' }">
              <div v-if="block.mediaStatus === 'waiting'" class="media-status-item media-status-item--waiting">
                <ImageIcon :size="14" class="media-status-item__icon" />
                <span class="media-status-item__text">{{ block.text }}</span>
              </div>
              <div v-else class="media-status-item media-status-item--completed">
                <CheckCircle2 :size="14" class="media-status-item__icon" />
                <span class="media-status-item__text">图片已加载</span>
              </div>
            </div>

            <!-- 轮次分隔线：当当前块与下一块的 round 不同时显示 -->
            <div v-if="showRoundDivider(index)" class="message-round__divider" role="separator">
              <span class="message-round__divider-label">
                {{ uiText.toolCall.entry.replace('{round}', String(block.round)) }} · 进入第 {{ blocks[index + 1]?.round }} 轮
              </span>
            </div>
          </template>
        </template>
        <RichMessageContent v-else :content="displayContent || '...'" />

        <!-- 错误信息提示条 -->
        <div v-if="message.errorInfo" class="message-error-banner" :class="{ 'message-error-banner--retryable': message.errorInfo.retryable }">
          <AlertTriangle :size="14" />
          <span class="message-error-banner__type">{{ errorTypeLabel(message.errorInfo.errorType) }}</span>
          <span class="message-error-banner__message">{{ extractErrorTip(message.errorInfo.message) }}</span>
          <span v-if="message.errorInfo.partialOutput" class="message-error-banner__hint">{{ uiText.errors.partialOutputHint }}</span>
        </div>
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
