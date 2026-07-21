import { watch } from 'vue';
import type { Ref } from 'vue';
import type { ChatMessage } from '@/types/chat';
import type { useFairyChatStore } from '@/stores/fairyChatStore';
import type { useFairyStore } from '@/stores/fairyStore';
import type { useWorkbenchStore } from '@/stores/workbenchStore';

interface FairyWatcherOptions {
  fairyStore: ReturnType<typeof useFairyStore>;
  fairyChatStore: ReturnType<typeof useFairyChatStore>;
  workbenchStore: ReturnType<typeof useWorkbenchStore>;

  // 本地状态
  pet: Ref<{ defaultAnimation: string } | null>;
  dragging: Ref<boolean>;
  selectedSessionId: Ref<string>;
  lastWorkbenchAssistantMessageId: Ref<string>;
  localDraft: Ref<string>;

  // 计算属性
  usingTemporaryChat: Ref<boolean>;
  temporaryChatContextActive: Ref<boolean>;
  idleChatEnabled: Ref<boolean>;
  animationName: Ref<string>;

  // 回调
  syncBubbleWithTemporaryChat: () => boolean;
  syncDraftFromStore: () => void;
  showBubble: (content: string) => void;
  showComposer: () => void;
  findLatestCompletedAssistantMessage: (messages: ChatMessage[]) => ChatMessage | null | undefined;
  ensurePetLoaded: () => Promise<void>;
  tryIdleChat: () => Promise<void>;
  markGlobalActivity: () => void;

  // 动画控制
  PET_ANIMATIONS: Record<string, string>;
  safeSetAnimation: (name: string) => void;
  triggerTypingWithCycles: () => void;
  setStatusMessage: (message: string) => void;

  // 调度
  scheduleIdleCheck: () => void;
}

/**
 * 从 FloatingFairy.vue 提取的全部 watcher 逻辑。
 *
 * 包含：
 *   - pet 加载监听
 *   - 发送状态/流式阶段 → 精灵动作切换
 *   - 临时闲聊错误 → requestFailed 动作
 *   - draft 同步
 *   - selected 会话切换 → bubble 同步
 *   - workbench 会话列表变化 → 默认选中
 *   - assistant 消息更新 → bubble 展示
 *   - 发送完成 → bubble + composer 展示
 *   - 错误消息 → bubble 展示
 */
export function useFairyWatcherOrchestrator(options: FairyWatcherOptions) {
  const {
    fairyStore,
    fairyChatStore,
    workbenchStore,
    pet,
    dragging,
    selectedSessionId,
    lastWorkbenchAssistantMessageId,
    usingTemporaryChat,
    temporaryChatContextActive,
    idleChatEnabled,
    animationName,
    syncBubbleWithTemporaryChat,
    syncDraftFromStore,
    showBubble,
    showComposer,
    findLatestCompletedAssistantMessage,
    ensurePetLoaded,
    tryIdleChat,
    markGlobalActivity,
    PET_ANIMATIONS,
    safeSetAnimation,
    triggerTypingWithCycles,
    setStatusMessage,
    scheduleIdleCheck,
  } = options;

  // pet 加载
  watch(
    () => [fairyStore.enabled, fairyStore.petId] as const,
    () => {
      void ensurePetLoaded();
    },
    { immediate: true },
  );

  // 发送状态和流式阶段 → 精灵动作切换
  watch(
    () => [
      usingTemporaryChat.value,
      fairyChatStore.streamPhase,
      workbenchStore.sending,
      workbenchStore.latestReasoningText,
    ] as const,
    ([isTemporaryChat, phase, isWorkbenchSending, workbenchReasoning]) => {
      if (dragging.value) {
        return;
      }

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

      // typing 动作特殊处理
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

  // 临时闲聊错误 → requestFailed 动作
  watch(
    () => fairyChatStore.errorMessage,
    (error) => {
      if (!error) {
        return;
      }
      safeSetAnimation(PET_ANIMATIONS.requestFailed);
    },
  );

  // draft 同步
  watch(
    () => fairyChatStore.draft,
    () => {
      if (temporaryChatContextActive.value) {
        syncDraftFromStore();
      }
    },
  );

  // selected 会话切换 → bubble 同步
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

  // assistant 消息更新 → bubble 展示
  watch(
    () => fairyChatStore.latestAssistantPreview,
    () => {
      if (usingTemporaryChat.value && !dragging.value) {
        syncBubbleWithTemporaryChat();
      }
    },
    { immediate: true },
  );

  // workbench 会话列表变化 → 默认选中
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

  // workbench assistant 消息变化跟踪
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

  // 临时会话过期清理
  watch(
    () => fairyChatStore.temporarySessionSummary,
    (session) => {
      if (!session && usingTemporaryChat.value) {
        selectedSessionId.value = workbenchStore.sessions[0]?.sessionId ?? '';
      }
    },
  );

  // fairyChat 消息变化 → bubble 同步
  watch(
    () => fairyChatStore.messages,
    () => {
      if (usingTemporaryChat.value && !dragging.value) {
        syncBubbleWithTemporaryChat();
      }
    },
    { deep: true, immediate: true },
  );

  // workbench 发送完成 → bubble + composer 展示
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

  // 错误消息 → bubble 展示
  watch(
    () => fairyChatStore.errorMessage,
    (message) => {
      if (message) {
        showBubble(message);
        showComposer();
      }
    },
  );
}
