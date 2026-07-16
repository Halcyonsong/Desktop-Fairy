import type { ApiResult } from '@/types/chat';
import { resolveApiUrl } from '@/config/runtimeConfig';
import { uiText } from '@/config/uiText';

export const jsonHeaders = {
  'Content-Type': 'application/json',
};

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(resolveApiUrl(url), init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = (await response.json()) as ApiResult<T>;
  if (result.code !== 200 && result.code !== 204) {
    throw new Error(result.message || uiText.errors.requestFailed);
  }

  return result.data;
}
