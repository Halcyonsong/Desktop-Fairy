<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  content: string;
  label: string;
  isError?: boolean;
  bubbleStyle?: Record<string, string>;
}>();

const emit = defineEmits<{
  pointerenter: [];
  pointerleave: [];
}>();
</script>

<template>
  <Transition name="floating-fairy-fade">
    <div
      v-if="props.visible && props.content"
      class="floating-fairy-bubble"
      data-fairy-interactive="true"
      role="status"
      aria-live="polite"
      :class="{ 'floating-fairy-bubble--error': !!props.isError }"
      :style="props.bubbleStyle"
      @pointerenter="emit('pointerenter')"
      @pointerleave="emit('pointerleave')"
    >
      <strong>{{ props.label }}</strong>
      <div class="floating-fairy-bubble__body">{{ props.content }}</div>
    </div>
  </Transition>
</template>
