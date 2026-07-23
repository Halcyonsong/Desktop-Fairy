import { CHAT_EVENT, TOOL_STAGE } from '@/config/chatConstants';
import {
  parseModelStreamErrorEvent,
  parsePermissionRequestEvent,
  parseToolStatusEvent,
  toEventText,
} from '@/utils/chatMessages';
import type { ChatEvent, ChatMessage, ChatMessageBlock, PermissionRequestEvent } from '@/types/chat';

function ensureTiming(message: ChatMessage) {
  if (!message.timing) {
    message.timing = {};
  }
  return message.timing;
}

// 当前轮号：优先从消息上的 _currentRound 字段读取（由 ROUND_START 设置）
// 轮次推进完全由后端的 ROUND_START 事件驱动，不再依赖正文标记
function currentRound(message: ChatMessage) {
  const meta = message as ChatMessage & { _currentRound?: number };
  return meta._currentRound ?? 1;
}

function setCurrentRound(message: ChatMessage, round: number) {
  const meta = message as ChatMessage & { _currentRound?: number };
  meta._currentRound = round;
}

// 将所有 waiting 状态的 media-status block 标记为 completed
function markMediaStatusCompleted(message: ChatMessage) {
  const blocks = message.blocks ?? [];
  let changed = false;
  for (const b of blocks) {
    if (b.type === 'media-status' && b.mediaStatus === 'waiting') {
      b.mediaStatus = 'completed';
      changed = true;
    }
  }
  if (changed) {
    message.blocks = [...blocks];
  }
}

function appendBlock(message: ChatMessage, block: Omit<ChatMessageBlock, 'id'>) {
  const id = `block-${message.id}-${(message.blocks?.length ?? 0)}-${Date.now()}`;
  message.blocks = [...(message.blocks ?? []), { ...block, id }];
}

function lastBlock(message: ChatMessage, type: ChatMessageBlock['type']) {
  const blocks = message.blocks ?? [];
  const round = currentRound(message);
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].type === type && blocks[i].round === round) {
      return blocks[i];
    }
  }
  return undefined;
}

function updateLastBlock(message: ChatMessage, type: ChatMessageBlock['type'], text: string) {
  const blocks = message.blocks ?? [];
  const round = currentRound(message);
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].type === type && blocks[i].round === round) {
      blocks[i] = { ...blocks[i], text };
      message.blocks = [...blocks];
      return;
    }
  }
  appendBlock(message, { type, round, text });
}

