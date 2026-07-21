import type {
  ChatDirectiveMarker,
  ChatMessage,
  ChatMessageBlock,
  ModelStreamErrorEvent,
  ToolStatusEvent,
} from '@/types/chat';

const MARKER_REGEX = /(?:\n|^)[ \t]*(@Continue@|@Finish@|@Missing@)[ \t]*$/;

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
  return {
    round: value.round,
    stage: value.stage,
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
    errorType: value.errorType,
    message: value.message,
    retryable: value.retryable === true,
    partialOutput: value.partialOutput === true,
    partialContent: typeof value.partialContent === 'string' ? value.partialContent : '',
  };
}

export function extractDirectiveMarker(text: string): ChatDirectiveMarker | undefined {
  if (!text) {
    return undefined;
  }
  const match = text.match(MARKER_REGEX);
  return match?.[1] as ChatDirectiveMarker | undefined;
}

export function stripControlMarkers(text: string): string {
  if (!text) {
    return text;
  }

  // 新格式为前后包裹的闭合标记 @Loop@ @Continue@ @Finish@ @Missing@
  // 闭合标记可以安全地全局移除，不会误伤正文中单独出现的 @
  // 转义标记 /@XXX@ 视为普通文本，只去掉转义符 / 保留 @XXX@
  // 注意：不做 trimEnd / 换行压缩，否则会吃掉流式输出末尾的换行符，
  // 导致下次追加文本时行粘连，表格/代码块/数学公式结构被破坏。
  return text
    // 1. 移除未转义的闭合标记（前面不是 / 的）
    .replace(/(?<!\/)@(?:Loop|Continue|Finish|Missing)@/g, '')
    // 2. 将转义标记的 / 去掉，保留 @XXX@ 作为普通文本输出
    .replace(/\/@(Loop|Continue|Finish|Missing)@/g, '@$1@');
}

export function rebuildMessageBlocks(message: ChatMessage): ChatMessageBlock[] {
  const text = message.content || '';
  if (!text) {
    message.blocks = [];
    return message.blocks;
  }

  // 去掉 @Loop@ 头（仅未转义的）
  let body = text.replace(/^\s*@Loop@\s*/, '');
  // 去掉末尾 @Finish@（仅未转义的）
  body = body.replace(/(?<!\/)@Finish@\s*$/, '');

  // 检测是否存在未转义的 @Continue@ / @Missing@ 标记
  const hasMarkers = /(?<!\/)@(?:Continue|Missing)@/.test(body);

  if (!hasMarkers) {
    // 单轮消息，整体作为一个 content block
    const displayContent = stripControlMarkers(body);
    if (!displayContent.trim()) {
      message.blocks = [];
      return message.blocks;
    }
    const block: ChatMessageBlock = {
      id: `block-${message.id}-0`,
      type: 'content',
      round: 1,
      text: displayContent,
    };
    message.blocks = [block];
    // 绑定 toolStatuses
    if (message.toolStatuses?.length) {
      for (const entry of message.toolStatuses) {
        message.blocks.push({
          id: `block-${message.id}-tool-${entry.round}-${message.blocks.length}`,
          type: 'tool',
          round: entry.round,
          text: entry.message,
          toolStatus: entry,
        });
      }
    }
    return message.blocks;
  }

  // 多轮消息：按未转义的 @Continue@ / @Missing@ 切分
  // 转义标记 /@Continue@ 不参与切分，保留为普通文本
  const parts = body.split(/(?<!\/)@(?:Continue|Missing)@/);
  const blocks: ChatMessageBlock[] = [];
  let round = 1;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      round++;
      continue;
    }
    blocks.push({
      id: `block-${message.id}-${blocks.length}`,
      type: 'content',
      round,
      text: stripControlMarkers(trimmed),
    });
    round++;
  }

  // 插入 toolStatuses 到对应轮次（按 round 匹配，放在该轮 content 之后）
  if (message.toolStatuses?.length) {
    for (const entry of message.toolStatuses) {
      const insertIndex = blocks.findIndex(
        (b, i) => b.round === entry.round && i === blocks.length - 1,
      );
      // 简化：直接追加到末尾，按 round 标注
      blocks.push({
        id: `block-${message.id}-tool-${entry.round}-${blocks.length}`,
        type: 'tool',
        round: entry.round,
        text: entry.message,
        toolStatus: entry,
      });
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
