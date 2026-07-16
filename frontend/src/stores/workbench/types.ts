import type { Ref } from 'vue';
import type { ChatMessage, ChatSession } from '@/types/chat';

export interface ReasoningController {
  reasoningBySession: Ref<Record<string, string>>;
  reasoningMessageIdBySession: Ref<Record<string, string>>;
  sending: Ref<boolean>;
  setReasoningText: (sessionId: string, value: string) => void;
  setReasoningMessageId: (sessionId: string, messageId: string) => void;
  clearReasoning: (sessionId: string) => void;
}

export interface HistoryStateRefs {
  messages: Ref<ChatMessage[]>;
  nextCursor: Ref<number | null>;
  hasMoreHistory: Ref<boolean>;
  historyTotal: Ref<number>;
  loadingMoreHistory: Ref<boolean>;
  refreshingHistory: Ref<boolean>;
  historyPullMessage: Ref<string>;
  errorMessage: Ref<string>;
  activeSessionId: Ref<string>;
  noMoreHistoryUntil: Ref<Record<string, number>>;
}

export interface ReasoningStateRefs {
  reasoningBySession: Ref<Record<string, string>>;
  reasoningMessageIdBySession: Ref<Record<string, string>>;
  sending: Ref<boolean>;
}

export interface SessionStateRefs {
  sessions: Ref<ChatSession[]>;
  activeSessionId: Ref<string>;
  composerDraft: Ref<string>;
}
