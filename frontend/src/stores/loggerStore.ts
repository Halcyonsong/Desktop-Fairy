import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

/**
 * 全局日志收集器
 *
 * 拦截 console.log/warn/error/debug，同时提供手动 log API
 * 所有日志存入内存环形缓冲区，设置页"日志查看"模块读取展示
 *
 * 持久化：最近 500 条日志保存到 localStorage，刷新页面后仍可查看
 *
 * 使用方式：
 *   import { useLoggerStore } from '@/stores/loggerStore';
 *   const logger = useLoggerStore();
 *   logger.info('模块名', '消息内容');
 *   logger.error('模块名', '错误信息', error);
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  timestamp: number;
  level: LogLevel;
  source: string;      // 来源模块，如 'voskModelManager'、'fairyChatStore'
  message: string;     // 主消息
  details?: string;    // 附加详情（如 error.stack、对象 JSON）
}

const MAX_ENTRIES = 2000;          // 内存环形缓冲区最大条数
const PERSIST_MAX = 500;           // 持久化到 localStorage 的最大条数
const STORAGE_KEY = 'desktop-fairy-logs';
const PERSIST_DEBOUNCE_MS = 1000;   // 防抖写入间隔

export const useLoggerStore = defineStore('logger', () => {
  const entries = ref<LogEntry[]>([]);
  const nextId = ref(1);
  const enabled = ref(true);
  const minLevel = ref<LogLevel>('debug');

  // ===== 初始化：从 localStorage 加载历史日志 =====
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { entries: LogEntry[]; nextId: number };
      if (parsed?.entries?.length) {
        entries.value = parsed.entries;
        nextId.value = parsed.nextId ?? (parsed.entries[parsed.entries.length - 1].id + 1);
        console.log(`[loggerStore] 从 localStorage 恢复 ${entries.value.length} 条日志`);
      }
    }
  } catch (error) {
    console.warn('[loggerStore] 加载持久化日志失败:', error);
  }

  // ===== 防抖写入 localStorage =====
  let persistTimer: number | null = null;
  function schedulePersist() {
    if (persistTimer !== null) {
      window.clearTimeout(persistTimer);
    }
    persistTimer = window.setTimeout(() => {
      try {
        // 只持久化最近的 PERSIST_MAX 条，避免超出 localStorage 容量
        const toSave = entries.value.slice(-PERSIST_MAX);
        const data = JSON.stringify({ entries: toSave, nextId: nextId.value });
        localStorage.setItem(STORAGE_KEY, data);
      } catch (error) {
        // localStorage 满了或其他错误，忽略
        console.warn('[loggerStore] 持久化失败:', error);
      }
    }, PERSIST_DEBOUNCE_MS);
  }

  // 监听 entries 变化，触发防抖写入
  watch(entries, () => {
    schedulePersist();
  }, { deep: true });

  // 过滤后的条目（按级别）
  const filteredEntries = computed(() => {
    const levelOrder: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    const minOrder = levelOrder[minLevel.value];
    return entries.value.filter((entry) => levelOrder[entry.level] >= minOrder);
  });

  const errorCount = computed(() => entries.value.filter((e) => e.level === 'error').length);
  const warnCount = computed(() => entries.value.filter((e) => e.level === 'warn').length);

  function append(level: LogLevel, source: string, message: string, details?: unknown) {
    if (!enabled.value) {
      return;
    }

    let detailsStr: string | undefined;
    if (details !== undefined) {
      if (details instanceof Error) {
        detailsStr = details.stack || details.message;
      } else if (typeof details === 'object') {
        try {
          detailsStr = JSON.stringify(details, null, 2);
        } catch {
          detailsStr = String(details);
        }
      } else {
        detailsStr = String(details);
      }
    }

    const entry: LogEntry = {
      id: nextId.value++,
      timestamp: Date.now(),
      level,
      source,
      message,
      details: detailsStr,
    };

    entries.value.push(entry);

    // 环形缓冲区：超出上限时删除最早的
    if (entries.value.length > MAX_ENTRIES) {
      entries.value.splice(0, entries.value.length - MAX_ENTRIES);
    }
  }

  function debug(source: string, message: string, details?: unknown) {
    append('debug', source, message, details);
  }

  function info(source: string, message: string, details?: unknown) {
    append('info', source, message, details);
  }

  function warn(source: string, message: string, details?: unknown) {
    append('warn', source, message, details);
  }

  function error(source: string, message: string, details?: unknown) {
    append('error', source, message, details);
  }

  function clear() {
    entries.value = [];
  }

  function setMinLevel(level: LogLevel) {
    minLevel.value = level;
  }

  function setEnabled(value: boolean) {
    enabled.value = value;
  }

  /**
   * 导出日志为文本（用于下载或复制）
   */
  function exportAsText(): string {
    const lines = entries.value.map((entry) => {
      const time = new Date(entry.timestamp).toISOString();
      const base = `[${time}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}`;
      return entry.details ? `${base}\n${entry.details}` : base;
    });
    return lines.join('\n\n');
  }

  return {
    entries,
    filteredEntries,
    enabled,
    minLevel,
    errorCount,
    warnCount,
    debug,
    info,
    warn,
    error,
    clear,
    setMinLevel,
    setEnabled,
    exportAsText,
  };
});
