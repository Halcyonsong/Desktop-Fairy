import { computed, ref } from 'vue';
import type { ChatMessage } from '@/types/chat';

const AUTO_HIDE_MS = 9000;

export function useFairyBubbleController() {
  const bubbleVisible = ref(false);
  const composerVisible = ref(false);
  const previewReply = ref('');
  const composerLocked = ref(false);

  let bubbleHideTimer: number | null = null;
  let composerHideTimer: number | null = null;

  const hasBubbleContent = computed(() => previewReply.value.trim().length > 0);

  function clearBubbleHideTimer() {
    if (bubbleHideTimer !== null) {
      window.clearTimeout(bubbleHideTimer);
      bubbleHideTimer = null;
    }
  }

  function clearComposerHideTimer() {
    if (composerHideTimer !== null) {
      window.clearTimeout(composerHideTimer);
      composerHideTimer = null;
    }
  }

  function scheduleBubbleHide() {
    clearBubbleHideTimer();
    bubbleHideTimer = window.setTimeout(() => {
      bubbleVisible.value = false;
      bubbleHideTimer = null;
    }, AUTO_HIDE_MS);
  }

  function scheduleComposerHide() {
    clearComposerHideTimer();
    if (composerLocked.value) {
      return;
    }

    composerHideTimer = window.setTimeout(() => {
      if (composerLocked.value) {
        composerHideTimer = null;
        return;
      }

      composerVisible.value = false;
      composerHideTimer = null;
    }, AUTO_HIDE_MS);
  }

  function showBubble(content: string) {
    previewReply.value = content;
    bubbleVisible.value = true;
    scheduleBubbleHide();
  }

  function showComposer() {
    composerVisible.value = true;
    scheduleComposerHide();
  }

  function lockComposer() {
    composerLocked.value = true;
    composerVisible.value = true;
    clearComposerHideTimer();
  }

  function unlockComposer() {
    composerLocked.value = false;
    scheduleComposerHide();
  }

  function hideBubbleAndComposer() {
    bubbleVisible.value = false;
    composerVisible.value = false;
    composerLocked.value = false;
    clearBubbleHideTimer();
    clearComposerHideTimer();
  }

  function syncBubbleFromMessages(messages: ChatMessage[]) {
    const latest = [...messages]
      .reverse()
      .find((message) => message.role === 'assistant' && message.status !== 'sending' && message.content.trim());

    if (!latest?.content?.trim()) {
      return false;
    }

    showBubble(latest.content.trim());
    return true;
  }

  return {
    bubbleVisible,
    composerVisible,
    previewReply,
    composerLocked,
    hasBubbleContent,
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
  };
}
