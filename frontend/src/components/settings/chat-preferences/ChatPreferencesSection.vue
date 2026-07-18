<script setup lang="ts">
import { RotateCcw } from '@lucide/vue';
import { computed } from 'vue';
import { customText } from '@/config/customText';
import { useChatPreferencesStore } from '@/stores/chatPreferencesStore';

const chatPreferencesStore = useChatPreferencesStore();

const settingsSummary = computed(() => {
  const tags: string[] = [];
  if (chatPreferencesStore.temperatureInput.trim()) {
    tags.push(`${customText.chatPreferences.temperatureLabel} ${chatPreferencesStore.temperatureInput.trim()}`);
  }
  if (chatPreferencesStore.maxTokensInput.trim()) {
    tags.push(`${customText.chatPreferences.maxTokensLabel} ${chatPreferencesStore.maxTokensInput.trim()}`);
  }
  if (chatPreferencesStore.systemPrompt.trim()) {
    tags.push(`${customText.chatPreferences.systemPromptLabel} 已设置`);
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
          <label class="settings-field settings-field--full">
            <span>{{ customText.chatPreferences.systemPromptLabel }}</span>
            <textarea
              class="settings-field__textarea"
              :value="chatPreferencesStore.systemPrompt"
              rows="5"
              :placeholder="customText.chatPreferences.systemPromptPlaceholder"
              @input="chatPreferencesStore.setSystemPrompt(($event.target as HTMLTextAreaElement).value)"
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
