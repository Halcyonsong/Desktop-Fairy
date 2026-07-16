import type { ChatMessage } from '@/types/chat';

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

export function normalizeHistoryMessageIds(messages: ChatMessage[]) {
  return messages.map((message, index) => ({
    ...message,
    id: `${message.createTime}-${message.role}-${index}`,
  }));
}
