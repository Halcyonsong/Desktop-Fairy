import type {
  ChatMessage,
  ChatMessageBlock,
  ModelStreamErrorEvent,
  ToolStatusEvent,
  ToolStage,
  ErrorType,
} from '@/types/chat';
import { TOOL_STAGE, ERROR_TYPE } from '@/config/chatConstants';

const KNOWN_TOOL_STAGES: Set<string> = new Set(Object.values(TOOL_STAGE));
const KNOWN_ERROR_TYPES: Set<string> = new Set(Object.values(ERROR_TYPE));

// 将 toolStatuses 转换为 blocks（区分 media-status 和 tool）
function toolStatusToBlock(message: ChatMessage, entry: ToolStatusEvent, index: number): ChatMessageBlock {
  if (entry.stage === TOOL_STAGE.mediaRequestStart) {
    return {
      id: `block-${message.id}-media-${entry.round}-${index}`,
      type: 'media-status',
      round: entry.round,
      text: entry.message,
      mediaStatus: 'completed', // 历史消息中的 media-status 一定是已完成的
    };
  }
  return {
    id: `block-${message.id}-tool-${entry.round}-${index}`,
    type: 'tool',
    round: entry.round,
    text: entry.message,
    toolStatus: entry,
  };
}

export function buildLocalMessage(
  role: ChatMessage['role'],
  content: string,
  status: ChatMessage['status'],
): ChatMessage {
  return {
    id: `local-${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    status,
    createTime: new Date().toISOString(),
  };
}

export function findLastUserMessage(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'user' && message.content.trim()) {
      return message;
    }
  }
  return undefined;
}

export function findLastAssistantMessage(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'assistant') {
      return message;
    }
  }
  return undefined;
}

export function toEventText(eventData: unknown) {
  return typeof eventData === 'string' ? eventData : JSON.stringify(eventData ?? '');
}

export function parseToolStatusEvent(eventData: unknown): ToolStatusEvent | null {
  if (
    typeof eventData !== 'object'
    || eventData === null
    || typeof (eventData as { round?: unknown }).round !== 'number'
    || typeof (eventData as { stage?: unknown }).stage !== 'string'
    || typeof (eventData as { message?: unknown }).message !== 'string'
  ) {
    return null;
  }

  const value = eventData as {
    round: number;
    stage: string;
    message: string;
    toolCallId?: unknown;
    toolName?: unknown;
    toolArguments?: unknown;
  };
  const stage = KNOWN_TOOL_STAGES.has(value.stage) ? value.stage : (console.warn(`[chatMessages] Unknown tool stage: ${value.stage}`), TOOL_STAGE.toolCall);
  return {
    round: value.round,
    stage: stage as ToolStage,
    message: value.message,
    toolCallId: typeof value.toolCallId === 'string' ? value.toolCallId : null,
    toolName: typeof value.toolName === 'string' ? value.toolName : null,
    toolArguments: typeof value.toolArguments === 'string' ? value.toolArguments : null,
  };
}

export function parseModelStreamErrorEvent(eventData: unknown): ModelStreamErrorEvent | null {
  if (
    typeof eventData !== 'object'
    || eventData === null
    || typeof (eventData as { errorType?: unknown }).errorType !== 'string'
    || typeof (eventData as { message?: unknown }).message !== 'string'
  ) {
    return null;
  }

  const value = eventData as {
    errorType: string;
    message: string;
    retryable?: unknown;
    partialOutput?: unknown;
    partialContent?: unknown;
  };
  return {
    errorType: (KNOWN_ERROR_TYPES.has(value.errorType) ? value.errorType : ERROR_TYPE.unknown) as ErrorType,
    message: value.message,
    retryable: value.retryable === true,
    partialOutput: value.partialOutput === true,
    partialContent: typeof value.partialContent === 'string' ? value.partialContent : '',
  };
}

/**
 * 从历史消息重建 blocks。
 *
 * 后端已切换为工具决策（markContinue/markFinish），正文不再包含 @Continue@/@Finish@/@Missing@ 标记，
 * 因此不需要标记裁剪或按标记切分轮次。整个 content 作为一个 content block，
 * toolStatuses 按 round 追加为 tool/media-status 块。
 */
export function rebuildMessageBlocks(message: ChatMessage): ChatMessageBlock[] {
  const text = message.content || '';
  const blocks: ChatMessageBlock[] = [];

  if (text.trim()) {
    blocks.push({
      id: `block-${message.id}-0`,
      type: 'content',
      round: 1,
      text,
    });
  }

  // 追加 toolStatuses 作为 tool/media-status 块
  if (message.toolStatuses?.length) {
    for (const entry of message.toolStatuses) {
      blocks.push(toolStatusToBlock(message, entry, blocks.length));
    }
  }

  message.blocks = blocks;
  return blocks;
}

export function normalizeHistoryMessageIds(messages: ChatMessage[]) {
  return messages.map((message, index) => {
    const normalized = {
      ...message,
      id: `${message.createTime}-${message.role}-${index}`,
    };

    if (normalized.role === 'assistant') {
      rebuildMessageBlocks(normalized);
    }

    return normalized;
  });
}
