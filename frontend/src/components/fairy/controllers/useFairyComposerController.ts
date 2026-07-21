import type { Ref } from 'vue';
import type { useFairyChatStore } from '@/stores/fairyChatStore';
import type { useWorkbenchStore } from '@/stores/workbenchStore';

interface UseFairyComposerControllerOptions {
  fairyChatStore: ReturnType<typeof useFairyChatStore>;
  workbenchStore: ReturnType<typeof useWorkbenchStore>;
  localDraft: Ref<string>;
  selectedSessionId: Ref<string>;
  temporaryChatContextActive: Ref<boolean>;
  chatModeActive: Ref<boolean>;
  showComposer: () => void;
  syncBubbleWithTemporaryChat: () => boolean;
}

/**
 * 精灵输入与发送链路控制器。
 *
 * 设计目标：
 *   - 将输入框草稿同步、发送、停止发送等逻辑从 FloatingFairy.vue 中抽离
 *   - 保持行为不变，仅做低风险结构化整理
 *   - 让大组件更专注于可视状态、动画和事件编排
 */
export function useFairyComposerController(options: UseFairyComposerControllerOptions) {
  const {
    fairyChatStore,
    workbenchStore,
    localDraft,
    selectedSessionId,
    temporaryChatContextActive,
    chatModeActive,
    showComposer,
    syncBubbleWithTemporaryChat,
  } = options;

  async function handleSend() {
    const question = localDraft.value.trim();

    showComposer();

    if (temporaryChatContextActive.value) {
      if (!fairyChatStore.canSend) {
        return;
      }

      // 临时闲聊模式下允许发送空消息，触发后端兜底自动回复
      fairyChatStore.setDraft(question);
      try {
        await fairyChatStore.sendTemporaryMessage(
          question,
          chatModeActive.value ? fairyChatStore.triggerSource || 'manual' : 'manual',
        );
        syncBubbleWithTemporaryChat();
      } catch {
        // 错误由 store 状态和气泡承接
      } finally {
        // 无论成功或失败，都清空输入框，避免 sending 恢复后输入框还残留旧内容
        localDraft.value = '';
        fairyChatStore.setDraft('');
      }
      return;
    }

    // 普通会话模式下，空消息不发送
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
    // 精灵窗口禁用系统提示词：传空让后端使用默认提示词
    await workbenchStore.sendMessage(question, { systemPromptOverride: '' });
  }

  function handleStop() {
    if (temporaryChatContextActive.value) {
      fairyChatStore.stopTemporaryChat();
      return;
    }

    void workbenchStore.stopChat();
  }

  function handleDraftInput(event: Event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    localDraft.value = target.value;
    if (temporaryChatContextActive.value) {
      fairyChatStore.setDraft(localDraft.value);
    }
  }

  // 语音输入最终结果回调：直接覆盖 localDraft（与输入框双向绑定）
  function handleDraftUpdate(value: string) {
    localDraft.value = value;
    if (temporaryChatContextActive.value) {
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

  return {
    handleSend,
    handleStop,
    handleDraftInput,
    handleDraftUpdate,
    handleComposerEnter,
  };
}
