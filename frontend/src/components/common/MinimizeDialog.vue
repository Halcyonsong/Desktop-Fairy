<script setup lang="ts">
import { Inbox, Minimize2, PanelBottom } from '@lucide/vue';
import { onUnmounted, ref, watch } from 'vue';
import { customText } from '@/config/customText';
import { useMinimizePreferencesStore } from '@/stores/minimizePreferencesStore';
import type { MinimizeBehavior } from '@/main';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const minimizePrefs = useMinimizePreferencesStore();

const selectedBehavior = ref<MinimizeBehavior>('taskbar');
const rememberChoice = ref(false);

function openDialog() {
  // 每次打开时默认选中当前已保存的行为
  selectedBehavior.value = minimizePrefs.behavior;
  rememberChoice.value = false;
}

async function confirm() {
  if (rememberChoice.value) {
    // 记住选择：更新偏好并关闭询问
    await minimizePrefs.setPrefs({
      behavior: selectedBehavior.value,
      askAgain: false,
    });
  } else {
    // 仅本次使用所选行为，不改变 askAgain
    await minimizePrefs.setBehavior(selectedBehavior.value);
  }
  await minimizePrefs.executeMinimize(selectedBehavior.value);
  emit('close');
}

function cancel() {
  // 取消：不做任何最小化，关闭弹窗
  emit('close');
}

// ===== ESC 键关闭支持 =====
function handleEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    cancel();
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
  <Transition name="modal-fade" @before-enter="openDialog">
    <div v-if="props.open" class="minimize-dialog-overlay" @click.self="cancel">
      <div class="minimize-dialog" role="dialog" aria-modal="true">
        <div class="minimize-dialog__header">
          <Minimize2 :size="18" />
          <h3 class="minimize-dialog__title">最小化到</h3>
        </div>

        <div class="minimize-dialog__options">
          <button
            class="minimize-option"
            :class="{ 'minimize-option--active': selectedBehavior === 'taskbar' }"
            type="button"
            @click="selectedBehavior = 'taskbar'"
          >
            <PanelBottom :size="20" />
            <span class="minimize-option__label">{{ customText.desktopBehavior.minimizeOptionTaskbar }}</span>
          </button>

          <button
            class="minimize-option"
            :class="{ 'minimize-option--active': selectedBehavior === 'tray' }"
            type="button"
            @click="selectedBehavior = 'tray'"
          >
            <Inbox :size="20" />
            <span class="minimize-option__label">{{ customText.desktopBehavior.minimizeOptionTray }}</span>
          </button>
        </div>

        <label class="minimize-dialog__remember">
          <input v-model="rememberChoice" type="checkbox" />
          <span>记住选择，不再询问</span>
        </label>

        <div class="minimize-dialog__actions">
          <button type="button" class="minimize-dialog__button minimize-dialog__button--ghost" @click="cancel">取消</button>
          <button type="button" class="minimize-dialog__button minimize-dialog__button--primary" @click="confirm">确定</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.minimize-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
}

.minimize-dialog {
  width: 320px;
  padding: 20px;
  border-radius: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.minimize-dialog__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  color: var(--color-text);
}

.minimize-dialog__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.minimize-dialog__options {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.minimize-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  border: 1.5px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s ease;
}

.minimize-option:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover, var(--color-surface));
}

.minimize-option--active {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface));
  color: var(--color-accent);
}

.minimize-option__label {
  font-size: 13px;
  font-weight: 500;
}

.minimize-dialog__remember {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  font-size: 12px;
  color: var(--color-text-muted);
  cursor: pointer;
}

.minimize-dialog__remember input {
  cursor: pointer;
}

.minimize-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.minimize-dialog__button {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.minimize-dialog__button--ghost {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.minimize-dialog__button--ghost:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text);
}

.minimize-dialog__button--primary {
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  color: white;
}

.minimize-dialog__button--primary:hover {
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
