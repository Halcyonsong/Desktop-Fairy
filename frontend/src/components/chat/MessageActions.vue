<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { Check, Copy, RotateCcw, Trash2 } from '@lucide/vue';
import { UI_TIMING } from '@/config/uiConstants';
import { uiText } from '@/config/uiText';
import { copyText } from '@/utils/clipboard';

const props = defineProps<{
  showRollback: boolean;
  showDelete: boolean;
  sending: boolean;
  content: string;
}>();

const emit = defineEmits<{
  rollback: [];
  delete: [];
}>();

// 复制反馈状态
const copied = ref(false);
let resetTimer: ReturnType<typeof setTimeout> | null = null;

const copyButtonTitle = computed(() =>
  copied.value ? uiText.chat.copied : uiText.chat.copy,
);

async function handleCopy() {
  if (!props.content) {
    return;
  }
  const success = await copyText(props.content);
  if (success) {
    copied.value = true;
    if (resetTimer) {
      clearTimeout(resetTimer);
    }
    resetTimer = setTimeout(() => {
      copied.value = false;
      resetTimer = null;
    }, UI_TIMING.copyFeedbackResetMs);
  }
}

// 组件卸载时清理复制反馈定时器，避免卸载后回调仍执行
onBeforeUnmount(() => {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
});
</script>

<template>
  <div class="message-actions">
    <button
      class="message-action-button"
      :class="{ 'message-action-button--success': copied }"
      type="button"
      :title="copyButtonTitle"
      @click="handleCopy"
    >
      <Check v-if="copied" :size="15" />
      <Copy v-else :size="15" />
    </button>
    <button
      v-if="showRollback"
      class="message-action-button"
      type="button"
      :title="uiText.chat.rollbackLatestRound"
      :disabled="sending"
      @click="emit('rollback')"
    >
      <RotateCcw :size="15" />
    </button>
    <button
      v-if="showDelete"
      class="message-action-button message-action-button--danger"
      type="button"
      :title="uiText.chat.deleteLatestRound"
      :disabled="sending"
      @click="emit('delete')"
    >
      <Trash2 :size="15" />
    </button>
  </div>
</template>
