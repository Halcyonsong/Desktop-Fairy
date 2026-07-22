<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info, X, TriangleAlert } from '@lucide/vue';
import { useToastStore } from '@/stores/toastStore';

const toast = useToastStore();

const iconMap = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
};
</script>

<template>
  <TransitionGroup name="toast" tag="div" class="toast-container">
    <div
      v-for="item in toast.items"
      :key="item.id"
      class="toast"
      :class="`toast--${item.type}`"
      @click="toast.dismiss(item.id)"
    >
      <component :is="iconMap[item.type]" :size="16" class="toast__icon" />
      <span class="toast__message">{{ item.message }}</span>
      <button class="toast__close" type="button" @click.stop="toast.dismiss(item.id)">
        <X :size="14" />
      </button>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  color: var(--color-text);
  font-size: 13px;
  line-height: 1.5;
  max-width: 380px;
  min-width: 200px;
  pointer-events: auto;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast__icon {
  flex-shrink: 0;
}

.toast__message {
  flex: 1;
  word-break: break-word;
}

.toast__close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 2px;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.toast__close:hover {
  color: var(--color-text);
  background: var(--color-surface-hover, rgba(0, 0, 0, 0.06));
}

/* 类型样式 */
.toast--success {
  border-left: 3px solid var(--color-success, #22c55e);
}

.toast--success .toast__icon {
  color: var(--color-success, #22c55e);
}

.toast--error {
  border-left: 3px solid var(--color-danger, #ef4444);
}

.toast--error .toast__icon {
  color: var(--color-danger, #ef4444);
}

.toast--warning {
  border-left: 3px solid var(--color-warning, #f59e0b);
}

.toast--warning .toast__icon {
  color: var(--color-warning, #f59e0b);
}

.toast--info {
  border-left: 3px solid var(--color-accent);
}

.toast--info .toast__icon {
  color: var(--color-accent);
}

/* 动画 */
.toast-enter-active {
  transition: all 0.3s ease;
}

.toast-leave-active {
  transition: all 0.25s ease;
  position: absolute;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.25s ease;
}
</style>
