<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

const props = defineProps<{
  formula: string;
  block?: boolean;
}>();

/**
 * KaTeX 运行时按需加载：
 *   - 不在组件顶层静态 import 'katex'
 *   - 只有真正渲染到数学公式组件时才动态 import('katex')
 *   - CSS 仍保留全局引入，避免首次渲染样式闪烁
 */
let katexRuntimePromise: Promise<typeof import('katex')> | null = null;

async function loadKatexRuntime() {
  if (!katexRuntimePromise) {
    katexRuntimePromise = import('katex');
  }
  return katexRuntimePromise;
}

const rendered = ref('');

async function renderFormula() {
  const source = props.formula?.trim() ?? '';
  if (!source) {
    rendered.value = '';
    return;
  }

  try {
    const katex = await loadKatexRuntime();
    rendered.value = katex.renderToString(source, {
      throwOnError: false,
      displayMode: Boolean(props.block),
      strict: 'ignore',
      output: 'html',
      trust: false,
    });
  } catch {
    rendered.value = source;
  }
}

onMounted(() => {
  void renderFormula();
});

watch(
  () => [props.formula, props.block] as const,
  () => {
    void renderFormula();
  },
);
</script>

<template>
  <span v-if="!block" class="message-math-inline" v-html="rendered || formula"></span>
  <div v-else class="message-math-rendered-block" v-html="rendered || formula"></div>
</template>
