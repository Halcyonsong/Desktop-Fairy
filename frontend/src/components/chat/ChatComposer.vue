<script setup lang="ts">
import { Camera, FileUp, FolderOpen, LoaderCircle, Mic, Paperclip, SendHorizontal, SlidersHorizontal, Square, Undo2, Wrench } from '@lucide/vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AttachmentChips from '@/components/chat/composer/AttachmentChips.vue';
import FilePreview from '@/components/chat/composer/FilePreview.vue';
import FolderAuthorizeConfirm from '@/components/chat/composer/FolderAuthorizeConfirm.vue';
import ModelPicker from '@/components/chat/composer/ModelPicker.vue';
import RuntimeSettingsPopover from '@/components/chat/composer/RuntimeSettingsPopover.vue';
import { appConfig } from '@/config/appConfig';
import { customText } from '@/config/customText';
import { uiText } from '@/config/uiText';
import { useSessionFileStore } from '@/stores/sessionFileStore';
import { useSessionFolderStore } from '@/stores/sessionFolderStore';
import { useToastStore } from '@/stores/toastStore';
import { useVoskVoiceController } from '@/modules/vosk/useVoskVoiceController';
import type { SelectableModelGroup, SystemPromptEntry, SystemPromptSlot } from '@/types/chat';
import type { SessionFileReference } from '@/types/electron';

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
  toolCallLocked?: boolean;
  sessionId?: string;
  isTemporarySession?: boolean;
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

// ===== 附件管理 =====
const sessionFileStore = useSessionFileStore();
const sessionFolderStore = useSessionFolderStore();
const toast = useToastStore();
const isDragging = ref(false);
const attachmentMenuOpen = ref(false);
const capturingScreenshot = ref(false);

// 文件夹授权确认弹窗状态
const folderConfirmOpen = ref(false);
const pendingFolderPath = ref('');

const attachmentButtonTitle = computed(() => {
  if (props.isTemporarySession) return customText.composer.attachmentTemporaryDisabled;
  return customText.composer.addAttachment;
});

function toggleAttachmentMenu() {
  if (props.isTemporarySession) {
    toast.warning(customText.composer.attachmentTemporaryDisabled);
    return;
  }
  attachmentMenuOpen.value = !attachmentMenuOpen.value;
}

async function handleSelectFiles() {
  attachmentMenuOpen.value = false;
  if (props.isTemporarySession || !props.sessionId) {
    toast.warning(customText.composer.attachmentTemporaryDisabled);
    return;
  }

  try {
    const filePaths = await window.desktopFairy?.showOpenFileDialog?.();
    if (!filePaths || filePaths.length === 0) return;
    await sessionFileStore.authorizeFiles(props.sessionId, filePaths);
  } catch {
    // toast 已在 store 中处理
  }
}

async function handleSelectFolder() {
  attachmentMenuOpen.value = false;
  if (props.isTemporarySession || !props.sessionId) {
    toast.warning(customText.composer.attachmentTemporaryDisabled);
    return;
  }

  try {
    const folderPath = await window.desktopFairy?.showOpenFolderDialog?.();
    if (!folderPath) return;

    // 授权前需用户确认（风险操作）
    pendingFolderPath.value = folderPath;
    folderConfirmOpen.value = true;
  } catch {
    // 文件夹选择失败，静默处理
  }
}

async function handleConfirmFolderAuthorize() {
  folderConfirmOpen.value = false;
  const folderPath = pendingFolderPath.value;
  pendingFolderPath.value = '';

  if (!folderPath || !props.sessionId) return;

  try {
    await sessionFolderStore.authorizeFolder(props.sessionId, folderPath);
  } catch {
    // toast 已在 store 中处理
  }
}

function handleCancelFolderAuthorize() {
  folderConfirmOpen.value = false;
  pendingFolderPath.value = '';
}

async function handleCaptureScreenshot(hideWindow = false) {
  attachmentMenuOpen.value = false;
  if (props.isTemporarySession || !props.sessionId) {
    toast.warning(customText.composer.attachmentTemporaryDisabled);
    return;
  }

  capturingScreenshot.value = true;
  toast.info(customText.composer.screenshotCapturing);
  try {
    const filePath = await window.desktopFairy?.captureScreenshot?.({ hideWindow });
    if (!filePath) {
      // 用户取消或失败，不显示错误（取消是正常行为）
      return;
    }
    await sessionFileStore.authorizeFile(props.sessionId, filePath);
  } catch {
    // toast 已在 store 中处理
  } finally {
    capturingScreenshot.value = false;
  }
}

// 点击外部关闭 popover
function handleAttachmentMenuOutsideClick(event: MouseEvent) {
  const target = event.target as Node;
  const popover = document.querySelector('.attachment-menu-popover');
  const button = document.querySelector('.composer-tool-button--attachment');
  if (popover && !popover.contains(target) && button && !button.contains(target)) {
    attachmentMenuOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleAttachmentMenuOutsideClick);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', handleAttachmentMenuOutsideClick);
});

async function handleRemoveAttachment(fileReferenceId: string) {
  await sessionFileStore.removeFile(fileReferenceId);
}

// 文件预览
const previewOpen = ref(false);
const previewFile = ref<SessionFileReference | null>(null);

function handlePreviewFile(file: SessionFileReference) {
  previewFile.value = file;
  previewOpen.value = true;
}

function closePreview() {
  previewOpen.value = false;
}

