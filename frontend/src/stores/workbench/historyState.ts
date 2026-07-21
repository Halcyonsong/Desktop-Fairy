import { chatApi } from '@/api';
import { HISTORY_NO_MORE_CACHE_MS } from '@/config/chatConstants';
import { uiText } from '@/config/uiText';
import { findLastAssistantMessage } from '@/utils/chatMessages';
import type { ChatMessage } from '@/types/chat';
import type { HistoryStateRefs, ReasoningStateRefs } from '@/stores/workbench/types';

export function cacheNoMoreHistory(noMoreHistoryUntil: Record<string, number>, sessionId: string) {
  return {
    ...noMoreHistoryUntil,
    [sessionId]: Date.now() + HISTORY_NO_MORE_CACHE_MS,
  };
}

export function applyHistoryPage(
  historyState: Pick<HistoryStateRefs, 'messages' | 'nextCursor' | 'hasMoreHistory' | 'historyTotal'>,
  reasoningState: Pick<ReasoningStateRefs, 'reasoningBySession' | 'reasoningMessageIdBySession' | 'sending'>,
  setReasoningMessageId: (sessionId: string, messageId: string) => void,
  sessionId: string,
  records: ChatMessage[],
  next: number | null,
  hasMore: boolean,
  total: number,
) {
  historyState.messages.value = records;
  historyState.nextCursor.value = next;
  historyState.hasMoreHistory.value = hasMore;
  historyState.historyTotal.value = total;

  if (
    reasoningState.reasoningMessageIdBySession.value[sessionId] ||
    reasoningState.reasoningBySession.value[sessionId] ||
    reasoningState.sending.value
  ) {
    const assistantMessage = findLastAssistantMessage(records);
    if (assistantMessage) {
      setReasoningMessageId(sessionId, assistantMessage.id);
    }
  }
}

export async function refreshActiveHistory(
  historyState: HistoryStateRefs,
  refreshSessions: () => Promise<void>,
  applyPage: (sessionId: string, records: ChatMessage[], next: number | null, hasMore: boolean, total: number) => void,
) {
  const sessionId = historyState.activeSessionId.value;
  if (!sessionId || historyState.refreshingHistory.value) {
    return;
  }

  historyState.refreshingHistory.value = true;
  historyState.errorMessage.value = '';
  try {
    await refreshSessions();
    const historyPage = await chatApi.listHistory(sessionId);
    applyPage(sessionId, historyPage.records, historyPage.nextCursor, historyPage.hasMore, historyPage.total);
    historyState.historyPullMessage.value = historyPage.hasMore ? uiText.chat.pullMore : uiText.chat.noMoreHistory;

    if (!historyPage.hasMore) {
      historyState.noMoreHistoryUntil.value = cacheNoMoreHistory(historyState.noMoreHistoryUntil.value, sessionId);
    }
  } catch (error) {
    historyState.errorMessage.value = error instanceof Error ? error.message : uiText.errors.refreshHistoryFailed;
  } finally {
    historyState.refreshingHistory.value = false;
  }
}

export async function loadMoreHistory(
  historyState: HistoryStateRefs,
  applyPageRecords: (records: ChatMessage[], next: number | null, hasMore: boolean, total: number) => void,
) {
  const sessionId = historyState.activeSessionId.value;
  if (!sessionId || historyState.loadingMoreHistory.value) {
    return;
  }

  if (!historyState.hasMoreHistory.value || historyState.nextCursor.value === null) {
    const cachedUntil = historyState.noMoreHistoryUntil.value[sessionId] ?? 0;
    if (Date.now() < cachedUntil) {
      historyState.historyPullMessage.value = uiText.chat.noMoreHistory;
      return;
    }
    historyState.noMoreHistoryUntil.value = cacheNoMoreHistory(historyState.noMoreHistoryUntil.value, sessionId);
    historyState.historyPullMessage.value = uiText.chat.noMoreHistory;
    return;
  }

  historyState.loadingMoreHistory.value = true;
  historyState.historyPullMessage.value = uiText.chat.loadingHistory;
  try {
    const page = await chatApi.listHistory(sessionId, historyState.nextCursor.value);
    applyPageRecords(page.records, page.nextCursor, page.hasMore, page.total);

    if (page.hasMore) {
      historyState.historyPullMessage.value = uiText.chat.pullMore;
    } else {
      historyState.noMoreHistoryUntil.value = cacheNoMoreHistory(historyState.noMoreHistoryUntil.value, sessionId);
      historyState.historyPullMessage.value = uiText.chat.noMoreHistory;
    }
  } catch (error) {
    historyState.historyPullMessage.value = error instanceof Error ? error.message : uiText.errors.loadHistoryFailed;
  } finally {
    historyState.loadingMoreHistory.value = false;
  }
}
