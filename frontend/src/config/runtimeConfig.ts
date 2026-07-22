const DEFAULT_LOCAL_API_BASE_URL = 'http://127.0.0.1:18765';

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/\/+$/, '');
}

export const runtimeConfig = {
  apiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL),
  appBrandName: import.meta.env.VITE_APP_BRAND_NAME?.trim() || 'Desktop Fairy',
  workbenchTitle: import.meta.env.VITE_APP_WORKBENCH_TITLE?.trim() || 'AI 工作台',
  workbenchSubtitle: import.meta.env.VITE_APP_WORKBENCH_SUBTITLE?.trim() || '本地 AI 工作台',
} as const;

/**
 * Electron 生产环境下页面通过 file:// 协议加载，此时若未配置 apiBaseUrl，
 * 相对路径请求无法命中后端，回退到本地后端默认地址。
 * 开发环境（http://localhost）下返回空串，保持走 Vite 代理的相对路径。
 */
function resolveDefaultApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return DEFAULT_LOCAL_API_BASE_URL;
  }
  return '';
}

export function resolveApiUrl(path: string) {
  const baseUrl = runtimeConfig.apiBaseUrl || resolveDefaultApiBaseUrl();

  if (!path) {
    return baseUrl;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}
