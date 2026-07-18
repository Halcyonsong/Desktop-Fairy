import { requestJson } from '@/api/httpClient';
import { CHAT_EVENT } from '@/config/chatConstants';
import type { ChatEvent, ChatModelConfig } from '@/types/chat';

const FAIRY_CHAT_TIMEOUT_MS = 120_000; // 2 分钟，模型推理可能需要较长时间

export interface FairyChatRequest {
  sessionId: string;
  question: string;
  model: ChatModelConfig;
  signal?: AbortSignal;
  onEvent: (event: ChatEvent) => void;
}

export const fairyChatApi = {
  async sendTemporaryChat({ sessionId, question, model, signal, onEvent }: FairyChatRequest): Promise<string> {
    // 合并调用方的 signal（用户主动取消）和超时 signal
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
      FAIRY_CHAT_TIMEOUT_MS,
    );

    const onAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort(signal.reason);
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }

    try {
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
        signal: controller.signal,
      });

      const content = typeof result === 'string' ? result : '';
      onEvent({ eventType: CHAT_EVENT.data, eventData: content });
      onEvent({ eventType: CHAT_EVENT.stop, eventData: '' });
      return content;
    } catch (error) {
      // 超时错误转为更友好的提示，但保留 AbortError 的类型
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new Error('闲聊请求超时，请稍后重试');
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    }
  },
};
