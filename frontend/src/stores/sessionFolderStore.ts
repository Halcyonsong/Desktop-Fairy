import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { sessionFolderApi } from '@/api/sessionApi';
import { useToastStore } from '@/stores/toastStore';
import type { SessionFolderReference } from '@/types/electron';

/**
 * 会话文件夹授权 Store
 *
 * 管理当前会话的已授权文件夹列表。
 * 文件夹通过 /session-folder REST API 管理，与文件授权独立。
 * 后端限制每个会话最多 3 个文件夹，前端不预限制，通过后端异常反馈。
 */
export const useSessionFolderStore = defineStore('sessionFolder', () => {
  const folders = ref<SessionFolderReference[]>([]);
  const loading = ref(false);
  const currentSessionId = ref<string>('');
  const authorizing = ref(false);

  const hasFolders = computed(() => folders.value.length > 0);
  const folderCount = computed(() => folders.value.length);

  /** 检查路径是否已存在（去重） */
  function findDuplicate(absolutePath: string): SessionFolderReference | undefined {
    return folders.value.find((f) => f.absolutePath === absolutePath);
  }

  /** 加载指定会话的已授权文件夹列表 */
  async function loadForSession(sessionId: string) {
    if (!sessionId) {
      folders.value = [];
      currentSessionId.value = '';
      return;
    }
    currentSessionId.value = sessionId;
    loading.value = true;
    try {
      const result = await sessionFolderApi.listBySession(sessionId);
      if (currentSessionId.value !== sessionId) return;
      folders.value = result;
    } catch {
      if (currentSessionId.value !== sessionId) return;
      folders.value = [];
    } finally {
      if (currentSessionId.value === sessionId) {
        loading.value = false;
      }
    }
  }

  /** 授权一个文件夹（通过本地路径） */
  async function authorizeFolder(sessionId: string, absolutePath: string) {
    const toast = useToastStore();
    if (!sessionId || !absolutePath) return;

    // 去重检查
    const existing = findDuplicate(absolutePath);
    if (existing) {
      toast.warning(`文件夹已授权：${existing.folderName}`);
      return;
    }

    currentSessionId.value = sessionId;
    authorizing.value = true;
    try {
      const ref = await sessionFolderApi.authorize(sessionId, absolutePath);
      if (currentSessionId.value !== sessionId) return;
      folders.value = [...folders.value, ref];
      toast.success(`已授权工作目录：${ref.folderName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '文件夹授权失败';
      toast.error(message);
      throw error;
    } finally {
      authorizing.value = false;
    }
  }

  /** 撤销一个已授权文件夹 */
  async function removeFolder(folderReferenceId: string, sessionId?: string) {
    const toast = useToastStore();
    const sid = sessionId || currentSessionId.value;
    if (!sid) return;

    try {
      await sessionFolderApi.remove(folderReferenceId, sid);
      folders.value = folders.value.filter((f) => f.folderReferenceId !== folderReferenceId);
      toast.success('已撤销文件夹授权');
    } catch (error) {
      const message = error instanceof Error ? error.message : '撤销文件夹授权失败';
      toast.error(message);
    }
  }

  /** 完全重置（切换会话时调用） */
  function reset() {
    folders.value = [];
    currentSessionId.value = '';
  }

  return {
    folders,
    loading,
    authorizing,
    currentSessionId,
    hasFolders,
    folderCount,
    loadForSession,
    authorizeFolder,
    removeFolder,
    reset,
  };
});
