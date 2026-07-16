<script setup lang="ts">
import { computed } from 'vue';
import MathFormula from '@/components/chat/MathFormula.vue';
import { parseMessageBlocks } from '@/utils/messageRichText';
import type { MessageInlineToken } from '@/utils/messageRichText';

const props = defineProps<{
  content: string;
}>();

const blocks = computed(() => parseMessageBlocks(props.content || '...'));

function inlineKey(token: MessageInlineToken, index: number) {
  return `${token.type}-${index}-${token.content.slice(0, 16)}`;
}
</script>

<template>
  <div class="message-rich-content">
    <template v-for="(block, blockIndex) in blocks" :key="`block-${blockIndex}`">
      <div v-if="block.type === 'paragraph'" class="message-paragraph">
        <template v-for="(segment, segmentIndex) in block.segments" :key="inlineKey(segment, segmentIndex)">
          <span v-if="segment.type === 'text'" class="message-inline-text">{{ segment.content }}</span>
          <strong v-else-if="segment.type === 'bold'" class="message-inline-strong">{{ segment.content }}</strong>
          <em v-else-if="segment.type === 'italic'" class="message-inline-em">{{ segment.content }}</em>
          <code v-else-if="segment.type === 'code'" class="message-inline-code">{{ segment.content }}</code>
          <MathFormula v-else-if="segment.type === 'math'" :formula="segment.content" />
          <br v-else />
        </template>
      </div>

      <component :is="`h${block.level}`" v-else-if="block.type === 'heading'" class="message-heading">
        <template v-for="(segment, segmentIndex) in block.segments" :key="inlineKey(segment, segmentIndex)">
          <span v-if="segment.type === 'text'" class="message-inline-text">{{ segment.content }}</span>
          <strong v-else-if="segment.type === 'bold'" class="message-inline-strong">{{ segment.content }}</strong>
          <em v-else-if="segment.type === 'italic'" class="message-inline-em">{{ segment.content }}</em>
          <code v-else-if="segment.type === 'code'" class="message-inline-code">{{ segment.content }}</code>
          <MathFormula v-else-if="segment.type === 'math'" :formula="segment.content" />
          <br v-else />
        </template>
      </component>

      <div v-else-if="block.type === 'divider'" class="message-divider" aria-hidden="true"></div>

      <div v-else-if="block.type === 'code'" class="message-code-block">
        <div class="message-code-block__meta">{{ block.language || 'code' }}</div>
        <pre><code>{{ block.content }}</code></pre>
      </div>

      <div v-else-if="block.type === 'math'" class="message-math-block">
        <MathFormula :formula="block.content" block />
      </div>

      <div v-else class="message-table-wrap">
        <table class="message-table">
          <thead>
            <tr>
              <th v-for="(cell, cellIndex) in block.header" :key="`header-${cellIndex}`">
                <template v-for="(segment, segmentIndex) in cell" :key="inlineKey(segment, segmentIndex)">
                  <span v-if="segment.type === 'text'" class="message-inline-text">{{ segment.content }}</span>
                  <strong v-else-if="segment.type === 'bold'" class="message-inline-strong">{{ segment.content }}</strong>
                  <em v-else-if="segment.type === 'italic'" class="message-inline-em">{{ segment.content }}</em>
                  <code v-else-if="segment.type === 'code'" class="message-inline-code">{{ segment.content }}</code>
                  <MathFormula v-else-if="segment.type === 'math'" :formula="segment.content" />
                  <br v-else />
                </template>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in block.rows" :key="`row-${rowIndex}`">
              <td v-for="(cell, cellIndex) in row" :key="`cell-${rowIndex}-${cellIndex}`">
                <template v-for="(segment, segmentIndex) in cell" :key="inlineKey(segment, segmentIndex)">
                  <span v-if="segment.type === 'text'" class="message-inline-text">{{ segment.content }}</span>
                  <strong v-else-if="segment.type === 'bold'" class="message-inline-strong">{{ segment.content }}</strong>
                  <em v-else-if="segment.type === 'italic'" class="message-inline-em">{{ segment.content }}</em>
                  <code v-else-if="segment.type === 'code'" class="message-inline-code">{{ segment.content }}</code>
                  <MathFormula v-else-if="segment.type === 'math'" :formula="segment.content" />
                  <br v-else />
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
