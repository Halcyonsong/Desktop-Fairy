<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { ArrowDownToLine, Eraser, Filter, Pause, Play, RefreshCw, Search } from '@lucide/vue';
import { useLoggerStore, type LogLevel } from '@/stores/loggerStore';
import { useLogViewerPanelController } from '@/components/settings/log-viewer/controllers/useLogViewerPanelController';

const logger = useLoggerStore();

// 当前 tab：frontend（前端内存日志） / backend（后端文件日志）
const activeTab = ref<'frontend' | 'backend'>('frontend');

const {
  copyButtonTitle,
  backendCopyButtonTitle,
  backendLogs,
  backendLogPath,
  backendLogLoading,
  backendLogError,
  backendLogLines,
  backendLogArray,
  copyAllLogs,
  loadBackendLogs,
  copyBackendLogs,
} = useLogViewerPanelController({
  activeTab,
  exportFrontendLogs: () => logger.exportAsText(),
});

// ===== 前端日志状态 =====
const searchKeyword = ref('');
const selectedLevel = ref<LogLevel | 'all'>('all');
const selectedSource = ref<string>('all');
const autoScroll = ref(true);
const paused = ref(false);

const sourceOptions = computed(() => {
  const set = new Set<string>();
  for (const entry of logger.entries) {
    set.add(entry.source);
  }
  return Array.from(set).sort();
});

const filteredEntries = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();
  return logger.entries.filter((entry) => {
    if (selectedLevel.value !== 'all' && entry.level !== selectedLevel.value) {
      return false;
    }
    if (selectedSource.value !== 'all' && entry.source !== selectedSource.value) {
      return false;
    }
    if (keyword) {
      const text = `${entry.message} ${entry.details ?? ''}`.toLowerCase();
      if (!text.includes(keyword)) {
        return false;
      }
    }
    return true;
  });
});

const logContainerRef = ref<HTMLElement | null>(null);

async function scrollToBottom() {
  if (!autoScroll.value || paused.value) {
    return;
  }
  await nextTick();
  if (logContainerRef.value) {
    logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight;
  }
}

watch(() => logger.entries.length, () => {
  if (autoScroll.value && !paused.value) {
    scrollToBottom();
  }
});

function togglePause() {
  paused.value = !paused.value;
}

// 清除日志确认模态框状态（替代 window.confirm，Electron 环境下 window.confirm 默认禁用）
const clearLogsModalOpen = ref(false);

function clearLogs() {
  clearLogsModalOpen.value = true;
}

function confirmClearLogs() {
  logger.clear();
  clearLogsModalOpen.value = false;
}

