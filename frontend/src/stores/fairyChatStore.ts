import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { fairyChatApi } from '@/api/fairyChatApi';
import { CHAT_EVENT } from '@/config/chatConstants';
import { useFairyStore } from '@/stores/fairyStore';
import { useModelSourceStore } from '@/stores/modelSourceStore';
import { handleStreamEvent } from '@/stores/workbench/streamState';
import type { ChatMessage, ChatModelConfig, ChatSession } from '@/types/chat';

const STORAGE_KEY = 'desktop-fairy.temporary-chat';
// 自动闲聊触发时间与冷却时间改为从 fairyStore.idleTriggerMs 读取（用户可在设置中调节）
// 保留默认值用于首次加载（store 未初始化时）
const DEFAULT_IDLE_TRIGGER_MS = 3 * 60_000;
const TEMPORARY_SESSION_TTL_MS = 10 * 60_000;
const TEMPORARY_CHAT_OPTION_ID = '__temporary_chat__';
const TEMPORARY_CHAT_OPTION_TITLE = '常驻闲聊';
const TEMPORARY_CHAT_OPTION_DESCRIPTION = '空消息可闲聊';

interface TemporaryChatSnapshot {
  temporarySessionId: string;
  messages: ChatMessage[];
  lastSessionActivityAt: number;
  draft: string;
  version: number;
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
    version: 0,
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
      version: typeof parsed.version === 'number' ? parsed.version : 0,
    };
  } catch {
    return buildEmptySnapshot();
  }
}

