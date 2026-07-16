import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const STORAGE_KEY = 'desktop-fairy.chat-preferences.v1';

interface ChatPreferencesSnapshot {
  temperatureInput: string;
  maxTokensInput: string;
}

function loadSnapshot(): ChatPreferencesSnapshot {
  if (typeof window === 'undefined') {
    return { temperatureInput: '', maxTokensInput: '' };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { temperatureInput: '', maxTokensInput: '' };
    }

    const parsed = JSON.parse(raw) as Partial<ChatPreferencesSnapshot>;
    return {
      temperatureInput: typeof parsed.temperatureInput === 'string' ? parsed.temperatureInput : '',
      maxTokensInput: typeof parsed.maxTokensInput === 'string' ? parsed.maxTokensInput : '',
    };
  } catch {
    return { temperatureInput: '', maxTokensInput: '' };
  }
}

export const useChatPreferencesStore = defineStore('chatPreferences', () => {
  const snapshot = loadSnapshot();
  const temperatureInput = ref(snapshot.temperatureInput);
  const maxTokensInput = ref(snapshot.maxTokensInput);

  const hasCustomRuntimeSettings = computed(() => Boolean(temperatureInput.value.trim() || maxTokensInput.value.trim()));

  function persist() {
    if (typeof window === 'undefined') {
      return;
    }

    const payload: ChatPreferencesSnapshot = {
      temperatureInput: temperatureInput.value,
      maxTokensInput: maxTokensInput.value,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function setTemperatureInput(value: string) {
    temperatureInput.value = value;
    persist();
  }

  function setMaxTokensInput(value: string) {
    maxTokensInput.value = value;
    persist();
  }

  function resetRuntimeSettings() {
    temperatureInput.value = '';
    maxTokensInput.value = '';
    persist();
  }

  return {
    temperatureInput,
    maxTokensInput,
    hasCustomRuntimeSettings,
    setTemperatureInput,
    setMaxTokensInput,
    resetRuntimeSettings,
  };
});
