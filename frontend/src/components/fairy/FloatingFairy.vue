<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import FairyAvatar from '@/components/fairy/FairyAvatar.vue';
import FairyBubble from '@/components/fairy/FairyBubble.vue';
import FairyComposer from '@/components/fairy/FairyComposer.vue';
import { useFairyBootstrap } from '@/components/fairy/controllers/useFairyBootstrap';
import { useFairyComposerController } from '@/components/fairy/controllers/useFairyComposerController';
import { useFairyConversationController } from '@/components/fairy/controllers/useFairyConversationController';
import { useFairyMotionOrchestrator } from '@/components/fairy/controllers/useFairyMotionOrchestrator';
import { useFairyVisibilityController } from '@/components/fairy/controllers/useFairyVisibilityController';
import { uiText } from '@/config/uiText';
import { loadPetDefinition } from '@/modules/fairy/petLoader';
import { useFairyBubbleController } from '@/modules/fairy/useFairyBubbleController';
import { useFairyDragController } from '@/modules/fairy/useFairyDragController';
import { useFairyIdleController } from '@/modules/fairy/useFairyIdleController';
import { useFairyMouseIgnoreController } from '@/modules/fairy/useFairyMouseIgnoreController';
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
const selectedSessionId = ref('');
const lastWorkbenchAssistantMessageId = ref('');

const isNativeFairyWindow = computed(() => props.windowMode === 'fairy');
const { animationName, currentFrame, setAnimation } = usePetPlayer(pet);
const { dragging, statusMessage, setDragging, setStatusMessage } = useFairyMotionController(pet, animationName);

// ===== 精灵动作触发逻辑 =====
// 动作名常量，避免拼写错误
const PET_ANIMATIONS = {
  idle: 'idle',
  dragRight: 'dragRight',
  dragLeft: 'dragLeft',
  greet: 'greet',
  hover: 'hover',
  requestFailed: 'requestFailed',
  thinking: 'thinking',
  typing: 'typing',
  replying: 'replying',
} as const;

// 拖动方向跟踪
const lastDragDeltaX = ref(0);
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
// 是否处于“临时闲聊上下文”：已进入聊天模式，或当前选中的就是临时闲聊会话
const temporaryChatContextActive = computed(() => chatModeActive.value || usingTemporaryChat.value);
// 自动闲聊是否启用：仅在桌面精灵开启 + 常驻闲聊开启时为 true
const idleChatEnabled = computed(() => fairyStore.enabled && fairyStore.residentChatEnabled);

const {
  safeSetAnimation,
  triggerTypingWithCycles,
} = useFairyMotionOrchestrator({
  pet,
  usingTemporaryChat,
  workbenchSending: computed(() => workbenchStore.sending),
  latestReasoningText: computed(() => workbenchStore.latestReasoningText),
  streamPhase: computed(() => fairyChatStore.streamPhase),
  setAnimation,
  petAnimations: PET_ANIMATIONS,
});

const selectedSessionTitle = computed(() => {
  if (temporaryChatContextActive.value) {
    return fairyChatStore.temporaryChatOption.title;
  }
  const current = combinedSessions.value.find((item) => item.sessionId === selectedSessionId.value);
  return current?.title ?? uiText.chat.untitledSession;
});

const inputPlaceholder = computed(() => {
  if (!modelSourceStore.selectedChatModelConfig && usingTemporaryChat.value) {
    return '请先在设置中选择聊天模型';
  }
  if (temporaryChatContextActive.value) {
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
  width: `${Math.round(frameWidth.value * scaleValue.value)}px`,
  height: `${Math.round(frameHeight.value * scaleValue.value)}px`,
}));

