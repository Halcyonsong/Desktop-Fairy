<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import FairyAvatar from '@/components/fairy/FairyAvatar.vue';
import FairyBubble from '@/components/fairy/FairyBubble.vue';
import FairyComposer from '@/components/fairy/FairyComposer.vue';
import { uiText } from '@/config/uiText';
import { loadPetDefinition } from '@/modules/fairy/petLoader';
import { useFairyBubbleController } from '@/modules/fairy/useFairyBubbleController';
import { useFairyDragController } from '@/modules/fairy/useFairyDragController';
import { useFairyIdleController } from '@/modules/fairy/useFairyIdleController';
import { useFairyMotionController } from '@/modules/fairy/useFairyMotionController';
import { usePetPlayer } from '@/modules/fairy/usePetPlayer';
import { useFairyChatStore } from '@/stores/fairyChatStore';
import { useFairyStore } from '@/stores/fairyStore';
import { useModelSourceStore } from '@/stores/modelSourceStore';
import { useWorkbenchStore } from '@/stores/workbenchStore';
import type { ChatMessage, ChatSession } from '@/types/chat';
import type { PetDefinition } from '@/types/pet';

const props = defineProps<{
  windowMode?: 'workbench' | 'fairy';
}>();

const fairyStore = useFairyStore();
const fairyChatStore = useFairyChatStore();
const modelSourceStore = useModelSourceStore();
const workbenchStore = useWorkbenchStore();

const pet = ref<PetDefinition | null>(null);
const loading = ref(false);
const errorMessage = ref('');
const sessionPickerOpen = ref(false);
const localDraft = ref('');
const interactivePinned = ref(false);
const selectedSessionId = ref('');
const lastWorkbenchAssistantMessageId = ref('');

const isNativeFairyWindow = computed(() => props.windowMode === 'fairy');
const { animationName, currentFrame } = usePetPlayer(pet);
const { dragging, statusMessage, setDragging, setStatusMessage } = useFairyMotionController(pet, animationName);
const {
  bubbleVisible,
  composerVisible,
  previewReply,
  clearBubbleHideTimer,
  clearComposerHideTimer,
  scheduleBubbleHide,
  scheduleComposerHide,
  showBubble,
  showComposer,
  lockComposer,
  unlockComposer,
  hideBubbleAndComposer,
  syncBubbleFromMessages,
} = useFairyBubbleController();

const scaleValue = computed(() => fairyStore.scale);
const frameWidth = computed(() => currentFrame.value?.w ?? 138);
const frameHeight = computed(() => currentFrame.value?.h ?? 194);
const visualWidth = computed(() => Math.round(frameWidth.value * scaleValue.value));
const visualHeight = computed(() => Math.round(frameHeight.value * scaleValue.value));
const bubbleBottom = computed(() => Math.max(visualHeight.value - 88, 84));
const bubbleGap = computed(() => Math.max(18, Math.round(16 + (scaleValue.value - 1) * 24)));
const chatModeActive = computed(() => fairyChatStore.mode === 'temporary-chat');
const usingTemporaryChat = computed(
  () => fairyChatStore.selected || fairyChatStore.isTemporaryChatSession(selectedSessionId.value),
);
const combinedSessions = computed<ChatSession[]>(() => {
  const temporary = fairyChatStore.temporarySessionSummary;
  return temporary ? [temporary, ...workbenchStore.sessions] : workbenchStore.sessions;
});
const sessionOptions = computed(() => {
  const temporary = fairyChatStore.temporarySessionSummary;
  if (!temporary) {
    return [fairyChatStore.temporaryChatOption, ...workbenchStore.sessions];
  }

  return [
    {
      ...temporary,
      description: fairyChatStore.temporaryChatOption.description,
    },
    ...workbenchStore.sessions,
  ];
});
const currentSending = computed(() => (usingTemporaryChat.value ? fairyChatStore.sending : workbenchStore.sending));
const temporaryChatHint = computed(() => (fairyChatStore.triggerSource === 'idle' ? '自动陪伴中' : '临时闲聊中'));
const canClickSend = computed(() => (usingTemporaryChat.value ? fairyChatStore.canSend : !workbenchStore.sending));

const selectedSessionTitle = computed(() => {
  if (chatModeActive.value || usingTemporaryChat.value) {
    return fairyChatStore.temporaryChatOption.title;
  }
  const current = combinedSessions.value.find((item) => item.sessionId === selectedSessionId.value);
  return current?.title ?? uiText.chat.untitledSession;
});

