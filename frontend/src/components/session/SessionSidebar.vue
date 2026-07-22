<script setup lang="ts">
import { CheckSquare, CircleHelp, LoaderCircle, MoreHorizontal, Plus, RefreshCw, Search, Settings, Sparkles, Square, Trash2, X } from '@lucide/vue';
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import SessionHelpDialog from '@/components/session/SessionHelpDialog.vue';
import { appConfig } from '@/config/appConfig';
import { customText } from '@/config/customText';
import { uiText } from '@/config/uiText';
import { useToastStore } from '@/stores/toastStore';
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
  batchDelete: [sessionIds: string[]];
}>();

const toast = useToastStore();

const keyword = ref('');
const openMenuSessionId = ref('');
const renameModalOpen = ref(false);
const renameTarget = ref<SidebarSessionItem | null>(null);
const renameValue = ref('');
const renameInputRef = ref<HTMLInputElement | null>(null);
const deleteModalOpen = ref(false);
const deleteTarget = ref<SidebarSessionItem | null>(null);
const helpDialogOpen = ref(false);

// ===== 批量管理状态 =====
const batchMode = ref(false);
const selectedIds = ref<Set<string>>(new Set());
const batchDeleteModalOpen = ref(false);
const batchDeleting = ref(false);
const batchDeleteProgress = ref({ done: 0, total: 0 });
const batchDeleteDoneCount = ref(0);
const batchDeleteHasError = ref(false);

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

// 批量模式下可选的会话（排除临时会话）
const batchableSessions = computed(() => filteredSessions.value.filter((session) => !session.temporary));

// 是否全选（基于当前可见的可批量会话）
const allSelected = computed(() => batchableSessions.value.length > 0 && batchableSessions.value.every((session) => selectedIds.value.has(session.sessionId)));
const someSelected = computed(() => selectedIds.value.size > 0 && !allSelected.value);
const selectedCount = computed(() => selectedIds.value.size);

function toggleMenu(sessionId: string) {
  openMenuSessionId.value = openMenuSessionId.value === sessionId ? '' : sessionId;
}

function renameSession(session: SidebarSessionItem) {
  if (session.temporary) return;
  openMenuSessionId.value = '';
  renameTarget.value = session;
  renameValue.value = session.title;
  renameModalOpen.value = true;
  nextTick(() => {
    renameInputRef.value?.focus();
    renameInputRef.value?.select();
  });
}

function confirmRename() {
  const target = renameTarget.value;
  const value = renameValue.value.trim();
  if (target && value && value !== target.title) {
    emit('rename', target.sessionId, value);
  }
  renameModalOpen.value = false;
  renameTarget.value = null;
  renameValue.value = '';
}

function cancelRename() {
  renameModalOpen.value = false;
  renameTarget.value = null;
  renameValue.value = '';
}

function deleteSession(session: SidebarSessionItem) {
  if (session.temporary) return;
  openMenuSessionId.value = '';
  deleteTarget.value = session;
  deleteModalOpen.value = true;
}

function confirmDelete() {
  const target = deleteTarget.value;
  if (target) emit('delete', target.sessionId);
  deleteModalOpen.value = false;
  deleteTarget.value = null;
}

function cancelDelete() {
  deleteModalOpen.value = false;
  deleteTarget.value = null;
}

function refreshTemporarySession(event: MouseEvent) {
  event.stopPropagation();
  emit('refreshTemporarySession');
}

function toggleHelpDialog() {
  helpDialogOpen.value = !helpDialogOpen.value;
}

// ===== 批量管理逻辑 =====

function enterBatchMode() {
  batchMode.value = true;
  selectedIds.value = new Set();
  openMenuSessionId.value = '';
}

// 从会话 ... 菜单进入批量模式，并默认选中触发的会话
function enterBatchModeFromMenu(sessionId: string) {
  openMenuSessionId.value = '';
  batchMode.value = true;
  selectedIds.value = new Set([sessionId]);
}

function exitBatchMode() {
  batchMode.value = false;
  selectedIds.value = new Set();
  batchDeleteModalOpen.value = false;
  batchDeleting.value = false;
}

function toggleSessionCheck(sessionId: string) {
  const next = new Set(selectedIds.value);
  if (next.has(sessionId)) {
    next.delete(sessionId);
  } else {
    next.add(sessionId);
  }
  selectedIds.value = next;
}

