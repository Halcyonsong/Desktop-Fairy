<script setup lang="ts">
import { computed } from 'vue';
import { customText } from '@/config/customText';
import type { SystemPromptEntry, SystemPromptSlot } from '@/types/chat';

const props = defineProps<{
  open: boolean;
  temperatureInput: string;
  maxTokensInput: string;
  systemPrompts: SystemPromptEntry[];
  selectedPromptSlot: SystemPromptSlot;
}>();

const emit = defineEmits<{
  toggle: [];
  'update:temperature-input': [value: string];
  'update:max-tokens-input': [value: string];
  'update:selected-prompt-slot': [value: SystemPromptSlot];
  'update-system-prompt': [id: SystemPromptSlot, patch: Partial<Pick<SystemPromptEntry, 'label' | 'content'>>];
}>();

const slotOptions: { value: SystemPromptSlot; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
];

const isDefaultSlot = computed(() => props.selectedPromptSlot === 'default');

// 当前选中的提示词条目（default 时为 null）
const currentEntry = computed(() => {
  if (isDefaultSlot.value) {
    return null;
  }
  return props.systemPrompts.find((item) => item.id === props.selectedPromptSlot) ?? null;
});

// 对话框中显示的文本（default 时显示后端默认提示，但禁用编辑）
const displayText = computed(() => {
  if (isDefaultSlot.value) {
    return customText.runtimePopover.systemPromptDefaultHint;
  }
  return currentEntry.value?.content ?? '';
});

const displayLabel = computed(() => {
  if (isDefaultSlot.value) {
    return 'default';
  }
  return currentEntry.value?.label ?? '';
});

function selectSlot(slot: SystemPromptSlot) {
  emit('update:selected-prompt-slot', slot);
}

function updateLabel(value: string) {
  if (!isDefaultSlot.value) {
    emit('update-system-prompt', props.selectedPromptSlot, { label: value });
  }
}

function updateContent(value: string) {
  if (!isDefaultSlot.value) {
    emit('update-system-prompt', props.selectedPromptSlot, { content: value });
  }
}
</script>

<template>
  <button class="composer-tool-button" type="button" :title="customText.runtimePopover.title" @click="emit('toggle')">
    <slot name="icon" />
  </button>

  <div v-if="open" class="composer-settings-popover">
    <!-- 提示词分组选择 -->
    <div class="composer-settings-field">
      <span>{{ customText.runtimePopover.systemPromptSlotLabel }}</span>
      <div class="composer-prompt-slot-group">
        <button
          v-for="option in slotOptions"
          :key="option.value"
          type="button"
          class="composer-prompt-slot-button"
          :class="{ 'composer-prompt-slot-button--active': props.selectedPromptSlot === option.value }"
          :title="option.value === 'default' ? customText.runtimePopover.systemPromptDefaultHint : ''"
          @click="selectSlot(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <!-- 自定义标签（所有分组都显示，default 时禁用） -->
    <label class="composer-settings-field">
      <span>{{ customText.runtimePopover.systemPromptLabelField }}</span>
      <input
        :value="displayLabel"
        type="text"
        :placeholder="customText.runtimePopover.systemPromptLabelPlaceholder"
        :disabled="isDefaultSlot"
        @input="updateLabel(($event.target as HTMLInputElement).value)"
      />
    </label>

    <!-- 提示词内容 -->
    <label class="composer-settings-field">
      <span>{{ customText.runtimePopover.systemPromptLabel }}</span>
      <textarea
        class="composer-settings-textarea"
        :value="displayText"
        rows="3"
        :placeholder="isDefaultSlot ? '' : customText.runtimePopover.systemPromptPlaceholder"
        :disabled="isDefaultSlot"
        @input="updateContent(($event.target as HTMLTextAreaElement).value)"
      />
    </label>

    <!-- Temperature -->
    <label class="composer-settings-field">
      <span>{{ customText.runtimePopover.temperatureLabel }}</span>
      <input
        :value="props.temperatureInput"
        type="text"
        inputmode="decimal"
        :placeholder="customText.runtimePopover.defaultPlaceholder"
        @input="emit('update:temperature-input', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <!-- Max Tokens -->
    <label class="composer-settings-field">
      <span>{{ customText.runtimePopover.maxTokensLabel }}</span>
      <input
        :value="props.maxTokensInput"
        type="text"
        inputmode="numeric"
        :placeholder="customText.runtimePopover.defaultPlaceholder"
        @input="emit('update:max-tokens-input', ($event.target as HTMLInputElement).value)"
      />
    </label>
  </div>
</template>