const inputPlaceholder = computed(() => {
  if (!modelSourceStore.selectedChatModelConfig && usingTemporaryChat.value) {
    return '请先在设置中选择聊天模型';
  }
  if (chatModeActive.value || usingTemporaryChat.value) {
    return '可直接发送空消息，让精灵主动陪你聊聊…';
  }
  if (selectedSessionTitle.value && selectedSessionTitle.value !== uiText.chat.untitledSession) {
    return `向「${selectedSessionTitle.value}」发送消息`;
  }
  return uiText.composer.placeholder;
});

const rootStyle = computed(() => {
  if (isNativeFairyWindow.value) {
    return {
      inset: '0',
      left: '0',
      top: '0',
      right: '0',
      bottom: '0',
      width: '100%',
      height: '100%',
      padding: '0',
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
    };
  }

  const position = fairyStore.position;
  if (!position) {
    return {};
  }

  return {
    left: `${position.x}px`,
    top: `${position.y}px`,
    right: 'auto',
    bottom: 'auto',
  };
});

const shellStyle = computed(() => ({
  width: `${Math.max(visualWidth.value + 24, 286)}px`,
  minHeight: `${visualHeight.value + (composerVisible.value ? 92 : 30)}px`,
}));

const spriteWrapperStyle = computed(() => ({
  width: `${frameWidth.value}px`,
  height: `${frameHeight.value}px`,
  transform: `scale(${scaleValue.value})`,
}));

