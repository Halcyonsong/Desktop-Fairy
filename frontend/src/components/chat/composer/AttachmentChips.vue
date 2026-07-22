<script setup lang="ts">
import { FileText, FileType, FileImage, FileSpreadsheet, Presentation, X } from '@lucide/vue';
import { customText } from '@/config/customText';
import type { SessionFileReference } from '@/main';

const props = defineProps<{
  files: SessionFileReference[];
}>();

const emit = defineEmits<{
  remove: [fileReferenceId: string];
  preview: [file: SessionFileReference];
}>();

// 根据扩展名或 contentType 判断文件类型图标
function fileIcon(file: SessionFileReference) {
  const ext = file.originalFileName.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) return FileImage;
  if (['pdf'].includes(ext)) return FileType;
  if (['docx', 'doc'].includes(ext)) return FileText;
  if (['xlsx', 'xls'].includes(ext)) return FileSpreadsheet;
  if (['pptx', 'ppt'].includes(ext)) return Presentation;
  return FileText;
}

const PREVIEWABLE_IMAGE = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'];
const PREVIEWABLE_TEXT = ['txt', 'md', 'json', 'csv', 'log', 'xml', 'yml', 'yaml', 'java', 'kt', 'js', 'ts', 'html', 'css', 'properties', 'sql'];

function isPreviewable(file: SessionFileReference): boolean {
  const ext = file.originalFileName.split('.').pop()?.toLowerCase() ?? '';
  return PREVIEWABLE_IMAGE.includes(ext) || PREVIEWABLE_TEXT.includes(ext);
}

function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTooltip(file: SessionFileReference): string {
  const tips = [file.originalFileName, formatSize(file.fileSize)];
  const ext = getExtension(file.originalFileName);
  if (PREVIEWABLE_IMAGE.includes(ext)) tips.push(customText.composer.attachmentImage);
  if (file.fileSize > 10 * 1024 * 1024) tips.push(customText.composer.attachmentLargeFile);
  if (isPreviewable(file)) tips.push('点击预览');
  return tips.join(' · ');
}
</script>

<template>
  <div v-if="props.files.length > 0" class="attachment-chips">
    <TransitionGroup name="chip">
      <span
        v-for="file in props.files"
        :key="file.fileReferenceId"
        class="attachment-chip"
        :class="{ 'attachment-chip--clickable': isPreviewable(file) }"
        :title="fileTooltip(file)"
        @click="isPreviewable(file) ? emit('preview', file) : undefined"
      >
        <component :is="fileIcon(file)" :size="14" class="attachment-chip__icon" />
        <span class="attachment-chip__name">{{ file.originalFileName }}</span>
        <span class="attachment-chip__size">{{ formatSize(file.fileSize) }}</span>
        <button
          class="attachment-chip__remove"
          type="button"
          title="移除"
          @click.stop="emit('remove', file.fileReferenceId)"
        >
          <X :size="12" />
        </button>
      </span>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.attachment-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0;
}

.attachment-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text);
  max-width: 240px;
  transition: all 0.15s ease;
}

.attachment-chip:hover {
  border-color: var(--color-border-strong);
}

.attachment-chip--clickable {
  cursor: pointer;
}

.attachment-chip--clickable:hover {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 4%, var(--color-surface));
}

.attachment-chip__icon {
  flex-shrink: 0;
  color: var(--color-accent);
}

.attachment-chip__name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.attachment-chip__size {
  flex-shrink: 0;
  color: var(--color-text-muted);
  font-size: 11px;
}

.attachment-chip__remove {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 2px;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.15s ease;
}

.attachment-chip__remove:hover {
  color: var(--color-danger, var(--color-text));
  background: color-mix(in srgb, var(--color-danger, var(--color-text)) 10%, transparent);
}

/* 动画 */
.chip-enter-active {
  transition: all 0.25s ease;
}

.chip-leave-active {
  transition: all 0.2s ease;
  position: absolute;
}

.chip-enter-from {
  opacity: 0;
  transform: scale(0.8);
}

.chip-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.chip-move {
  transition: transform 0.25s ease;
}
</style>
