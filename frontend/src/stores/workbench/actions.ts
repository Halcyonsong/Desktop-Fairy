import { chatApi } from '@/api';
import { uiText } from '@/config/uiText';
import { useChatPreferencesStore } from '@/stores/chatPreferencesStore';
import { useModelSourceStore } from '@/stores/modelSourceStore';
import { useSessionFileStore } from '@/stores/sessionFileStore';
import {
  applyHistoryPage,
  cacheNoMoreHistory,
  loadMoreHistory as loadMoreHistoryAction,
  refreshActiveHistory as refreshActiveHistoryAction,
} from '@/stores/workbench/historyState';
import { handleStreamEvent } from '@/stores/workbench/streamState';
import type { HistoryStateRefs, ReasoningController, SessionStateRefs } from '@/stores/workbench/types';
import { buildLocalMessage, findLastUserMessage } from '@/utils/chatMessages';
import type { Ref } from 'vue';

export interface WorkbenchStateRefs extends HistoryStateRefs, SessionStateRefs {
  loading: Ref<boolean>;
  sending: Ref<boolean>;
  streamController: Ref<AbortController | null>;
}

export async function bootstrapWorkbench(
  state: WorkbenchStateRefs,
  refreshSessions: () => Promise<void>,
  loadSession: (sessionId: string) => Promise<void>,
) {
  state.loading.value = true;
  state.errorMessage.value = '';
  try {
    await refreshSessions();
    if (state.sessions.value.length === 0) {
      const session = await chatApi.createSession();
      state.sessions.value = [session];
    }

    const firstSessionId = state.sessions.value[0]?.sessionId ?? '';
    if (firstSessionId) {
      await loadSession(firstSessionId);
    }
  } catch (error) {
    state.errorMessage.value = error instanceof Error ? error.message : uiText.errors.initFailed;
  } finally {
    state.loading.value = false;
  }
}

export async function loadWorkbenchSession(
  state: WorkbenchStateRefs,
  reasoning: ReasoningController,
  sessionId: string,
) {
  state.activeSessionId.value = sessionId;
  state.errorMessage.value = '';
  state.historyPullMessage.value = uiText.chat.pullMore;

  try {
    const historyPage = await chatApi.listHistory(sessionId);
    // 会话可能已切换，校验避免历史数据错乱
    if (state.activeSessionId.value !== sessionId) return;
    applyHistoryPage(
      state,
      reasoning,
      reasoning.setReasoningMessageId,
      sessionId,
      historyPage.records,
      historyPage.nextCursor,
      historyPage.hasMore,
      historyPage.total,
    );

    if (!historyPage.hasMore) {
      state.noMoreHistoryUntil.value = cacheNoMoreHistory(state.noMoreHistoryUntil.value, sessionId);
    }
  } catch (error) {
    state.errorMessage.value = error instanceof Error ? error.message : uiText.errors.requestFailed;
  }
}

export async function refreshWorkbenchHistory(
  state: WorkbenchStateRefs,
  refreshSessions: () => Promise<void>,
  reasoning: ReasoningController,
) {
  if (state.sending.value) {
    return;
  }

  await refreshActiveHistoryAction(state, refreshSessions, (sessionId, records, next, hasMore, total) => {
    applyHistoryPage(state, reasoning, reasoning.setReasoningMessageId, sessionId, records, next, hasMore, total);
  });
}

export async function loadWorkbenchMoreHistory(state: WorkbenchStateRefs) {
  await loadMoreHistoryAction(state, (records, next, hasMore, total) => {
    state.messages.value = [...records, ...state.messages.value];
    state.nextCursor.value = next;
    state.hasMoreHistory.value = hasMore;
    state.historyTotal.value = total;
  });
}

export async function createWorkbenchSession(
  state: WorkbenchStateRefs,
  loadSession: (sessionId: string) => Promise<void>,
) {
  try {
    const session = await chatApi.createSession();
    state.sessions.value = [session, ...state.sessions.value.filter((item) => item.sessionId !== session.sessionId)];
    state.composerDraft.value = '';
    await loadSession(session.sessionId);
  } catch (error) {
    state.errorMessage.value = error instanceof Error ? error.message : uiText.errors.requestFailed;
  }
}

export async function renameWorkbenchSession(state: WorkbenchStateRefs, sessionId: string, title: string) {
  if (!sessionId || !title.trim()) {
    return;
  }

  try {
    const session = await chatApi.renameSession(sessionId, title.trim());
    state.sessions.value = state.sessions.value.map((item) => (item.sessionId === session.sessionId ? session : item));
  } catch (error) {
    state.errorMessage.value = error instanceof Error ? error.message : uiText.errors.requestFailed;
  }
}

export async function deleteWorkbenchSession(
  state: WorkbenchStateRefs,
  reasoning: ReasoningController,
  loadSession: (sessionId: string) => Promise<void>,
  sessionId: string,
) {
  if (!sessionId) {
    return;
  }

  try {
    await chatApi.deleteSession(sessionId);
    state.sessions.value = state.sessions.value.filter((session) => session.sessionId !== sessionId);
    reasoning.clearReasoning(sessionId);
    const { [sessionId]: ignored, ...nextNoMoreHistory } = state.noMoreHistoryUntil.value;
    state.noMoreHistoryUntil.value = nextNoMoreHistory;

    if (state.activeSessionId.value !== sessionId) {
      return;
    }

    state.messages.value = [];
    state.activeSessionId.value = '';
    state.composerDraft.value = '';

    if (state.sessions.value[0]) {
      await loadSession(state.sessions.value[0].sessionId);
    }
  } catch (error) {
    state.errorMessage.value = error instanceof Error ? error.message : uiText.errors.requestFailed;
  }
}

