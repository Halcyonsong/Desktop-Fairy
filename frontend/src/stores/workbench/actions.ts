import { chatApi } from '@/api/chatApi';
import { uiText } from '@/config/uiText';
import { useChatPreferencesStore } from '@/stores/chatPreferencesStore';
import { useModelSourceStore } from '@/stores/modelSourceStore';
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

  const historyPage = await chatApi.listHistory(sessionId);
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
  const session = await chatApi.createSession();
  state.sessions.value = [session, ...state.sessions.value.filter((item) => item.sessionId !== session.sessionId)];
  state.composerDraft.value = '';
  await loadSession(session.sessionId);
}

export async function renameWorkbenchSession(state: WorkbenchStateRefs, sessionId: string, title: string) {
  if (!sessionId || !title.trim()) {
    return;
  }

  const session = await chatApi.renameSession(sessionId, title.trim());
  state.sessions.value = state.sessions.value.map((item) => (item.sessionId === session.sessionId ? session : item));
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
}

export async function sendWorkbenchMessage(
  state: WorkbenchStateRefs,
  reasoning: ReasoningController,
  refreshSessions: () => Promise<void>,
  question?: string,
) {
  const source = question ?? state.composerDraft.value;
  const trimmedQuestion = source.trim();
  if (!trimmedQuestion || state.sending.value) {
    return;
  }

  const modelSourceStore = useModelSourceStore();
  const chatPreferencesStore = useChatPreferencesStore();
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

  try {
    await chatApi.sendChat({
      sessionId,
      question: trimmedQuestion,
      systemPrompt: chatPreferencesStore.systemPrompt,
      model: modelSourceStore.selectedChatModelConfig,
      signal: abortController.signal,
      onEvent: (event) =>
        handleStreamEvent(
          event,
          assistantMessage,
          sessionId,
          reasoning.setReasoningText,
          reasoning.setReasoningMessageId,
          reasoning.reasoningBySession.value,
        ),
    });

    if (assistantMessage.status === 'streaming') {
      assistantMessage.status = 'completed';
    }
    assistantMessage.timing ??= {};
    assistantMessage.timing.completedAt ??= Date.now();

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
  } finally {
    state.sending.value = false;
    state.streamController.value = null;
  }
}

export async function stopWorkbenchChat(state: WorkbenchStateRefs) {
  if (!state.activeSessionId.value) {
    return;
  }

  await chatApi.stopChat(state.activeSessionId.value);
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
}
