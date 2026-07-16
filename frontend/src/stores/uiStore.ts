import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ViewMode } from '@/types/chat';

export const useUiStore = defineStore('ui', () => {
  const viewMode = ref<ViewMode>('chat');

  function switchView(mode: ViewMode) {
    viewMode.value = mode;
  }

  return {
    viewMode,
    switchView,
  };
});
