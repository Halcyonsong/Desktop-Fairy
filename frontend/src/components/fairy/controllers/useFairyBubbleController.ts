import { onScopeDispose, ref } from 'vue';
import { FAIRY_TIMING } from '@/config/uiConstants';
import type { ChatMessage } from '@/types/chat';

// 气泡自动隐藏时间集中到 config/uiConstants.ts，便于统一调整 UI 节奏
const AUTO_HIDE_MS = FAIRY_TIMING.bubbleAutoHideMs;

/**
 * 从消息内容中提取用于精灵气泡展示的文本。
 *
 * 后端已切换为工具决策（markContinue/markFinish），正文不再包含 @Continue@/@Finish@/@Missing@ 标记，
 * 因此无需标记裁剪或按标记切分轮次。直接返回原始内容即可。
 * 精灵气泡只展示纯文本，不做 markdown 渲染。
 */
function extractLastRoundContent(content: string): string {
  return content || '';
}

export function useFairyBubbleController() {
  const bubbleVisible = ref(false);
  const composerVisible = ref(false);
  const previewReply = ref('');
  const composerLocked = ref(false);

  let bubbleHideTimer: number | null = null;
  let composerHideTimer: number | null = null;

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

  // 作用域销毁时清理 pending 定时器，避免精灵关闭后倒计时回调仍执行
  onScopeDispose(() => {
    clearBubbleHideTimer();
    clearComposerHideTimer();
  });

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
    // 统一清理控制标记 + 取最后一轮，避免气泡展示 @Loop@ 等原始标记
    previewReply.value = extractLastRoundContent(content);
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

    showBubble(latest.content);
    return true;
  }

  return {
    bubbleVisible,
    composerVisible,
    previewReply,
    composerLocked,
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
