import { requestJson } from '@/api/httpClient';
import { CHAT_EVENT } from '@/config/chatConstants';
import type { ChatEvent, ChatModelConfig } from '@/types/chat';

export interface FairyChatRequest {
  sessionId: string;
  question: string;
  model: ChatModelConfig;
  signal?: AbortSignal;
  onEvent: (event: ChatEvent) => void;
}

export const fairyChatApi = {
  async sendTemporaryChat({ sessionId, question, model, signal, onEvent }: FairyChatRequest) {
    const result = await requestJson<string>('/api/fairy/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams({
        sessionId,
        question,
        baseUrl: model.baseUrl,
        apiKey: model.apiKey,
        model: model.model,
      }).toString(),
      signal,
    });

    onEvent({ eventType: CHAT_EVENT.data, eventData: result ?? '' });
    onEvent({ eventType: CHAT_EVENT.stop, eventData: '' });
  },
};
