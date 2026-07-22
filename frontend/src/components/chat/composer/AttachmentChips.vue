<script setup lang="ts">
import { FileText, FileType, FileImage, FileSpreadsheet, Presentation, Star, X } from '@lucide/vue';
import { ref } from 'vue';
import { customText } from '@/config/customText';
import type { SessionFileReference } from '@/types/electron';
import { PREVIEWABLE_IMAGE_EXTENSIONS, PREVIEWABLE_TEXT_EXTENSIONS, getExtension, isPreviewableFile, isImageFile, formatFileSize } from '@/utils/fileUtils';

const props = defineProps<{
  files: SessionFileReference[];
  primaryAttachmentFileReferenceId?: string;
}>();

const emit = defineEmits<{
  remove: [fileReferenceId: string];
  preview: [file: SessionFileReference];
  setPrimary: [fileReferenceId: string];
  clearPrimary: [];
}>();

// 右键菜单状态
const contextMenuOpen = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const contextMenuFile = ref<SessionFileReference | null>(null);

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

function isPrimary(file: SessionFileReference): boolean {
  return props.primaryAttachmentFileReferenceId === file.fileReferenceId;
}

function fileTooltip(file: SessionFileReference): string {
  const tips = [file.originalFileName, formatFileSize(file.fileSize)];
  const ext = getExtension(file.originalFileName);
  if (PREVIEWABLE_IMAGE_EXTENSIONS.includes(ext)) tips.push(customText.composer.attachmentImage);
  if (file.fileSize > 10 * 1024 * 1024) tips.push(customText.composer.attachmentLargeFile);
  if (isPreviewableFile(file.originalFileName)) tips.push('点击预览');
  tips.push('右键设置主附件');
  return tips.join(' · ');
}

// 右键菜单
function handleContextMenu(event: MouseEvent, file: SessionFileReference) {
  event.preventDefault();
  contextMenuFile.value = file;
  contextMenuX.value = event.clientX;
  contextMenuY.value = event.clientY;
  contextMenuOpen.value = true;
}

function closeContextMenu() {
  contextMenuOpen.value = false;
  contextMenuFile.value = null;
}

function handleSetPrimary() {
  if (contextMenuFile.value) {
    emit('setPrimary', contextMenuFile.value.fileReferenceId);
  }
  closeContextMenu();
}

function handleClearPrimary() {
  emit('clearPrimary');
  closeContextMenu();
}

// 点击外部关闭菜单
function handleOutsideClick(event: MouseEvent) {
  const target = event.target as Node;
  const menu = document.querySelector('.attachment-context-menu');
  if (menu && !menu.contains(target)) {
    closeContextMenu();
  }
}

import { onMounted, onBeforeUnmount } from 'vue';
onMounted(() => document.addEventListener('click', handleOutsideClick));
onBeforeUnmount(() => document.removeEventListener('click', handleOutsideClick));
</script>

<template>
  <div v-if="props.files.length > 0" class="attachment-chips">
    <TransitionGroup name="chip">
      <span
        v-for="file in props.files"
        :key="file.fileReferenceId"
        class="attachment-chip"
        :class="{
          'attachment-chip--clickable': isPreviewableFile(file.originalFileName),
          'attachment-chip--primary': isPrimary(file),
        }"
        :title="fileTooltip(file)"
        :tabindex="isPreviewableFile(file.originalFileName) ? 0 : undefined"
        :role="isPreviewableFile(file.originalFileName) ? 'button' : undefined"
        @click="isPreviewableFile(file.originalFileName) ? emit('preview', file) : undefined"
        @keydown.enter="isPreviewableFile(file.originalFileName) ? emit('preview', file) : undefined"
        @contextmenu="handleContextMenu($event, file)"
      >
        <Star v-if="isPrimary(file)" :size="14" class="attachment-chip__primary-icon" fill="currentColor" />
        <component :is="fileIcon(file)" :size="14" class="attachment-chip__icon" />
        <span class="attachment-chip__name">{{ file.originalFileName }}</span>
        <span class="attachment-chip__size">{{ formatFileSize(file.fileSize) }}</span>
        <button
          class="attachment-chip__remove"
          type="button"
          title="移除"
          aria-label="移除附件"
          @click.stop="emit('remove', file.fileReferenceId)"
        >
          <X :size="12" />
        </button>
      </span>
    </TransitionGroup>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenuOpen"
        class="attachment-context-menu"
        role="menu"
        :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
        @click.stop
        @keydown.esc="closeContextMenu"
      >
        <button v-if="contextMenuFile && !isPrimary(contextMenuFile)" class="context-menu-item" type="button" role="menuitem" @click="handleSetPrimary">
          <Star :size="14" />
          <span>设为主附件</span>
        </button>
        <button v-if="contextMenuFile && isPrimary(contextMenuFile)" class="context-menu-item" type="button" role="menuitem" @click="handleClearPrimary">
          <Star :size="14" />
          <span>取消主附件</span>
        </button>
      </div>
    </Teleport>
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

.attachment-chip--primary {
  border-color: color-mix(in srgb, var(--color-accent) 50%, var(--color-border));
  background: color-mix(in srgb, var(--color-accent) 6%, var(--color-surface));
}

.attachment-chip__primary-icon {
  flex-shrink: 0;
  color: var(--color-accent);
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

/* 右键菜单 */
.attachment-context-menu {
  position: fixed;
  z-index: 10002;
  min-width: 140px;
  padding: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: var(--shadow-md, 0 4px 16px rgba(0, 0, 0, 0.12));
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--color-text);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.context-menu-item:hover {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  color: var(--color-accent);
}

.context-menu-item svg {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.context-menu-item:hover svg {
  color: var(--color-accent);
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