function toggleSelectAll() {
  if (allSelected.value) {
    // 取消全选
    const next = new Set(selectedIds.value);
    for (const session of batchableSessions.value) {
      next.delete(session.sessionId);
    }
    selectedIds.value = next;
  } else {
    // 全选当前可见的批量会话
    const next = new Set(selectedIds.value);
    for (const session of batchableSessions.value) {
      next.add(session.sessionId);
    }
    selectedIds.value = next;
  }
}

function openBatchDeleteModal() {
  if (selectedIds.value.size === 0) {
    return;
  }
  batchDeleteModalOpen.value = true;
}

function cancelBatchDelete() {
  if (batchDeleting.value) return;
  batchDeleteModalOpen.value = false;
}

// ===== ESC 键关闭弹窗支持 =====
function handleEscRename(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    cancelRename();
  }
}

function handleEscDelete(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    cancelDelete();
  }
}

function handleEscBatchDelete(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    // cancelBatchDelete 内部已对 batchDeleting 进行拦截
    cancelBatchDelete();
  }
}

watch(renameModalOpen, (open) => {
  if (open) {
    window.addEventListener('keydown', handleEscRename);
  } else {
    window.removeEventListener('keydown', handleEscRename);
  }
});

watch(deleteModalOpen, (open) => {
  if (open) {
    window.addEventListener('keydown', handleEscDelete);
  } else {
    window.removeEventListener('keydown', handleEscDelete);
  }
});

watch(batchDeleteModalOpen, (open) => {
  if (open) {
    window.addEventListener('keydown', handleEscBatchDelete);
  } else {
    window.removeEventListener('keydown', handleEscBatchDelete);
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscRename);
  window.removeEventListener('keydown', handleEscDelete);
  window.removeEventListener('keydown', handleEscBatchDelete);
});

async function confirmBatchDelete() {
  const ids = [...selectedIds.value];
  if (ids.length === 0) {
    return;
  }

  batchDeleting.value = true;
  batchDeleteHasError.value = false;
  batchDeleteProgress.value = { done: 0, total: ids.length };
  batchDeleteDoneCount.value = 0;

  // 通过 batchDelete 事件把所有 id 交给父组件逐个调用删除接口
  // 父组件循环 await workbench.deleteSession，完成后通过 @batch-delete-done 反馈结果
  emit('batchDelete', ids);
}

// 父组件每次删除完成后更新进度
function onBatchDeleteProgress(done: number, total: number) {
  batchDeleteProgress.value = { done, total };
}

function onBatchDeleteDone(successCount: number, failCount: number) {
  batchDeleteProgress.value = { done: batchDeleteProgress.value.total, total: batchDeleteProgress.value.total };
  batchDeleteDoneCount.value = successCount;
  batchDeleteHasError.value = failCount > 0;
  batchDeleting.value = false;
  selectedIds.value = new Set();

  // 额外的 toast 反馈，补充内联提示
  if (failCount > 0) {
    toast.error(`部分会话删除失败，失败 ${failCount} 个`);
  } else if (successCount > 0) {
    toast.success(`已删除 ${successCount} 个会话`);
  }

  if (!batchDeleteHasError.value) {
    setTimeout(() => {
      batchDeleteModalOpen.value = false;
      batchDeleteDoneCount.value = 0;
    }, 800);
  }
}

defineExpose({ onBatchDeleteProgress, onBatchDeleteDone, exitBatchMode });

