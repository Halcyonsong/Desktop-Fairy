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

  return JSON.parse(data) as ChatEvent;
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
