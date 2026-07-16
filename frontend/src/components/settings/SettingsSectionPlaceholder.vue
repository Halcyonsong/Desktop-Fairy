<script setup lang="ts">
import { Construction } from '@lucide/vue';

defineProps<{
  title: string;
  description: string;
}>();
</script>

<template>
  <section class="settings-placeholder">
    <div class="settings-placeholder__icon">
      <Construction :size="18" />
    </div>
    <div class="settings-placeholder__body">
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </div>
  </section>
</template>