const spriteStyle = computed(() => {
  const definition = pet.value;
  const frame = currentFrame.value;
  if (!definition || !frame) {
    return {};
  }

  return {
    width: `${frame.w}px`,
    height: `${frame.h}px`,
    backgroundImage: `url(${definition.spritesheetPath})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `${-frame.x}px ${-frame.y}px`,
    backgroundSize: `${definition.canvas.width}px ${definition.canvas.height}px`,
  };
});

const bubbleStyle = computed(() => ({
  right: `calc(100% + ${bubbleGap.value}px)`,
  bottom: `${bubbleBottom.value}px`,
}));

function syncNativeMouseIgnore(clientX: number, clientY: number) {
  if (!isNativeFairyWindow.value || typeof window === 'undefined') {
    return;
  }

  if (interactivePinned.value || dragging.value) {
    window.desktopFairy?.setFairyMouseIgnore?.(false);
    return;
  }

  const target = document.elementFromPoint(clientX, clientY);
  const interactive = target instanceof HTMLElement && !!target.closest('[data-fairy-interactive="true"]');
  window.desktopFairy?.setFairyMouseIgnore?.(!interactive);
}

function handleNativeMouseMove(event: MouseEvent) {
  syncNativeMouseIgnore(event.clientX, event.clientY);
}

function handleNativeMouseLeave() {
  if (!isNativeFairyWindow.value) {
    return;
  }

  if (interactivePinned.value || dragging.value) {
    return;
  }

  window.desktopFairy?.setFairyMouseIgnore?.(true);
}

function syncInteractivePinnedState() {
  interactivePinned.value = composerVisible.value || bubbleVisible.value || sessionPickerOpen.value;
  if (!isNativeFairyWindow.value || typeof window === 'undefined') {
    return;
  }

  window.desktopFairy?.setFairyMouseIgnore?.(!(interactivePinned.value || dragging.value));
}

function syncBubbleWithTemporaryChat() {
  return syncBubbleFromMessages(fairyChatStore.messages);
}

function findLatestCompletedAssistantMessage(messages: ChatMessage[]) {
  return [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.status === 'completed' && message.content.trim()) ?? null;
}

async function ensurePetLoaded() {
  if (!fairyStore.enabled) {
    pet.value = null;
    return;
  }

  loading.value = true;
  errorMessage.value = '';

  try {
    pet.value = await loadPetDefinition(fairyStore.petId);
    setStatusMessage(`当前动作：${animationName.value || pet.value.defaultAnimation}`);
  } catch (error) {
    pet.value = null;
    errorMessage.value = error instanceof Error ? error.message : '桌面精灵加载失败';
  } finally {
    loading.value = false;
  }
}

async function ensureSessionListLoaded() {
  if (workbenchStore.sessions.length > 0) {
    return;
  }

  try {
    await workbenchStore.bootstrap();
  } catch {
    // 保持静默，避免影响精灵展示
  }
}

async function ensureModelSourceLoaded() {
  if (modelSourceStore.sources.length > 0 && (modelSourceStore.selectedChatModelConfig || !modelSourceStore.selectedChatSourceCode)) {
    return;
  }

  try {
    await modelSourceStore.bootstrap();
  } catch {
    // 保持静默，避免影响精灵展示
  }
}

function syncDraftFromStore() {
  localDraft.value = fairyChatStore.draft;
}

async function showLatestReply() {
  if (usingTemporaryChat.value || chatModeActive.value) {
    if (syncBubbleWithTemporaryChat()) {
      return;
    }

    if (!modelSourceStore.selectedChatModelConfig) {
      showBubble('请先前往设置选择聊天模型后，再开启闲聊模式。');
      return;
    }

    showBubble('当前临时闲聊还没有回复内容，可以直接发送一条空消息或普通消息。');
    return;
  }

  if (selectedSessionId.value && workbenchStore.activeSessionId !== selectedSessionId.value) {
    await workbenchStore.loadSession(selectedSessionId.value);
  }

  const lastAssistantMessage = [...workbenchStore.messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.content.trim());

  if (lastAssistantMessage) {
    showBubble(lastAssistantMessage.content);
  } else {
    showBubble('当前会话下暂无可展示的助手回复内容。');
  }
}

function enterTemporaryChat(source: 'manual' | 'idle') {
  fairyChatStore.activateTemporaryChat(source);
  selectedSessionId.value = fairyChatStore.temporaryChatOption.sessionId;
  syncDraftFromStore();
  showComposer();
  syncBubbleWithTemporaryChat();
}

function markGlobalActivity() {
  fairyChatStore.markUserActivity();
}

async function tryIdleChat() {
  fairyChatStore.pruneTemporarySessionIfExpired();
  const triggered = await fairyChatStore.maybeTriggerIdleChat(fairyStore.enabled && fairyStore.residentChatEnabled);
  if (triggered) {
    selectedSessionId.value = fairyChatStore.temporaryChatOption.sessionId;
    syncBubbleWithTemporaryChat() || showBubble('桌面精灵刚刚发来了一条闲聊消息。');
    setStatusMessage('已自动触发闲聊模式');
  }
}

function toggleSessionPicker() {
  sessionPickerOpen.value = !sessionPickerOpen.value;
  if (sessionPickerOpen.value) {
    showComposer();
  }
}

function refreshTemporarySession(event: MouseEvent) {
  event.stopPropagation();
  fairyChatStore.refreshTemporarySession();
  selectedSessionId.value = fairyChatStore.temporaryChatOption.sessionId;
  localDraft.value = '';
  sessionPickerOpen.value = false;
  showComposer();
  showBubble('已刷新临时会话。');
}

async function chooseSession(sessionId: string) {
  selectedSessionId.value = sessionId;
  sessionPickerOpen.value = false;
  showComposer();

  if (fairyChatStore.isTemporaryChatSession(sessionId)) {
    enterTemporaryChat('manual');
    await showLatestReply();
    return;
  }

  fairyChatStore.deactivateTemporaryChat(false);
  if (workbenchStore.activeSessionId !== sessionId) {
    await workbenchStore.loadSession(sessionId);
  }
}

async function handleAvatarClick() {
  if (shouldSuppressClick()) {
    return;
  }

  if (bubbleVisible.value || composerVisible.value) {
    hideBubbleAndComposer();
    if (!fairyChatStore.sending && chatModeActive.value) {
      fairyChatStore.deactivateTemporaryChat(false);
    }
    return;
  }

  showComposer();
  await showLatestReply();
  setStatusMessage(`当前动作：${animationName.value || pet.value?.defaultAnimation || 'idle'}`);
}

function handleDragCommitted() {
  fairyChatStore.markUserActivity();
  setStatusMessage('已记住新的悬浮位置');
}

async function handleSend() {
  const question = localDraft.value.trim();

  showComposer();

  if (usingTemporaryChat.value || chatModeActive.value) {
    if (!fairyChatStore.canSend) {
      return;
    }

    fairyChatStore.setDraft(question);
    try {
      await fairyChatStore.sendTemporaryMessage(
        question,
        chatModeActive.value ? fairyChatStore.triggerSource || 'manual' : 'manual',
      );
      localDraft.value = '';
      fairyChatStore.setDraft('');
      syncBubbleWithTemporaryChat();
    } catch {
      // 错误由 store 状态和气泡承接
    }
    return;
  }

  if (!question || workbenchStore.sending) {
    return;
  }

  if (!selectedSessionId.value) {
    await workbenchStore.createSession();
    selectedSessionId.value = workbenchStore.activeSessionId;
  } else if (workbenchStore.activeSessionId !== selectedSessionId.value) {
    await workbenchStore.loadSession(selectedSessionId.value);
  }

  localDraft.value = '';
  await workbenchStore.sendMessage(question);
}

function handleStop() {
  if (usingTemporaryChat.value || chatModeActive.value) {
    fairyChatStore.stopTemporaryChat();
    return;
  }

  void workbenchStore.stopChat();
}

function handleWindowPointerDown(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (sessionPickerOpen.value && !target.closest('.floating-fairy-session-picker-anchor')) {
    sessionPickerOpen.value = false;
  }
}

function handleBubblePointerEnter() {
  clearBubbleHideTimer();
}

function handleBubblePointerLeave() {
  if (bubbleVisible.value) {
    scheduleBubbleHide();
  }
}

function handleComposerPointerEnter() {
  clearComposerHideTimer();
}

function handleComposerPointerLeave() {
  if (composerVisible.value) {
    scheduleComposerHide();
  }
}

function handleComposerFocus() {
  lockComposer();
}

function handleComposerBlur() {
  unlockComposer();
}

function handleDraftInput(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  localDraft.value = target.value;
  if (usingTemporaryChat.value || chatModeActive.value) {
    fairyChatStore.setDraft(localDraft.value);
  }
}

async function handleComposerEnter(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) {
    return;
  }

  event.preventDefault();
  await handleSend();
}

const { shellRef, handlePointerDown, shouldSuppressClick } = useFairyDragController({
  fairyStore,
  hideOverlay: () => {
    hideBubbleAndComposer();
    sessionPickerOpen.value = false;
  },
  onDragStateChange: setDragging,
  useNativeWindowDrag: () => isNativeFairyWindow.value,
  onDragCommitted: handleDragCommitted,
});

watch(
  () => [composerVisible.value, bubbleVisible.value, sessionPickerOpen.value, dragging.value] as const,
  () => {
    syncInteractivePinnedState();
  },
  { immediate: true },
);

useFairyIdleController({
  enabled: computed(() => fairyStore.enabled),
  onActivity: markGlobalActivity,
  onIdleCheck: tryIdleChat,
  onWindowPointerDown: handleWindowPointerDown,
});

void ensureSessionListLoaded();
void ensureModelSourceLoaded();
syncBubbleWithTemporaryChat();

watch(
  () => [fairyStore.enabled, fairyStore.petId] as const,
  () => {
    void ensurePetLoaded();
  },
  { immediate: true },
);

watch(
  () => fairyChatStore.selected,
  (selected) => {
    if (selected) {
      selectedSessionId.value = fairyChatStore.temporaryChatOption.sessionId;
      syncBubbleWithTemporaryChat();
    }
  },
  { immediate: true },
);

watch(
  () => fairyChatStore.latestAssistantPreview,
  () => {
    if (usingTemporaryChat.value) {
      syncBubbleWithTemporaryChat();
    }
  },
  { immediate: true },
);

watch(
  () => workbenchStore.sessions,
  async (options) => {
    if (!selectedSessionId.value && options.length > 0) {
      selectedSessionId.value = options[0]?.sessionId ?? '';
    }

    if (usingTemporaryChat.value) {
      return;
    }

    const exists = options.some((item) => item.sessionId === selectedSessionId.value);
    if (!exists) {
      selectedSessionId.value = options[0]?.sessionId ?? '';
    }

    if (selectedSessionId.value && !workbenchStore.activeSessionId) {
      await workbenchStore.loadSession(selectedSessionId.value);
    }
  },
  { immediate: true },
);

watch(
  () => [workbenchStore.activeSessionId, selectedSessionId.value, fairyChatStore.selected] as const,
  () => {
    if (fairyChatStore.selected || workbenchStore.activeSessionId !== selectedSessionId.value) {
      lastWorkbenchAssistantMessageId.value = '';
      return;
    }

    lastWorkbenchAssistantMessageId.value = findLatestCompletedAssistantMessage(workbenchStore.messages)?.id ?? '';
  },
  { immediate: true },
);

watch(
  () => fairyChatStore.temporarySessionSummary,
  (session) => {
    if (!session && usingTemporaryChat.value) {
      selectedSessionId.value = workbenchStore.sessions[0]?.sessionId ?? '';
    }
  },
);

watch(
  () => fairyChatStore.messages,
  () => {
    if (usingTemporaryChat.value) {
      syncBubbleWithTemporaryChat();
    }
  },
  { deep: true, immediate: true },
);

watch(
  () => workbenchStore.sending,
  (sending, previousSending) => {
    if (sending || !previousSending) {
      return;
    }

    if (chatModeActive.value || usingTemporaryChat.value) {
      return;
    }

    if (!workbenchStore.activeSessionId || workbenchStore.activeSessionId !== selectedSessionId.value) {
      return;
    }

    const lastAssistantMessage = findLatestCompletedAssistantMessage(workbenchStore.messages);
    const nextAssistantId = lastAssistantMessage?.id ?? '';
    if (!nextAssistantId || nextAssistantId === lastWorkbenchAssistantMessageId.value) {
      return;
    }

    lastWorkbenchAssistantMessageId.value = nextAssistantId;
    showBubble(lastAssistantMessage!.content);
    showComposer();
  },
);

watch(
  () => fairyChatStore.errorMessage,
  (message) => {
    if (message) {
      showBubble(message);
      showComposer();
    }
  },
);

onMounted(() => {
  if (!isNativeFairyWindow.value || typeof window === 'undefined') {
    return;
  }

  window.desktopFairy?.setFairyMouseIgnore?.(true);
  window.addEventListener('mousemove', handleNativeMouseMove);
  window.addEventListener('mouseleave', handleNativeMouseLeave);
});

onBeforeUnmount(() => {
  if (!isNativeFairyWindow.value || typeof window === 'undefined') {
    return;
  }

  window.removeEventListener('mousemove', handleNativeMouseMove);
  window.removeEventListener('mouseleave', handleNativeMouseLeave);
  window.desktopFairy?.setFairyMouseIgnore?.(true);
});
</script>

<template>
  <div v-if="fairyStore.enabled" class="floating-fairy-root" :class="{ 'floating-fairy-root--native': isNativeFairyWindow }" :style="rootStyle">
    <div ref="shellRef" class="floating-fairy-shell" :class="{ 'floating-fairy-shell--dragging': dragging }" :style="shellStyle">
      <FairyBubble
        :visible="bubbleVisible"
        :content="previewReply"
        :label="usingTemporaryChat ? selectedSessionTitle : uiText.chat.speakerAssistant"
        :is-error="!!errorMessage || !!fairyChatStore.errorMessage"
        :bubble-style="bubbleStyle"
        @pointerenter="handleBubblePointerEnter"
        @pointerleave="handleBubblePointerLeave"
      />

      <div class="floating-fairy-glow"></div>
      <div class="floating-fairy-shadow"></div>

      <FairyAvatar
        :loading="loading"
        :has-sprite="!!pet && !!currentFrame"
        :sprite-wrapper-style="spriteWrapperStyle"
        :sprite-style="spriteStyle"
        @pointerdown="handlePointerDown"
        @click="handleAvatarClick"
      />

      <FairyComposer
        :visible="composerVisible"
        :session-options="sessionOptions"
        :selected-session-id="selectedSessionId"
        :selected-session-title="selectedSessionTitle"
        :local-draft="localDraft"
        :input-placeholder="inputPlaceholder"
        :current-sending="currentSending"
        :temporary-chat-hint="temporaryChatHint"
        :using-temporary-chat="usingTemporaryChat"
        :can-click-send="canClickSend"
        :status-message="statusMessage"
        :session-picker-open="sessionPickerOpen"
        :is-temporary-session="fairyChatStore.isTemporaryChatSession"
        @toggle-session-picker="toggleSessionPicker"
        @choose-session="chooseSession"
        @refresh-temporary-session="refreshTemporarySession"
        @draft-input="handleDraftInput"
        @composer-enter="handleComposerEnter"
        @composer-focus="handleComposerFocus"
        @composer-blur="handleComposerBlur"
        @send="handleSend"
        @stop="handleStop"
        @pointerenter="handleComposerPointerEnter"
        @pointerleave="handleComposerPointerLeave"
      />
    </div>
  </div>
</template>
