import { defineStore } from 'pinia';
import { ref } from 'vue';

export type WindowMode = 'workbench' | 'fairy';

export const useWindowModeStore = defineStore('window-mode', () => {
  const windowMode = ref<WindowMode>('workbench');

  function setWindowMode(mode: WindowMode) {
    windowMode.value = mode;
  }

  return {
    windowMode,
    setWindowMode,
  };
});
