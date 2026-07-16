<script setup lang="ts">
import { Copy, RotateCcw, Trash2 } from '@lucide/vue';
import { uiText } from '@/config/uiText';

defineProps<{
  showRollback: boolean;
  showDelete: boolean;
  sending: boolean;
}>();

const emit = defineEmits<{
  copy: [];
  rollback: [];
  delete: [];
}>();
</script>

<template>
  <div class="message-actions">
    <button class="message-action-button" type="button" :title="uiText.chat.copy" @click="emit('copy')">
      <Copy :size="15" />
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
