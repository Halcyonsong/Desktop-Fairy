import { useLoggerStore } from '@/stores/loggerStore';

/**
 * Console 拦截器
 *
 * 拦截 console.log/warn/error/debug，同步写入 loggerStore
 * 保留原始 console 行为（开发工具仍能看到日志）
 *
 * 调用 installConsoleInterceptor() 启用，在应用入口 main.ts 中调用一次
 */

const SOURCE_CONSOLE = 'console';

let installed = false;

export function installConsoleInterceptor() {
  if (installed) {
    return;
  }
  installed = true;

  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  function formatArgs(args: unknown[]): { message: string; details?: unknown } {
    if (args.length === 0) {
      return { message: '' };
    }
    // 如果第一个参数是字符串且包含 %s 等占位符，用后续参数填充
    if (typeof args[0] === 'string') {
      const first = args[0] as string;
      if (args.length > 1) {
        // 简单处理 %s/%d/%o 占位符
        let argIndex = 1;
        const formatted = first.replace(/%[sdifoO%]/g, (match) => {
          if (match === '%%') {
            return '%';
          }
          if (argIndex < args.length) {
            const arg = args[argIndex++];
            if (match === '%s') {
              return String(arg);
            }
            if (match === '%d' || match === '%i') {
              return String(Number(arg));
            }
            if (match === '%f') {
              return String(Number(arg));
            }
            if (match === '%o' || match === '%O') {
              try {
                return JSON.stringify(arg);
              } catch {
                return String(arg);
              }
            }
          }
          return match;
        });
        const remaining = args.slice(argIndex);
        if (remaining.length > 0) {
          return { message: formatted, details: remaining.length === 1 ? remaining[0] : remaining };
        }
        return { message: formatted };
      }
      return { message: first };
    }
    // 第一个参数不是字符串
    if (args.length === 1) {
      const arg = args[0];
      if (arg instanceof Error) {
        return { message: arg.message, details: arg };
      }
      if (typeof arg === 'object') {
        try {
          return { message: JSON.stringify(arg), details: arg };
        } catch {
          return { message: String(arg) };
        }
      }
      return { message: String(arg) };
    }
    return { message: args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '), details: args };
  }

  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    try {
      const logger = useLoggerStore();
      const { message, details } = formatArgs(args);
      logger.info(SOURCE_CONSOLE, message, details);
    } catch {
      // pinia 未初始化时忽略
    }
  };

  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    try {
      const logger = useLoggerStore();
      const { message, details } = formatArgs(args);
      logger.warn(SOURCE_CONSOLE, message, details);
    } catch {
      // ignore
    }
  };

  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    try {
      const logger = useLoggerStore();
      const { message, details } = formatArgs(args);
      logger.error(SOURCE_CONSOLE, message, details);
    } catch {
      // ignore
    }
  };

  console.debug = (...args: unknown[]) => {
    originalConsole.debug(...args);
    try {
      const logger = useLoggerStore();
      const { message, details } = formatArgs(args);
      logger.debug(SOURCE_CONSOLE, message, details);
    } catch {
      // ignore
    }
  };

  // 捕获未处理的 Promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    try {
      const logger = useLoggerStore();
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      logger.error('promise', `未处理的 Promise 拒绝: ${message}`, reason);
    } catch {
      // ignore
    }
  });

  // 捕获全局错误
  window.addEventListener('error', (event) => {
    try {
      const logger = useLoggerStore();
      logger.error('window', event.message, event.error);
    } catch {
      // ignore
    }
  });
}
