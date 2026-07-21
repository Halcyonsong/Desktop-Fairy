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

export function resolveApiUrl(path: string) {
  if (!path) {
    return runtimeConfig.apiBaseUrl;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return runtimeConfig.apiBaseUrl ? `${runtimeConfig.apiBaseUrl}${normalizedPath}` : normalizedPath;
}
