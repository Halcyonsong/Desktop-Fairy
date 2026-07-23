<script setup lang="ts">
import { AlertTriangle } from '@lucide/vue';
import { onUnmounted, watch } from 'vue';

const props = defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
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
    <div v-if="props.open" class="confirm-overlay" @click.self="emit('cancel')">
      <div class="confirm-dialog" role="dialog" aria-modal="true">
        <div class="confirm-dialog__header">
          <AlertTriangle :size="18" class="confirm-dialog__icon" />
          <h3 class="confirm-dialog__title">{{ props.title }}</h3>
        </div>

        <div class="confirm-dialog__body">
          <p class="confirm-dialog__message">{{ props.message }}</p>
        </div>

        <div class="confirm-dialog__actions">
          <button type="button" class="confirm-dialog__button confirm-dialog__button--ghost" @click="emit('cancel')">
            {{ props.cancelText ?? '取消' }}
          </button>
          <button type="button" class="confirm-dialog__button confirm-dialog__button--danger" @click="emit('confirm')">
            {{ props.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay, rgba(0, 0, 0, 0.3));
  backdrop-filter: blur(2px);
}

.confirm-dialog {
  width: 360px;
  max-width: 90vw;
  padding: 20px;
  border-radius: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.15));
}

.confirm-dialog__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  color: var(--color-text);
}

.confirm-dialog__icon {
  color: var(--color-danger);
  flex-shrink: 0;
}

.confirm-dialog__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.confirm-dialog__body {
  margin-bottom: 16px;
}

.confirm-dialog__message {
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 0;
}

.confirm-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.confirm-dialog__button {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.confirm-dialog__button--ghost {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.confirm-dialog__button--ghost:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text);
}

.confirm-dialog__button--danger {
  background: var(--color-danger);
  border: 1px solid var(--color-danger);
  color: var(--color-accent-contrast);
}

.confirm-dialog__button--danger:hover {
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