function isSessionChecked(sessionId: string) {
  return selectedIds.value.has(sessionId);
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

    <!-- 非批量模式：显示新建 + 搜索 + 更多菜单 -->
    <template v-if="!batchMode">
      <button class="primary-action" type="button" :disabled="loading" @click="emit('create')">
        <Plus :size="18" />
        {{ customText.session.create }}
      </button>

      <label class="search-box">
        <Search :size="17" />
        <input v-model="keyword" type="search" :placeholder="customText.session.searchPlaceholder" />
      </label>
    </template>

    <!-- 批量模式：显示工具栏 -->
    <template v-else>
      <div class="batch-toolbar">
        <button class="batch-toolbar__action" type="button" @click="toggleSelectAll">
          <component :is="allSelected ? Square : CheckSquare" :size="16" />
          {{ allSelected ? customText.session.batchDeselectAll : customText.session.batchSelectAll }}
        </button>
        <span class="batch-toolbar__count">已选 {{ selectedCount }} 个</span>
        <button class="batch-toolbar__exit" type="button" :title="customText.session.batchExit" @click="exitBatchMode">
          <X :size="16" />
        </button>
      </div>

      <label class="search-box search-box--batch">
        <Search :size="17" />
        <input v-model="keyword" type="search" :placeholder="customText.session.searchPlaceholder" />
      </label>
    </template>

    <div class="session-list">
      <div
        v-for="session in filteredSessions"
        :key="session.sessionId"
        class="session-item"
        :class="{
          'session-item--active': !batchMode && props.viewMode === 'chat' && session.sessionId === activeSessionId,
          'session-item--temporary': session.temporary,
          'session-item--batch': batchMode,
          'session-item--checked': batchMode && isSessionChecked(session.sessionId),
          'session-item--disabled': batchMode && session.temporary,
        }"
      >
        <!-- 批量模式：checkbox -->
        <button
          v-if="batchMode"
          class="session-item__checkbox"
          type="button"
          :disabled="session.temporary"
          :title="session.temporary ? '临时会话不可选' : ''"
          @click.stop="!session.temporary && toggleSessionCheck(session.sessionId)"
        >
          <component :is="isSessionChecked(session.sessionId) ? CheckSquare : Square" :size="16" />
        </button>

        <button class="session-item__content" type="button" @click="batchMode ? (!session.temporary && toggleSessionCheck(session.sessionId)) : (emit('switchView', 'chat'), emit('select', session.sessionId))">
          <span class="session-item__title-row">
            <span class="session-item__title">{{ session.title }}</span>
            <span v-if="session.temporary" class="session-item__badge">
              <Sparkles :size="11" />{{ customText.session.temporaryTag }}
            </span>
          </span>
          <span v-if="session.summary" class="session-item__summary" :title="session.summary">{{ session.summary }}</span>
          <span class="session-item__meta">{{ formatDateTime(session.updateTime) }}</span>
        </button>

        <div v-if="!batchMode && session.temporary" class="session-item__menu-wrap">
          <button class="session-menu-button" type="button" :title="customText.session.refreshTemporaryTitle" @click="refreshTemporarySession($event)">
            <RefreshCw :size="16" />
          </button>
        </div>

        <div v-if="!batchMode && !session.temporary" class="session-item__menu-wrap">
          <button class="session-menu-button" type="button" :title="uiText.session.operations" @click.stop="toggleMenu(session.sessionId)">
            <MoreHorizontal :size="17" />
          </button>
          <div v-if="openMenuSessionId === session.sessionId" class="session-menu">
            <button type="button" @click.stop="renameSession(session)">{{ uiText.session.rename }}</button>
            <button type="button" @click.stop="enterBatchModeFromMenu(session.sessionId)">{{ customText.session.batchManage }}</button>
            <button type="button" class="danger-menu-item" @click.stop="deleteSession(session)">{{ uiText.session.delete }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 非批量模式：底部工具栏 -->
    <div v-if="!batchMode" class="session-sidebar__footer">
      <div class="session-sidebar__footer-tools">
        <button
          class="session-sidebar__nav-button"
          :class="{ 'session-sidebar__nav-button--active': viewMode === 'settings' }"
          type="button"
          :title="customText.session.settingsHint"
          @click="emit('switchView', 'settings')"
        >
          <Settings :size="18" />
        </button>

        <button class="session-sidebar__nav-button session-sidebar__help-button" type="button" :title="customText.session.helpTitle" @click="toggleHelpDialog">
          <CircleHelp :size="18" />
        </button>
      </div>
    </div>

    <!-- 批量模式：底部删除按钮 -->
    <div v-else class="session-sidebar__footer">
      <button
        class="batch-delete-button"
        type="button"
        :disabled="selectedCount === 0"
        @click="openBatchDeleteModal"
      >
        <Trash2 :size="16" />
        {{ customText.session.batchDelete }}（{{ selectedCount }}）
      </button>
    </div>

    <SessionHelpDialog :open="helpDialogOpen" @close="helpDialogOpen = false" />

    <Transition name="modal-fade">
      <div v-if="renameModalOpen" class="session-modal-overlay" @click.self="cancelRename">
        <div class="session-modal" role="dialog" aria-modal="true">
          <h3 class="session-modal__title">{{ uiText.session.renamePrompt }}</h3>
          <input
            ref="renameInputRef"
            v-model="renameValue"
            type="text"
            class="session-modal__input"
            @keydown.enter="confirmRename"
            @keydown.escape="cancelRename"
          />
          <div class="session-modal__actions">
            <button type="button" class="session-modal__button session-modal__button--ghost" @click="cancelRename">{{ customText.session.modalCancel }}</button>
            <button type="button" class="session-modal__button session-modal__button--primary" @click="confirmRename">{{ customText.session.modalConfirm }}</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="modal-fade">
      <div v-if="deleteModalOpen" class="session-modal-overlay" @click.self="cancelDelete">
        <div class="session-modal" role="dialog" aria-modal="true">
          <h3 class="session-modal__title">{{ customText.session.deleteTitle }}</h3>
          <p class="session-modal__message">{{ deleteTarget ? uiText.session.deleteConfirm(deleteTarget.title) : '' }}</p>
          <div class="session-modal__actions">
            <button type="button" class="session-modal__button session-modal__button--ghost" @click="cancelDelete">{{ customText.session.modalCancel }}</button>
            <button type="button" class="session-modal__button session-modal__button--danger" @click="confirmDelete">{{ uiText.session.delete }}</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 批量删除确认弹窗 -->
    <Transition name="modal-fade">
      <div v-if="batchDeleteModalOpen" class="session-modal-overlay" @click.self="cancelBatchDelete">
        <div class="session-modal" role="dialog" aria-modal="true">
          <h3 class="session-modal__title">{{ customText.session.batchDeleteTitle }}</h3>

          <template v-if="!batchDeleting && batchDeleteDoneCount === 0">
            <p class="session-modal__message">{{ customText.session.batchDeleteConfirm(selectedCount) }}</p>
            <div class="session-modal__actions">
              <button type="button" class="session-modal__button session-modal__button--ghost" :disabled="batchDeleting" @click="cancelBatchDelete">{{ customText.session.modalCancel }}</button>
              <button type="button" class="session-modal__button session-modal__button--danger" @click="confirmBatchDelete">{{ customText.session.batchDelete }}</button>
            </div>
          </template>

          <!-- 删除进行中 -->
          <template v-if="batchDeleting">
            <div class="batch-progress">
              <LoaderCircle :size="20" class="spin-icon" />
              <span>{{ customText.session.batchDeleteProgress(batchDeleteProgress.done, batchDeleteProgress.total) }}</span>
            </div>
          </template>

          <!-- 删除完成 -->
          <template v-if="!batchDeleting && batchDeleteDoneCount > 0">
            <p class="session-modal__message" :class="{ 'session-modal__message--error': batchDeleteHasError }">
              {{ batchDeleteHasError ? customText.session.batchDeleteError : customText.session.batchDeleteDone(batchDeleteDoneCount) }}
            </p>
            <div class="session-modal__actions">
              <button type="button" class="session-modal__button session-modal__button--primary" @click="batchDeleteModalOpen = false; batchDeleteDoneCount = 0">{{ customText.session.modalConfirm }}</button>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.session-sidebar__footer-tools {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.session-sidebar__help-button {
  margin-left: auto;
}

/* ===== 批量管理工具栏 ===== */
.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
}

.batch-toolbar__action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s ease;
}

