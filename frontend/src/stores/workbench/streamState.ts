import { CHAT_EVENT } from '@/config/chatConstants';
import { toEventText } from '@/utils/chatMessages';
import type { ChatEvent, ChatMessage } from '@/types/chat';

function ensureTiming(message: ChatMessage) {
  if (!message.timing) {
    message.timing = {};
  }
  return message.timing;
}

export function handleStreamEvent(
  event: ChatEvent,
  assistantMessage: ChatMessage,
  sessionId: string,
  setReasoningText: (sessionId: string, value: string) => void,
  setReasoningMessageId: (sessionId: string, messageId: string) => void,
  reasoningBySession: Record<string, string>,
) {
  const text = toEventText(event.eventData);

  if (event.eventType === CHAT_EVENT.reasoning) {
    const timing = ensureTiming(assistantMessage);
    timing.firstReasoningAt ??= Date.now();
    setReasoningText(sessionId, `${reasoningBySession[sessionId] ?? ''}${text}`);
    setReasoningMessageId(sessionId, assistantMessage.id);
    return;
  }

  if (event.eventType === CHAT_EVENT.data) {
    const timing = ensureTiming(assistantMessage);
    timing.firstOutputAt ??= Date.now();
    assistantMessage.content += text;
    assistantMessage.status = 'streaming';
    setReasoningMessageId(sessionId, assistantMessage.id);
    return;
  }

  if (event.eventType === CHAT_EVENT.stop) {
    const timing = ensureTiming(assistantMessage);
    timing.completedAt ??= Date.now();
    assistantMessage.status = 'completed';
    return;
  }

  if (event.eventType === CHAT_EVENT.interrupted) {
    const timing = ensureTiming(assistantMessage);
    timing.completedAt ??= Date.now();
    assistantMessage.status = 'interrupted';
    return;
  }

  if (event.eventType === CHAT_EVENT.error) {
    const timing = ensureTiming(assistantMessage);
    timing.completedAt ??= Date.now();
    assistantMessage.status = 'error';
    assistantMessage.content += text ? `\n${text}` : '';
  }
}
