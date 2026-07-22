<script setup lang="ts">
import { ChevronDown, ChevronUp, FileText, FileType, FileImage, FileSpreadsheet, Presentation, FolderOpen, ShieldCheck, X } from '@lucide/vue';
import { computed, ref } from 'vue';
import { customText } from '@/config/customText';
import { formatFileSize, getExtension } from '@/utils/fileUtils';
import type { SessionFileReference, SessionFolderReference } from '@/types/electron';

const props = defineProps<{
  files: SessionFileReference[];
  folders: SessionFolderReference[];
}>();

const emit = defineEmits<{
  revokeFile: [fileReferenceId: string];
  revokeFolder: [folderReferenceId: string];
}>();

const expanded = ref(false);

const totalCount = computed(() => props.files.length + props.folders.length);
const summaryText = computed(() => customText.folder.barSummary(props.folders.length, props.files.length));

function toggleExpand() {
  expanded.value = !expanded.value;
}

function fileIcon(file: SessionFileReference) {
  const ext = getExtension(file.originalFileName);
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) return FileImage;
  if (['pdf'].includes(ext)) return FileType;
  if (['docx', 'doc'].includes(ext)) return FileText;
  if (['xlsx', 'xls'].includes(ext)) return FileSpreadsheet;
  if (['pptx', 'ppt'].includes(ext)) return Presentation;
  return FileText;
}
</script>

<template>
  <div v-if="totalCount > 0" class="auth-paths-bar">
    <!-- 收起状态：摘要栏 -->
    <button
      class="auth-paths-bar__summary"
      type="button"
      :aria-expanded="expanded"
      :title="expanded ? customText.folder.barCollapse : customText.folder.barExpand"
      @click="toggleExpand"
    >
      <ShieldCheck :size="14" class="auth-paths-bar__icon" />
      <span class="auth-paths-bar__text">{{ summaryText }}</span>
      <ChevronUp v-if="expanded" :size="14" class="auth-paths-bar__chevron" />
      <ChevronDown v-else :size="14" class="auth-paths-bar__chevron" />
    </button>

    <!-- 展开状态：授权列表 -->
    <Transition name="auth-paths-expand">
      <div v-if="expanded" class="auth-paths-bar__panel">
        <!-- 空状态 -->
        <div v-if="totalCount === 0" class="auth-paths-bar__empty">
          {{ customText.folder.empty }}
        </div>

        <template v-else>
          <!-- 文件夹区域 -->
          <div v-if="props.folders.length > 0" class="auth-paths-bar__section">
            <div class="auth-paths-bar__section-title">
              <FolderOpen :size="13" />
              <span>{{ customText.folder.sectionFolders }}</span>
              <span class="auth-paths-bar__section-count">{{ props.folders.length }}</span>
            </div>
            <div class="auth-paths-bar__list">
              <div
                v-for="folder in props.folders"
                :key="folder.folderReferenceId"
                class="auth-paths-bar__item auth-paths-bar__item--folder"
              >
                <FolderOpen :size="14" class="auth-paths-bar__item-icon" />
                <div class="auth-paths-bar__item-info">
                  <span class="auth-paths-bar__item-name">{{ folder.folderName }}</span>
                  <span class="auth-paths-bar__item-path" :title="folder.absolutePath">{{ folder.absolutePath }}</span>
                </div>
                <button
                  class="auth-paths-bar__revoke"
                  type="button"
                  :title="customText.folder.revoke"
                  :aria-label="customText.folder.revoke"
                  @click.stop="emit('revokeFolder', folder.folderReferenceId)"
                >
                  <X :size="13" />
                </button>
              </div>
            </div>
          </div>

          <!-- 分隔线 -->
          <div v-if="props.folders.length > 0 && props.files.length > 0" class="auth-paths-bar__divider"></div>

          <!-- 文件区域 -->
          <div v-if="props.files.length > 0" class="auth-paths-bar__section">
            <div class="auth-paths-bar__section-title">
              <FileText :size="13" />
              <span>{{ customText.folder.sectionFiles }}</span>
              <span class="auth-paths-bar__section-count">{{ props.files.length }}</span>
            </div>
            <div class="auth-paths-bar__list">
              <div
                v-for="file in props.files"
                :key="file.fileReferenceId"
                class="auth-paths-bar__item"
              >
                <component :is="fileIcon(file)" :size="14" class="auth-paths-bar__item-icon" />
                <div class="auth-paths-bar__item-info">
                  <span class="auth-paths-bar__item-name">{{ file.originalFileName }}</span>
                  <span class="auth-paths-bar__item-path" :title="file.absolutePath">{{ file.absolutePath }}</span>
                </div>
                <span class="auth-paths-bar__item-size">{{ formatFileSize(file.fileSize) }}</span>
                <button
                  class="auth-paths-bar__revoke"
                  type="button"
                  :title="customText.folder.revoke"
                  :aria-label="customText.folder.revoke"
                  @click.stop="emit('revokeFile', file.fileReferenceId)"
                >
                  <X :size="13" />
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.auth-paths-bar {
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-strong);
}

.auth-paths-bar__summary {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 6px;
  padding: 6px 24px;
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.auth-paths-bar__summary:hover {
  background: var(--color-surface-hover, var(--color-surface-muted));
}

.auth-paths-bar__icon {
  flex-shrink: 0;
  color: var(--color-accent);
}

.auth-paths-bar__text {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.auth-paths-bar__chevron {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.auth-paths-bar__panel {
  max-height: 280px;
  overflow-y: auto;
  padding: 4px 24px 8px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.auth-paths-bar__empty {
  padding: 12px 0;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 12px;
}

.auth-paths-bar__section {
  padding: 4px 0;
}

.auth-paths-bar__section-title {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 0;
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.auth-paths-bar__section-count {
  padding: 0 5px;
  border-radius: 999px;
  background: var(--color-surface-muted);
  font-size: 10px;
  font-weight: 500;
}

.auth-paths-bar__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.auth-paths-bar__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.auth-paths-bar__item:hover {
  background: var(--color-surface-hover, var(--color-surface-muted));
}

.auth-paths-bar__item--folder {
  background: color-mix(in srgb, var(--color-accent) 3%, transparent);
}

.auth-paths-bar__item--folder:hover {
  background: color-mix(in srgb, var(--color-accent) 6%, var(--color-surface));
}

.auth-paths-bar__item-icon {
  flex-shrink: 0;
  color: var(--color-accent);
}

.auth-paths-bar__item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.auth-paths-bar__item-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.auth-paths-bar__item-path {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--font-mono, 'Cascadia Code', 'JetBrains Mono', monospace);
}

.auth-paths-bar__item-size {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--color-text-muted);
}

.auth-paths-bar__revoke {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  padding: 0;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.auth-paths-bar__revoke:hover {
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
}

.auth-paths-bar__divider {
  height: 1px;
  margin: 4px 0;
  background: var(--color-border);
}

/* 展开动画 */
.auth-paths-expand-enter-active {
  transition: max-height 0.25s ease, opacity 0.2s ease;
  overflow: hidden;
}

.auth-paths-expand-leave-active {
  transition: max-height 0.2s ease, opacity 0.15s ease;
  overflow: hidden;
}

.auth-paths-expand-enter-from,
.auth-paths-expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.auth-paths-expand-enter-to,
.auth-paths-expand-leave-from {
  max-height: 280px;
  opacity: 1;
}
</style>