export function handleStreamEvent(
  event: ChatEvent,
  assistantMessage: ChatMessage,
  sessionId: string,
  setReasoningText: (sessionId: string, value: string) => void,
  setReasoningMessageId: (sessionId: string, messageId: string) => void,
  onPermissionRequest?: (sessionId: string, request: PermissionRequestEvent) => void,
) {
  const text = toEventText(event.eventData);

  // 1008 PERMISSION_REQUEST：模型请求用户授权文件/文件夹访问
  // 后端发出此事件后会中断工具循环，等待前端处理
  if (event.eventType === CHAT_EVENT.permissionRequest) {
    const req = parsePermissionRequestEvent(event.eventData);
    if (req && onPermissionRequest) {
      onPermissionRequest(sessionId, req);
    }
    return;
  }

  if (event.eventType === CHAT_EVENT.reasoning) {
    const timing = ensureTiming(assistantMessage);
    timing.firstReasoningAt ??= Date.now();

    // 模型开始输出思考，标记之前的 media-status block 为 completed
    markMediaStatusCompleted(assistantMessage);

    const round = currentRound(assistantMessage);
    const existing = lastBlock(assistantMessage, 'reasoning');
    if (existing) {
      updateLastBlock(assistantMessage, 'reasoning', existing.text + text);
    } else {
      appendBlock(assistantMessage, { type: 'reasoning', round, text });
    }
    setReasoningText(sessionId, (existing?.text ?? '') + text);
    setReasoningMessageId(sessionId, assistantMessage.id);
    return;
  }

  if (event.eventType === CHAT_EVENT.toolStatus) {
    const entry = parseToolStatusEvent(event.eventData);
    if (!entry) {
      return;
    }

    // 记录到 toolStatuses（所有 stage 都记录，用于历史重建）
    if (!assistantMessage.toolStatuses) {
      assistantMessage.toolStatuses = [];
    }
    assistantMessage.toolStatuses.push(entry);

    // 始终从 TOOL_STATUS 事件的 round 字段更新当前轮号
    // 这样后续的 REASONING/DATA 事件会正确归属到新轮次的 block
    const previousRound = currentRound(assistantMessage);
    const roundChanged = entry.round !== previousRound && entry.round > 0;
    if (roundChanged) {
      setCurrentRound(assistantMessage, entry.round);
    }

    // ROUND_START / ROUND_CONTINUE / LOOP_START：仅更新轮号，不创建 tool block
    // 轮次分隔由 MessageRow.vue 的 showRoundDivider 自动渲染
    if (
      entry.stage === TOOL_STAGE.roundStart
      || entry.stage === TOOL_STAGE.roundContinue
      || entry.stage === TOOL_STAGE.loopStart
    ) {
      return;
    }

    // MEDIA_REQUEST_START 插入为 inline block，在出现位置展示
    // 当后续 REASONING/DATA 到达时标记为 completed
    if (entry.stage === TOOL_STAGE.mediaRequestStart) {
      // 复用已封装的函数，确保响应式行为一致
      markMediaStatusCompleted(assistantMessage);
      // 插入新的 media-status block
      appendBlock(assistantMessage, {
        type: 'media-status',
        round: entry.round,
        text: entry.message,
        mediaStatus: 'waiting',
      });
      return;
    }

    // 其他 stage（TOOL_CALL / ROUND_FINISH / ROUND_LIMIT / TOOL_LIMIT / TIME_LIMIT / TOOL_RESULT）
    // 创建 tool block 展示
    appendBlock(assistantMessage, {
      type: 'tool',
      round: entry.round,
      text: entry.message,
      toolStatus: entry,
    });
    return;
  }

  if (event.eventType === CHAT_EVENT.toolResult) {
    const entry = parseToolStatusEvent(event.eventData);
    if (!entry) {
      return;
    }
    appendBlock(assistantMessage, {
      type: 'tool',
      round: entry.round,
      text: entry.message,
      toolStatus: entry,
    });
    return;
  }

  if (event.eventType === CHAT_EVENT.data) {
    const timing = ensureTiming(assistantMessage);
    timing.firstOutputAt ??= Date.now();

    // 模型开始输出正文，标记之前的 media-status block 为 completed
    markMediaStatusCompleted(assistantMessage);

    assistantMessage.content += text;
    assistantMessage.status = 'streaming';
    setReasoningMessageId(sessionId, assistantMessage.id);

    // 正文直接追加，不做标记裁剪（后端已切换为工具决策，不再输出控制标记）
    // 轮次推进完全由 ROUND_START 事件驱动
    const round = currentRound(assistantMessage);
    const existing = lastBlock(assistantMessage, 'content');
    if (existing) {
      updateLastBlock(assistantMessage, 'content', existing.text + text);
    } else {
      // 正文为空时不创建 content 块
      if (text.trim()) {
        appendBlock(assistantMessage, { type: 'content', round, text });
      }
    }
    return;
  }

  if (event.eventType === CHAT_EVENT.stop) {
    const timing = ensureTiming(assistantMessage);
    timing.completedAt ??= Date.now();
    // 停止时标记所有未完成的 media-status 为已完成
    markMediaStatusCompleted(assistantMessage);
    assistantMessage.status = 'completed';
    // 只清理空的 content/reasoning 块，保留 tool 和 media-status 块
    assistantMessage.blocks = (assistantMessage.blocks ?? []).filter(
      (b) => b.type === 'tool' || b.type === 'media-status' || b.text.trim() !== '',
    );
    return;
  }

  if (event.eventType === CHAT_EVENT.interrupted) {
    const timing = ensureTiming(assistantMessage);
    timing.completedAt ??= Date.now();
    // 中断时标记所有未完成的 media-status 为已完成
    markMediaStatusCompleted(assistantMessage);
    assistantMessage.status = 'interrupted';
    // 只清理空的 content/reasoning 块，保留 tool 和 media-status 块
    assistantMessage.blocks = (assistantMessage.blocks ?? []).filter(
      (b) => b.type === 'tool' || b.type === 'media-status' || b.text.trim() !== '',
    );
    return;
  }

  if (event.eventType === CHAT_EVENT.error) {
    const timing = ensureTiming(assistantMessage);
    timing.completedAt ??= Date.now();
    // 错误时标记所有未完成的 media-status 为已完成
    markMediaStatusCompleted(assistantMessage);
    assistantMessage.status = 'error';

    // 解析 1005 错误事件的结构化数据
    const errorEvent = parseModelStreamErrorEvent(event.eventData);

    if (errorEvent) {
      // 在消息上记录错误详情，供 UI 展示
      assistantMessage.errorInfo = {
        errorType: errorEvent.errorType,
        message: errorEvent.message,
        retryable: errorEvent.retryable,
        partialOutput: errorEvent.partialOutput,
      };

      // 如果有部分输出内容，把 partialContent 作为正文展示
      if (errorEvent.partialOutput && errorEvent.partialContent) {
        assistantMessage.content += errorEvent.partialContent;

        const round = currentRound(assistantMessage);
        const existing = lastBlock(assistantMessage, 'content');
        if (existing) {
          updateLastBlock(assistantMessage, 'content', existing.text + errorEvent.partialContent);
        } else if (errorEvent.partialContent.trim()) {
          appendBlock(assistantMessage, { type: 'content', round, text: errorEvent.partialContent });
        }
      }
    } else {
      // 兜底：eventData 不是结构化对象，按旧逻辑处理纯文本
      const fallbackText = toEventText(event.eventData);
      if (fallbackText.trim()) {
        assistantMessage.content += `\n${fallbackText}`;

        const round = currentRound(assistantMessage);
        const existing = lastBlock(assistantMessage, 'content');
        if (existing) {
          updateLastBlock(assistantMessage, 'content', existing.text + `\n${fallbackText}`);
        } else {
          appendBlock(assistantMessage, { type: 'content', round, text: fallbackText });
        }
      }
    }
  }
}
