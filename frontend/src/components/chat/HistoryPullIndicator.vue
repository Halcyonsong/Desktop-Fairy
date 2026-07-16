<script setup lang="ts">
defineProps<{
  pullDistance: number;
  text: string;
}>();
</script>

<template>
  <div class="pull-history-indicator" :style="{ height: `${pullDistance}px` }">
    <span>{{ text }}</span>
  </div>
</template>
