import type { ApiResult } from '@/types/chat';
import { resolveApiUrl } from '@/config/runtimeConfig';
import { uiText } from '@/config/uiText';

export const jsonHeaders = {
  'Content-Type': 'application/json',
};

const DEFAULT_TIMEOUT_MS = 120_000; // 2 分钟，模型推理可能需要较长时间

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function requestJson<T>(url: string, init?: RequestOptions): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = init ?? {};

  // 如果调用方已经传入了 signal，我们尊重它；否则创建一个带超时的 controller
  let controller: AbortController | null = null;
  let timeoutId: number | null = null;

  if (!fetchInit.signal) {
    controller = new AbortController();
    fetchInit.signal = controller.signal;
    timeoutId = window.setTimeout(() => {
      controller?.abort(new DOMException('Request timed out', 'TimeoutError'));
    }, timeoutMs);
  }

  try {
    const response = await fetch(resolveApiUrl(url), fetchInit);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = (await response.json()) as ApiResult<T>;
    if (result.code !== 200 && result.code !== 204) {
      throw new Error(result.message || uiText.errors.requestFailed);
    }

    return result.data;
  } catch (error) {
    // 超时错误转为更友好的提示
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('请求超时，请稍后重试');
    }
    // AbortError（用户主动取消）保持原样抛出
    throw error;
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}
