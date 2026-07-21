import { computed, ref } from 'vue';
import { FAIRY_TIMING } from '@/config/uiConstants';
import { stripControlMarkers } from '@/utils/chatMessages';
import type { ChatMessage } from '@/types/chat';

// 气泡自动隐藏时间集中到 config/uiConstants.ts，便于统一调整 UI 节奏
const AUTO_HIDE_MS = FAIRY_TIMING.bubbleAutoHideMs;

/**
 * 从原始消息内容中提取最后一轮的纯文本：
 *   1. 去掉 @Loop@ 头 / @Finish@ 尾（仅未转义的）
 *   2. 按未转义的 @Continue@ / @Missing@ 切分，取最后一段非空内容
 *   3. stripControlMarkers 清理残留标记和转义符
 *
 * 精灵气泡只展示纯文本，不做 markdown 渲染，
 * 因此只取最后一轮正文，避免历史轮次内容刷屏。
 */
function extractLastRoundContent(content: string): string {
  if (!content) {
    return '';
  }

  // 去掉 @Loop@ 头（仅未转义的）
  let body = content.replace(/^\s*@Loop@\s*/, '');
  // 去掉末尾 @Finish@（仅未转义的）
  body = body.replace(/(?<!\/)@Finish@\s*$/, '');
  // 按未转义的 @Continue@ / @Missing@ 切分
  const parts = body.split(/(?<!\/)@(?:Continue|Missing)@/);

  // 从后往前找第一个非空段，作为最后一轮正文
  for (let i = parts.length - 1; i >= 0; i--) {
    const trimmed = parts[i].trim();
    if (trimmed) {
      return stripControlMarkers(trimmed);
    }
  }

  // 兜底：切分后全部为空，直接清理整段
  return stripControlMarkers(content);
}

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
