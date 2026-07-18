<script setup lang="ts">
import type { CSSProperties } from 'vue';

const props = defineProps<{
  loading: boolean;
  hasSprite: boolean;
  spriteWrapperStyle: CSSProperties;
  spriteStyle: CSSProperties;
}>();

const emit = defineEmits<{
  pointerdown: [event: PointerEvent];
  click: [event: MouseEvent];
}>();
</script>

<template>
  <button
    class="floating-fairy-avatar"
    data-fairy-interactive="true"
    type="button"
    :disabled="props.loading"
    @pointerdown.stop="emit('pointerdown', $event)"
    @click.stop="emit('click', $event)"
  >
    <div v-if="props.loading" class="floating-fairy-skeleton"></div>
    <div v-else-if="props.hasSprite" class="floating-fairy-sprite-shell">
      <div class="floating-fairy-sprite-wrapper" :style="props.spriteWrapperStyle">
        <div class="floating-fairy-sprite" :style="props.spriteStyle"></div>
      </div>
    </div>
    <div v-else class="floating-fairy-skeleton"></div>
  </button>
</template>
