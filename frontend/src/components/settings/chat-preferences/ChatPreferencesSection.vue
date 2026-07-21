<script setup lang="ts">
import { RotateCcw } from '@lucide/vue';
import { computed } from 'vue';
import { customText } from '@/config/customText';
import { useChatPreferencesStore } from '@/stores/chatPreferencesStore';
import type { SystemPromptSlot } from '@/types/chat';

const chatPreferencesStore = useChatPreferencesStore();

const slotOptions: { value: SystemPromptSlot; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: '1', label: '提示词 1' },
  { value: '2', label: '提示词 2' },
  { value: '3', label: '提示词 3' },
];

const isDefaultSlot = computed(() => chatPreferencesStore.selectedPromptSlot === 'default');

const currentEntry = computed(() => {
  if (isDefaultSlot.value) {
    return null;
  }
  return chatPreferencesStore.systemPrompts.find((item) => item.id === chatPreferencesStore.selectedPromptSlot) ?? null;
});

const settingsSummary = computed(() => {
  const tags: string[] = [];
  if (chatPreferencesStore.temperatureInput.trim()) {
    tags.push(`${customText.chatPreferences.temperatureLabel} ${chatPreferencesStore.temperatureInput.trim()}`);
  }
  if (chatPreferencesStore.maxTokensInput.trim()) {
    tags.push(`${customText.chatPreferences.maxTokensLabel} ${chatPreferencesStore.maxTokensInput.trim()}`);
  }
  if (chatPreferencesStore.selectedPromptSlot !== 'default') {
    const entry = currentEntry.value;
    if (entry?.content.trim()) {
      const label = entry.label.trim() || `提示词 ${entry.id}`;
      tags.push(`${customText.chatPreferences.systemPromptLabel} ${label}`);
    }
  }
  return tags;
});
</script>

<template>
  <div class="settings-page__surface">
    <header class="settings-page__header settings-page__header--compact">
      <div>
        <span class="chat-header__status">{{ customText.chatPreferences.status }}</span>
        <h1>{{ customText.chatPreferences.title }}</h1>
      </div>

      <div class="settings-header-actions">
        <button
          class="settings-icon-button"
          type="button"
          :title="customText.chatPreferences.resetTitle"
          :disabled="!chatPreferencesStore.hasCustomRuntimeSettings"
          @click="chatPreferencesStore.resetRuntimeSettings()"
        >
          <RotateCcw :size="16" />
        </button>
      </div>
    </header>

    <section class="settings-card-grid">
      <div class="settings-card settings-card--compact">
        <div class="settings-card__header">
          <div>
            <h2>{{ customText.chatPreferences.defaultsTitle }}</h2>
            <p>{{ customText.chatPreferences.defaultsDescription }}</p>
          </div>
        </div>

        <div class="settings-form-grid settings-form-grid--two-column">
          <!-- 提示词分组选择 -->
          <div class="settings-field settings-field--full">
            <span>{{ customText.runtimePopover.systemPromptSlotLabel }}</span>
            <div class="settings-prompt-slot-group">
              <button
                v-for="option in slotOptions"
                :key="option.value"
                type="button"
                class="settings-prompt-slot-button"
                :class="{ 'settings-prompt-slot-button--active': chatPreferencesStore.selectedPromptSlot === option.value }"
                @click="chatPreferencesStore.setSelectedPromptSlot(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <!-- 分组名称（所有分组都显示，default 时禁用） -->
          <label class="settings-field">
            <span>{{ customText.runtimePopover.systemPromptLabelField }}</span>
            <input
              :value="isDefaultSlot ? 'default' : (currentEntry?.label ?? '')"
              type="text"
              :placeholder="customText.runtimePopover.systemPromptLabelPlaceholder"
              :disabled="isDefaultSlot"
              @input="chatPreferencesStore.updateSystemPrompt(chatPreferencesStore.selectedPromptSlot, { label: ($event.target as HTMLInputElement).value })"
            />
          </label>

          <!-- 提示词内容 -->
          <label class="settings-field settings-field--full">
            <span>{{ customText.chatPreferences.systemPromptLabel }}</span>
            <textarea
              class="settings-field__textarea"
              :value="isDefaultSlot ? customText.runtimePopover.systemPromptDefaultHint : (currentEntry?.content ?? '')"
              rows="5"
              :placeholder="isDefaultSlot ? '' : customText.chatPreferences.systemPromptPlaceholder"
              :disabled="isDefaultSlot"
              @input="chatPreferencesStore.updateSystemPrompt(chatPreferencesStore.selectedPromptSlot, { content: ($event.target as HTMLTextAreaElement).value })"
            />
          </label>

          <label class="settings-field">
            <span>{{ customText.chatPreferences.temperatureLabel }}</span>
            <input
              :value="chatPreferencesStore.temperatureInput"
              type="text"
              inputmode="decimal"
              :placeholder="customText.chatPreferences.defaultPlaceholder"
              @input="chatPreferencesStore.setTemperatureInput(($event.target as HTMLInputElement).value)"
            />
          </label>

          <label class="settings-field">
            <span>{{ customText.chatPreferences.maxTokensLabel }}</span>
            <input
              :value="chatPreferencesStore.maxTokensInput"
              type="text"
              inputmode="numeric"
              :placeholder="customText.chatPreferences.defaultPlaceholder"
              @input="chatPreferencesStore.setMaxTokensInput(($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </div>

      <div class="settings-card settings-card--compact">
        <div class="settings-card__header">
          <div>
            <h2>{{ customText.chatPreferences.summaryTitle }}</h2>
            <p>{{ customText.chatPreferences.summaryDescription }}</p>
          </div>
        </div>

        <div v-if="settingsSummary.length" class="settings-tag-list">
          <span v-for="item in settingsSummary" :key="item" class="settings-tag">{{ item }}</span>
        </div>
        <div v-else class="settings-empty-hint">{{ customText.chatPreferences.emptyHint }}</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-prompt-slot-group {
  display: flex;
  gap: 6px;
}

.settings-prompt-slot-button {
  flex: 1;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.settings-prompt-slot-button:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text);
}

.settings-prompt-slot-button--active {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.settings-field__textarea:disabled,
.settings-field input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--color-bg-secondary, var(--color-surface));
  color: var(--color-text-muted);
  border-color: var(--color-border);
}
</style>
