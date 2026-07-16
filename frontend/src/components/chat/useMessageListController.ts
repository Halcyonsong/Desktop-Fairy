import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { MESSAGE_LIST_SCROLL } from '@/config/chatConstants';
import { uiText } from '@/config/uiText';
import type { ChatMessage } from '@/types/chat';

interface MessageListControllerOptions {
  sessionKey: () => string;
  messages: () => ChatMessage[];
  reasoningText: () => string;
  reasoningMessageId: () => string;
  historyPullMessage: () => string;
  loadingMoreHistory: () => boolean;
  sending: () => boolean;
  onLoadMore: () => void;
}

export function useMessageListController(options: MessageListControllerOptions) {
  const messageListRef = ref<HTMLElement | null>(null);
  const pullDistance = ref(0);
  const pullStartY = ref(0);
  const pulling = ref(false);
  const openReasoningMessageId = ref('');
  const showBackToBottom = ref(false);
  const beforeLoadScrollHeight = ref<number | null>(null);
  const wheelPullTimer = ref<number | null>(null);
  const pendingSessionScrollToBottom = ref(true);

  const latestUserMessageId = computed(() => findLatestRoleMessageId('user'));
  const latestAssistantMessageId = computed(() => findLatestRoleMessageId('assistant'));
  const hasReasoningState = computed(() => Boolean(options.reasoningMessageId() || options.reasoningText() || options.sending()));
  const pullReady = computed(() => pullDistance.value >= MESSAGE_LIST_SCROLL.pullTriggerDistance);
  const pullText = computed(() => {
    if (options.loadingMoreHistory()) {
      return uiText.chat.loadingHistory;
    }
    if (pullReady.value) {
      return uiText.chat.releaseToLoad;
    }
    return options.historyPullMessage();
  });

  onMounted(() => {
    void scrollToBottom(false);
    updateBackToBottom();
  });

  watch(
    () => options.sessionKey(),
    () => {
      openReasoningMessageId.value = '';
      pullDistance.value = 0;
      beforeLoadScrollHeight.value = null;
      pendingSessionScrollToBottom.value = true;
    },
  );

  watch(
    () => options.messages().length,
    async () => {
      if (pendingSessionScrollToBottom.value) {
        pendingSessionScrollToBottom.value = false;
        await scrollToBottom(false);
        return;
      }

      if (beforeLoadScrollHeight.value === null) {
        updateBackToBottom();
        return;
      }

      await nextTick();
      const element = messageListRef.value;
      if (element) {
        element.scrollTop = element.scrollHeight - beforeLoadScrollHeight.value;
      }
      beforeLoadScrollHeight.value = null;
      updateBackToBottom();
    },
  );

  watch(
    () => options.sending(),
    (sending, previous) => {
      if (previous && !sending) {
        openReasoningMessageId.value = '';
      }
    },
  );

  watch(
    () => options.reasoningMessageId(),
    (messageId) => {
      if (!options.sending() && openReasoningMessageId.value && messageId !== openReasoningMessageId.value) {
        openReasoningMessageId.value = '';
      }
    },
  );

  function findLatestRoleMessageId(role: ChatMessage['role']) {
    const messages = options.messages();
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === role) {
        return message.id;
      }
    }
    return '';
  }

  function isLatestRoundMessage(message: ChatMessage) {
    return message.id === latestUserMessageId.value || message.id === latestAssistantMessageId.value;
  }

  function isReasoningMessage(message: ChatMessage) {
    if (message.role !== 'assistant' || !hasReasoningState.value) {
      return false;
    }

    if (message.id === options.reasoningMessageId()) {
      return true;
    }

    return message.id === latestAssistantMessageId.value;
  }

  function isReasoningOpen(message: ChatMessage) {
    return openReasoningMessageId.value === message.id;
  }

  function toggleReasoning(message: ChatMessage) {
    openReasoningMessageId.value = isReasoningOpen(message) ? '' : message.id;
  }

  function reasoningLabel(message: ChatMessage) {
    if (options.sending() && message.id === latestAssistantMessageId.value) {
      return uiText.chat.reasoningPending;
    }
    return '';
  }

  function reasoningBody() {
    if (options.reasoningText()) {
      return options.reasoningText();
    }
    return options.sending() ? uiText.chat.reasoningLoading : uiText.chat.reasoningEmpty;
  }

  function updateBackToBottom() {
    const element = messageListRef.value;
    if (!element) {
      showBackToBottom.value = false;
      return;
    }

    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    showBackToBottom.value = distanceToBottom > MESSAGE_LIST_SCROLL.bottomVisibleDistance;
  }

  async function scrollToBottom(smooth = true) {
    await nextTick();
    const element = messageListRef.value;
    if (!element) {
      return;
    }

    element.scrollTo({
      top: element.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
    updateBackToBottom();
  }

  function startLoadMore() {
    const element = messageListRef.value;
    if (!element || options.loadingMoreHistory()) {
      return;
    }

    beforeLoadScrollHeight.value = element.scrollHeight;
    options.onLoadMore();
  }

  function resetWheelPullLater() {
    if (wheelPullTimer.value !== null) {
      window.clearTimeout(wheelPullTimer.value);
    }

    wheelPullTimer.value = window.setTimeout(() => {
      if (!pulling.value && !options.loadingMoreHistory()) {
        pullDistance.value = 0;
      }
      wheelPullTimer.value = null;
    }, 260);
  }

  function handleScroll() {
    updateBackToBottom();

    const element = messageListRef.value;
    if (element && element.scrollTop > 0 && !pulling.value && !options.loadingMoreHistory()) {
      pullDistance.value = 0;
    }
  }

  function handleWheel(event: WheelEvent) {
    const element = messageListRef.value;
    if (!element || element.scrollTop !== 0 || event.deltaY >= 0 || options.loadingMoreHistory()) {
      return;
    }

    event.preventDefault();
    pullDistance.value = Math.min(MESSAGE_LIST_SCROLL.pullMaxDistance, pullDistance.value + Math.abs(event.deltaY) * 0.35);

    if (pullDistance.value >= MESSAGE_LIST_SCROLL.pullTriggerDistance) {
      pullDistance.value = 0;
      startLoadMore();
      return;
    }

    resetWheelPullLater();
  }

  function handlePointerDown(event: PointerEvent) {
    if (messageListRef.value?.scrollTop !== 0 || options.loadingMoreHistory()) {
      return;
    }

    pulling.value = true;
    pullStartY.value = event.clientY;
  }

  function handlePointerMove(event: PointerEvent) {
    if (!pulling.value) {
      return;
    }

    const delta = event.clientY - pullStartY.value;
    if (delta <= 0) {
      pullDistance.value = 0;
      return;
    }

    event.preventDefault();
    pullDistance.value = Math.min(MESSAGE_LIST_SCROLL.pullMaxDistance, delta * 0.55);
  }

  function handlePointerUp() {
    if (!pulling.value) {
      return;
    }

    const shouldLoad = pullDistance.value >= MESSAGE_LIST_SCROLL.pullTriggerDistance;
    pulling.value = false;
    pullDistance.value = 0;

    if (shouldLoad) {
      startLoadMore();
    }
  }

  return {
    messageListRef,
    pullDistance,
    pullText,
    latestUserMessageId,
    latestAssistantMessageId,
    showBackToBottom,
    isLatestRoundMessage,
    isReasoningMessage,
    isReasoningOpen,
    toggleReasoning,
    reasoningLabel,
    reasoningBody,
    scrollToBottom,
    handleScroll,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
