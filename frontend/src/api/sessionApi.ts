import { requestJson, jsonHeaders } from '@/api/httpClient';
import { resolveApiUrl } from '@/config/runtimeConfig';
import { consumeSseStream } from '@/api/sseClient';
import { normalizeHistoryMessageIds } from '@/utils/chatMessages';
import type { ChatHistoryPage, ChatSession, SendChatOptions } from '@/types/chat';
import type { SessionFileReference } from '@/main';

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

export const sessionFileApi = {
  /** 授权一个本地文件，返回文件引用信息 */
  authorize(sessionId: string, absolutePath: string) {
    return requestJson<SessionFileReference>('/api/session-file/authorize', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ sessionId, absolutePath }),
    });
  },

  /** 列出会话下所有已授权文件 */
  listBySession(sessionId: string) {
    return requestJson<SessionFileReference[]>(`/api/session-file/list?sessionId=${encodeURIComponent(sessionId)}`);
  },

  /** 删除某个授权文件引用 */
  remove(fileReferenceId: string, sessionId: string) {
    return requestJson<void>(`/api/session-file/${encodeURIComponent(fileReferenceId)}?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  },
};
