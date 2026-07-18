import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { fairyChatApi } from '@/api/fairyChatApi';
import { CHAT_EVENT } from '@/config/chatConstants';
import { useModelSourceStore } from '@/stores/modelSourceStore';
import { handleStreamEvent } from '@/stores/workbench/streamState';
import type { ChatMessage, ChatModelConfig, ChatSession } from '@/types/chat';

const STORAGE_KEY = 'desktop-fairy.temporary-chat';
const IDLE_TRIGGER_MS = 3 * 60_000;
const IDLE_COOLDOWN_MS = 3 * 60_000;
const TEMPORARY_SESSION_TTL_MS = 10 * 60_000;
const TEMPORARY_CHAT_OPTION_ID = '__temporary_chat__';
const TEMPORARY_CHAT_OPTION_TITLE = '常驻闲聊';
const TEMPORARY_CHAT_OPTION_DESCRIPTION = '空消息可闲聊';

interface TemporaryChatSnapshot {
  temporarySessionId: string;
  messages: ChatMessage[];
  lastSessionActivityAt: number;
  draft: string;
}

export type FairyChatTriggerSource = 'manual' | 'idle' | '';

function createMessage(role: 'user' | 'assistant', content = '', status: ChatMessage['status'] = 'completed'): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    status,
    createTime: new Date().toISOString(),
    timing: role === 'assistant' ? {} : undefined,
  };
}

function createTemporarySessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `fairy-${crypto.randomUUID()}`;
  }
  return `fairy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildEmptySnapshot(): TemporaryChatSnapshot {
  return {
    temporarySessionId: '',
    messages: [],
    lastSessionActivityAt: 0,
    draft: '',
  };
}

function loadSnapshot(): TemporaryChatSnapshot {
  if (typeof window === 'undefined') {
    return buildEmptySnapshot();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return buildEmptySnapshot();
    }

    const parsed = JSON.parse(raw) as Partial<TemporaryChatSnapshot>;
    const lastSessionActivityAt = Number(parsed.lastSessionActivityAt ?? 0);
    if (!lastSessionActivityAt || Date.now() - lastSessionActivityAt > TEMPORARY_SESSION_TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return buildEmptySnapshot();
    }

    return {
      temporarySessionId: typeof parsed.temporarySessionId === 'string' ? parsed.temporarySessionId : '',
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      lastSessionActivityAt,
      draft: typeof parsed.draft === 'string' ? parsed.draft : '',
    };
  } catch {
    return buildEmptySnapshot();
  }
}

export const useFairyChatStore = defineStore('fairyChat', () => {
  const modelSourceStore = useModelSourceStore();
  const snapshot = loadSnapshot();

  const mode = ref<'inactive' | 'temporary-chat'>('inactive');
  const triggerSource = ref<FairyChatTriggerSource>('');
  const temporarySessionId = ref(snapshot.temporarySessionId);
  const messages = ref<ChatMessage[]>(snapshot.messages);
  const sending = ref(false);
  const errorMessage = ref('');
  const draft = ref(snapshot.draft);
  const streamController = ref<AbortController | null>(null);
  const lastUserActivityAt = ref(Date.now());
  const lastSessionActivityAt = ref(snapshot.lastSessionActivityAt);
  const lastAutoTriggerAt = ref(0);
  const idleArmed = ref(true);
  const selected = ref(false);
  const syncInitialized = ref(false);

  const canSend = computed(() => Boolean(modelSourceStore.selectedChatModelConfig) && !sending.value);
  const latestAssistantMessage = computed(
    () => [...messages.value].reverse().find((message) => message.role === 'assistant' && message.status !== 'sending' && message.content.trim()) ?? null,
  );
  const latestAssistantPreview = computed(() => latestAssistantMessage.value?.content ?? '');
  const activeModelLabel = computed(() => modelSourceStore.selectedChatModelLabel || '未选择聊天模型');
  const canAutoTrigger = computed(
    () => idleArmed.value && !sending.value && Boolean(modelSourceStore.selectedChatModelConfig) && Date.now() - lastAutoTriggerAt.value >= IDLE_COOLDOWN_MS,
  );
  const temporaryChatOption = computed(() => ({
    sessionId: TEMPORARY_CHAT_OPTION_ID,
    title: TEMPORARY_CHAT_OPTION_TITLE,
    description: TEMPORARY_CHAT_OPTION_DESCRIPTION,
  }));
  const temporarySessionSummary = computed<ChatSession | null>(() => {
    if (!temporarySessionId.value) {
      return null;
    }

    const fallbackTime = new Date(lastSessionActivityAt.value || Date.now()).toISOString();
    const latestTime = messages.value.at(-1)?.createTime ?? fallbackTime;
    return {
      sessionId: TEMPORARY_CHAT_OPTION_ID,
      title: TEMPORARY_CHAT_OPTION_TITLE,
      createTime: messages.value[0]?.createTime ?? fallbackTime,
      updateTime: latestTime,
    };
  });

  function applySnapshot(next: TemporaryChatSnapshot) {
    temporarySessionId.value = next.temporarySessionId;
    messages.value = next.messages;
    lastSessionActivityAt.value = next.lastSessionActivityAt;
    draft.value = next.draft;
  }

  function persist() {
    if (typeof window === 'undefined') {
      return;
    }

    if (!temporarySessionId.value || !lastSessionActivityAt.value) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const payload: TemporaryChatSnapshot = {
      temporarySessionId: temporarySessionId.value,
      messages: messages.value,
      lastSessionActivityAt: lastSessionActivityAt.value,
      draft: draft.value,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function syncFromStorage() {
    applySnapshot(loadSnapshot());
  }

  function initializeSync() {
    if (syncInitialized.value || typeof window === 'undefined') {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }
      syncFromStorage();
    };

    window.addEventListener('storage', handleStorage);
    syncInitialized.value = true;
  }

  function isTemporaryChatSession(sessionId: string) {
    return sessionId === TEMPORARY_CHAT_OPTION_ID;
  }

  function selectTemporaryChat() {
    selected.value = true;
    mode.value = 'temporary-chat';
    ensureTemporarySession();
  }

  function deselectTemporaryChat() {
    selected.value = false;
    if (!sending.value) {
      mode.value = 'inactive';
      triggerSource.value = '';
    }
  }

  function markUserActivity() {
    lastUserActivityAt.value = Date.now();
    idleArmed.value = true;
  }

  function touchSessionActivity() {
    lastSessionActivityAt.value = Date.now();
  }

  function pruneTemporarySessionIfExpired() {
    if (!temporarySessionId.value || !lastSessionActivityAt.value) {
      return;
    }

    if (Date.now() - lastSessionActivityAt.value > TEMPORARY_SESSION_TTL_MS) {
      resetTemporarySession();
      selected.value = false;
      if (mode.value === 'temporary-chat' && !sending.value) {
        mode.value = 'inactive';
        triggerSource.value = '';
      }
    }
  }

  function resetTemporarySession(clearMessages = true) {
    temporarySessionId.value = '';
    if (clearMessages) {
      messages.value = [];
    }
    errorMessage.value = '';
    streamController.value = null;
    lastSessionActivityAt.value = 0;
    persist();
  }

  function ensureTemporarySession() {
    if (!temporarySessionId.value) {
      temporarySessionId.value = createTemporarySessionId();
      messages.value = [];
      errorMessage.value = '';
      touchSessionActivity();
    }
    persist();
    return temporarySessionId.value;
  }

  function refreshTemporarySession() {
    if (sending.value) {
      return;
    }

    temporarySessionId.value = createTemporarySessionId();
    messages.value = [];
    draft.value = '';
    errorMessage.value = '';
    touchSessionActivity();
    persist();
  }

  function activateTemporaryChat(source: FairyChatTriggerSource) {
    mode.value = 'temporary-chat';
    triggerSource.value = source;
    selected.value = true;
    ensureTemporarySession();
    markUserActivity();
  }

  function deactivateTemporaryChat(resetSession = false) {
    mode.value = 'inactive';
    triggerSource.value = '';
    errorMessage.value = '';
    selected.value = false;
    if (resetSession) {
      draft.value = '';
      resetTemporarySession();
    } else {
      persist();
    }
  }

  function setDraft(value: string) {
    draft.value = value;
    persist();
  }

  function appendUserMessage(question: string) {
    messages.value = [...messages.value, createMessage('user', question)];
    touchSessionActivity();
    persist();
  }

  function createAssistantStreamingMessage(): string {
    const message = createMessage('assistant', '', 'sending');
    messages.value = [...messages.value, message];
    persist();
    // 返回消息 ID，后续通过 ID 从响应式数组中查找并替换，确保触发响应式更新
    return message.id;
  }

  function updateAssistantMessageById(messageId: string, mutator: (message: ChatMessage) => void) {
    const index = messages.value.findIndex((item) => item.id === messageId);
    if (index < 0) {
      return;
    }
    // 创建副本并应用变更，再替换数组元素，确保 Vue 响应式系统检测到变化
    const current = messages.value[index];
    const next: ChatMessage = {
      ...current,
      timing: current.timing ? { ...current.timing } : {},
    };
    mutator(next);
    messages.value[index] = next;
  }

  async function sendTemporaryMessage(question: string, source: FairyChatTriggerSource = 'manual') {
    const model = modelSourceStore.selectedChatModelConfig;
    const normalizedQuestion = question.trim();

    if (!model) {
      throw new Error('请先选择聊天模型后再使用闲聊模式。');
    }

    activateTemporaryChat(source);
    markUserActivity();
    touchSessionActivity();
    errorMessage.value = '';
    sending.value = true;

    const sessionId = ensureTemporarySession();
    const controller = new AbortController();
    streamController.value = controller;

    appendUserMessage(normalizedQuestion);
    const assistantMessage = createAssistantStreamingMessage();

    try {
      await fairyChatApi.sendTemporaryChat({
        sessionId,
        question: normalizedQuestion,
        model,
        signal: controller.signal,
        onEvent: (event) => {
          handleStreamEvent(event, assistantMessage, sessionId, () => {}, () => {}, {});
          if (event.eventType === CHAT_EVENT.data) {
            touchSessionActivity();
            persist();
          }
          if (event.eventType === CHAT_EVENT.stop || event.eventType === CHAT_EVENT.interrupted || event.eventType === CHAT_EVENT.error) {
            touchSessionActivity();
            persist();
          }
        },
      });

      if (!assistantMessage.content.trim()) {
        assistantMessage.content = '闲聊接口已返回，但内容为空。';
      }
      if (assistantMessage.status === 'sending') {
        assistantMessage.status = 'completed';
      }
      touchSessionActivity();
      persist();
    } catch (error) {
      // 用户主动停止不应显示为错误
      if (error instanceof Error && error.name === 'AbortError') {
        assistantMessage.status = 'interrupted';
        if (!assistantMessage.content.trim()) {
          assistantMessage.content = '已停止生成。';
        }
        persist();
        return;
      }
      const message = error instanceof Error ? error.message : '闲聊模式请求失败';
      errorMessage.value = message;
      assistantMessage.status = 'error';
      assistantMessage.content = assistantMessage.content.trim() ? assistantMessage.content : message;
      persist();
      throw error;
    } finally {
      sending.value = false;
      streamController.value = null;
    }
  }

  async function triggerIdleChat() {
    if (!canAutoTrigger.value) {
      return false;
    }

    lastAutoTriggerAt.value = Date.now();
    idleArmed.value = false;

    try {
      await sendTemporaryMessage('', 'idle');
      return true;
    } catch {
      return false;
    }
  }

  async function maybeTriggerIdleChat(enabled: boolean) {
    pruneTemporarySessionIfExpired();
    if (!enabled || mode.value === 'temporary-chat') {
      return false;
    }

    const idleFor = Date.now() - lastUserActivityAt.value;
    if (idleFor < IDLE_TRIGGER_MS) {
      return false;
    }

    return triggerIdleChat();
  }

  function stopTemporaryChat() {
    streamController.value?.abort();
  }

  function clearMessages() {
    messages.value = [];
    errorMessage.value = '';
    lastSessionActivityAt.value = 0;
    persist();
  }

  function syncModelChange(model: ChatModelConfig | null) {
    if (!model) {
      resetTemporarySession();
      return;
    }

    if (messages.value.length > 0 || temporarySessionId.value) {
      resetTemporarySession();
    }
  }

  watch(
    () => [temporarySessionId.value, messages.value.length, lastSessionActivityAt.value] as const,
    () => {
      persist();
    },
    { deep: true },
  );

  initializeSync();

  return {
    mode,
    triggerSource,
    temporarySessionId,
    messages,
    sending,
    errorMessage,
    draft,
    lastUserActivityAt,
    idleArmed,
    selected,
    canSend,
    latestAssistantMessage,
    latestAssistantPreview,
    activeModelLabel,
    canAutoTrigger,
    temporaryChatOption,
    temporarySessionSummary,
    initializeSync,
    syncFromStorage,
    isTemporaryChatSession,
    selectTemporaryChat,
    deselectTemporaryChat,
    activateTemporaryChat,
    deactivateTemporaryChat,
    ensureTemporarySession,
    refreshTemporarySession,
    resetTemporarySession,
    setDraft,
    sendTemporaryMessage,
    triggerIdleChat,
    maybeTriggerIdleChat,
    stopTemporaryChat,
    clearMessages,
    markUserActivity,
    pruneTemporarySessionIfExpired,
    syncModelChange,
  };
});
