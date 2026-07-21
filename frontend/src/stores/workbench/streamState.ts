import { CHAT_EVENT, TOOL_STAGE } from '@/config/chatConstants';
import {
  parseModelStreamErrorEvent,
  parseToolStatusEvent,
  stripControlMarkers,
  toEventText,
} from '@/utils/chatMessages';
import type { ChatEvent, ChatMessage, ChatMessageBlock } from '@/types/chat';

function ensureTiming(message: ChatMessage) {
  if (!message.timing) {
    message.timing = {};
  }
  return message.timing;
}

// 当前轮号：优先从消息上的 _currentRound 字段读取（由 ROUND_START 设置）
// 这样不再依赖 @Continue@ 检测来推进轮次，而是用后端 ROUND_START 的权威 round 号
function currentRound(message: ChatMessage) {
  const meta = message as ChatMessage & { _currentRound?: number };
  return meta._currentRound ?? 1;
}

function setCurrentRound(message: ChatMessage, round: number) {
  const meta = message as ChatMessage & { _currentRound?: number };
  meta._currentRound = round;
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
  reasoningBySession: Record<string, string>,
) {
  void reasoningBySession;
  const text = toEventText(event.eventData);

  if (event.eventType === CHAT_EVENT.reasoning) {
    const timing = ensureTiming(assistantMessage);
    timing.firstReasoningAt ??= Date.now();

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

    // ROUND_START 是权威轮次信号：用它来更新当前 round 号
    // 这样即使 @Continue@ 标记出现问题，轮次也能正确推进
    if (entry.stage === TOOL_STAGE.roundStart) {
      setCurrentRound(assistantMessage, entry.round);
    }

    appendBlock(assistantMessage, {
      type: 'tool',
      round: entry.round,
      text: entry.message,
      toolStatus: entry,
    });

    if (!assistantMessage.toolStatuses) {
      assistantMessage.toolStatuses = [];
    }
    assistantMessage.toolStatuses.push(entry);
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

    if (!assistantMessage.toolStatuses) {
      assistantMessage.toolStatuses = [];
    }
    assistantMessage.toolStatuses.push(entry);
    return;
  }

  if (event.eventType === CHAT_EVENT.data) {
    const timing = ensureTiming(assistantMessage);
    timing.firstOutputAt ??= Date.now();
    assistantMessage.content += text;
    assistantMessage.status = 'streaming';
    setReasoningMessageId(sessionId, assistantMessage.id);

    // 不再用 @Continue@ 检测来推进轮次
    // 轮次推进完全由 ROUND_START 事件驱动
    // 这里只做正文追加和标记裁剪
    const round = currentRound(assistantMessage);
    const existing = lastBlock(assistantMessage, 'content');
    if (existing) {
      const rawContent = existing.text + text;
      updateLastBlock(assistantMessage, 'content', stripControlMarkers(rawContent));
    } else {
      const stripped = stripControlMarkers(text);
      // 裁剪后为空（如 @Loop@ 头部标记）时不创建 content 块
      // 否则空 content 块会排在 ROUND_START tool 块和 reasoning 块之前，
      // 导致正文显示在轮次提示和思考按钮上方（顺序错乱）
      // 实际正文到达时会在正确位置创建 content 块
      if (stripped.trim()) {
        appendBlock(assistantMessage, { type: 'content', round, text: stripped });
      }
    }
    return;
  }

  if (event.eventType === CHAT_EVENT.stop) {
    const timing = ensureTiming(assistantMessage);
    timing.completedAt ??= Date.now();
    assistantMessage.status = 'completed';
    assistantMessage.blocks = (assistantMessage.blocks ?? []).filter(
      (b) => b.text.trim() !== '',
    );
    return;
  }

  if (event.eventType === CHAT_EVENT.interrupted) {
    const timing = ensureTiming(assistantMessage);
    timing.completedAt ??= Date.now();
    assistantMessage.status = 'interrupted';
    assistantMessage.blocks = (assistantMessage.blocks ?? []).filter(
      (b) => b.text.trim() !== '',
    );
    return;
  }

  if (event.eventType === CHAT_EVENT.error) {
    const timing = ensureTiming(assistantMessage);
    timing.completedAt ??= Date.now();
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
        const partialText = stripControlMarkers(errorEvent.partialContent);
        assistantMessage.content += partialText;

        const round = currentRound(assistantMessage);
        const existing = lastBlock(assistantMessage, 'content');
        if (existing) {
          updateLastBlock(assistantMessage, 'content', stripControlMarkers(existing.text + partialText));
        } else if (partialText.trim()) {
          appendBlock(assistantMessage, { type: 'content', round, text: partialText });
        }
      }
    } else {
      // 兜底：eventData 不是结构化对象，按旧逻辑处理纯文本
      const text = toEventText(event.eventData);
      assistantMessage.content += text ? `\n${text}` : '';

      const round = currentRound(assistantMessage);
      const existing = lastBlock(assistantMessage, 'content');
      if (existing) {
        updateLastBlock(assistantMessage, 'content', stripControlMarkers(existing.text + text));
      } else {
        appendBlock(assistantMessage, { type: 'content', round, text: stripControlMarkers(text) });
      }
    }
  }
}
