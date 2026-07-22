<script setup lang="ts">
import { computed } from 'vue';
import MathFormula from '@/components/chat/MathFormula.vue';
import InlineSegments from '@/components/chat/InlineSegments.vue';
import { parseMessageBlocks } from '@/utils/messageRichText';

const props = defineProps<{
  content: string;
}>();

const blocks = computed(() => parseMessageBlocks(props.content || '...'));
</script>

<template>
  <div class="message-rich-content">
    <template v-for="(block, blockIndex) in blocks" :key="`block-${blockIndex}`">
      <div v-if="block.type === 'paragraph'" class="message-paragraph">
        <InlineSegments :segments="block.segments" />
      </div>

      <component :is="`h${block.level}`" v-else-if="block.type === 'heading'" class="message-heading">
        <InlineSegments :segments="block.segments" />
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
                <InlineSegments :segments="cell" />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in block.rows" :key="`row-${rowIndex}`">
              <td v-for="(cell, cellIndex) in row" :key="`cell-${rowIndex}-${cellIndex}`">
                <InlineSegments :segments="cell" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
