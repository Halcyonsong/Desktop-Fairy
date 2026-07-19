import type { Ref } from 'vue';
import type { useFairyChatStore } from '@/stores/fairyChatStore';
import type { PetDefinition } from '@/types/pet';

interface UseFairyVisibilityControllerOptions {
  fairyChatStore: ReturnType<typeof useFairyChatStore>;
  bubbleVisible: Ref<boolean>;
  composerVisible: Ref<boolean>;
  sessionPickerOpen: Ref<boolean>;
  chatModeActive: Ref<boolean>;
  shouldSuppressClick: () => boolean;
  showComposer: () => void;
  hideBubbleAndComposer: () => void;
  showLatestReply: () => Promise<void>;
  safeSetAnimation: (animationName: string) => void;
  greetAnimation: string;
  animationName: Ref<string>;
  pet: Ref<PetDefinition | null>;
  setStatusMessage: (message: string) => void;
}

/**
 * 精灵可见性与点击行为编排控制器。
 *
 * 设计目标：
 *   - 把点击头像、切换会话下拉、窗口外点击收起等 UI 编排逻辑从 FloatingFairy.vue 中抽离
 *   - 与 Bubble/Composer 的底层显示控制解耦：这里负责“何时触发”，底层 controller 负责“如何隐藏/显示”
 */
export function useFairyVisibilityController(options: UseFairyVisibilityControllerOptions) {
  const {
    fairyChatStore,
    bubbleVisible,
    composerVisible,
    sessionPickerOpen,
    chatModeActive,
    shouldSuppressClick,
    showComposer,
    hideBubbleAndComposer,
    showLatestReply,
    safeSetAnimation,
    greetAnimation,
    animationName,
    pet,
    setStatusMessage,
  } = options;

  function toggleSessionPicker() {
    sessionPickerOpen.value = !sessionPickerOpen.value;
    if (sessionPickerOpen.value) {
      showComposer();
    }
  }

  async function handleAvatarClick() {
    if (shouldSuppressClick()) {
      return;
    }

    // 点击角色时触发打招呼动作（一次性，结束后自动回到 idle）
    safeSetAnimation(greetAnimation);

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

  function handleWindowPointerDown(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (sessionPickerOpen.value && !target.closest('.floating-fairy-session-picker-anchor')) {
      sessionPickerOpen.value = false;
    }
  }

  function handleDragHideOverlay() {
    hideBubbleAndComposer();
    sessionPickerOpen.value = false;
  }

  return {
    toggleSessionPicker,
    handleAvatarClick,
    handleWindowPointerDown,
    handleDragHideOverlay,
  };
}
