<script setup lang="ts">
import { MoreHorizontal, Plus, Search, Settings2 } from '@lucide/vue';
import { computed, ref } from 'vue';
import { appConfig } from '@/config/appConfig';
import { customText } from '@/config/customText';
import { uiText } from '@/config/uiText';
import { formatDateTime } from '@/utils/date';
import type { ChatSession, ViewMode } from '@/types/chat';

const props = defineProps<{
  sessions: ChatSession[];
  activeSessionId: string;
  loading: boolean;
  viewMode: ViewMode;
}>();

const emit = defineEmits<{
  create: [];
  select: [sessionId: string];
  rename: [sessionId: string, title: string];
  delete: [sessionId: string];
  switchView: [viewMode: ViewMode];
}>();

const keyword = ref('');
const openMenuSessionId = ref('');

const filteredSessions = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  if (!value) {
    return props.sessions;
  }

  return props.sessions.filter((session) => session.title.toLowerCase().includes(value));
});

function toggleMenu(sessionId: string) {
  openMenuSessionId.value = openMenuSessionId.value === sessionId ? '' : sessionId;
}

function renameSession(session: ChatSession) {
  openMenuSessionId.value = '';
  const title = window.prompt(uiText.session.renamePrompt, session.title);
  if (title !== null && title.trim() && title.trim() !== session.title) {
    emit('rename', session.sessionId, title.trim());
  }
}

function deleteSession(session: ChatSession) {
  openMenuSessionId.value = '';
  if (window.confirm(uiText.session.deleteConfirm(session.title))) {
    emit('delete', session.sessionId);
  }
}
</script>

<template>
  <section class="session-sidebar">
    <div class="session-sidebar__brand">
      <div>
        <span class="session-sidebar__eyebrow">{{ appConfig.brandName }}</span>
        <h1>{{ appConfig.workbenchTitle }}</h1>
      </div>
    </div>

    <button class="primary-action" type="button" :disabled="loading" @click="emit('create')">
      <Plus :size="18" />
      {{ customText.session.create }}
    </button>

    <label class="search-box">
      <Search :size="17" />
      <input v-model="keyword" type="search" :placeholder="customText.session.searchPlaceholder" />
    </label>

    <div class="session-list">
      <div
        v-for="session in filteredSessions"
        :key="session.sessionId"
        class="session-item"
        :class="{ 'session-item--active': props.viewMode === 'chat' && session.sessionId === activeSessionId }"
      >
        <button class="session-item__content" type="button" @click="emit('switchView', 'chat'); emit('select', session.sessionId)">
          <span class="session-item__title">{{ session.title }}</span>
          <span class="session-item__meta">{{ formatDateTime(session.updateTime) }}</span>
        </button>

        <div class="session-item__menu-wrap">
          <button class="session-menu-button" type="button" :title="uiText.session.operations" @click.stop="toggleMenu(session.sessionId)">
            <MoreHorizontal :size="17" />
          </button>
          <div v-if="openMenuSessionId === session.sessionId" class="session-menu">
            <button type="button" @click.stop="renameSession(session)">{{ uiText.session.rename }}</button>
            <button type="button" class="danger-menu-item" @click.stop="deleteSession(session)">{{ uiText.session.delete }}</button>
          </div>
        </div>
      </div>
    </div>

    <div class="session-sidebar__footer">
      <button
        class="session-sidebar__nav-button"
        :class="{ 'session-sidebar__nav-button--active': viewMode === 'settings' }"
        type="button"
        :title="customText.session.settingsHint"
        @click="emit('switchView', 'settings')"
      >
        <Settings2 :size="18" />
      </button>
    </div>
  </section>
</template>
