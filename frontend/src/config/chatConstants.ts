export const CHAT_EVENT = {
  data: 1001,
  reasoning: 1002,
  stop: 1003,
  interrupted: 1004,
  error: 1005,
  toolStatus: 1006,
  toolResult: 1007,
} as const;

// 1006 TOOL_STATUS / 1007 TOOL_RESULT 的 stage 取值
// 后端已从正文标记切换为工具决策（markContinue/markFinish），不再输出 @Continue@/@Finish@/@Missing@
export const TOOL_STAGE = {
  loopStart: 'LOOP_START',
  roundStart: 'ROUND_START',
  toolCall: 'TOOL_CALL',
  roundContinue: 'ROUND_CONTINUE',
  roundFinish: 'ROUND_FINISH',
  roundLimit: 'ROUND_LIMIT',
  toolLimit: 'TOOL_LIMIT',
  timeLimit: 'TIME_LIMIT',
  toolResult: 'TOOL_RESULT',
  mediaRequestStart: 'MEDIA_REQUEST_START',
} as const;

// 1005 ERROR 事件的 errorType 取值
// 对应后端 ModelServiceErrorTypeEnum
export const ERROR_TYPE = {
  unauthorized: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  notFound: 'NOT_FOUND',
  rateLimit: 'RATE_LIMIT',
  insufficientBalance: 'INSUFFICIENT_BALANCE',
  timeout: 'TIMEOUT',
  connectionReset: 'CONNECTION_RESET',
  connectionFailed: 'CONNECTION_FAILED',
  serverError: 'SERVER_ERROR',
  badRequest: 'BAD_REQUEST',
  unknown: 'UNKNOWN',
} as const;

export const HISTORY_NO_MORE_CACHE_MS = 30_000;

export const MESSAGE_LIST_SCROLL = {
  pullTriggerDistance: 62,
  pullMaxDistance: 92,
  bottomVisibleDistance: 180,
} as const;