function cancelClearLogs() {
  clearLogsModalOpen.value = false;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function levelLabel(level: LogLevel): string {
  switch (level) {
    case 'debug': return 'DEBUG';
    case 'info': return 'INFO';
    case 'warn': return 'WARN';
    case 'error': return 'ERROR';
  }
}

const levelOptions: Array<{ value: LogLevel | 'all'; label: string }> = [
  { value: 'all', label: '全部级别' },
  { value: 'debug', label: 'DEBUG' },
  { value: 'info', label: 'INFO' },
  { value: 'warn', label: 'WARN' },
  { value: 'error', label: 'ERROR' },
];

const stats = computed(() => ({
  total: logger.entries.length,
  errors: logger.errorCount,
  warns: logger.warnCount,
}));


</script>

<template>
  <div class="settings-page__surface log-viewer">
    <header class="settings-page__header settings-page__header--compact">
      <div>
        <span class="chat-header__status">开发与排查</span>
        <h1>日志查看</h1>
      </div>
      <div class="log-viewer__stats">
        <span class="log-viewer__stat" :title="`共 ${stats.total} 条前端日志`">前端 {{ stats.total }}</span>
        <span class="log-viewer__stat log-viewer__stat--warn" :title="`${stats.warns} 条警告`">⚠ {{ stats.warns }}</span>
        <span class="log-viewer__stat log-viewer__stat--error" :title="`${stats.errors} 条错误`">✕ {{ stats.errors }}</span>
      </div>
    </header>

    <!-- Tab 切换 -->
    <div class="log-viewer__tabs">
      <button
        class="log-viewer__tab"
        :class="{ 'log-viewer__tab--active': activeTab === 'frontend' }"
        type="button"
        @click="activeTab = 'frontend'"
      >
        前端日志（内存）
      </button>
      <button
        class="log-viewer__tab"
        :class="{ 'log-viewer__tab--active': activeTab === 'backend' }"
        type="button"
        @click="activeTab = 'backend'"
      >
        后端日志（文件）
      </button>
    </div>

    <!-- 前端日志 Tab -->
    <section v-if="activeTab === 'frontend'" class="settings-section settings-section--compact">
      <div class="settings-section__heading">
        <div>
          <h2>前端运行日志</h2>
          <p>实时显示前端运行日志，包括 console 输出、未捕获错误和 Promise 拒绝。日志保存在内存中，最多 2000 条，刷新页面后仅保留最近 500 条持久化日志。</p>
        </div>
      </div>

      <!-- 工具栏 -->
      <div class="log-viewer__toolbar">
        <div class="log-viewer__search">
          <Search :size="14" />
          <input
            v-model="searchKeyword"
            type="text"
            placeholder="搜索日志内容..."
            class="log-viewer__search-input"
          />
        </div>
        <select v-model="selectedLevel" class="log-viewer__select" title="日志级别">
          <option v-for="opt in levelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <select v-model="selectedSource" class="log-viewer__select" title="来源模块">
          <option value="all">全部来源</option>
          <option v-for="src in sourceOptions" :key="src" :value="src">{{ src }}</option>
        </select>
        <label class="log-viewer__autoscroll" title="新日志自动滚动到底部">
          <input v-model="autoScroll" type="checkbox" />
          <ArrowDownToLine :size="14" />
        </label>
        <button
          class="log-viewer__btn"
          :class="{ 'log-viewer__btn--active': paused }"
          type="button"
          :title="paused ? '恢复日志' : '暂停日志'"
          @click="togglePause"
        >
          <Pause v-if="!paused" :size="14" />
          <Play v-else :size="14" />
          <span>{{ paused ? '已暂停' : '暂停' }}</span>
        </button>
        <button class="log-viewer__btn" type="button" :title="copyButtonTitle" @click="copyAllLogs">
          <Filter :size="14" />
          <span>{{ copyButtonTitle }}</span>
        </button>
        <button class="log-viewer__btn log-viewer__btn--danger" type="button" title="清除所有日志" @click="clearLogs">
          <Eraser :size="14" />
          <span>清除</span>
        </button>
      </div>

      <!-- 日志列表 -->
      <div ref="logContainerRef" class="log-viewer__list">
        <div v-if="filteredEntries.length === 0" class="log-viewer__empty">
          暂无日志{{ searchKeyword || selectedLevel !== 'all' || selectedSource !== 'all' ? '（当前筛选条件下）' : '' }}
        </div>
        <div
          v-for="entry in filteredEntries"
          :key="entry.id"
          class="log-viewer__entry"
          :class="`log-viewer__entry--${entry.level}`"
        >
          <span class="log-viewer__time">{{ formatTime(entry.timestamp) }}</span>
          <span class="log-viewer__level" :class="`log-viewer__level--${entry.level}`">{{ levelLabel(entry.level) }}</span>
          <span class="log-viewer__source">{{ entry.source }}</span>
          <span class="log-viewer__message">{{ entry.message }}</span>
          <pre v-if="entry.details" class="log-viewer__details">{{ entry.details }}</pre>
        </div>
      </div>
    </section>

    <!-- 后端日志 Tab -->
    <section v-else class="settings-section settings-section--compact">
      <div class="settings-section__heading">
        <div>
          <h2>后端运行日志</h2>
          <p>读取后端 Spring Boot 写入的日志文件（按配置路径 <code>{{ backendLogPath || 'loading...' }}</code>）。日志由后端 logback 写入，仅展示最后 N 行。</p>
        </div>
      </div>

      <!-- 工具栏 -->
      <div class="log-viewer__toolbar">
        <label class="log-viewer__autoscroll">
          <span>读取最后</span>
          <input v-model.number="backendLogLines" type="number" min="50" max="5000" step="50" class="log-viewer__number-input" />
          <span>行</span>
        </label>
        <button class="log-viewer__btn log-viewer__btn--primary" type="button" :disabled="backendLogLoading" @click="loadBackendLogs">
          <RefreshCw :size="14" :class="{ 'spin': backendLogLoading }" />
          <span>{{ backendLogLoading ? '加载中...' : '刷新日志' }}</span>
        </button>
        <button class="log-viewer__btn" type="button" :disabled="!backendLogs" :title="backendCopyButtonTitle" @click="copyBackendLogs">
          <Filter :size="14" />
          <span>{{ backendCopyButtonTitle }}</span>
        </button>
      </div>

      <!-- 错误提示 -->
      <div v-if="backendLogError" class="log-viewer__error">
        {{ backendLogError }}
      </div>

      <!-- 日志内容 -->
      <div class="log-viewer__list log-viewer__list--backend">
        <div v-if="backendLogLoading" class="log-viewer__empty">加载中...</div>
        <div v-else-if="backendLogArray.length === 0" class="log-viewer__empty">
          暂无后端日志
        </div>
        <div v-else>
          <div
            v-for="(line, index) in backendLogArray"
            :key="index"
            class="log-viewer__backend-line"
            :class="{
              'log-viewer__backend-line--error': line.includes('ERROR'),
              'log-viewer__backend-line--warn': line.includes('WARN'),
            }"
          >
            <span class="log-viewer__line-number">{{ backendLogArray.length - backendLogArray.length + index + 1 }}</span>
            <span class="log-viewer__line-content">{{ line }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 清除日志确认模态框（替代原生 confirm） -->
    <div
      v-if="clearLogsModalOpen"
      class="session-modal-overlay"
      @click.self="cancelClearLogs"
    >
      <div class="session-modal" role="dialog" aria-modal="true" aria-labelledby="clearLogsTitle">
        <h3 id="clearLogsTitle" class="session-modal__title">清除前端日志</h3>
        <p class="session-modal__message">确定清除所有前端日志吗？此操作不可恢复。</p>
        <div class="session-modal__actions">
          <button
            type="button"
            class="session-modal__button session-modal__button--ghost"
            @click="cancelClearLogs"
          >
            取消
          </button>
          <button
            type="button"
            class="session-modal__button session-modal__button--danger"
            @click="confirmClearLogs"
          >
            清除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.log-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.log-viewer__stats {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 12px;
  color: var(--color-text-muted);
}

.log-viewer__stat {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-surface);
}

