<script setup lang="ts">
import { ChevronDown, LoaderCircle, MessageCircleMore, RefreshCw, SendHorizontal, Sparkles, Square } from '@lucide/vue';

interface FairySessionOption {
  sessionId: string;
  title: string;
  description?: string;
}

const props = defineProps<{
  visible: boolean;
  sessionOptions: FairySessionOption[];
  selectedSessionId: string;
  selectedSessionTitle: string;
  localDraft: string;
  inputPlaceholder: string;
  currentSending: boolean;
  temporaryChatHint: string;
  usingTemporaryChat: boolean;
  canClickSend: boolean;
  statusMessage: string;
  sessionPickerOpen: boolean;
  isTemporarySession: (sessionId: string) => boolean;
}>();

const emit = defineEmits<{
  toggleSessionPicker: [];
  chooseSession: [sessionId: string];
  refreshTemporarySession: [event: MouseEvent];
  draftInput: [event: Event];
  composerEnter: [event: KeyboardEvent];
  composerFocus: [];
  composerBlur: [];
  send: [];
  stop: [];
  pointerenter: [];
  pointerleave: [];
}>();
</script>

<template>
  <Transition name="floating-fairy-fade">
    <div
      v-if="props.visible"
      class="floating-fairy-chat-shell"
      data-fairy-interactive="true"
      @pointerenter="emit('pointerenter')"
      @pointerleave="emit('pointerleave')"
    >
      <div class="floating-fairy-inline-composer">
        <div class="floating-fairy-session-picker-anchor">
          <button
            class="floating-fairy-session-trigger"
            type="button"
            title="切换会话"
            @click.stop="emit('toggleSessionPicker')"
          >
            <MessageCircleMore :size="14" />
          </button>

          <div v-if="props.sessionPickerOpen" class="floating-fairy-session-popover">
            <button
              v-for="option in props.sessionOptions"
              :key="option.sessionId"
              class="floating-fairy-session-option"
              :class="{
                'floating-fairy-session-option--active': option.sessionId === props.selectedSessionId,
                'floating-fairy-session-option--temporary': props.isTemporarySession(option.sessionId),
              }"
              type="button"
              @click="emit('chooseSession', option.sessionId)"
            >
              <span class="floating-fairy-session-option__main">
                <span class="floating-fairy-session-option__title">{{ option.title }}</span>
                <span v-if="option.description" class="floating-fairy-session-option__description">
                  {{ option.description }}
                </span>
              </span>

              <span class="floating-fairy-session-option__icon-wrap">
                <button
                  v-if="props.isTemporarySession(option.sessionId)"
                  class="floating-fairy-session-refresh"
                  type="button"
                  title="新建临时会话"
                  @click.stop="emit('refreshTemporarySession', $event)"
                >
                  <RefreshCw :size="12" />
                </button>
                <Sparkles v-if="props.isTemporarySession(option.sessionId)" :size="12" />
                <ChevronDown v-else :size="12" />
              </span>
            </button>
          </div>
        </div>

        <input
          :value="props.localDraft"
          class="floating-fairy-inline-input"
          :placeholder="props.inputPlaceholder"
          @input="emit('draftInput', $event)"
          @keydown="emit('composerEnter', $event)"
          @focus="emit('composerFocus')"
          @blur="emit('composerBlur')"
        />

        <button
          v-if="props.currentSending"
          class="floating-fairy-inline-send floating-fairy-inline-send--stop"
          type="button"
          title="停止"
          @click="emit('stop')"
        >
          <Square :size="13" />
        </button>
        <button
          v-else
          class="floating-fairy-inline-send"
          type="button"
          :disabled="!props.canClickSend"
          title="发送"
          @click="emit('send')"
        >
          <SendHorizontal :size="14" />
        </button>
      </div>

      <div v-if="props.currentSending" class="floating-fairy-sending-indicator">
        <LoaderCircle class="floating-fairy-sending-indicator__icon" :size="12" />
        <span>{{ props.usingTemporaryChat ? props.temporaryChatHint : '回复生成中' }}</span>
      </div>

      <div v-else class="floating-fairy-chat-footer">
        <span class="floating-fairy-chat-badge">{{ props.selectedSessionTitle }}</span>
        <span class="floating-fairy-chat-tip">{{ props.statusMessage }}</span>
      </div>
    </div>
  </Transition>
</template>
