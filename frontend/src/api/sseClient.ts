import type { ChatEvent } from '@/types/chat';
import { uiText } from '@/config/uiText';

function parseSseEvent(rawEvent: string): ChatEvent | null {
  const dataLines = rawEvent
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith('data:'));

  if (dataLines.length === 0) {
    return null;
  }

  const data = dataLines.map((line) => line.slice(5).trimStart()).join('\n');
  if (!data || data === '[DONE]') {
    return null;
  }

  // JSON.parse 单独包 try/catch：
  // 后端只要推送一条非 JSON 格式的 data: 行（如截断的 chunk、错误提示文本），
  // 抛错会终止整个 consumeSseStream 的 while 循环，导致流式响应中断。
  // 这里容错返回 null，跳过畸形事件，保持后续正常事件能继续消费。
  try {
    return JSON.parse(data) as ChatEvent;
  } catch (error) {
    console.warn('[sseClient] Failed to parse SSE event:', data, error);
    return null;
  }
}

export async function consumeSseStream(response: Response, onEvent: (event: ChatEvent) => void) {
  if (!response.body) {
    throw new Error(uiText.errors.streamUnsupported);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const event = parseSseEvent(chunk);
      if (event) {
        onEvent(event);
      }
    }

    if (done) {
      const tailEvent = parseSseEvent(buffer);
      if (tailEvent) {
        onEvent(tailEvent);
      }
      break;
    }
  }
}
