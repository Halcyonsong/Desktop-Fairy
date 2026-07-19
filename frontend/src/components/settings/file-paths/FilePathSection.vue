<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Copy, FolderOpen, RefreshCw } from '@lucide/vue';
import { useDesktopFairyAPI } from '@/composables/useDesktopFairyAPI';
import { copyText } from '@/utils/clipboard';
import { UI_TIMING } from '@/config/uiConstants';
import type { FilePathsResult } from '@/main';

const desktopFairy = useDesktopFairyAPI();

const filePaths = ref<FilePathsResult | null>(null);
const loading = ref(false);
const errorMsg = ref<string>('');
const copiedKey = ref<string>('');
const copyFailed = ref<boolean>(false);

async function loadFilePaths() {
  if (!desktopFairy.isAvailable()) {
    errorMsg.value = '此功能仅在 Electron 桌面应用环境下可用。请在桌面应用中查看文件路径。';
    return;
  }
  loading.value = true;
  errorMsg.value = '';
  try {
    filePaths.value = await desktopFairy.getFilePaths();
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function copyPath(path: string, key: string) {
  await copyText(path, {
    onSuccess: () => {
      copiedKey.value = key;
      copyFailed.value = false;
      setTimeout(() => {
        copiedKey.value = '';
      }, UI_TIMING.copyFeedbackResetMs);
    },
    onFail: () => {
      copyFailed.value = true;
      setTimeout(() => {
        copyFailed.value = false;
      }, UI_TIMING.copyFeedbackResetMs);
    },
  });
}

function refresh() {
  loadFilePaths();
}

onMounted(() => {
  loadFilePaths();
});
</script>

<template>
  <div class="settings-page__surface file-paths">
    <header class="settings-page__header settings-page__header--compact">
      <div>
        <span class="chat-header__status">存储与文件</span>
        <h1>文件保存路径</h1>
      </div>
      <button
        class="file-paths__refresh"
        type="button"
        :disabled="loading || !desktopFairy.isAvailable()"
        @click="refresh"
      >
        <RefreshCw :size="14" :class="{ 'spin': loading }" />
        <span>刷新</span>
      </button>
    </header>

    <section class="settings-section settings-section--compact">
      <div class="settings-section__heading">
        <div>
          <h2>所有数据存储位置</h2>
          <p>应用所有数据的存储路径。可以点击"复制"按钮复制单个路径，或打开所在文件夹进行手动操作。</p>
        </div>
      </div>

      <div v-if="errorMsg" class="file-paths__error">
        {{ errorMsg }}
      </div>

      <div v-else-if="loading" class="file-paths__loading">
        加载中...
      </div>

      <div v-else-if="filePaths" class="file-paths__list">
        <div
          v-for="item in filePaths.paths"
          :key="item.key"
          class="file-paths__item"
        >
          <div class="file-paths__item-header">
            <FolderOpen :size="16" class="file-paths__item-icon" />
            <span class="file-paths__item-label">{{ item.label }}</span>
            <button
              class="file-paths__copy-btn"
              type="button"
              :title="copiedKey === item.key ? '已复制！' : '复制路径'"
              @click="copyPath(item.path, item.key)"
            >
              <Copy :size="12" />
              <span>{{ copiedKey === item.key ? '已复制' : '复制' }}</span>
            </button>
          </div>
          <code class="file-paths__item-path">{{ item.path }}</code>
          <p class="file-paths__item-desc">{{ item.description }}</p>
        </div>
      </div>

      <!-- 环境信息 -->
      <div v-if="filePaths" class="file-paths__env">
        <h3>环境信息</h3>
        <div class="file-paths__env-grid">
          <div class="file-paths__env-item">
            <span class="file-paths__env-label">用户目录</span>
            <code>{{ filePaths.home }}</code>
          </div>
          <div class="file-paths__env-item">
            <span class="file-paths__env-label">本地应用数据</span>
            <code>{{ filePaths.localAppData }}</code>
          </div>
          <div class="file-paths__env-item">
            <span class="file-paths__env-label">Electron 用户数据</span>
            <code>{{ filePaths.userData }}</code>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.file-paths {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.file-paths__refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.file-paths__refresh:hover:not(:disabled) {
  background: var(--color-hover-soft);
}

.file-paths__refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.file-paths__error {
  padding: 10px 14px;
  margin-bottom: 12px;
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
  border-radius: 6px;
  color: var(--color-warning);
  font-size: 13px;
}

.file-paths__loading {
  padding: 40px;
  text-align: center;
  color: var(--color-text-muted);
  font-style: italic;
}

.file-paths__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.file-paths__item {
  padding: 12px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  transition: border-color 0.15s ease;
}

.file-paths__item:hover {
  border-color: var(--color-primary);
}

.file-paths__item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.file-paths__item-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

.file-paths__item-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  flex: 1;
}

.file-paths__copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.file-paths__copy-btn:hover {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.file-paths__item-path {
  display: block;
  padding: 6px 10px;
  margin-bottom: 6px;
  background: var(--color-bg);
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: var(--color-primary);
  word-break: break-all;
  user-select: all;
}

.file-paths__item-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 0;
}

.file-paths__env {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.file-paths__env h3 {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  margin: 0 0 12px 0;
}

.file-paths__env-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-paths__env-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-paths__env-label {
  font-size: 11px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.file-paths__env-item code {
  padding: 4px 8px;
  background: var(--color-bg);
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 11px;
  color: var(--color-text-muted);
  word-break: break-all;
  user-select: all;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