.batch-toolbar__action:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface);
}

.batch-toolbar__count {
  flex: 1;
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: center;
}

.batch-toolbar__exit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.batch-toolbar__exit:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text);
}

.search-box--batch {
  margin-bottom: 4px;
}

/* ===== 批量模式会话项 ===== */
/* 覆盖默认的 grid-template-columns: minmax(0,1fr) 34px，
   批量模式下右侧菜单不显示，改为 checkbox + content 两列，checkbox 紧凑占位 */
.session-item--batch {
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 6px;
  cursor: pointer;
}

.session-item--batch:hover {
  background: color-mix(in srgb, var(--color-accent) 4%, transparent);
}

.session-item--checked {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.session-item--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.session-item__checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: color 0.15s ease;
}

.session-item__checkbox:hover:not(:disabled) {
  color: var(--color-accent);
}

.session-item__checkbox:disabled {
  cursor: not-allowed;
}

.session-item__checkbox svg {
  color: var(--color-accent);
}

/* ===== 批量删除按钮 ===== */
.batch-delete-button {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--color-danger, var(--color-accent));
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-danger, var(--color-accent)) 8%, transparent);
  color: var(--color-danger, var(--color-accent));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.batch-delete-button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-danger, var(--color-accent)) 16%, transparent);
}

.batch-delete-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ===== 批量进度 ===== */
.batch-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  color: var(--color-text);
  font-size: 13px;
}

.batch-progress .spin-icon {
  color: var(--color-accent);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.session-modal__message--error {
  color: var(--color-danger, var(--color-text));
}
</style>
