import { requestJson, jsonHeaders } from '@/api/httpClient';
import { resolveApiUrl } from '@/config/runtimeConfig';
import { consumeSseStream } from '@/api/sseClient';
import { normalizeHistoryMessageIds } from '@/utils/chatMessages';
import type { ChatHistoryPage, ChatSession, SendChatOptions } from '@/types/chat';
import type { SessionFileReference, SessionFolderReference } from '@/types/electron';

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

  async sendChat({ sessionId, question, systemPrompt, model, onEvent, signal, enableToolCalling, attachmentFileReferenceIds, primaryAttachmentFileReferenceId }: SendChatOptions) {
    const endpoint = enableToolCalling ? '/api/ai/tool-chat/stream' : '/api/ai/chat/stream';

    // 普通聊天发送 ChatRequestDTO，工具聊天发送 ToolChatRequestDTO
    // systemPrompt 是 ChatRequestDTO 的顶层字段（不在 chat 内）
    const chatRequest = {
      chat: {
        sessionId,
        question,
      },
      systemPrompt: systemPrompt ?? '',
      model: model ?? undefined,
    };

    const body = enableToolCalling
      ? {
          request: chatRequest,
          attachmentFileReferenceIds: attachmentFileReferenceIds ?? [],
          primaryAttachmentFileReferenceId: primaryAttachmentFileReferenceId ?? null,
        }
      : chatRequest;

    const response = await fetch(resolveApiUrl(endpoint), {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    await consumeSseStream(response, onEvent);
  },

  async stopChat(sessionId: string) {
    const response = await fetch(resolveApiUrl(`/api/ai/chat/stop?sessionId=${encodeURIComponent(sessionId)}`), {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    // 检查业务状态码（后端返回 ApiResult 包装）
    try {
      const result = await response.json();
      if (result.code !== undefined && result.code !== 200 && result.code !== 0) {
        throw new Error(result.message || `停止失败，错误码: ${result.code}`);
      }
    } catch (e) {
      // 响应体非 JSON，忽略解析错误（HTTP 状态码已检查）
      if (e instanceof Error && !e.message.includes('停止失败')) {
        // JSON 解析失败，不是业务错误，忽略
      } else {
        throw e;
      }
    }
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

export const sessionFolderApi = {
  /** 授权一个本地文件夹，返回文件夹引用信息 */
  authorize(sessionId: string, absolutePath: string) {
    return requestJson<SessionFolderReference>('/api/session-folder/authorize', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ sessionId, absolutePath }),
    });
  },

  /** 列出会话下所有已授权文件夹 */
  listBySession(sessionId: string) {
    return requestJson<SessionFolderReference[]>(`/api/session-folder/list?sessionId=${encodeURIComponent(sessionId)}`);
  },

  /** 删除某个授权文件夹引用 */
  remove(folderReferenceId: string, sessionId: string) {
    return requestJson<void>(`/api/session-folder/${encodeURIComponent(folderReferenceId)}?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  },
};
