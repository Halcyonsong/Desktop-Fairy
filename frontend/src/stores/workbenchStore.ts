import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { chatApi } from '@/api/chatApi';
import { uiText } from '@/config/uiText';
import {
  bootstrapWorkbench,
  createWorkbenchSession,
  deleteLatestWorkbenchRound,
  deleteWorkbenchSession,
  loadWorkbenchMoreHistory,
  loadWorkbenchSession,
  refreshWorkbenchHistory,
  renameWorkbenchSession,
  sendWorkbenchMessage,
  stopWorkbenchChat,
  type WorkbenchStateRefs,
} from '@/stores/workbench/actions';
import { useReasoningState } from '@/stores/workbench/reasoningState';
import type { ChatMessage, ChatSession } from '@/types/chat';

export const useWorkbenchStore = defineStore('workbench', () => {
  const sessions = ref<ChatSession[]>([]);
  const messages = ref<ChatMessage[]>([]);
  const activeSessionId = ref('');
  const nextCursor = ref<number | null>(null);
  const hasMoreHistory = ref(false);
  const historyTotal = ref(0);
  const loading = ref(false);
  const loadingMoreHistory = ref(false);
  const refreshingHistory = ref(false);
  const sending = ref(false);
  const errorMessage = ref('');
  const streamController = ref<AbortController | null>(null);
  const composerDraft = ref('');
  const noMoreHistoryUntil = ref<Record<string, number>>({});
  const historyPullMessage = ref<string>(uiText.chat.pullMore);

  const reasoning = useReasoningState(activeSessionId);

  const state: WorkbenchStateRefs = {
    sessions,
    messages,
    activeSessionId,
    nextCursor,
    hasMoreHistory,
    historyTotal,
    loading,
    loadingMoreHistory,
    refreshingHistory,
    sending,
    errorMessage,
    streamController,
    composerDraft,
    noMoreHistoryUntil,
    historyPullMessage,
  };

  const activeSession = computed(() => sessions.value.find((session) => session.sessionId === activeSessionId.value));

  async function refreshSessions() {
    sessions.value = await chatApi.listSessions();
  }

  async function bootstrap() {
    await bootstrapWorkbench(state, refreshSessions, loadSession);
  }

  async function loadSession(sessionId: string) {
    await loadWorkbenchSession(state, { ...reasoning, sending }, sessionId);
  }

  async function refreshActiveHistory() {
    await refreshWorkbenchHistory(state, refreshSessions, { ...reasoning, sending });
  }

  async function loadMoreHistory() {
    await loadWorkbenchMoreHistory(state);
  }

  async function createSession() {
    await createWorkbenchSession(state, loadSession);
  }

  async function renameSession(sessionId: string, title: string) {
    await renameWorkbenchSession(state, sessionId, title);
  }

  async function deleteSession(sessionId: string) {
    await deleteWorkbenchSession(state, { ...reasoning, sending }, loadSession, sessionId);
  }

  async function sendMessage(question?: string) {
    await sendWorkbenchMessage(state, { ...reasoning, sending }, refreshSessions, question);
  }

  async function stopChat() {
    await stopWorkbenchChat(state);
  }

  async function deleteLatestRound(fillComposer: boolean) {
    await deleteLatestWorkbenchRound(state, { ...reasoning, sending }, refreshSessions, fillComposer);
  }

  function rollbackLatestRoundToComposer() {
    return deleteLatestRound(true);
  }

  function deleteLatestRoundOnly() {
    return deleteLatestRound(false);
  }

  function setComposerDraft(value: string) {
    composerDraft.value = value;
  }

  return {
    sessions,
    messages,
    activeSessionId,
    activeSession,
    nextCursor,
    hasMoreHistory,
    historyTotal,
    loading,
    loadingMoreHistory,
    refreshingHistory,
    sending,
    errorMessage,
    latestReasoningText: reasoning.latestReasoningText,
    latestReasoningMessageId: reasoning.latestReasoningMessageId,
    historyPullMessage,
    composerDraft,
    bootstrap,
    loadSession,
    refreshActiveHistory,
    loadMoreHistory,
    createSession,
    renameSession,
    deleteSession,
    sendMessage,
    stopChat,
    rollbackLatestRoundToComposer,
    deleteLatestRoundOnly,
    setComposerDraft,
  };
});
