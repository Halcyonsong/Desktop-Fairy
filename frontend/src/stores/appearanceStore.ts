import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'jetbrains';

const STORAGE_KEY = 'desktop-fairy.appearance.v1';
const DEFAULT_THEME_MODE: ThemeMode = 'light';
const DEFAULT_GLOBAL_SERIF_FONT_ENABLED = false;

interface AppearanceSnapshot {
  globalSerifFontEnabled: boolean;
  themeMode: ThemeMode;
}

function buildDefaultSnapshot(): AppearanceSnapshot {
  return {
    globalSerifFontEnabled: DEFAULT_GLOBAL_SERIF_FONT_ENABLED,
    themeMode: DEFAULT_THEME_MODE,
  };
}

function normalizeSnapshot(snapshot: Partial<AppearanceSnapshot> | null | undefined): AppearanceSnapshot {
  const fallback = buildDefaultSnapshot();
  return {
    globalSerifFontEnabled: Boolean(snapshot?.globalSerifFontEnabled),
    themeMode:
      snapshot?.themeMode === 'dark' || snapshot?.themeMode === 'jetbrains' || snapshot?.themeMode === 'light'
        ? snapshot.themeMode
        : fallback.themeMode,
  };
}

function loadSnapshot(): AppearanceSnapshot {
  if (typeof window === 'undefined') {
    return buildDefaultSnapshot();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return buildDefaultSnapshot();
    }

    return normalizeSnapshot(JSON.parse(raw) as Partial<AppearanceSnapshot>);
  } catch {
    return buildDefaultSnapshot();
  }
}

export const useAppearanceStore = defineStore('appearance', () => {
  const snapshot = loadSnapshot();
  const globalSerifFontEnabled = ref(snapshot.globalSerifFontEnabled);
  const themeMode = ref<ThemeMode>(snapshot.themeMode);
  const syncInitialized = ref(false);

  const currentFontMode = computed(() => (globalSerifFontEnabled.value ? 'serif-cn' : 'default'));

  function applySnapshot(nextSnapshot: AppearanceSnapshot) {
    globalSerifFontEnabled.value = nextSnapshot.globalSerifFontEnabled;
    themeMode.value = nextSnapshot.themeMode;
  }

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

    const root = document.documentElement;
    const fontFamilyValue =
      currentFontMode.value === 'serif-cn' ? 'var(--font-family-serif-cn)' : 'var(--font-family-default)';

    root.dataset.fontMode = currentFontMode.value;
    root.dataset.themeMode = themeMode.value;
    root.style.setProperty('--font-family-app', fontFamilyValue);
  }

  function syncFromStorage() {
    applySnapshot(loadSnapshot());
    applyAppearance();
  }

  function initializeAppearance() {
    applyAppearance();
  }

  function initializeSync() {
    if (syncInitialized.value || typeof window === 'undefined') {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }
      syncFromStorage();
    };

    window.addEventListener('storage', handleStorage);
    syncInitialized.value = true;
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

  return {
    globalSerifFontEnabled,
    themeMode,
    currentFontMode,
    setThemeMode,
    setGlobalSerifFontEnabled,
    toggleGlobalSerifFont,
    initializeAppearance,
    initializeSync,
    syncFromStorage,
  };
});