const spriteStyle = computed(() => {
  const definition = pet.value;
  const frame = currentFrame.value;
  if (!definition || !frame) {
    return {};
  }

  // 按缩放后的尺寸直接渲染，避免 transform: scale 导致的模糊
  const scaledWidth = Math.round(frame.w * scaleValue.value);
  const scaledHeight = Math.round(frame.h * scaleValue.value);
  const scaledCanvasWidth = Math.round(definition.canvas.width * scaleValue.value);
  const scaledCanvasHeight = Math.round(definition.canvas.height * scaleValue.value);
  const scaledOffsetX = Math.round(frame.x * scaleValue.value);
  const scaledOffsetY = Math.round(frame.y * scaleValue.value);

  return {
    width: `${scaledWidth}px`,
    height: `${scaledHeight}px`,
    backgroundImage: `url(${definition.spritesheetPath})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `${-scaledOffsetX}px ${-scaledOffsetY}px`,
    backgroundSize: `${scaledCanvasWidth}px ${scaledCanvasHeight}px`,
    imageRendering: 'auto' as const,
  };
});

const bubbleStyle = computed(() => ({
  right: `calc(100% + ${bubbleGap.value}px)`,
  bottom: `${bubbleBottom.value}px`,
}));

// 鼠标穿透管理：委托给 composable
const interactivePinned = computed(() => composerVisible.value || bubbleVisible.value || sessionPickerOpen.value);
useFairyMouseIgnoreController({
  isNativeFairyWindow: () => isNativeFairyWindow.value,
  isDragging: () => dragging.value,
  interactivePinned,
});

function syncBubbleWithTemporaryChat() {
  return syncBubbleFromMessages(fairyChatStore.messages);
}

const { ensureSessionListLoaded, ensureModelSourceLoaded } = useFairyBootstrap({
  workbenchStore,
  modelSourceStore,
});

const {
  findLatestCompletedAssistantMessage,
  syncDraftFromStore,
  showLatestReply,
  enterTemporaryChat,
  refreshTemporarySession,
  chooseSession,
} = useFairyConversationController({
  fairyChatStore,
  modelSourceStore,
  workbenchStore,
  localDraft,
  selectedSessionId,
  sessionPickerOpen,
  temporaryChatContextActive,
  syncBubbleWithTemporaryChat,
  showComposer,
  showBubble,
});

const {
  handleSend,
  handleStop,
  handleDraftInput,
  handleDraftUpdate,
  handleComposerEnter,
} = useFairyComposerController({
  fairyChatStore,
  workbenchStore,
  localDraft,
  selectedSessionId,
  temporaryChatContextActive,
  chatModeActive,
  showComposer,
  syncBubbleWithTemporaryChat,
});

const {
  toggleSessionPicker,
  handleAvatarClick,
  handleWindowPointerDown,
  handleDragHideOverlay,
} = useFairyVisibilityController({
  fairyChatStore,
  bubbleVisible,
  composerVisible,
  sessionPickerOpen,
  chatModeActive,
  shouldSuppressClick: () => shouldSuppressClick(),
  showComposer,
  hideBubbleAndComposer,
  showLatestReply,
  safeSetAnimation,
  greetAnimation: PET_ANIMATIONS.greet,
  animationName,
  pet,
  setStatusMessage,
});

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

function markGlobalActivity() {
  fairyChatStore.markUserActivity();
}

async function tryIdleChat() {
  fairyChatStore.pruneTemporarySessionIfExpired();
  const triggered = await fairyChatStore.maybeTriggerIdleChat(idleChatEnabled.value);
  if (triggered) {
    selectedSessionId.value = fairyChatStore.temporaryChatOption.sessionId;
    syncBubbleWithTemporaryChat() || showBubble('桌面精灵刚刚发来了一条闲聊消息。');
    setStatusMessage('已自动触发闲聊模式');
  }

  // 单次 timeout 调度模型：无论这次是否真正触发，都继续安排下一次检测
  // 这样当用户保持空闲时，会以 idleTriggerMs 为间隔持续检查；
  // 一旦用户有活动，useFairyIdleController 内部的 handleActivity 会重置倒计时。
  scheduleIdleCheck();
}

// 鼠标悬停在精灵上时触发 hover 动作（仅在非拖动、非发送状态下）
function handleAvatarHover() {
  if (dragging.value || fairyChatStore.sending) {
    return;
  }
  safeSetAnimation(PET_ANIMATIONS.hover);
}

// 鼠标离开精灵时回到 idle
function handleAvatarLeave() {
  if (dragging.value || fairyChatStore.sending) {
    return;
  }
  safeSetAnimation(PET_ANIMATIONS.idle);
}

function handleDragCommitted() {
  fairyChatStore.markUserActivity();
  setStatusMessage('已记住新的悬浮位置');
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

const { shellRef, handlePointerDown, shouldSuppressClick } = useFairyDragController({
  fairyStore,
  hideOverlay: handleDragHideOverlay,
  onDragStateChange: (isDragging: boolean) => {
    setDragging(isDragging);
    // 拖动开始时不切换动作；拖动结束后回到 idle
    if (!isDragging) {
      safeSetAnimation(PET_ANIMATIONS.idle);
    }
  },
  onDragMove: (deltaX: number) => {
    // 根据水平拖动方向切换动作（向右 > 0，向左 < 0）
    const direction = deltaX > 0 ? PET_ANIMATIONS.dragRight : PET_ANIMATIONS.dragLeft;
    if (direction !== animationName.value) {
      safeSetAnimation(direction);
    }
  },
  useNativeWindowDrag: () => isNativeFairyWindow.value,
  onDragCommitted: handleDragCommitted,
});

const { scheduleIdleCheck } = useFairyIdleController({
  // 只有桌面精灵启用且常驻闲聊开启时，才真正调度自动闲聊 timeout
  enabled: idleChatEnabled,
  idleDelayMs: computed(() => fairyStore.idleTriggerMs),
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

// 监听发送状态和流式阶段，切换精灵动作
// 临时闲聊模式：按 streamPhase 精确切换 typing → thinking → replying → idle
// 工作台模式：根据 sending 和 reasoning 状态切换
// typing 阶段特殊处理：循环 3 次 typing 动作后再切换到下一阶段
watch(
  () => [
    usingTemporaryChat.value,
    fairyChatStore.streamPhase,
    workbenchStore.sending,
    workbenchStore.latestReasoningText,
  ] as const,
  ([isTemporaryChat, phase, isWorkbenchSending, workbenchReasoning], oldValues) => {
    if (dragging.value) {
      return;
    }

    // 判断当前阶段应该播放的动作
    let targetAction: string;
    if (isTemporaryChat) {
      switch (phase) {
        case 'typing':
          targetAction = PET_ANIMATIONS.typing;
          break;
        case 'thinking':
          targetAction = PET_ANIMATIONS.thinking;
          break;
        case 'replying':
          targetAction = PET_ANIMATIONS.replying;
          break;
        case 'idle':
        default:
          targetAction = PET_ANIMATIONS.idle;
          break;
      }
    } else if (isWorkbenchSending) {
      if (workbenchReasoning) {
        targetAction = PET_ANIMATIONS.thinking;
      } else {
        targetAction = PET_ANIMATIONS.replying;
      }
    } else {
      targetAction = PET_ANIMATIONS.idle;
    }

    // typing 动作特殊处理：如果当前不是 typing，触发带 3 次循环的 typing
    if (targetAction === PET_ANIMATIONS.typing && animationName.value !== PET_ANIMATIONS.typing) {
      triggerTypingWithCycles();
      return;
    }

    // 非 typing 动作直接切换
    if (targetAction !== PET_ANIMATIONS.typing && animationName.value !== targetAction) {
      safeSetAnimation(targetAction);
    }
  },
);

// 监听临时闲聊的错误状态：失败时触发 requestFailed 动作
watch(
  () => fairyChatStore.errorMessage,
  (error) => {
    if (!error) {
      return;
    }
    safeSetAnimation(PET_ANIMATIONS.requestFailed);
  },
);

watch(
  () => fairyChatStore.draft,
  () => {
    if (temporaryChatContextActive.value) {
      syncDraftFromStore();
    }
  },
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

    if (temporaryChatContextActive.value) {
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

      <FairyAvatar
        :loading="loading"
        :has-sprite="!!pet && !!currentFrame"
        :sprite-wrapper-style="spriteWrapperStyle"
        :sprite-style="spriteStyle"
        @pointerdown="handlePointerDown"
        @click="handleAvatarClick"
        @pointerenter="handleAvatarHover"
        @pointerleave="handleAvatarLeave"
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
        @draft-update="handleDraftUpdate"
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
