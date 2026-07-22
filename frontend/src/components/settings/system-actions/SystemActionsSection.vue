<script setup lang="ts">
import { ref } from 'vue';
import { RefreshCw } from '@lucide/vue';

const reloadConfirmOpen = ref(false);

function openReloadConfirm() {
  reloadConfirmOpen.value = true;
}

function cancelReload() {
  reloadConfirmOpen.value = false;
}

function confirmReload() {
  reloadConfirmOpen.value = false;
  window.location.reload();
}
</script>

<template>
  <div class="settings-page__surface">
    <header class="settings-page__header settings-page__header--compact">
      <div>
        <span class="chat-header__status">系统性操作</span>
        <h1>系统性操作</h1>
      </div>
    </header>

    <section class="settings-section settings-section--compact">
      <div class="settings-section__heading">
        <div>
          <h2>重载页面</h2>
          <p>重新加载整个前端工作台，并重新初始化当前页面的数据与状态。</p>
        </div>
      </div>

      <div class="settings-panel__actions settings-panel__actions--block">
        <button class="settings-page__primary settings-page__primary--icon" type="button" title="重载页面" @click="openReloadConfirm">
          <RefreshCw :size="16" />
          <span>重载页面</span>
        </button>
      </div>
    </section>

    <Transition name="reload-modal-fade">
      <div v-if="reloadConfirmOpen" class="reload-modal-overlay" @click.self="cancelReload">
        <div class="reload-modal" role="dialog" aria-modal="true">
          <h3 class="reload-modal__title">重载页面</h3>
          <p class="reload-modal__message">重载页面将丢失当前未保存的内容。确认要重载吗？</p>
          <div class="reload-modal__actions">
            <button type="button" class="reload-modal__button reload-modal__button--ghost" @click="cancelReload">取消</button>
            <button type="button" class="reload-modal__button reload-modal__button--primary" @click="confirmReload">确认</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.reload-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 18, 30, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.reload-modal {
  width: 360px;
  max-width: calc(100vw - 48px);
  padding: 22px 22px 18px;
  border-radius: 16px;
  background: var(--color-surface-strong, #fff);
  box-shadow: 0 24px 48px rgba(15, 18, 30, 0.24);
}

.reload-modal__title {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.reload-modal__message {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--color-text);
}

.reload-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.reload-modal__button {
  min-width: 72px;
  height: 34px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 9px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.reload-modal__button--ghost {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.reload-modal__button--ghost:hover {
  background: var(--color-hover-soft);
}

.reload-modal__button--primary {
  background: var(--color-accent);
  color: #fff;
}

.reload-modal__button--primary:hover {
  filter: brightness(1.08);
}

.reload-modal-fade-enter-active,
.reload-modal-fade-leave-active {
  transition: opacity 0.18s ease;
}

.reload-modal-fade-enter-from,
.reload-modal-fade-leave-to {
  opacity: 0;
}
</style>
