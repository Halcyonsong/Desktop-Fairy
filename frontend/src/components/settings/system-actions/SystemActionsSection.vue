<script setup lang="ts">
import { RefreshCw } from '@lucide/vue';

function reloadPage() {
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
        <button class="settings-page__primary settings-page__primary--icon" type="button" title="重载页面" @click="reloadPage">
          <RefreshCw :size="16" />
          <span>重载页面</span>
        </button>
      </div>
    </section>
  </div>
</template>
