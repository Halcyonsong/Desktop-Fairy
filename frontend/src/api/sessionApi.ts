import { requestJson, jsonHeaders } from '@/api/httpClient';
import { resolveApiUrl } from '@/config/runtimeConfig';
import { consumeSseStream } from '@/api/sseClient';
import { normalizeHistoryMessageIds } from '@/utils/chatMessages';
import type { ChatHistoryPage, ChatSession, SendChatOptions } from '@/types/chat';

function normalizeHistoryPage(page: ChatHistoryPage): ChatHistoryPage {
  return {
    ...page,
    records: normalizeHistoryMessageIds(page.records),
  };
}

export const sessionApi = {
  createSession() {
    return requestJson<ChatSession>('/api/ai/session/create', {
      method: 'POST',
    });
  },

  listSessions() {
    return requestJson<ChatSession[]>('/api/ai/session/list');
  },

  getSession(sessionId: string) {
    return requestJson<ChatSession>(`/api/ai/session/get?sessionId=${encodeURIComponent(sessionId)}`);
  },

  renameSession(sessionId: string, title: string) {
    return requestJson<ChatSession>('/api/ai/session/rename', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ sessionId, title }),
    });
  },

  deleteSession(sessionId: string) {
    return requestJson<boolean>(`/api/ai/session/delete?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  },

  async listHistory(sessionId: string, beforeIndex?: number | null) {
    const search = new URLSearchParams({ sessionId });
    if (beforeIndex !== undefined && beforeIndex !== null) {
      search.set('beforeIndex', String(beforeIndex));
    }

    const page = await requestJson<ChatHistoryPage>(`/api/ai/session/history?${search.toString()}`);
    return normalizeHistoryPage(page);
  },

  async rollback(sessionId: string) {
    const page = await requestJson<ChatHistoryPage>(`/api/ai/session/rollback?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
    });
    return normalizeHistoryPage(page);
  },

  async sendChat({ sessionId, question, systemPrompt, model, onEvent, signal, enableToolCalling }: SendChatOptions) {
    const endpoint = enableToolCalling ? '/api/ai/tool-chat/stream' : '/api/ai/chat/stream';
    const response = await fetch(resolveApiUrl(endpoint), {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        chat: {
          sessionId,
          question,
          systemPrompt: systemPrompt ?? '',
        },
        model: model ?? null,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    await consumeSseStream(response, onEvent);
  },

  stopChat(sessionId: string) {
    return fetch(resolveApiUrl(`/api/ai/chat/stop?sessionId=${encodeURIComponent(sessionId)}`), {
      method: 'POST',
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    });
  },
};
