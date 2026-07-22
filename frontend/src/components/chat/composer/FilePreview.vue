<script setup lang="ts">
import { ref, watch } from 'vue';
import { FileText, ImageIcon, LoaderCircle, X } from '@lucide/vue';
import type { SessionFileReference } from '@/main';

const props = defineProps<{
  open: boolean;
  file: SessionFileReference | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const loading = ref(false);
const imageUrl = ref<string | null>(null);
const textContent = ref<string | null>(null);
const previewType = ref<'image' | 'text' | 'unsupported'>('unsupported');

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'];
const TEXT_EXTENSIONS = ['txt', 'md', 'json', 'csv', 'log', 'xml', 'yml', 'yaml', 'java', 'kt', 'js', 'ts', 'html', 'css', 'properties', 'sql'];

function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

watch(() => props.file, async (file) => {
  if (!file || !props.open) return;

  imageUrl.value = null;
  textContent.value = null;
  loading.value = true;

  const ext = getExtension(file.originalFileName);

  try {
    if (IMAGE_EXTENSIONS.includes(ext)) {
      previewType.value = 'image';
      const dataUrl = await window.desktopFairy?.readFileAsDataUrl?.(file.absolutePath);
      if (dataUrl) {
        imageUrl.value = dataUrl;
      }
    } else if (TEXT_EXTENSIONS.includes(ext)) {
      previewType.value = 'text';
      const text = await window.desktopFairy?.readFileAsText?.(file.absolutePath);
      if (text !== null && text !== undefined) {
        textContent.value = text;
      }
    } else {
      previewType.value = 'unsupported';
    }
  } finally {
    loading.value = false;
  }
}, { immediate: true });

// ESC 关闭
function handleEsc(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    emit('close');
  }
}

watch(() => props.open, (open) => {
  if (open) {
    window.addEventListener('keydown', handleEsc);
  } else {
    window.removeEventListener('keydown', handleEsc);
  }
});
</script>

<template>
  <Transition name="preview-fade">
    <div v-if="open && file" class="file-preview-overlay" @click.self="emit('close')">
      <div class="file-preview-modal">
        <div class="file-preview-modal__header">
          <div class="file-preview-modal__title">
            <component
              :is="IMAGE_EXTENSIONS.includes(file.originalFileName.split('.').pop()?.toLowerCase() ?? '') ? ImageIcon : FileText"
              :size="16"
            />
            <span>{{ file.originalFileName }}</span>
          </div>
          <div class="file-preview-modal__meta">
            {{ formatSize(file.fileSize) }} · {{ file.contentType || '未知类型' }}
          </div>
          <button class="file-preview-modal__close" type="button" @click="emit('close')">
            <X :size="18" />
          </button>
        </div>

        <div class="file-preview-modal__body">
          <div v-if="loading" class="file-preview-loading">
            <LoaderCircle :size="24" class="spin-icon" />
            <span>加载中...</span>
          </div>

          <div v-else-if="previewType === 'image' && imageUrl" class="file-preview-image">
            <img :src="imageUrl" :alt="file.originalFileName" />
          </div>

          <div v-else-if="previewType === 'text' && textContent !== null" class="file-preview-text">
            <pre>{{ textContent }}</pre>
          </div>

          <div v-else class="file-preview-unsupported">
            <FileText :size="48" />
            <p>该文件格式不支持预览</p>
            <p class="file-preview-unsupported__path">{{ file.absolutePath }}</p>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.file-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.file-preview-modal {
  display: flex;
  flex-direction: column;
  width: 80vw;
  max-width: 900px;
  height: 80vh;
  max-height: 700px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.file-preview-modal__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary, var(--color-surface));
  flex-shrink: 0;
}

.file-preview-modal__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-preview-modal__meta {
  font-size: 12px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.file-preview-modal__close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.file-preview-modal__close:hover {
  color: var(--color-text);
  background: var(--color-surface-hover, rgba(0, 0, 0, 0.06));
}

.file-preview-modal__body {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--color-text-muted);
  font-size: 14px;
}

.file-preview-image {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  width: 100%;
  height: 100%;
}

.file-preview-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
}

.file-preview-text {
  width: 100%;
  height: 100%;
  padding: 16px;
  overflow: auto;
}

.file-preview-text pre {
  font-family: 'Cascadia Code', 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-text);
}

.file-preview-unsupported {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--color-text-muted);
}

.file-preview-unsupported p {
  font-size: 14px;
}

.file-preview-unsupported__path {
  font-size: 12px;
  color: var(--color-text-muted);
  opacity: 0.7;
  word-break: break-all;
  max-width: 400px;
}

/* 动画 */
.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 0.2s ease;
}

.preview-fade-enter-active .file-preview-modal,
.preview-fade-leave-active .file-preview-modal {
  transition: transform 0.2s ease;
}

.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}

.preview-fade-enter-from .file-preview-modal {
  transform: scale(0.95);
}
</style>
