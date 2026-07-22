<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

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

// 渲染请求令牌：每次发起渲染递增，await 后校验是否仍是最新请求，避免竞态与卸载后写入
let renderToken = 0;

async function renderFormula() {
  const token = ++renderToken;
  const source = props.formula?.trim() ?? '';
  if (!source) {
    rendered.value = '';
    return;
  }

  try {
    const katex = await loadKatexRuntime();
    // await 期间若有新请求或组件已卸载，放弃本次写入
    if (token !== renderToken) {
      return;
    }
    rendered.value = katex.renderToString(source, {
      throwOnError: false,
      displayMode: Boolean(props.block),
      strict: 'ignore',
      output: 'html',
      trust: false,
    });
  } catch {
    if (token !== renderToken) {
      return;
    }
    rendered.value = source;
  }
}

onMounted(() => {
  void renderFormula();
});

// 组件卸载时使进行中的渲染失效，避免 await 完成后写入已卸载组件的状态
onBeforeUnmount(() => {
  renderToken++;
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
