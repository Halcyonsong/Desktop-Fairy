import type { Ref } from 'vue';
import type { ChatMessage } from '@/types/chat';
import type { useFairyChatStore } from '@/stores/fairyChatStore';
import type { useModelSourceStore } from '@/stores/modelSourceStore';
import type { useWorkbenchStore } from '@/stores/workbenchStore';

interface UseFairyConversationControllerOptions {
  fairyChatStore: ReturnType<typeof useFairyChatStore>;
  modelSourceStore: ReturnType<typeof useModelSourceStore>;
  workbenchStore: ReturnType<typeof useWorkbenchStore>;
  localDraft: Ref<string>;
  selectedSessionId: Ref<string>;
  sessionPickerOpen: Ref<boolean>;
  temporaryChatContextActive: Ref<boolean>;
  syncBubbleWithTemporaryChat: () => boolean;
  showComposer: () => void;
  showBubble: (message: string) => void;
}

/**
 * 精灵会话展示/切换控制器。
 *
 * 设计目标：
 *   - 把“临时闲聊 vs 普通会话”的回复展示与切换逻辑从 FloatingFairy.vue 中抽离
 *   - 保持行为不变，只做低风险结构化整理
 *   - 让组件本体更专注于动画、可见性、交互事件绑定
 */
export function useFairyConversationController(options: UseFairyConversationControllerOptions) {
  const {
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
  } = options;

  function findLatestCompletedAssistantMessage(messages: ChatMessage[]) {
    return [...messages]
      .reverse()
      .find((message) => message.role === 'assistant' && message.status === 'completed' && message.content.trim()) ?? null;
  }

  function syncDraftFromStore() {
    localDraft.value = fairyChatStore.draft;
  }

  async function showLatestReply() {
    if (temporaryChatContextActive.value) {
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

  return {
    findLatestCompletedAssistantMessage,
    syncDraftFromStore,
    showLatestReply,
    enterTemporaryChat,
    refreshTemporarySession,
    chooseSession,
  };
}
