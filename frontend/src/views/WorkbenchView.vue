<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppShell from '@/components/layout/AppShell.vue';
import AuthorizedPathsBar from '@/components/chat/AuthorizedPathsBar.vue';
import ChatComposer from '@/components/chat/ChatComposer.vue';
import ChatHeader from '@/components/chat/ChatHeader.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import MessageList from '@/components/chat/MessageList.vue';
import PermissionRequestBar from '@/components/chat/PermissionRequestBar.vue';
import SessionSidebar from '@/components/session/SessionSidebar.vue';
import SettingsView from '@/views/SettingsView.vue';
import { useChatPreferencesStore } from '@/stores/chatPreferencesStore';
import { useBackendStatusStore } from '@/stores/backendStatusStore';
import { useFairyChatStore } from '@/stores/fairyChatStore';
import { useModelSourceStore } from '@/stores/modelSourceStore';
import { usePermissionRequestStore } from '@/stores/permissionRequestStore';
import { useSessionFileStore } from '@/stores/sessionFileStore';
import { useSessionFolderStore } from '@/stores/sessionFolderStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
import { useWorkbenchStore } from '@/stores/workbenchStore';
import { customText } from '@/config/customText';
import { uiText } from '@/config/uiText';
import type { ChatSession } from '@/types/chat';

const workbench = useWorkbenchStore();
const uiStore = useUiStore();
const modelSourceStore = useModelSourceStore();
const fairyChatStore = useFairyChatStore();
const chatPreferencesStore = useChatPreferencesStore();
const sessionFileStore = useSessionFileStore();
const sessionFolderStore = useSessionFolderStore();
const permissionRequestStore = usePermissionRequestStore();
const toast = useToastStore();

const sessionSidebarRef = ref<InstanceType<typeof SessionSidebar> | null>(null);

// 刷新历史成功提示的显示时长（毫秒）
const REFRESH_SUCCESS_HINT_MS = 1200;

// 消息操作确认弹窗状态
const confirmDialogOpen = ref(false);
const confirmDialogTitle = ref('');
const confirmDialogMessage = ref('');
const confirmDialogConfirmText = ref('');
const pendingConfirmAction = ref<(() => void) | null>(null);

function requestRollbackConfirm() {
  if (fairyChatStore.selected) return;
  confirmDialogTitle.value = uiText.chat.rollbackConfirmTitle;
  confirmDialogMessage.value = uiText.chat.rollbackConfirmMessage;
  confirmDialogConfirmText.value = uiText.chat.rollbackConfirmText;
  pendingConfirmAction.value = () => workbench.rollbackLatestRoundToComposer();
  confirmDialogOpen.value = true;
}

function requestDeleteConfirm() {
  if (fairyChatStore.selected) return;
  confirmDialogTitle.value = uiText.chat.deleteConfirmTitle;
  confirmDialogMessage.value = uiText.chat.deleteConfirmMessage;
  confirmDialogConfirmText.value = uiText.chat.deleteConfirmText;
  pendingConfirmAction.value = () => workbench.deleteLatestRoundOnly();
  confirmDialogOpen.value = true;
}

function handleConfirmDialogConfirm() {
  confirmDialogOpen.value = false;
  const action = pendingConfirmAction.value;
  pendingConfirmAction.value = null;
  action?.();
}

function handleConfirmDialogCancel() {
  confirmDialogOpen.value = false;
  pendingConfirmAction.value = null;
}

async function handleBatchDelete(sessionIds: string[]) {
  let successCount = 0;
  let failCount = 0;
  const total = sessionIds.length;

  for (let i = 0; i < sessionIds.length; i++) {
    try {
      await workbench.deleteSession(sessionIds[i]);
      successCount++;
    } catch {
      failCount++;
    }
    sessionSidebarRef.value?.onBatchDeleteProgress(i + 1, total);
  }

  sessionSidebarRef.value?.onBatchDeleteDone(successCount, failCount);
}

