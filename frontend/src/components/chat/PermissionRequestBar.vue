<script setup lang="ts">
import { Check, FileText, FolderOpen, ShieldAlert, X } from '@lucide/vue';
import { ref } from 'vue';
import { customText } from '@/config/customText';
import { usePermissionRequestStore } from '@/stores/permissionRequestStore';

const permissionRequestStore = usePermissionRequestStore();

const extraContent = ref('');
const processing = ref(false);

const emit = defineEmits<{
  approve: [extraContent: string];
  reject: [extraContent: string];
  dismiss: [];
}>();

function handleApprove() {
  if (processing.value) return;
  processing.value = true;
  emit('approve', extraContent.value.trim());
}

function handleReject() {
  if (processing.value) return;
  processing.value = true;
  emit('reject', extraContent.value.trim());
}

function handleDismiss() {
  if (processing.value) return;
  emit('dismiss');
}

function reset() {
  extraContent.value = '';
  processing.value = false;
}

defineExpose({ reset });
</script>

<template>
  <Transition name="permission-bar-slide">
    <div v-if="permissionRequestStore.hasPending" class="permission-bar">
      <div class="permission-bar__header">
        <div class="permission-bar__title-group">
          <ShieldAlert :size="16" class="permission-bar__icon" />
          <span class="permission-bar__title">{{ customText.permission.title }}</span>
          <span
            class="permission-bar__type-badge"
            :class="permissionRequestStore.isFolderRequest ? 'permission-bar__type-badge--folder' : 'permission-bar__type-badge--file'"
          >
            <component :is="permissionRequestStore.isFolderRequest ? FolderOpen : FileText" :size="12" />
            {{ permissionRequestStore.isFolderRequest ? customText.permission.requestTypeFolder : customText.permission.requestTypeFile }}
          </span>
        </div>
        <button
          class="permission-bar__close"
          type="button"
          :title="customText.permission.dismiss"
          :aria-label="customText.permission.dismiss"
          @click="handleDismiss"
        >
          <X :size="16" />
        </button>
      </div>

      <div class="permission-bar__body">
        <div class="permission-bar__path-row">
          <span class="permission-bar__path-label">{{ customText.permission.description }}</span>
          <code class="permission-bar__path" :title="permissionRequestStore.absolutePath">{{ permissionRequestStore.absolutePath }}</code>
        </div>

        <div v-if="permissionRequestStore.reason" class="permission-bar__reason">
          <span class="permission-bar__reason-label">{{ customText.permission.reasonLabel }}：</span>
          <span class="permission-bar__reason-text">{{ permissionRequestStore.reason }}</span>
        </div>

        <input
          v-model="extraContent"
          class="permission-bar__extra-input"
          type="text"
          :placeholder="customText.permission.extraPlaceholder"
          @keydown.enter="handleApprove"
        />
      </div>

      <div class="permission-bar__actions">
        <button
          class="permission-bar__button permission-bar__button--approve"
          type="button"
          :disabled="processing"
          @click="handleApprove"
        >
          <Check :size="14" />
          <span>{{ customText.permission.approve }}</span>
        </button>
        <button
          class="permission-bar__button permission-bar__button--reject"
          type="button"
          :disabled="processing"
          @click="handleReject"
        >
          <X :size="14" />
          <span>{{ customText.permission.reject }}</span>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.permission-bar {
  flex-shrink: 0;
  padding: 10px 24px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-strong);
}

.permission-bar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.permission-bar__title-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.permission-bar__icon {
  flex-shrink: 0;
  color: var(--color-warning, #f59e0b);
}

.permission-bar__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.permission-bar__type-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
}

.permission-bar__type-badge--file {
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
  color: var(--color-accent);
}

.permission-bar__type-badge--folder {
  background: color-mix(in srgb, var(--color-warning, #f59e0b) 12%, transparent);
  color: var(--color-warning, #f59e0b);
}

.permission-bar__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  padding: 0;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.permission-bar__close:hover {
  color: var(--color-text);
  background: var(--color-surface-hover, var(--color-surface-muted));
}

.permission-bar__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.permission-bar__path-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.permission-bar__path-label {
  font-size: 11px;
  color: var(--color-text-muted);
}

.permission-bar__path {
  display: block;
  padding: 5px 8px;
  border-radius: 4px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  font-size: 12px;
  word-break: break-all;
  color: var(--color-text);
  font-family: var(--font-mono, 'Cascadia Code', 'JetBrains Mono', monospace);
}

.permission-bar__reason {
  display: flex;
  gap: 4px;
  font-size: 12px;
}

.permission-bar__reason-label {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.permission-bar__reason-text {
  color: var(--color-text);
}

.permission-bar__extra-input {
  width: 100%;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: 12px;
  color: var(--color-text);
  outline: none;
  transition: border-color 0.15s ease;
}

.permission-bar__extra-input:focus {
  border-color: var(--color-accent);
}

.permission-bar__extra-input::placeholder {
  color: var(--color-text-muted);
}

.permission-bar__actions {
  display: flex;
  gap: 8px;
}

.permission-bar__button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.permission-bar__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.permission-bar__button--approve {
  background: var(--color-success, #22c55e);
  color: #fff;
}

.permission-bar__button--approve:hover:not(:disabled) {
  filter: brightness(1.1);
}

.permission-bar__button--reject {
  background: none;
  border-color: var(--color-border);
  color: var(--color-text-muted);
}

.permission-bar__button--reject:hover:not(:disabled) {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

/* 滑入动画 */
.permission-bar-slide-enter-active {
  transition: max-height 0.3s ease, opacity 0.2s ease;
  overflow: hidden;
}

.permission-bar-slide-leave-active {
  transition: max-height 0.2s ease, opacity 0.15s ease;
  overflow: hidden;
}

.permission-bar-slide-enter-from,
.permission-bar-slide-leave-to {
  max-height: 0;
  opacity: 0;
}

.permission-bar-slide-enter-to,
.permission-bar-slide-leave-from {
  max-height: 300px;
  opacity: 1;
}
</style>
