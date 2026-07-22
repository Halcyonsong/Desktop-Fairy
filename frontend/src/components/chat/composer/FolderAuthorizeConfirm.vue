<script setup lang="ts">
import { AlertTriangle, FolderOpen } from '@lucide/vue';
import { onUnmounted, watch } from 'vue';
import { customText } from '@/config/customText';

const props = defineProps<{
  open: boolean;
  folderPath: string;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

function handleEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('cancel');
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      window.addEventListener('keydown', handleEsc);
    } else {
      window.removeEventListener('keydown', handleEsc);
    }
  },
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleEsc);
});
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="props.open" class="folder-confirm-overlay" @click.self="emit('cancel')">
      <div class="folder-confirm-dialog" role="dialog" aria-modal="true">
        <div class="folder-confirm-dialog__header">
          <AlertTriangle :size="18" class="folder-confirm-dialog__icon" />
          <h3 class="folder-confirm-dialog__title">{{ customText.folder.confirmTitle }}</h3>
        </div>

        <div class="folder-confirm-dialog__body">
          <p class="folder-confirm-dialog__warning">{{ customText.folder.confirmWarning }}</p>
          <div class="folder-confirm-dialog__path-box">
            <FolderOpen :size="16" class="folder-confirm-dialog__path-icon" />
            <span class="folder-confirm-dialog__path-label">{{ customText.folder.confirmPath }}</span>
          </div>
          <code class="folder-confirm-dialog__path">{{ props.folderPath }}</code>
        </div>

        <div class="folder-confirm-dialog__actions">
          <button type="button" class="folder-confirm-dialog__button folder-confirm-dialog__button--ghost" @click="emit('cancel')">
            {{ customText.folder.confirmCancel }}
          </button>
          <button type="button" class="folder-confirm-dialog__button folder-confirm-dialog__button--danger" @click="emit('confirm')">
            {{ customText.folder.confirmSubmit }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.folder-confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay, rgba(0, 0, 0, 0.3));
  backdrop-filter: blur(2px);
}

.folder-confirm-dialog {
  width: 380px;
  max-width: 90vw;
  padding: 20px;
  border-radius: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.15));
}

.folder-confirm-dialog__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  color: var(--color-text);
}

.folder-confirm-dialog__icon {
  color: var(--color-danger);
  flex-shrink: 0;
}

.folder-confirm-dialog__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.folder-confirm-dialog__body {
  margin-bottom: 16px;
}

.folder-confirm-dialog__warning {
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 0 0 12px 0;
}

.folder-confirm-dialog__path-box {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.folder-confirm-dialog__path-icon {
  color: var(--color-accent);
  flex-shrink: 0;
}

.folder-confirm-dialog__path-label {
  font-size: 12px;
  color: var(--color-text-muted);
}

.folder-confirm-dialog__path {
  display: block;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  font-size: 12px;
  word-break: break-all;
  color: var(--color-text);
  font-family: var(--font-mono, 'Cascadia Code', 'JetBrains Mono', monospace);
}

.folder-confirm-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.folder-confirm-dialog__button {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.folder-confirm-dialog__button--ghost {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.folder-confirm-dialog__button--ghost:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text);
}

.folder-confirm-dialog__button--danger {
  background: var(--color-danger);
  border: 1px solid var(--color-danger);
  color: var(--color-accent-contrast);
}

.folder-confirm-dialog__button--danger:hover {
  filter: brightness(1.1);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