export async function sendWorkbenchMessage(
  state: WorkbenchStateRefs,
  reasoning: ReasoningController,
  refreshSessions: () => Promise<void>,
  question?: string,
  options?: { systemPromptOverride?: string },
) {
  const source = question ?? state.composerDraft.value;
  const trimmedQuestion = source.trim();
  if (!trimmedQuestion || state.sending.value) {
    return;
  }

  const modelSourceStore = useModelSourceStore();
  const chatPreferencesStore = useChatPreferencesStore();
  const sessionFileStore = useSessionFileStore();
  if (!modelSourceStore.selectedChatModelConfig) {
    state.errorMessage.value = uiText.errors.modelRequired;
    return;
  }

  if (!state.activeSessionId.value) {
    await createWorkbenchSession(state, (sessionId) => loadWorkbenchSession(state, reasoning, sessionId));
  }

  const sessionId = state.activeSessionId.value;
  const userMessage = buildLocalMessage('user', trimmedQuestion, 'completed');
  const assistantMessage = buildLocalMessage('assistant', '', 'streaming');
  assistantMessage.timing = {
    requestStartedAt: Date.now(),
  };
  const abortController = new AbortController();

  state.messages.value = [...state.messages.value, userMessage, assistantMessage];
  state.historyTotal.value = Math.max(state.historyTotal.value + 2, state.messages.value.length);
  reasoning.setReasoningText(sessionId, '');
  reasoning.setReasoningMessageId(sessionId, assistantMessage.id);
  state.streamController.value = abortController;
  state.sending.value = true;
  state.errorMessage.value = '';
  state.composerDraft.value = '';

  // 流式过程中 handleStreamEvent 直接 mutate assistantMessage（普通对象），
  // 每次事件后用新对象替换数组中的消息，强制 Vue 检测到 prop 变更并重渲染 MessageRow。
  // 不依赖深层响应式，因为 Pinia + computed + props 链路下深层 mutate 不可靠。
  function commitMessageChange() {
    const index = state.messages.value.findIndex((m) => m.id === assistantMessage.id);
    if (index >= 0) {
      state.messages.value[index] = { ...assistantMessage };
    }
  }

  try {
    await chatApi.sendChat({
      sessionId,
      question: trimmedQuestion,
      // 优先使用调用方传入的 override（精灵窗口传空禁用），否则读 chatPreferencesStore
      systemPrompt: options?.systemPromptOverride ?? chatPreferencesStore.activeSystemPrompt,
      model: modelSourceStore.selectedChatModelConfig,
      signal: abortController.signal,
      enableToolCalling: chatPreferencesStore.effectiveToolCallEnabled,
      // 传入附件信息：只有工具对话时才有意义
      attachmentFileReferenceIds: sessionFileStore.hasFiles
        ? sessionFileStore.files.map((f) => f.fileReferenceId)
        : undefined,
      primaryAttachmentFileReferenceId: sessionFileStore.primaryAttachmentFileReferenceId || undefined,
      onEvent: (event) => {
        handleStreamEvent(
          event,
          assistantMessage,
          sessionId,
          reasoning.setReasoningText,
          reasoning.setReasoningMessageId,
        );
        commitMessageChange();
      },
    });

    if (assistantMessage.status === 'streaming') {
      assistantMessage.status = 'completed';
    }
    assistantMessage.timing ??= {};
    assistantMessage.timing.completedAt ??= Date.now();
    commitMessageChange();

    await refreshSessions();
  } catch (error) {
    if (abortController.signal.aborted) {
      assistantMessage.status = 'interrupted';
    } else {
      assistantMessage.status = 'error';
      state.errorMessage.value = error instanceof Error ? error.message : uiText.errors.sendFailed;
    }
    assistantMessage.timing ??= {};
    assistantMessage.timing.completedAt ??= Date.now();
    commitMessageChange();
  } finally {
    state.sending.value = false;
    state.streamController.value = null;
  }
}

export async function stopWorkbenchChat(state: WorkbenchStateRefs) {
  if (!state.activeSessionId.value) {
    return;
  }

  try {
    await chatApi.stopChat(state.activeSessionId.value);
  } catch (error) {
    // 停止接口失败不应阻塞 UI，仍要 abort 前端流，仅记录错误日志
    console.warn('[workbench] stopChat failed:', error);
  }
  state.streamController.value?.abort();
}

export async function deleteLatestWorkbenchRound(
  state: WorkbenchStateRefs,
  reasoning: ReasoningController,
  refreshSessions: () => Promise<void>,
  fillComposer: boolean,
) {
  if (!state.activeSessionId.value || state.sending.value) {
    return;
  }

  const sessionId = state.activeSessionId.value;
  const lastUserMessage = findLastUserMessage(state.messages.value);

  try {
    const page = await chatApi.rollback(sessionId);
    applyHistoryPage(
      state,
      reasoning,
      reasoning.setReasoningMessageId,
      sessionId,
      page.records,
      page.nextCursor,
      page.hasMore,
      page.total,
    );
    state.composerDraft.value = fillComposer ? lastUserMessage?.content ?? '' : '';
    reasoning.clearReasoning(sessionId);
    await refreshSessions();
  } catch (error) {
    state.errorMessage.value = error instanceof Error ? error.message : uiText.errors.requestFailed;
  }
}
