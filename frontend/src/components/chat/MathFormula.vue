<script setup lang="ts">
import { computed } from 'vue';
import katex from 'katex';

const props = defineProps<{
  formula: string;
  block?: boolean;
}>();

const rendered = computed(() => {
  const source = props.formula?.trim() ?? '';
  if (!source) {
    return '';
  }

  try {
    return katex.renderToString(source, {
      throwOnError: false,
      displayMode: Boolean(props.block),
      strict: 'ignore',
      output: 'html',
      trust: false,
    });
  } catch {
    return source;
  }
});
</script>

<template>
  <span v-if="!block" class="message-math-inline" v-html="rendered"></span>
  <div v-else class="message-math-rendered-block" v-html="rendered"></div>
</template>
