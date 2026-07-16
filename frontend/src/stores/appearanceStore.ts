import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'jetbrains';

const STORAGE_KEY = 'desktop-fairy.appearance.v1';

interface AppearanceSnapshot {
  globalSerifFontEnabled: boolean;
  themeMode: ThemeMode;
}

function loadSnapshot(): AppearanceSnapshot {
  if (typeof window === 'undefined') {
    return { globalSerifFontEnabled: false, themeMode: 'light' };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { globalSerifFontEnabled: false, themeMode: 'light' };
    }

    const parsed = JSON.parse(raw) as Partial<AppearanceSnapshot>;
    return {
      globalSerifFontEnabled: Boolean(parsed.globalSerifFontEnabled),
      themeMode:
        parsed.themeMode === 'dark' || parsed.themeMode === 'jetbrains' || parsed.themeMode === 'light'
          ? parsed.themeMode
          : 'light',
    };
  } catch {
    return { globalSerifFontEnabled: false, themeMode: 'light' };
  }
}

export const useAppearanceStore = defineStore('appearance', () => {
  const snapshot = loadSnapshot();
  const globalSerifFontEnabled = ref(snapshot.globalSerifFontEnabled);
  const themeMode = ref<ThemeMode>(snapshot.themeMode);

  const currentFontMode = computed(() => (globalSerifFontEnabled.value ? 'serif-cn' : 'default'));

  function persist() {
    if (typeof window === 'undefined') {
      return;
    }

    const payload: AppearanceSnapshot = {
      globalSerifFontEnabled: globalSerifFontEnabled.value,
      themeMode: themeMode.value,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function applyAppearance() {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dataset.fontMode = currentFontMode.value;
    document.documentElement.dataset.themeMode = themeMode.value;
  }

  function setThemeMode(value: ThemeMode) {
    themeMode.value = value;
    persist();
    applyAppearance();
  }

  function setGlobalSerifFontEnabled(value: boolean) {
    globalSerifFontEnabled.value = value;
    persist();
    applyAppearance();
  }

  function toggleGlobalSerifFont() {
    setGlobalSerifFontEnabled(!globalSerifFontEnabled.value);
  }

  function initializeAppearance() {
    applyAppearance();
  }

  return {
    globalSerifFontEnabled,
    themeMode,
    currentFontMode,
    setThemeMode,
    setGlobalSerifFontEnabled,
    toggleGlobalSerifFont,
    initializeAppearance,
  };
});
