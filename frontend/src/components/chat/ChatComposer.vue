<script setup lang="ts">
import { Paperclip, SendHorizontal, SlidersHorizontal, Square, Undo2 } from '@lucide/vue';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ModelPicker from '@/components/chat/composer/ModelPicker.vue';
import RuntimeSettingsPopover from '@/components/chat/composer/RuntimeSettingsPopover.vue';
import { appConfig } from '@/config/appConfig';
import { uiText } from '@/config/uiText';
import type { SelectableModelGroup } from '@/types/chat';

const props = defineProps<{
  sending: boolean;
  draft: string;
  modelLabel: string;
  hasSelectableModels: boolean;
  selectableModelGroups: SelectableModelGroup[];
  modelRequired: boolean;
  temperatureInput: string;
  maxTokensInput: string;
  autoFocus: boolean;
}>();

const emit = defineEmits<{
  'update:draft': [value: string];
  send: [question: string];
  stop: [];
  rollback: [];
  selectModel: [sourceCode: string, modelName: string];
  'update:temperature-input': [value: string];
  'update:max-tokens-input': [value: string];
}>();

const pickerOpen = ref(false);
const settingsOpen = ref(false);
const pickerRef = ref<HTMLElement | null>(null);
const settingsRef = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

function submit() {
  const value = props.draft.trim();
  if (!value || props.sending || props.modelRequired) {
    return;
  }

  emit('send', value);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submit();
  }
}

function togglePicker() {
  pickerOpen.value = !pickerOpen.value;
  if (pickerOpen.value) {
    settingsOpen.value = false;
  }
}

function toggleSettings() {
  settingsOpen.value = !settingsOpen.value;
  if (settingsOpen.value) {
    pickerOpen.value = false;
  }
}

function chooseModel(sourceCode: string, modelName: string) {
  emit('selectModel', sourceCode, modelName);
  pickerOpen.value = false;
}

async function focusComposer() {
  await nextTick();
  textareaRef.value?.focus();
}

function handlePointerDown(event: MouseEvent) {
  const target = event.target;

  if (pickerOpen.value && pickerRef.value && target instanceof Node && !pickerRef.value.contains(target)) {
    pickerOpen.value = false;
  }

  if (settingsOpen.value && settingsRef.value && target instanceof Node && !settingsRef.value.contains(target)) {
    settingsOpen.value = false;
  }
}

onMounted(() => {
  window.addEventListener('mousedown', handlePointerDown);
  if (props.autoFocus) {
    void focusComposer();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', handlePointerDown);
});

watch(
  () => props.autoFocus,
  (value) => {
    if (value) {
      void focusComposer();
    }
  },
);
</script>

<template>
  <footer class="chat-composer">
    <div class="composer-card">
      <textarea
        ref="textareaRef"
        :value="draft"
        rows="3"
        :placeholder="uiText.composer.placeholder"
        @input="emit('update:draft', ($event.target as HTMLTextAreaElement).value)"
        @keydown="handleKeydown"
      />

      <div class="chat-composer__toolbar">
        <div class="composer-tools-left">
          <button v-if="appConfig.featureFlags.attachmentEntry" class="composer-tool-button" type="button" :title="uiText.composer.addAttachment">
            <Paperclip :size="18" />
          </button>

          <div v-if="appConfig.featureFlags.modelPresetEntry" ref="pickerRef" class="model-select-wrap">
            <ModelPicker
              :open="pickerOpen"
              :model-label="modelLabel"
              :has-selectable-models="hasSelectableModels"
              :selectable-model-groups="selectableModelGroups"
              @toggle="togglePicker"
              @select-model="chooseModel"
            />
          </div>

          <div v-if="appConfig.featureFlags.settingsEntry" ref="settingsRef" class="composer-settings-wrap">
            <RuntimeSettingsPopover
              :open="settingsOpen"
              :temperature-input="temperatureInput"
              :max-tokens-input="maxTokensInput"
              @toggle="toggleSettings"
              @update:temperature-input="emit('update:temperature-input', $event)"
              @update:max-tokens-input="emit('update:max-tokens-input', $event)"
            >
              <template #icon>
                <SlidersHorizontal :size="18" />
              </template>
            </RuntimeSettingsPopover>
          </div>
        </div>

        <div class="composer-tools-right">
          <button class="composer-tool-button" type="button" :title="uiText.composer.rollback" :disabled="sending" @click="emit('rollback')">
            <Undo2 :size="18" />
          </button>
          <button v-if="sending" class="send-button" type="button" :title="uiText.composer.stop" @click="emit('stop')">
            <Square :size="19" />
          </button>
          <button v-else class="send-button" type="button" :title="uiText.composer.send" :disabled="!draft.trim() || modelRequired" @click="submit">
            <SendHorizontal :size="19" />
          </button>
        </div>
      </div>
    </div>
  </footer>
</template>