.log-viewer__stat--warn {
  color: var(--color-warning);
  background: var(--color-warning-bg);
}

.log-viewer__stat--error {
  color: var(--color-danger);
  background: rgba(220, 38, 38, 0.1);
}

.log-viewer__tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 12px;
}

.log-viewer__tab {
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.log-viewer__tab:hover {
  color: var(--color-text);
}

.log-viewer__tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 500;
}

.log-viewer__toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.log-viewer__search {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 200px;
  padding: 4px 10px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-muted);
}

.log-viewer__search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  outline: none;
}

.log-viewer__select {
  padding: 4px 8px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  font-size: 12px;
  outline: none;
  cursor: pointer;
}

.log-viewer__autoscroll {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  font-size: 12px;
}

.log-viewer__autoscroll input[type="checkbox"] {
  cursor: pointer;
}

.log-viewer__number-input {
  width: 60px;
  padding: 2px 4px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: 12px;
  outline: none;
}

.log-viewer__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.log-viewer__btn:hover:not(:disabled) {
  background: var(--color-hover-soft);
}

.log-viewer__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.log-viewer__btn--active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.log-viewer__btn--primary {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.log-viewer__btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.log-viewer__btn--danger:hover:not(:disabled) {
  background: var(--color-danger);
  color: #fff;
  border-color: var(--color-danger);
}

.log-viewer__list {
  flex: 1;
  overflow-y: auto;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  min-height: 300px;
  max-height: calc(100vh - 320px);
}

.log-viewer__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  color: var(--color-text-muted);
  font-style: italic;
}

.log-viewer__entry {
  display: grid;
  grid-template-columns: 96px 56px 120px 1fr;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 4px;
  border-bottom: 1px solid var(--color-border-light, rgba(0,0,0,0.05));
  align-items: start;
}

.log-viewer__entry:hover {
  background: var(--color-hover-soft);
}

.log-viewer__entry--error {
  background: rgba(220, 38, 38, 0.05);
}

.log-viewer__entry--warn {
  background: rgba(217, 119, 6, 0.05);
}

.log-viewer__time {
  color: var(--color-text-muted);
  white-space: nowrap;
}

.log-viewer__level {
  font-weight: 600;
  text-align: center;
  border-radius: 3px;
  padding: 0 4px;
}

.log-viewer__level--debug {
  color: var(--color-text-muted);
}

.log-viewer__level--info {
  color: var(--color-primary);
}

.log-viewer__level--warn {
  color: var(--color-warning);
  background: var(--color-warning-bg);
}

.log-viewer__level--error {
  color: #fff;
  background: var(--color-danger);
}

.log-viewer__source {
  color: var(--color-text-muted);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.log-viewer__message {
  word-break: break-word;
  white-space: pre-wrap;
}

.log-viewer__details {
  grid-column: 4;
  margin-top: 4px;
  padding: 6px 8px;
  background: var(--color-surface);
  border-radius: 4px;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

/* 后端日志样式 */
.log-viewer__error {
  padding: 8px 12px;
  margin-bottom: 8px;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid var(--color-danger);
  border-radius: 6px;
  color: var(--color-danger);
  font-size: 12px;
}

.log-viewer__backend-line {
  display: flex;
  gap: 12px;
  padding: 2px 6px;
  border-radius: 2px;
}

.log-viewer__backend-line:hover {
  background: var(--color-hover-soft);
}

.log-viewer__backend-line--error {
  background: rgba(220, 38, 38, 0.05);
}

.log-viewer__backend-line--warn {
  background: rgba(217, 119, 6, 0.05);
}

.log-viewer__line-number {
  color: var(--color-text-muted);
  user-select: none;
  min-width: 40px;
  text-align: right;
}

.log-viewer__line-content {
  white-space: pre-wrap;
  word-break: break-word;
  flex: 1;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

code {
  padding: 1px 4px;
  background: var(--color-surface);
  border-radius: 3px;
  font-size: 11px;
  color: var(--color-primary);
}
</style>
