import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const STORAGE_KEY = 'desktop-fairy.chat-preferences.v1';

interface ChatPreferencesSnapshot {
  temperatureInput: string;
  maxTokensInput: string;
  systemPrompt: string;
  toolCallEnabled: boolean;
}

function emptySnapshot(): ChatPreferencesSnapshot {
  return {
    temperatureInput: '',
    maxTokensInput: '',
    systemPrompt: '',
    toolCallEnabled: false,
  };
}

function loadSnapshot(): ChatPreferencesSnapshot {
  if (typeof window === 'undefined') {
    return emptySnapshot();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptySnapshot();
    }

    const parsed = JSON.parse(raw) as Partial<ChatPreferencesSnapshot>;
    return {
      temperatureInput: typeof parsed.temperatureInput === 'string' ? parsed.temperatureInput : '',
      maxTokensInput: typeof parsed.maxTokensInput === 'string' ? parsed.maxTokensInput : '',
      systemPrompt: typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt : '',
      toolCallEnabled: typeof parsed.toolCallEnabled === 'boolean' ? parsed.toolCallEnabled : false,
    };
  } catch {
    return emptySnapshot();
  }
}

export const useChatPreferencesStore = defineStore('chatPreferences', () => {
  const snapshot = loadSnapshot();
  const temperatureInput = ref(snapshot.temperatureInput);
  const maxTokensInput = ref(snapshot.maxTokensInput);
  const systemPrompt = ref(snapshot.systemPrompt);
  const toolCallEnabled = ref(snapshot.toolCallEnabled);

  const hasCustomRuntimeSettings = computed(() =>
    Boolean(temperatureInput.value.trim() || maxTokensInput.value.trim() || systemPrompt.value.trim()),
  );

  function persist() {
    if (typeof window === 'undefined') {
      return;
    }

    const payload: ChatPreferencesSnapshot = {
      temperatureInput: temperatureInput.value,
      maxTokensInput: maxTokensInput.value,
      systemPrompt: systemPrompt.value,
      toolCallEnabled: toolCallEnabled.value,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function syncFromStorage() {
    const nextSnapshot = loadSnapshot();
    temperatureInput.value = nextSnapshot.temperatureInput;
    maxTokensInput.value = nextSnapshot.maxTokensInput;
    systemPrompt.value = nextSnapshot.systemPrompt;
    toolCallEnabled.value = nextSnapshot.toolCallEnabled;
  }

  function setTemperatureInput(value: string) {
    temperatureInput.value = value;
    persist();
  }

  function setMaxTokensInput(value: string) {
    maxTokensInput.value = value;
    persist();
  }

  function setSystemPrompt(value: string) {
    systemPrompt.value = value;
    persist();
  }

  function setToolCallEnabled(value: boolean) {
    toolCallEnabled.value = value;
    persist();
  }

  function toggleToolCallEnabled() {
    toolCallEnabled.value = !toolCallEnabled.value;
    persist();
  }

  function resetRuntimeSettings() {
    temperatureInput.value = '';
    maxTokensInput.value = '';
    systemPrompt.value = '';
    persist();
  }

  return {
    temperatureInput,
    maxTokensInput,
    systemPrompt,
    toolCallEnabled,
    hasCustomRuntimeSettings,
    syncFromStorage,
    setTemperatureInput,
    setMaxTokensInput,
    setSystemPrompt,
    setToolCallEnabled,
    toggleToolCallEnabled,
    resetRuntimeSettings,
  };
});
