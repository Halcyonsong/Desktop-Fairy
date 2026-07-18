<script setup lang="ts">
import { computed, watch } from 'vue';
import FloatingFairy from '@/components/fairy/FloatingFairy.vue';
import WorkbenchView from '@/views/WorkbenchView.vue';
import { useWindowModeStore } from '@/stores/windowModeStore';

const windowModeStore = useWindowModeStore();
const windowMode = computed(() => windowModeStore.windowMode);
const isFairyWindow = computed(() => windowMode.value === 'fairy');

watch(
  windowMode,
  (mode) => {
    document.documentElement.dataset.windowMode = mode;
    document.body.dataset.windowMode = mode;
  },
  { immediate: true },
);
</script>

<template>
  <FloatingFairy v-if="isFairyWindow" :window-mode="windowMode" />
  <WorkbenchView v-else />
</template>
