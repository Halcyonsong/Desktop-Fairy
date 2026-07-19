<script setup lang="ts">
import { ChevronDown, Copy, Eye, EyeOff, Save, X } from '@lucide/vue';
import { useSourceFormController } from '@/components/settings/model-source/controllers/useSourceFormController';
import { customText } from '@/config/customText';
import type { ModelProvider, ModelSourceFormState } from '@/types/chat';

const props = defineProps<{
  errorMessage: string;
  form: ModelSourceFormState;
  providerOptions: ModelProvider[];
  canSubmit: boolean;
  saving: boolean;
}>();

const {
  apiKeyVisible,
  providerOpen,
  providerFilter,
  providerRef,
  copiedField,
  filteredProviderOptions,
  toggleApiKeyVisible,
  hideApiKey,
  clearField,
  chooseProvider,
  toggleProviderOpen,
  copyValue,
} = useSourceFormController({
  form: props.form,
  providerOptions: props.providerOptions,
});

const emit = defineEmits<{
  save: [];
}>();
</script>

<template>
  <section class="settings-section settings-section--compact">
    <div v-if="errorMessage" class="message-alert">{{ errorMessage }}</div>

    <div class="settings-form-grid">
      <label class="settings-field">
        <span>名称</span>
        <div class="settings-input-shell settings-input-shell--single-action">
          <input v-model="form.name" type="text" placeholder="DeepSeek 主账号" />
          <div v-if="form.name" class="settings-input-actions">
            <button class="settings-input-action" type="button" title="清空名称" @click="clearField('name')">
              <X :size="15" />
            </button>
          </div>
        </div>
      </label>

      <label class="settings-field">
        <span>Provider</span>
        <div ref="providerRef" class="settings-select-shell">
          <div class="settings-input-shell settings-input-shell--single-action">
            <input v-model="form.provider" type="text" :placeholder="customText.modelSource.providerPlaceholder" @focus="providerOpen = true" />
            <div class="settings-input-actions">
              <button class="settings-input-action" type="button" title="展开 Provider" @click="toggleProviderOpen">
                <ChevronDown :size="16" :class="{ 'settings-select-shell__chevron--open': providerOpen }" />
              </button>
            </div>
          </div>

          <div v-if="providerOpen" class="settings-select-popover">
            <div class="settings-select-filter">
              <input v-model="providerFilter" type="text" :placeholder="customText.modelSource.providerFilterPlaceholder" />
            </div>

            <div v-if="filteredProviderOptions.length > 0" class="settings-select-scroll">
              <button
                v-for="provider in filteredProviderOptions"
                :key="provider"
                class="settings-select-option"
                type="button"
                @click="chooseProvider(provider)"
              >
                {{ provider }}
              </button>
            </div>
            <div v-else class="settings-empty-hint">{{ customText.modelSource.providerNoMatch }}</div>
          </div>
        </div>
      </label>

      <label class="settings-field settings-field--full">
        <span>Base URL</span>
        <div class="settings-input-shell settings-input-shell--double-action">
          <input v-model="form.baseUrl" type="text" placeholder="https://api.deepseek.com" />
          <div v-if="form.baseUrl" class="settings-input-actions">
            <button class="settings-input-action" type="button" :title="copiedField === 'baseUrl' ? '已复制！' : '复制 Base URL'" @click="copyValue(form.baseUrl, 'baseUrl')">
              <Copy :size="15" />
            </button>
            <button class="settings-input-action" type="button" title="清空 Base URL" @click="clearField('baseUrl')">
              <X :size="15" />
            </button>
          </div>
        </div>
      </label>

      <label class="settings-field settings-field--full">
        <span>API Key</span>
        <div class="settings-input-shell settings-input-shell--triple-action">
          <input
            v-model="form.apiKey"
            :type="apiKeyVisible ? 'text' : 'password'"
            placeholder="sk-xxxx"
            @blur="hideApiKey"
          />
          <div class="settings-input-actions">
            <button
              class="settings-input-action"
              type="button"
              :title="apiKeyVisible ? '隐藏 API Key' : '显示 API Key'"
              @click="toggleApiKeyVisible"
            >
              <EyeOff v-if="apiKeyVisible" :size="16" />
              <Eye v-else :size="16" />
            </button>
            <button
              v-if="form.apiKey"
              class="settings-input-action"
              type="button"
              :title="copiedField === 'apiKey' ? '已复制！' : '复制 API Key'"
              @click="copyValue(form.apiKey, 'apiKey')"
            >
              <Copy :size="15" />
            </button>
            <button
              v-if="form.apiKey"
              class="settings-input-action"
              type="button"
              title="清空 API Key"
              @click="clearField('apiKey')"
            >
              <X :size="15" />
            </button>
          </div>
        </div>
      </label>
    </div>

    <div class="settings-panel__actions settings-panel__actions--block settings-panel__actions--end">
      <button class="settings-page__primary settings-page__primary--icon" type="button" :disabled="!canSubmit || saving" title="保存" @click="emit('save')">
        <Save :size="16" />
        <span>{{ saving ? '保存中' : '保存' }}</span>
      </button>
    </div>
  </section>
</template>