// 拖拽
function handleDragOver(event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer?.types.includes('Files')) {
    isDragging.value = true;
  }
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault();
  // 仅在离开 composer 区域时取消
  const related = event.relatedTarget;
  const currentTarget = event.currentTarget as Node | null;
  if (!related || !currentTarget || !currentTarget.contains(related as Node)) {
    isDragging.value = false;
  }
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;

  if (props.isTemporarySession || !props.sessionId) {
    toast.warning(customText.composer.attachmentTemporaryDisabled);
    return;
  }

  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;

  // 提取所有有效路径，批量授权
  const paths: string[] = [];
  for (const file of Array.from(files)) {
    const filePath = (file as File & { path?: string }).path;
    if (filePath) {
      paths.push(filePath);
    }
  }
  if (paths.length === 0) {
    toast.error('无法获取文件路径，请使用按钮添加');
    return;
  }
  await sessionFileStore.authorizeFiles(props.sessionId, paths);
}

// 粘贴
async function handlePaste(event: ClipboardEvent) {
  if (props.isTemporarySession || !props.sessionId) return;

  const items = event.clipboardData?.items;
  if (!items) return;

  // 提取所有有效文件路径，批量授权
  const paths: string[] = [];
  for (const item of Array.from(items)) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (!file) continue;
      const filePath = (file as File & { path?: string }).path;
      if (filePath) paths.push(filePath);
    }
  }
  if (paths.length > 0) {
    event.preventDefault();
    await sessionFileStore.authorizeFiles(props.sessionId, paths);
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
  <footer
    class="chat-composer"
    :class="{ 'chat-composer--dragging': isDragging }"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div v-if="isDragging" class="chat-composer__drag-overlay">
      <Paperclip :size="24" />
      <span>{{ customText.composer.dragDropHint }}</span>
    </div>

    <div class="composer-card">
      <!-- 附件 chip 列表 -->
      <AttachmentChips
        v-if="sessionFileStore.files.length > 0"
        :files="sessionFileStore.files"
        :primary-attachment-file-reference-id="sessionFileStore.primaryAttachmentFileReferenceId"
        @remove="handleRemoveAttachment"
        @preview="handlePreviewFile"
        @set-primary="sessionFileStore.setPrimaryAttachment"
        @clear-primary="sessionFileStore.clearPrimaryAttachment"
      />

      <textarea
        ref="textareaRef"
        :value="draft"
        rows="3"
        :placeholder="uiText.composer.placeholder"
        aria-label="消息输入"
        @input="emit('update:draft', ($event.target as HTMLTextAreaElement).value)"
        @keydown="handleKeydown"
        @paste="handlePaste"
      />

      <div class="chat-composer__toolbar">
        <div class="composer-tools-left">
          <div class="attachment-entry-wrapper">
            <button
              v-if="appConfig.featureFlags.attachmentEntry"
              class="composer-tool-button composer-tool-button--attachment"
              :class="{ 'composer-tool-button--active': attachmentMenuOpen }"
              type="button"
              :disabled="isTemporarySession || sessionFileStore.authorizing || sessionFolderStore.authorizing || capturingScreenshot"
              :title="attachmentButtonTitle"
              aria-label="添加附件"
              @click="toggleAttachmentMenu"
            >
              <LoaderCircle v-if="sessionFileStore.authorizing || sessionFolderStore.authorizing || capturingScreenshot" :size="18" class="spin" />
              <Paperclip v-else :size="18" />
            </button>

            <!-- 附件选项 popover -->
            <Transition name="attachment-menu">
              <div v-if="attachmentMenuOpen" class="attachment-menu-popover">
                <button class="attachment-menu-item" type="button" @click="handleSelectFiles">
                  <FileUp :size="16" />
                  <span>{{ customText.composer.selectFile }}</span>
                </button>
                <button class="attachment-menu-item" type="button" @click="handleSelectFolder">
                  <FolderOpen :size="16" />
                  <span>{{ customText.folder.selectFolder }}</span>
                </button>
                <div class="attachment-menu-divider"></div>
                <button class="attachment-menu-item" type="button" @click="handleCaptureScreenshot(false)">
                  <Camera :size="16" />
                  <span>{{ customText.composer.captureScreenshotDirect }}</span>
                </button>
                <button class="attachment-menu-item" type="button" @click="handleCaptureScreenshot(true)">
                  <Camera :size="16" />
                  <span>{{ customText.composer.captureScreenshotHidden }}</span>
                </button>
              </div>
            </Transition>
          </div>

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
            :class="{
              'composer-tool-button--active': toolCallLocked || toolCallEnabled,
              'composer-tool-button--locked': toolCallLocked,
            }"
            type="button"
            :title="toolCallLocked ? customText.composer.attachmentToolLocked : toolCallButtonTitle"
            :aria-pressed="(toolCallLocked || toolCallEnabled) ? 'true' : 'false'"
            @click="emit('toggle-tool-call')"
          >
            <Wrench :size="18" />
          </button>
        </div>

        <div class="composer-tools-right">
          <button class="composer-tool-button" type="button" :title="uiText.composer.rollback" aria-label="回退" :disabled="sending" @click="emit('rollback')">
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
          <button v-if="sending" class="send-button" type="button" :title="uiText.composer.stop" aria-label="停止生成" @click="emit('stop')">
            <Square :size="19" />
          </button>
          <button v-else class="send-button" type="button" :title="uiText.composer.send" aria-label="发送消息" :disabled="sending || (!allowEmptySend && !draft.trim()) || modelRequired" @click="submit">
            <SendHorizontal :size="19" />
          </button>
        </div>
      </div>
    </div>
  </footer>

  <!-- 文件预览弹窗 -->
  <FilePreview :open="previewOpen" :file="previewFile" @close="closePreview" />

  <!-- 文件夹授权确认弹窗 -->
  <FolderAuthorizeConfirm
    :open="folderConfirmOpen"
    :folder-path="pendingFolderPath"
    @confirm="handleConfirmFolderAuthorize"
    @cancel="handleCancelFolderAuthorize"
  />
</template>
