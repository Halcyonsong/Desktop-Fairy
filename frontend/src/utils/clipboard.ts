/**
 * 统一的剪贴板复制工具，兼容 Electron file:// 协议与非安全上下文。
 *
 * 设计目标：
 *   - 统一 4 处重复实现（LogViewerSection、FilePathSection、MessageList、SourceFormSection）
 *   - 优先使用现代 Clipboard API（navigator.clipboard.writeText）
 *   - 失败时降级到 execCommand('copy') + 临时 textarea（兼容 Electron 非安全上下文）
 *   - 提供成功/失败回调，方便 UI 反馈
 *
 * 行为：
 *   - 成功：返回 true，调用 onSuccess
 *   - 失败：返回 false，调用 onFail（不抛错，避免 unhandled rejection）
 */

export interface CopyOptions {
  /** 复制成功回调 */
  onSuccess?: () => void;
  /** 复制失败回调 */
  onFail?: (error: unknown) => void;
}

/**
 * 执行剪贴板复制，返回是否成功。
 *
 * @param text 待复制的文本
 * @param options 成功/失败回调
 * @returns true 表示复制成功，false 表示失败
 */
export async function copyText(text: string, options: CopyOptions = {}): Promise<boolean> {
  if (!text) {
    return false;
  }

  const { onSuccess, onFail } = options;

  // 优先使用现代 Clipboard API（需要安全上下文：https 或 localhost）
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      onSuccess?.();
      return true;
    } catch (error) {
      // 落到 fallback 继续尝试
      console.warn('[clipboard] navigator.clipboard.writeText failed, falling back:', error);
    }
  }

  // 降级方案：创建临时 textarea + execCommand('copy')
  // 适用于 Electron file:// 协议或非安全上下文
  if (fallbackCopy(text)) {
    onSuccess?.();
    return true;
  }

  console.warn('[clipboard] fallback copy also failed');
  onFail?.(new Error('剪贴板复制失败'));
  return false;
}

function fallbackCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  // 避免在视口中闪现
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  // 防止移动端键盘弹出
  textarea.setAttribute('readonly', '');
  document.body.appendChild(textarea);

  // 选中并复制
  const selected = document.getSelection();
  const savedRange = selected && selected.rangeCount > 0 ? selected.getRangeAt(0) : null;
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let succeeded = false;
  try {
    succeeded = document.execCommand('copy');
  } catch (error) {
    console.warn('[clipboard] execCommand("copy") threw:', error);
    succeeded = false;
  }

  // 清理 DOM
  document.body.removeChild(textarea);

  // 恢复之前选中的内容
  if (savedRange && selected) {
    selected.removeAllRanges();
    selected.addRange(savedRange);
  }

  return succeeded;
}
