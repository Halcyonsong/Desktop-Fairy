<script setup lang="ts">
import { computed, onMounted } from 'vue';
import AppShell from '@/components/layout/AppShell.vue';
import ChatComposer from '@/components/chat/ChatComposer.vue';
import ChatHeader from '@/components/chat/ChatHeader.vue';
import MessageList from '@/components/chat/MessageList.vue';
import SessionSidebar from '@/components/session/SessionSidebar.vue';
import SettingsView from '@/views/SettingsView.vue';
import { useModelSourceStore } from '@/stores/modelSourceStore';
import { useUiStore } from '@/stores/uiStore';
import { useWorkbenchStore } from '@/stores/workbenchStore';

const workbench = useWorkbenchStore();
const uiStore = useUiStore();
const modelSourceStore = useModelSourceStore();

const shouldAutoFocusComposer = computed(() => {
  return uiStore.viewMode === 'chat' && !workbench.sending && workbench.messages.length === 0;
});

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
              :sessions="workbench.sessions"
              :active-session-id="workbench.activeSessionId"
              :loading="workbench.loading"
              :view-mode="uiStore.viewMode"
              @create="uiStore.switchView('chat'); workbench.createSession()"
              @select="workbench.loadSession"
              @rename="workbench.renameSession"
              @delete="workbench.deleteSession"
              @switch-view="uiStore.switchView"
            />
          </template>

          <template #main>
            <ChatHeader
              :session="workbench.activeSession"
              :history-total="workbench.historyTotal"
              :refreshing="workbench.refreshingHistory"
              @refresh="workbench.refreshActiveHistory"
            />
            <MessageList
              :session-key="workbench.activeSessionId"
              :messages="workbench.messages"
              :error-message="workbench.errorMessage"
              :reasoning-text="workbench.latestReasoningText"
              :reasoning-message-id="workbench.latestReasoningMessageId"
              :history-pull-message="workbench.historyPullMessage"
              :loading-more-history="workbench.loadingMoreHistory"
              :sending="workbench.sending"
              @load-more="workbench.loadMoreHistory"
              @rollback-latest-round="workbench.rollbackLatestRoundToComposer"
              @delete-latest-round="workbench.deleteLatestRoundOnly"
            />
            <ChatComposer
              :sending="workbench.sending"
              :draft="workbench.composerDraft"
              :model-label="modelSourceStore.selectedChatModelLabel"
              :has-selectable-models="modelSourceStore.hasSelectableChatModels"
              :selectable-model-groups="modelSourceStore.selectableChatGroups"
              :model-required="!modelSourceStore.selectedChatModelConfig"
              :temperature-input="modelSourceStore.temperatureInput"
              :max-tokens-input="modelSourceStore.maxTokensInput"
              :auto-focus="shouldAutoFocusComposer"
              @update:draft="workbench.setComposerDraft"
              @send="workbench.sendMessage"
              @stop="workbench.stopChat"
              @rollback="workbench.rollbackLatestRoundToComposer"
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
