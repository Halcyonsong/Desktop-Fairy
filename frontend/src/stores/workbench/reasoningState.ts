import { computed, ref } from 'vue';

export function useReasoningState(activeSessionId: { value: string }) {
  const reasoningBySession = ref<Record<string, string>>({});
  const reasoningMessageIdBySession = ref<Record<string, string>>({});

  const latestReasoningText = computed(() =>
    activeSessionId.value ? reasoningBySession.value[activeSessionId.value] ?? '' : '',
  );
  const latestReasoningMessageId = computed(() =>
    activeSessionId.value ? reasoningMessageIdBySession.value[activeSessionId.value] ?? '' : '',
  );

  function setReasoningText(sessionId: string, value: string) {
    reasoningBySession.value = {
      ...reasoningBySession.value,
      [sessionId]: value,
    };
  }

  function setReasoningMessageId(sessionId: string, messageId: string) {
    reasoningMessageIdBySession.value = {
      ...reasoningMessageIdBySession.value,
      [sessionId]: messageId,
    };
  }

  function clearReasoning(sessionId: string) {
    const { [sessionId]: ignoredText, ...nextReasoning } = reasoningBySession.value;
    const { [sessionId]: ignoredId, ...nextIds } = reasoningMessageIdBySession.value;
    reasoningBySession.value = nextReasoning;
    reasoningMessageIdBySession.value = nextIds;
  }

  return {
    reasoningBySession,
    reasoningMessageIdBySession,
    latestReasoningText,
    latestReasoningMessageId,
    setReasoningText,
    setReasoningMessageId,
    clearReasoning,
  };
}
