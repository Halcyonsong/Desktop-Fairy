import { defineStore } from 'pinia';
import { ref } from 'vue';
import { chatApi } from '@/api/chatApi';
import type {
  LocalModelActionType,
  LocalModelTaskDetail,
  LocalModelTaskLaunchResult,
  LocalModelTaskStatus,
} from '@/types/chat';

const TERMINAL_STATUSES: LocalModelTaskStatus[] = ['SUCCESS', 'FAILED'];
const POLL_INTERVAL_MS = 1000;

export const useLocalModelInstallerStore = defineStore('localModelInstaller', () => {
  const status = ref<LocalModelTaskStatus>('IDLE');
  const actionType = ref<LocalModelActionType | null>(null);
  const taskLaunch = ref<LocalModelTaskLaunchResult | null>(null);
  const taskDetail = ref<LocalModelTaskDetail | null>(null);
  const errorMessage = ref('');
  const polling = ref(false);
  const busy = ref(false);
  const installBusy = ref(false);
  const startBusy = ref(false);
  const stopBusy = ref(false);
  const logPanelOpen = ref(false);
  let pollTimer: number | null = null;

  function clearPollTimer() {
    if (pollTimer !== null) {
      window.clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function stopPolling() {
    clearPollTimer();
    polling.value = false;
    busy.value = false;
    installBusy.value = false;
    startBusy.value = false;
    stopBusy.value = false;
  }

  function scheduleNextPoll() {
    clearPollTimer();
    pollTimer = window.setTimeout(() => {
      void pollTask();
    }, POLL_INTERVAL_MS);
  }

  async function pollTask() {
    const currentTaskId = taskLaunch.value?.taskId;
    if (!currentTaskId) {
      stopPolling();
      return;
    }

    try {
      const detail = await chatApi.getLocalTestTask(currentTaskId);
      taskDetail.value = detail;
      status.value = detail.status;
      errorMessage.value = detail.status === 'FAILED' ? detail.message?.trim() || detail.stderr?.trim() || '本地脚本任务失败' : '';

      if (TERMINAL_STATUSES.includes(detail.status)) {
        stopPolling();
        return;
      }

      scheduleNextPoll();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '查询本地脚本任务失败';
      stopPolling();
    }
  }

  async function launchTask(action: LocalModelActionType) {
    if (busy.value || polling.value) {
      errorMessage.value = '当前已有本地脚本任务正在执行，请等待完成后再试';
      return false;
    }

    stopPolling();
    errorMessage.value = '';
    actionType.value = action;
    logPanelOpen.value = true;
    taskDetail.value = null;
    busy.value = true;

    if (action === 'install') installBusy.value = true;
    if (action === 'start') startBusy.value = true;
    if (action === 'stop') stopBusy.value = true;

    try {
      const launchResult =
        action === 'install'
          ? await chatApi.installLocalTestModel()
          : action === 'start'
            ? await chatApi.startLocalTestModel()
            : await chatApi.stopLocalTestModel();

      taskLaunch.value = launchResult;
      status.value = launchResult.status;
      polling.value = true;
      await pollTask();
      return true;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '本地脚本任务启动失败';
      stopPolling();
      return false;
    }
  }

  function openLogPanel() {
    logPanelOpen.value = true;
  }

  function closeLogPanel() {
    logPanelOpen.value = false;
  }

  async function installLocalTestModel() {
    return launchTask('install');
  }

  async function startLocalTestModel() {
    return launchTask('start');
  }

  async function stopLocalTestModel() {
    return launchTask('stop');
  }

  return {
    status,
    actionType,
    taskLaunch,
    taskDetail,
    errorMessage,
    polling,
    busy,
    installBusy,
    startBusy,
    stopBusy,
    logPanelOpen,
    openLogPanel,
    closeLogPanel,
    installLocalTestModel,
    startLocalTestModel,
    stopLocalTestModel,
    stopPolling,
  };
});
