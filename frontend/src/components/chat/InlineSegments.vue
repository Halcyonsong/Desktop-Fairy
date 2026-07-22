<script setup lang="ts">
import MathFormula from '@/components/chat/MathFormula.vue';
import type { MessageInlineToken } from '@/utils/messageRichText';

defineProps<{
  segments: MessageInlineToken[];
}>();
</script>

<template>
  <template v-for="(segment, i) in segments" :key="i">
    <span v-if="segment.type === 'text'" class="message-inline-text">{{ segment.content }}</span>
    <strong v-else-if="segment.type === 'bold'" class="message-inline-strong">{{ segment.content }}</strong>
    <em v-else-if="segment.type === 'italic'" class="message-inline-em">{{ segment.content }}</em>
    <code v-else-if="segment.type === 'code'" class="message-inline-code">{{ segment.content }}</code>
    <MathFormula v-else-if="segment.type === 'math'" :formula="segment.content" />
    <br v-else />
  </template>
</template>
