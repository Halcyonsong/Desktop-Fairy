import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useSessionFileStore } from '@/stores/sessionFileStore';
import type { SystemPromptEntry, SystemPromptSlot } from '@/types/chat';

const STORAGE_KEY = 'desktop-fairy.chat-preferences.v1';

// 默认的三组自定义提示词（空内容）
function defaultSystemPrompts(): SystemPromptEntry[] {
  return [
    { id: '1', label: '', content: '' },
    { id: '2', label: '', content: '' },
    { id: '3', label: '', content: '' },
  ];
}

interface ChatPreferencesSnapshot {
  temperatureInput: string;
  maxTokensInput: string;
  // 新版：多组系统提示词 + 选中分组
  systemPrompts?: SystemPromptEntry[];
  selectedPromptSlot?: SystemPromptSlot;
  // 旧版字段（向后兼容迁移用，读取后清除）
  systemPrompt?: string;
  systemPromptEnabled?: boolean;
  toolCallEnabled: boolean;
}

function emptySnapshot(): ChatPreferencesSnapshot {
  return {
    temperatureInput: '',
    maxTokensInput: '',
    systemPrompts: defaultSystemPrompts(),
    selectedPromptSlot: 'default',
    toolCallEnabled: false,
  };
}

function migrateSnapshot(parsed: Partial<ChatPreferencesSnapshot>): ChatPreferencesSnapshot {
  // 读取新版字段
  const systemPrompts = Array.isArray(parsed.systemPrompts)
    ? parsed.systemPrompts.map((entry, index) => ({
        id: (entry?.id ?? String(index + 1)) as SystemPromptSlot,
        label: typeof entry?.label === 'string' ? entry.label : '',
        content: typeof entry?.content === 'string' ? entry.content : '',
      })).slice(0, 3)
    : defaultSystemPrompts();

  // 补齐不足 3 组的情况
  while (systemPrompts.length < 3) {
    systemPrompts.push({
      id: String(systemPrompts.length + 1) as SystemPromptSlot,
      label: '',
      content: '',
    });
  }

  let selectedPromptSlot: SystemPromptSlot =
    parsed.selectedPromptSlot === '1' || parsed.selectedPromptSlot === '2' || parsed.selectedPromptSlot === '3' || parsed.selectedPromptSlot === 'default'
      ? parsed.selectedPromptSlot
      : 'default';

  // 旧版字段迁移：如果旧 systemPromptEnabled 为 true 且有内容，迁移到 slot 1
  if (
    selectedPromptSlot === 'default' &&
    parsed.systemPromptEnabled === true &&
    typeof parsed.systemPrompt === 'string' &&
    parsed.systemPrompt.trim()
  ) {
    systemPrompts[0] = { id: '1', label: '', content: parsed.systemPrompt };
    selectedPromptSlot = '1';
  }

  return {
    temperatureInput: typeof parsed.temperatureInput === 'string' ? parsed.temperatureInput : '',
    maxTokensInput: typeof parsed.maxTokensInput === 'string' ? parsed.maxTokensInput : '',
    systemPrompts,
    selectedPromptSlot,
    toolCallEnabled: typeof parsed.toolCallEnabled === 'boolean' ? parsed.toolCallEnabled : false,
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
    return migrateSnapshot(parsed);
  } catch {
    return emptySnapshot();
  }
}

export const useChatPreferencesStore = defineStore('chatPreferences', () => {
  const snapshot = loadSnapshot();
  const temperatureInput = ref(snapshot.temperatureInput);
  const maxTokensInput = ref(snapshot.maxTokensInput);
  const systemPrompts = ref<SystemPromptEntry[]>(snapshot.systemPrompts ?? defaultSystemPrompts());
  const selectedPromptSlot = ref<SystemPromptSlot>(snapshot.selectedPromptSlot ?? 'default');
  const toolCallEnabled = ref(snapshot.toolCallEnabled);

  // 当当前会话有已授权文件时，工具调用被锁定（必须开启）
  const toolCallLocked = computed(() => {
    const sessionFileStore = useSessionFileStore();
    return sessionFileStore.hasFiles;
  });

  // 实际生效的工具调用开关：被锁定时强制 true
  const effectiveToolCallEnabled = computed(() => {
    return toolCallLocked.value ? true : toolCallEnabled.value;
  });

  const hasCustomRuntimeSettings = computed(() =>
    Boolean(
      temperatureInput.value.trim() ||
        maxTokensInput.value.trim() ||
        systemPrompts.value.some((entry) => entry.content.trim()),
    ),
  );

  // 当前选中的提示词内容（default 返回空，由后端兜底）
  const activeSystemPrompt = computed(() => {
    if (selectedPromptSlot.value === 'default') {
      return '';
    }
    const entry = systemPrompts.value.find((item) => item.id === selectedPromptSlot.value);
    return entry?.content ?? '';
  });

  function persist() {
    if (typeof window === 'undefined') {
      return;
    }

    const payload: ChatPreferencesSnapshot = {
      temperatureInput: temperatureInput.value,
      maxTokensInput: maxTokensInput.value,
      systemPrompts: systemPrompts.value,
      selectedPromptSlot: selectedPromptSlot.value,
      toolCallEnabled: toolCallEnabled.value,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('[ChatPreferencesStore] Failed to persist to localStorage:', error);
    }
  }

  function syncFromStorage() {
    const nextSnapshot = loadSnapshot();
    temperatureInput.value = nextSnapshot.temperatureInput;
    maxTokensInput.value = nextSnapshot.maxTokensInput;
    systemPrompts.value = nextSnapshot.systemPrompts ?? defaultSystemPrompts();
    selectedPromptSlot.value = nextSnapshot.selectedPromptSlot ?? 'default';
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

  function setSelectedPromptSlot(slot: SystemPromptSlot) {
    selectedPromptSlot.value = slot;
    persist();
  }

  function updateSystemPrompt(id: SystemPromptSlot, patch: Partial<Pick<SystemPromptEntry, 'label' | 'content'>>) {
    const entry = systemPrompts.value.find((item) => item.id === id);
    if (!entry) {
      return;
    }
    if (patch.label !== undefined) {
      entry.label = patch.label;
    }
    if (patch.content !== undefined) {
      entry.content = patch.content;
    }
    persist();
  }

  function toggleToolCallEnabled() {
    toolCallEnabled.value = !toolCallEnabled.value;
    persist();
  }

  function resetRuntimeSettings() {
    temperatureInput.value = '';
    maxTokensInput.value = '';
    systemPrompts.value = defaultSystemPrompts();
    selectedPromptSlot.value = 'default';
    persist();
  }

  return {
    temperatureInput,
    maxTokensInput,
    systemPrompts,
    selectedPromptSlot,
    activeSystemPrompt,
    toolCallEnabled,
    toolCallLocked,
    effectiveToolCallEnabled,
    hasCustomRuntimeSettings,
    syncFromStorage,
    setTemperatureInput,
    setMaxTokensInput,
    setSelectedPromptSlot,
    updateSystemPrompt,
    toggleToolCallEnabled,
    resetRuntimeSettings,
  };
});
