<script setup lang="ts">
import { computed, onMounted } from 'vue';
import AppShell from '@/components/layout/AppShell.vue';
import ChatComposer from '@/components/chat/ChatComposer.vue';
import ChatHeader from '@/components/chat/ChatHeader.vue';
import MessageList from '@/components/chat/MessageList.vue';
import SessionSidebar from '@/components/session/SessionSidebar.vue';
import SettingsView from '@/views/SettingsView.vue';
import { useFairyChatStore } from '@/stores/fairyChatStore';
import { useModelSourceStore } from '@/stores/modelSourceStore';
import { useUiStore } from '@/stores/uiStore';
import { useWorkbenchStore } from '@/stores/workbenchStore';
import type { ChatSession } from '@/types/chat';

const workbench = useWorkbenchStore();
const uiStore = useUiStore();
const modelSourceStore = useModelSourceStore();
const fairyChatStore = useFairyChatStore();

const temporarySummary = computed(() => fairyChatStore.temporarySessionSummary);
const sidebarSessions = computed(() => {
  if (!temporarySummary.value) {
    return workbench.sessions.map((session) => ({
      ...session,
      summary: '',
      temporary: false,
    }));
  }

  return [
    {
      ...temporarySummary.value,
      summary: '',
      temporary: true,
    },
    ...workbench.sessions.map((session) => ({
      ...session,
      summary: '',
      temporary: false,
    })),
  ];
});

const activeSessionId = computed(() => (fairyChatStore.selected ? fairyChatStore.temporaryChatOption.sessionId : workbench.activeSessionId));
const currentSession = computed<ChatSession | undefined>(() => {
  if (fairyChatStore.selected && temporarySummary.value) {
    return temporarySummary.value;
  }
  return workbench.activeSession;
});
const currentMessages = computed(() => (fairyChatStore.selected ? fairyChatStore.messages : workbench.messages));
const currentErrorMessage = computed(() => (fairyChatStore.selected ? fairyChatStore.errorMessage : workbench.errorMessage));
const currentSending = computed(() => (fairyChatStore.selected ? fairyChatStore.sending : workbench.sending));
const currentHistoryTotal = computed(() => (fairyChatStore.selected ? fairyChatStore.messages.length : workbench.historyTotal));
const currentHistoryRefreshing = computed(() => (!fairyChatStore.selected ? workbench.refreshingHistory : false));

const shouldAutoFocusComposer = computed(() => {
  if (uiStore.viewMode !== 'chat') {
    return false;
  }
  if (fairyChatStore.selected) {
    return !fairyChatStore.sending && fairyChatStore.messages.length === 0;
  }
  return !workbench.sending && workbench.messages.length === 0;
});

async function handleSidebarSelect(sessionId: string) {
  uiStore.switchView('chat');

  if (fairyChatStore.isTemporaryChatSession(sessionId)) {
    fairyChatStore.selectTemporaryChat();
    return;
  }

  fairyChatStore.deselectTemporaryChat();
  await workbench.loadSession(sessionId);
}

function handleRefreshTemporarySession() {
  fairyChatStore.refreshTemporarySession();
  fairyChatStore.selectTemporaryChat();
  uiStore.switchView('chat');
}

async function handleComposerSend(question: string) {
  if (fairyChatStore.selected) {
    await fairyChatStore.sendTemporaryMessage(question, 'manual');
    return;
  }

  await workbench.sendMessage(question);
}

function handleComposerStop() {
  if (fairyChatStore.selected) {
    fairyChatStore.stopTemporaryChat();
    return;
  }

  workbench.stopChat();
}

function handleRefreshHistory() {
  if (fairyChatStore.selected) {
    return;
  }
  void workbench.refreshActiveHistory();
}

function handleCreateSession() {
  fairyChatStore.deselectTemporaryChat();
  uiStore.switchView('chat');
  void workbench.createSession();
}

onMounted(() => {
  void workbench.bootstrap();
  void modelSourceStore.bootstrap();
});
</script>

<template>
  <div class="view-switch-shell">
    <Transition name="view-fade-slide" mode="out-in">
      <div v-if="uiStore.viewMode === 'settings'" key="settings" class="view-switch-page">
        <SettingsView @back="uiStore.switchView('chat')" />
      </div>

      <div v-else key="chat" class="view-switch-page">
        <AppShell>
          <template #sidebar>
            <SessionSidebar
              :sessions="sidebarSessions"
              :active-session-id="activeSessionId"
              :loading="workbench.loading"
              :view-mode="uiStore.viewMode"
              @create="handleCreateSession"
              @select="handleSidebarSelect"
              @rename="workbench.renameSession"
              @delete="workbench.deleteSession"
              @refresh-temporary-session="handleRefreshTemporarySession"
              @switch-view="uiStore.switchView"
            />
          </template>

          <template #main>
            <ChatHeader
              :session="currentSession"
              :history-total="currentHistoryTotal"
              :refreshing="currentHistoryRefreshing"
              @refresh="handleRefreshHistory"
            />
            <MessageList
              :session-key="activeSessionId"
              :messages="currentMessages"
              :error-message="currentErrorMessage"
              :reasoning-text="workbench.latestReasoningText"
              :reasoning-message-id="workbench.latestReasoningMessageId"
              :history-pull-message="fairyChatStore.selected ? '' : workbench.historyPullMessage"
              :loading-more-history="fairyChatStore.selected ? false : workbench.loadingMoreHistory"
              :sending="currentSending"
              @load-more="fairyChatStore.selected ? undefined : workbench.loadMoreHistory()"
              @rollback-latest-round="fairyChatStore.selected ? undefined : workbench.rollbackLatestRoundToComposer()"
              @delete-latest-round="fairyChatStore.selected ? undefined : workbench.deleteLatestRoundOnly()"
            />
            <ChatComposer
              :sending="currentSending"
              :draft="fairyChatStore.selected ? fairyChatStore.draft : workbench.composerDraft"
              :model-label="modelSourceStore.selectedChatModelLabel"
              :has-selectable-models="modelSourceStore.hasSelectableChatModels"
              :selectable-model-groups="modelSourceStore.selectableChatGroups"
              :model-required="!modelSourceStore.selectedChatModelConfig"
              :temperature-input="modelSourceStore.temperatureInput"
              :max-tokens-input="modelSourceStore.maxTokensInput"
              :auto-focus="shouldAutoFocusComposer"
              @update:draft="fairyChatStore.selected ? fairyChatStore.setDraft($event) : workbench.setComposerDraft($event)"
              @send="handleComposerSend"
              @stop="handleComposerStop"
              @rollback="fairyChatStore.selected ? undefined : workbench.rollbackLatestRoundToComposer()"
              @select-model="modelSourceStore.selectChatModel"
              @update:temperature-input="modelSourceStore.setTemperatureInput"
              @update:max-tokens-input="modelSourceStore.setMaxTokensInput"
            />
          </template>
        </AppShell>
      </div>
    </Transition>
  </div>
</template>
