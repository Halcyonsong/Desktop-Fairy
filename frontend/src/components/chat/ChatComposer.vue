<script setup lang="ts">
import { LoaderCircle, Mic, Paperclip, SendHorizontal, SlidersHorizontal, Square, Undo2, Wrench } from '@lucide/vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ModelPicker from '@/components/chat/composer/ModelPicker.vue';
import RuntimeSettingsPopover from '@/components/chat/composer/RuntimeSettingsPopover.vue';
import { appConfig } from '@/config/appConfig';
import { uiText } from '@/config/uiText';
import { useVoskVoiceController } from '@/modules/vosk/useVoskVoiceController';
import type { SelectableModelGroup, SystemPromptEntry, SystemPromptSlot } from '@/types/chat';

const props = defineProps<{
  sending: boolean;
  draft: string;
  modelLabel: string;
  hasSelectableModels: boolean;
  selectableModelGroups: SelectableModelGroup[];
  modelRequired: boolean;
  temperatureInput: string;
  maxTokensInput: string;
  systemPrompts: SystemPromptEntry[];
  selectedPromptSlot: SystemPromptSlot;
  autoFocus: boolean;
  allowEmptySend?: boolean;
  toolCallEnabled?: boolean;
}>();

const emit = defineEmits<{
  'update:draft': [value: string];
  send: [question: string];
  stop: [];
  rollback: [];
  selectModel: [sourceCode: string, modelName: string];
  'update:temperature-input': [value: string];
  'update:max-tokens-input': [value: string];
  'update:selected-prompt-slot': [value: SystemPromptSlot];
  'update-system-prompt': [id: SystemPromptSlot, patch: Partial<Pick<SystemPromptEntry, 'label' | 'content'>>];
  'toggle-tool-call': [];
}>();

const pickerOpen = ref(false);
const settingsOpen = ref(false);
const pickerRef = ref<HTMLElement | null>(null);
const settingsRef = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// 语音输入控制器：本地离线识别（vosk-browser）
const voiceInput = useVoskVoiceController({
  onFinalResult: (transcript) => {
    const current = props.draft;
    emit('update:draft', current + transcript);
  },
  onError: (error, message) => {
    if (error !== 'no-speech' && error !== 'aborted') {
      console.warn('[voiceInput]', message);
    }
  },
});

const voiceButtonTitle = computed(() => {
  if (!voiceInput.isSupported.value) {
    return uiText.composer.voiceUnsupported;
  }
  if (voiceInput.isLoading.value) {
    return voiceInput.loadingMessage.value || uiText.composer.voicePreparing;
  }
  return voiceInput.isListening.value ? uiText.composer.voiceStop : uiText.composer.voiceStart;
});

const toolCallButtonTitle = computed(() =>
  props.toolCallEnabled ? uiText.composer.toolCallOn : uiText.composer.toolCallOff,
);

function submit() {
  const value = props.draft.trim();
  // 临时闲聊模式下允许发送空消息，触发后端兜底自动回复
  if (props.sending || props.modelRequired) {
    return;
  }
  if (!value && !props.allowEmptySend) {
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
              :system-prompts="systemPrompts"
              :selected-prompt-slot="selectedPromptSlot"
              @toggle="toggleSettings"
              @update:temperature-input="emit('update:temperature-input', $event)"
              @update:max-tokens-input="emit('update:max-tokens-input', $event)"
              @update:selected-prompt-slot="emit('update:selected-prompt-slot', $event)"
              @update-system-prompt="(id, patch) => emit('update-system-prompt', id, patch)"
            >
              <template #icon>
                <SlidersHorizontal :size="18" />
              </template>
            </RuntimeSettingsPopover>
          </div>

          <button
            v-if="appConfig.featureFlags.toolCallEntry"
            class="composer-tool-button composer-tool-button--toggle"
            :class="{ 'composer-tool-button--active': toolCallEnabled }"
            type="button"
            :title="toolCallButtonTitle"
            :aria-pressed="toolCallEnabled ? 'true' : 'false'"
            @click="emit('toggle-tool-call')"
          >
            <Wrench :size="18" />
          </button>
        </div>

        <div class="composer-tools-right">
          <button class="composer-tool-button" type="button" :title="uiText.composer.rollback" :disabled="sending" @click="emit('rollback')">
            <Undo2 :size="18" />
          </button>
          <!-- 语音输入按钮：放在发送键左边 -->
          <button
            v-if="voiceInput.isSupported.value"
            class="composer-tool-button composer-voice-button"
            :class="{
              'composer-voice-button--active': voiceInput.isListening.value,
              'composer-voice-button--loading': voiceInput.isLoading.value,
            }"
            type="button"
            :title="voiceButtonTitle"
            :disabled="sending || voiceInput.isLoading.value"
            @click="voiceInput.toggle()"
          >
            <span v-if="voiceInput.isLoading.value && voiceInput.downloadProgress.value" class="composer-voice-button__percent">
              {{ voiceInput.downloadProgress.value.percent }}%
            </span>
            <LoaderCircle v-else-if="voiceInput.isLoading.value" :size="18" class="spin" />
            <Mic v-else :size="18" />
          </button>
          <button v-if="sending" class="send-button" type="button" :title="uiText.composer.stop" @click="emit('stop')">
            <Square :size="19" />
          </button>
          <button v-else class="send-button" type="button" :title="uiText.composer.send" :disabled="(!allowEmptySend && !draft.trim()) || modelRequired" @click="submit">
            <SendHorizontal :size="19" />
          </button>
        </div>
      </div>
    </div>
  </footer>
</template>
