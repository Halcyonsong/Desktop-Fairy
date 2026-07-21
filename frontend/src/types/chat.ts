export type ChatRole = 'user' | 'assistant';
export type ChatMessageStatus = 'completed' | 'interrupted' | 'error' | 'sending' | 'streaming';
export type ChatEventType = 1001 | 1002 | 1003 | 1004 | 1005 | 1006 | 1007;
export type ModelProvider = string;

export interface ChatSession {
  sessionId: string;
  title: string;
  createTime: string;
  updateTime: string;
}

export interface ChatMessageTiming {
  requestStartedAt?: number;
  firstReasoningAt?: number;
  firstOutputAt?: number;
  completedAt?: number;
}

// 1006 TOOL_STATUS / 1007 TOOL_RESULT 的 eventData 结构
// toolCallId / toolName / toolArguments 仅在 TOOL_CALL / TOOL_RESULT 等 stage 有值，
// 其余 stage（ROUND_START / ROUND_CONTINUE / *_LIMIT 等）为 null
export interface ToolStatusEvent {
  round: number;
  stage: string;
  message: string;
  toolCallId?: string | null;
  toolName?: string | null;
  toolArguments?: string | null;
}

export type ChatDirectiveMarker = '@Continue@' | '@Finish@' | '@Missing@';

// 消息块类型：按事件实际到达顺序排列
// reasoning 和 content 交替出现，每个 reasoning 块独立控制展开
export type ChatMessageBlockType = 'reasoning' | 'content' | 'tool';

export interface ChatMessageBlock {
  id: string;
  type: ChatMessageBlockType;
  round: number;
  // reasoning: 思考内容（展示用，已裁标记）
  // content: 正文内容（展示用，已裁标记）
  // tool: 工具状态说明文案
  text: string;
  // tool 块的附加信息
  toolStatus?: ToolStatusEvent;
}

// 1005 ERROR 事件的 eventData 结构
// 对应后端 ModelStreamErrorEventVO
export interface ModelStreamErrorEvent {
  errorType: string;
  message: string;
  retryable: boolean;
  partialOutput: boolean;
  partialContent: string;
}

// 消息上记录的错误详情（从 1005 事件解析后挂载）
export interface ChatMessageErrorInfo {
  errorType: string;
  message: string;
  retryable: boolean;
  partialOutput: boolean;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  status: ChatMessageStatus;
  createTime: string;
  timing?: ChatMessageTiming;
  // 工具调用轮次状态/结果
  toolStatuses?: ToolStatusEvent[];
  // 按事件顺序排列的消息块（reasoning / content / tool 交替）
  blocks?: ChatMessageBlock[];
  // 流式错误详情（status === 'error' 时有值）
  errorInfo?: ChatMessageErrorInfo;
}

export interface ChatHistoryPage {
  records: ChatMessage[];
  nextCursor: number | null;
  hasMore: boolean;
  total: number;
}

export interface ChatEvent {
  eventData: unknown;
  eventType: ChatEventType;
}

export interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
}

export interface ModelSourceModelInput {
  localId: string;
  modelName: string;
}

export interface ModelSourceFormState {
  sourceCode: string;
  name: string;
  provider: ModelProvider;
  baseUrl: string;
  apiKey: string;
  models: ModelSourceModelInput[];
}

export interface ModelSourceListItem {
  sourceCode: string;
  name: string;
  provider: ModelProvider;
  baseUrl: string;
  createTime: string;
  updateTime: string;
}

export interface ModelSourceModelDetail {
  id: number;
  modelName: string;
  createTime: string;
  updateTime: string;
}

export interface SelectableModelSourceItem {
  sourceCode: string;
  sourceName: string;
  models: ModelSourceModelDetail[];
}

export interface SelectableModelGroup {
  provider: ModelProvider;
  items: SelectableModelSourceItem[];
}

export interface ModelSourceDetail extends ModelSourceListItem {
  apiKey: string;
  models: ModelSourceModelDetail[];
}

export interface ModelSourceSavePayload {
  sourceCode?: string;
  name: string;
  provider: ModelProvider;
  baseUrl: string;
  apiKey: string;
  models: Array<{
    modelName: string;
  }>;
}

export interface ModelSourceTestPayload {
  provider: ModelProvider;
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

export interface ModelSourceTestResult {
  success: boolean;
  message: string;
}

export interface ModelSourceFetchModelsPayload {
  provider: ModelProvider;
  baseUrl: string;
  apiKey: string;
  modelName?: string;
}

export type LocalModelTaskStatus = 'IDLE' | 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
export type LocalModelActionType = 'install' | 'start' | 'stop';

export interface LocalModelTaskLaunchResult {
  taskId: string;
  script: string;
  status: Exclude<LocalModelTaskStatus, 'IDLE'>;
}

export interface LocalModelTaskDetail {
  taskId: string;
  script: string;
  status: Exclude<LocalModelTaskStatus, 'IDLE'>;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  message?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface ChatModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

// 系统提示词分组
export type SystemPromptSlot = 'default' | '1' | '2' | '3';

export interface SystemPromptEntry {
  id: SystemPromptSlot;
  label: string;
  content: string;
}

export interface SendChatOptions {
  sessionId: string;
  question: string;
  systemPrompt?: string;
  model?: ChatModelConfig | null;
  onEvent: (event: ChatEvent) => void;
  signal?: AbortSignal;
  enableToolCalling?: boolean;
}