export const useFairyChatStore = defineStore('fairyChat', () => {
  const modelSourceStore = useModelSourceStore();
  const fairyStore = useFairyStore();
  const snapshot = loadSnapshot();

  const mode = ref<'inactive' | 'temporary-chat'>('inactive');
  const triggerSource = ref<FairyChatTriggerSource>('');
  const temporarySessionId = ref(snapshot.temporarySessionId);
  const messages = ref<ChatMessage[]>(snapshot.messages);
  const sending = ref(false);
  const errorMessage = ref('');
  const draft = ref(snapshot.draft);
  const streamController = ref<AbortController | null>(null);
  // 流式阶段：'idle' | 'typing' | 'thinking' | 'replying'
  // typing: 用户已发送，等待模型响应
  // thinking: 模型正在输出思考内容（reasoning）
  // replying: 模型正在输出正式回复（data）
  const streamPhase = ref<'idle' | 'typing' | 'thinking' | 'replying'>('idle');
  const lastUserActivityAt = ref(Date.now());
  const lastSessionActivityAt = ref(snapshot.lastSessionActivityAt);
  const lastAutoTriggerAt = ref(0);
  const idleArmed = ref(true);
  const selected = ref(false);
  const syncInitialized = ref(false);
  const localVersion = ref(snapshot.version);
  const syncSuppressed = ref(false);

  const canSend = computed(() => Boolean(modelSourceStore.selectedChatModelConfig) && !sending.value);
  const latestAssistantMessage = computed(
    () => [...messages.value].reverse().find((message) => message.role === 'assistant' && message.status !== 'sending' && message.content.trim()) ?? null,
  );
  const latestAssistantPreview = computed(() => latestAssistantMessage.value?.content ?? '');
  const activeModelLabel = computed(() => modelSourceStore.selectedChatModelLabel || '未选择聊天模型');
  const canAutoTrigger = computed(
    () => idleArmed.value
      && !sending.value
      && Boolean(modelSourceStore.selectedChatModelConfig)
      && Date.now() - lastAutoTriggerAt.value >= fairyStore.idleTriggerMs,
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
    localVersion.value = next.version;
  }

  function persist() {
    if (typeof window === 'undefined') {
      return;
    }

    if (!temporarySessionId.value || !lastSessionActivityAt.value) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    // 每次写入时递增版本号，确保多窗口同步时不会用旧数据覆盖新数据
    localVersion.value += 1;

    const payload: TemporaryChatSnapshot = {
      temporarySessionId: temporarySessionId.value,
      messages: messages.value,
      lastSessionActivityAt: lastSessionActivityAt.value,
      draft: draft.value,
      version: localVersion.value,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function syncFromStorage() {
    // 发送期间禁止同步，避免覆盖正在写入的状态
    if (syncSuppressed.value || sending.value) {
      return;
    }

    const next = loadSnapshot();

    // 只同步版本号更新的数据，防止旧数据覆盖新数据
    if (next.version <= localVersion.value) {
      return;
    }

    applySnapshot(next);
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
    // 创建副本并应用变更，确保触发响应式更新
    const current = messages.value[index];
    const next: ChatMessage = {
      ...current,
      timing: current.timing ? { ...current.timing } : {},
    };
    mutator(next);
    // 直接替换数组中的元素即可触发响应式（Vue 3 Proxy 机制支持索引赋值）
    // 避免流式更新时每次都拷贝整个数组（O(N) → O(1)）
    messages.value[index] = next;
  }

  async function sendTemporaryMessage(question: string, source: FairyChatTriggerSource = 'manual') {
    const model = modelSourceStore.selectedChatModelConfig;
    const normalizedQuestion = question.trim();

    if (!model) {
      throw new Error('请先选择聊天模型后再使用闲聊模式。');
    }

    // 发送期间抑制 localStorage 同步，避免多窗口竞态导致消息丢失
    syncSuppressed.value = true;

    activateTemporaryChat(source);
    markUserActivity();
    touchSessionActivity();
    errorMessage.value = '';
    sending.value = true;
    streamPhase.value = 'typing';

    const sessionId = ensureTemporarySession();
    const controller = new AbortController();
    streamController.value = controller;

    appendUserMessage(normalizedQuestion);
    const assistantMessageId = createAssistantStreamingMessage();

    try {
      const replyContent = await fairyChatApi.sendTemporaryChat({
        sessionId,
        question: normalizedQuestion,
        model,
        signal: controller.signal,
        onEvent: (event) => {
          // 通过索引替换更新消息，确保 Vue 响应式系统检测到变化
          updateAssistantMessageById(assistantMessageId, (message) => {
            handleStreamEvent(event, message, sessionId, () => {}, () => {}, {});
          });
          if (event.eventType === CHAT_EVENT.reasoning) {
            // 模型开始输出思考内容
            streamPhase.value = 'thinking';
          }
          if (event.eventType === CHAT_EVENT.data) {
            // 模型开始输出正式回复
            streamPhase.value = 'replying';
            touchSessionActivity();
            persist();
          }
          if (event.eventType === CHAT_EVENT.stop || event.eventType === CHAT_EVENT.interrupted || event.eventType === CHAT_EVENT.error) {
            streamPhase.value = 'idle';
            touchSessionActivity();
            persist();
          }
        },
      });

      // 请求完成后，使用 API 返回值直接设置消息内容（兜底，确保响应式更新）
      updateAssistantMessageById(assistantMessageId, (message) => {
        if (replyContent && replyContent.trim()) {
          message.content = replyContent;
        }
        if (!message.content.trim()) {
          message.content = '闲聊接口已返回，但内容为空。';
        }
        if (message.status === 'sending' || message.status === 'streaming') {
          message.status = 'completed';
        }
      });
      touchSessionActivity();
      persist();
    } catch (error) {
      // 用户主动停止不应显示为错误
      if (error instanceof Error && error.name === 'AbortError') {
        updateAssistantMessageById(assistantMessageId, (message) => {
          message.status = 'interrupted';
          if (!message.content.trim()) {
            message.content = '已停止生成。';
          }
        });
        persist();
        return;
      }
      const message = error instanceof Error ? error.message : '闲聊模式请求失败';
      errorMessage.value = message;
      updateAssistantMessageById(assistantMessageId, (msg) => {
        msg.status = 'error';
        msg.content = msg.content.trim() ? msg.content : message;
      });
      persist();
      throw error;
    } finally {
      sending.value = false;
      streamPhase.value = 'idle';
      streamController.value = null;
      // 发送完成后，确保版本号已同步到 localStorage，再解除同步抑制
      persist();
      syncSuppressed.value = false;
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
    // 不再用 mode === 'temporary-chat' 拦截：
    // 用户可能已经处于临时闲聊会话，但仍希望在持续空闲时继续自动触发下一轮陪伴消息。
    // 真正应该阻止自动触发的是：
    //   1. 当前功能未启用
    //   2. 当前已有一轮请求正在发送中（sending=true）
    //   3. idleArmed / lastAutoTriggerAt / model 是否可用由 canAutoTrigger 统一控制
    if (!enabled || sending.value) {
      return false;
    }

    const idleFor = Date.now() - lastUserActivityAt.value;
    // 触发时间从 fairyStore.idleTriggerMs 读取（用户可在设置中调节）
    const idleTriggerMs = fairyStore.idleTriggerMs || DEFAULT_IDLE_TRIGGER_MS;
    if (idleFor < idleTriggerMs) {
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
    streamPhase,
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
