<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Copy, FolderOpen, RefreshCw } from '@lucide/vue';
import { useDesktopFairyAPI } from '@/api/useDesktopFairyAPI';
import { copyText } from '@/utils/clipboard';
import { UI_TIMING } from '@/config/uiConstants';
import type { FilePathsResult } from '@/types/electron';

const desktopFairy = useDesktopFairyAPI();

const filePaths = ref<FilePathsResult | null>(null);
const loading = ref(false);
const errorMsg = ref<string>('');
const copiedKey = ref<string>('');
const copyFailed = ref<boolean>(false);
const refreshSuccess = ref(false);
const hasLoadedOnce = ref(false);

async function loadFilePaths(options: { showRefreshSuccess?: boolean } = {}) {
  if (!desktopFairy.isAvailable()) {
    errorMsg.value = '此功能仅在 Electron 桌面应用环境下可用。请在桌面应用中查看文件路径。';
    return;
  }
  loading.value = true;
  errorMsg.value = '';
  refreshSuccess.value = false;
  try {
    filePaths.value = await desktopFairy.getFilePaths();
    if (options.showRefreshSuccess && hasLoadedOnce.value) {
      refreshSuccess.value = true;
      setTimeout(() => {
        refreshSuccess.value = false;
      }, UI_TIMING.copyFeedbackResetMs);
    }
    hasLoadedOnce.value = true;
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
      copiedKey.value = '';
      setTimeout(() => {
        copyFailed.value = false;
      }, UI_TIMING.copyFeedbackResetMs);
    },
  });
}

function refresh() {
  void loadFilePaths({ showRefreshSuccess: true });
}

onMounted(() => {
  void loadFilePaths();
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
        <RefreshCw :size="14" :class="{ spin: loading }" />
        <span>{{ refreshSuccess ? '已刷新' : '刷新' }}</span>
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

      <div v-else-if="refreshSuccess" class="file-paths__success">
        路径信息已刷新。
      </div>

      <div v-if="copyFailed" class="file-paths__error file-paths__error--inline">
        复制失败，请手动选择路径后复制。
      </div>

      <div v-if="filePaths" class="file-paths__list">
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
              :title="copyFailed ? '复制失败' : copiedKey === item.key ? '已复制！' : '复制路径'"
              @click="copyPath(item.path, item.key)"
            >
              <Copy :size="12" />
              <span>{{ copyFailed ? '复制失败' : copiedKey === item.key ? '已复制' : '复制' }}</span>
            </button>
          </div>
          <code class="file-paths__item-path">{{ item.path }}</code>
          <p class="file-paths__item-desc">{{ item.description }}</p>
        </div>
      </div>

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

.file-paths__error,
.file-paths__success {
  padding: 10px 14px;
  margin-bottom: 12px;
  border-radius: 6px;
  font-size: 13px;
}

.file-paths__error {
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
  color: var(--color-warning);
}

.file-paths__error--inline {
  margin-top: 12px;
}

.file-paths__success {
  background: color-mix(in srgb, var(--color-success, #10b981) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-success, #10b981) 45%, transparent);
  color: color-mix(in srgb, var(--color-success, #10b981) 86%, var(--color-text) 14%);
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
}

.file-paths__env {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}

.file-paths__env h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.file-paths__env-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.file-paths__env-item {
  padding: 10px 12px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.file-paths__env-label {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  color: var(--color-text-muted);
}

.file-paths__env-item code {
  font-size: 12px;
  color: var(--color-text);
  word-break: break-all;
}

.spin {
  animation: spin 0.8s linear infinite;
}
</style>
