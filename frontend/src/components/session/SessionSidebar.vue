<script setup lang="ts">
import { MoreHorizontal, Plus, RefreshCw, Search, Settings2, Sparkles } from '@lucide/vue';
import { computed, ref } from 'vue';
import { appConfig } from '@/config/appConfig';
import { customText } from '@/config/customText';
import { uiText } from '@/config/uiText';
import { formatDateTime } from '@/utils/date';
import type { ChatSession } from '@/types/chat';
import type { ViewMode } from '@/types/pet';

interface SidebarSessionItem extends ChatSession {
  summary?: string;
  temporary?: boolean;
}

const props = defineProps<{
  sessions: SidebarSessionItem[];
  activeSessionId: string;
  loading: boolean;
  viewMode: ViewMode;
}>();

const emit = defineEmits<{
  create: [];
  select: [sessionId: string];
  rename: [sessionId: string, title: string];
  delete: [sessionId: string];
  refreshTemporarySession: [];
  switchView: [viewMode: ViewMode];
}>();

const keyword = ref('');
const openMenuSessionId = ref('');

const filteredSessions = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  if (!value) {
    return props.sessions;
  }

  return props.sessions.filter((session) => {
    const title = session.title.toLowerCase();
    const summary = session.summary?.toLowerCase() ?? '';
    return title.includes(value) || summary.includes(value);
  });
});

function toggleMenu(sessionId: string) {
  openMenuSessionId.value = openMenuSessionId.value === sessionId ? '' : sessionId;
}

function renameSession(session: SidebarSessionItem) {
  if (session.temporary) {
    return;
  }

  openMenuSessionId.value = '';
  const title = window.prompt(uiText.session.renamePrompt, session.title);
  if (title !== null && title.trim() && title.trim() !== session.title) {
    emit('rename', session.sessionId, title.trim());
  }
}

function deleteSession(session: SidebarSessionItem) {
  if (session.temporary) {
    return;
  }

  openMenuSessionId.value = '';
  if (window.confirm(uiText.session.deleteConfirm(session.title))) {
    emit('delete', session.sessionId);
  }
}

function refreshTemporarySession(event: MouseEvent) {
  event.stopPropagation();
  emit('refreshTemporarySession');
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
        :class="{
          'session-item--active': props.viewMode === 'chat' && session.sessionId === activeSessionId,
          'session-item--temporary': session.temporary,
        }"
      >
        <button class="session-item__content" type="button" @click="emit('switchView', 'chat'); emit('select', session.sessionId)">
          <span class="session-item__title-row">
            <span class="session-item__title">{{ session.title }}</span>
            <span v-if="session.temporary" class="session-item__badge">
              <Sparkles :size="11" />
              临时
            </span>
          </span>
          <span v-if="session.summary" class="session-item__summary" :title="session.summary">{{ session.summary }}</span>
          <span class="session-item__meta">{{ formatDateTime(session.updateTime) }}</span>
        </button>

        <div v-if="session.temporary" class="session-item__menu-wrap">
          <button class="session-menu-button" type="button" title="刷新临时会话" @click="refreshTemporarySession($event)">
            <RefreshCw :size="16" />
          </button>
        </div>

        <div v-if="!session.temporary" class="session-item__menu-wrap">
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
