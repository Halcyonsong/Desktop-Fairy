<script setup lang="ts">
import { ChevronDown } from '@lucide/vue';

defineProps<{
  open: boolean;
  label: string;
  title: string;
}>();
</script>

<template>
  <button class="reasoning-inline-toggle" :class="{ 'reasoning-inline-toggle--open': open }" type="button" :title="title" :aria-expanded="open">
    <span v-if="label">{{ label }}</span>
    <ChevronDown :size="14" />
  </button>
</template>