const temporarySummary = computed(() => fairyChatStore.temporarySessionSummary);
const sidebarSessions = computed(() => {
  const sessions = workbench.sessions.map((session) => ({
    ...session,
    summary: '',
    temporary: false,
  }));

  if (!temporarySummary.value) {
    // 没有活跃的临时会话时，也显示一个临时闲聊入口，确保用户随时可进入
    return [
      {
        sessionId: fairyChatStore.temporaryChatOption.sessionId,
        title: fairyChatStore.temporaryChatOption.title,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        summary: '',
        temporary: true,
      },
      ...sessions,
    ];
  }

  return [
    {
      ...temporarySummary.value,
      summary: '',
      temporary: true,
    },
    ...sessions,
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
const refreshHistorySuccess = ref(false);

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
    sessionFileStore.reset();
    sessionFolderStore.reset();
    permissionRequestStore.clear();
    return;
  }

  fairyChatStore.deselectTemporaryChat();
  // 切换会话时清除待处理的权限申请
  permissionRequestStore.clear();
  await workbench.loadSession(sessionId);
  // 加载该会话的已授权文件和文件夹列表
  await Promise.all([
    sessionFileStore.loadForSession(sessionId),
    sessionFolderStore.loadForSession(sessionId),
  ]);
}

function handleToggleToolCall() {
  // 如果工具调用被锁定（有附件），不允许关闭
  if (chatPreferencesStore.toolCallLocked) {
    toast.warning(customText.composer.attachmentToolLocked);
    return;
  }
  chatPreferencesStore.toggleToolCallEnabled();
}

function handleRefreshTemporarySession() {
  fairyChatStore.refreshTemporarySession();
  fairyChatStore.selectTemporaryChat();
  uiStore.switchView('chat');
}

async function handleComposerSend(question: string) {
  if (fairyChatStore.selected) {
    // 发送前立即清空输入框，让用户可以立即输入下一条消息
    fairyChatStore.setDraft('');
    try {
      await fairyChatStore.sendTemporaryMessage(question, 'manual');
    } catch (error) {
      // 非 AbortError 的错误已在 store 中设置 errorMessage，此处仅防止未捕获异常
      if (!(error instanceof Error && error.name === 'AbortError')) {
        console.error('[WorkbenchView] 临时闲聊发送失败:', error);
      }
    }
    return;
  }

  try {
    await workbench.sendMessage(question);
    // 发送成功后清除附件展示（后端授权仍保留，仅清空 UI）
    sessionFileStore.clear();
  } catch (error) {
    console.error('[WorkbenchView] 工作台消息发送失败:', error);
  }
}

async function handleRevokeFile(fileReferenceId: string) {
  await sessionFileStore.removeFile(fileReferenceId);
}

async function handleRevokeFolder(folderReferenceId: string) {
  await sessionFolderStore.removeFolder(folderReferenceId);
}

// ===== 权限申请处理 =====
const permissionBarRef = ref<InstanceType<typeof PermissionRequestBar> | null>(null);

/** 批准权限申请：先走授权接口，再自动发送消息 */
async function handleApprovePermission(extraContent: string) {
  const sid = permissionRequestStore.sessionId;
  const path = permissionRequestStore.absolutePath;
  const isFile = permissionRequestStore.isFileRequest;

  permissionRequestStore.clear();
  permissionBarRef.value?.reset();

  if (!sid || !path) return;

  // 先执行授权
  try {
    if (isFile) {
      await sessionFileStore.authorizeFile(sid, path);
    } else {
      await sessionFolderStore.authorizeFolder(sid, path);
    }
  } catch {
    // 授权失败，toast 已在 store 中处理，不继续发送消息
    toast.error(customText.permission.authorizeFailed);
    return;
  }

  // 构造基础提示词并发送
  const basePrompt = customText.permission.approveBase(path);
  const message = extraContent ? `${basePrompt} ${extraContent}` : basePrompt;
  await workbench.sendMessage(message);
}

/** 拒绝权限申请：直接发送拒绝消息 */
async function handleRejectPermission(extraContent: string) {
  const path = permissionRequestStore.absolutePath;

  permissionRequestStore.clear();
  permissionBarRef.value?.reset();

  const basePrompt = customText.permission.rejectBase(path);
  const message = extraContent ? `${basePrompt} ${extraContent}` : basePrompt;
  await workbench.sendMessage(message);
}

/** 关闭权限申请：不发送任何消息，停止当前操作 */
function handleDismissPermission() {
  permissionRequestStore.clear();
  permissionBarRef.value?.reset();
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

  refreshHistorySuccess.value = false;
  void workbench.refreshActiveHistory()
    .then(() => {
      if (!workbench.errorMessage) {
        refreshHistorySuccess.value = true;
        toast.success(uiText.chat.historyRefreshed);
        setTimeout(() => {
          refreshHistorySuccess.value = false;
        }, REFRESH_SUCCESS_HINT_MS);
      } else {
        toast.error(workbench.errorMessage);
      }
    })
    .catch(() => {
      refreshHistorySuccess.value = false;
      toast.error(uiText.errors.refreshHistoryFailed);
    });
}

function handleCreateSession() {
  fairyChatStore.deselectTemporaryChat();
  uiStore.switchView('chat');
  void workbench.createSession().catch((error) => {
    console.error('[WorkbenchView] 创建会话失败:', error);
    toast.error(uiText.errors.createSessionFailed);
  });
}

async function handleDeleteSession(sessionId: string) {
  try {
    await workbench.deleteSession(sessionId);
    toast.success('会话已删除');
  } catch (error) {
    console.error('[WorkbenchView] 删除会话失败:', error);
    toast.error('删除会话失败');
  }
}

async function handleRenameSession(sessionId: string, title: string) {
  try {
    await workbench.renameSession(sessionId, title);
    toast.success('已重命名');
  } catch (error) {
    console.error('[WorkbenchView] 重命名会话失败:', error);
    toast.error('重命名失败');
  }
}

onMounted(() => {
  const backendStatusStore = useBackendStatusStore();

  let stopWatch: (() => void) | null = null;

  async function initWhenReady() {
    if (!backendStatusStore.ready) {
      // 等待后端 ready（Electron 环境下由 IPC 通知触发）
      await new Promise<void>((resolve) => {
        stopWatch = watch(
          () => backendStatusStore.ready,
          (ready) => {
            if (ready) {
              stopWatch = null;
              resolve();
            }
          },
        );
      });
    }
    await workbench.bootstrap();
    // bootstrap 会自动加载第一个会话，需同步加载该会话的已授权文件和文件夹
    const sid = workbench.activeSessionId;
    if (sid) {
      await Promise.all([
        sessionFileStore.loadForSession(sid),
        sessionFolderStore.loadForSession(sid),
      ]);
    }
    void modelSourceStore.bootstrap();
  }

  void initWhenReady();

  // 组件卸载时清理 watch，防止内存泄漏
  onBeforeUnmount(() => {
    stopWatch?.();
  });
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
              ref="sessionSidebarRef"
              :sessions="sidebarSessions"
              :active-session-id="activeSessionId"
              :loading="workbench.loading"
              :view-mode="uiStore.viewMode"
              @create="handleCreateSession"
              @select="handleSidebarSelect"
              @rename="handleRenameSession"
              @delete="handleDeleteSession"
              @batch-delete="handleBatchDelete"
              @refresh-temporary-session="handleRefreshTemporarySession"
              @switch-view="uiStore.switchView"
            />
          </template>

          <template #main>
            <ChatHeader
              :session="currentSession"
              :history-total="currentHistoryTotal"
              :refreshing="currentHistoryRefreshing"
              :refresh-success="refreshHistorySuccess"
              @refresh="handleRefreshHistory"
            />
            <AuthorizedPathsBar
              v-if="!fairyChatStore.selected"
              :files="sessionFileStore.files"
              :folders="sessionFolderStore.folders"
              @revoke-file="handleRevokeFile"
              @revoke-folder="handleRevokeFolder"
            />
            <PermissionRequestBar
              v-if="!fairyChatStore.selected"
              ref="permissionBarRef"
              @approve="handleApprovePermission"
              @reject="handleRejectPermission"
              @dismiss="handleDismissPermission"
            />
            <MessageList
              :session-key="activeSessionId"
              :messages="currentMessages"
              :error-message="currentErrorMessage"
              :reasoning-text="fairyChatStore.selected ? '' : workbench.latestReasoningText"
              :reasoning-message-id="fairyChatStore.selected ? '' : workbench.latestReasoningMessageId"
              :history-pull-message="fairyChatStore.selected ? '' : workbench.historyPullMessage"
              :loading-more-history="fairyChatStore.selected ? false : workbench.loadingMoreHistory"
              :sending="currentSending"
              @load-more="fairyChatStore.selected ? undefined : workbench.loadMoreHistory()"
              @rollback-latest-round="requestRollbackConfirm()"
              @delete-latest-round="requestDeleteConfirm()"
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
              :allow-empty-send="fairyChatStore.selected"
              :tool-call-enabled="chatPreferencesStore.toolCallEnabled"
              :tool-call-locked="chatPreferencesStore.toolCallLocked"
              :session-id="fairyChatStore.selected ? undefined : activeSessionId"
              :is-temporary-session="fairyChatStore.selected"
              :system-prompts="chatPreferencesStore.systemPrompts"
              :selected-prompt-slot="chatPreferencesStore.selectedPromptSlot"
              @update:draft="fairyChatStore.selected ? fairyChatStore.setDraft($event) : workbench.setComposerDraft($event)"
              @send="handleComposerSend"
              @stop="handleComposerStop"
              @rollback="requestRollbackConfirm()"
              @select-model="modelSourceStore.selectChatModel"
              @update:temperature-input="modelSourceStore.setTemperatureInput"
              @update:max-tokens-input="modelSourceStore.setMaxTokensInput"
              @update:selected-prompt-slot="chatPreferencesStore.setSelectedPromptSlot($event)"
              @update-system-prompt="(id, patch) => chatPreferencesStore.updateSystemPrompt(id, patch)"
              @toggle-tool-call="handleToggleToolCall"
            />
          </template>
        </AppShell>
      </div>
    </Transition>

    <ConfirmDialog
      :open="confirmDialogOpen"
      :title="confirmDialogTitle"
      :message="confirmDialogMessage"
      :confirm-text="confirmDialogConfirmText"
      :cancel-text="uiText.chat.confirmCancel"
      @confirm="handleConfirmDialogConfirm"
      @cancel="handleConfirmDialogCancel"
    />
  </div>
</template>
