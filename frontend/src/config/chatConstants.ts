export const CHAT_EVENT = {
  data: 1001,
  reasoning: 1002,
  stop: 1003,
  interrupted: 1004,
  error: 1005,
} as const;

export const HISTORY_NO_MORE_CACHE_MS = 30_000;

export const MESSAGE_LIST_SCROLL = {
  pullTriggerDistance: 62,
  pullMaxDistance: 92,
  bottomVisibleDistance: 180,
} as const;
