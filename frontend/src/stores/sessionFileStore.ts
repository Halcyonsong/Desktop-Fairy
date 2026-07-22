import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { sessionFileApi } from '@/api/sessionApi';
import { useToastStore } from '@/stores/toastStore';
import type { SessionFileReference } from '@/main';

/**
 * 会话文件授权 Store
 *
 * 管理当前会话的已授权文件列表。
 * 文件通过 /session-file REST API 管理，与聊天请求解耦。
 * 当有已授权文件时，自动锁定工具调用状态。
 */
export const useSessionFileStore = defineStore('sessionFile', () => {
  const files = ref<SessionFileReference[]>([]);
  const loading = ref(false);
  const currentSessionId = ref<string>('');
  const authorizing = ref(false);

  const hasFiles = computed(() => files.value.length > 0);
  const fileCount = computed(() => files.value.length);

  /** 加载指定会话的已授权文件列表 */
  async function loadForSession(sessionId: string) {
    if (!sessionId) {
      files.value = [];
      currentSessionId.value = '';
      return;
    }
    currentSessionId.value = sessionId;
    loading.value = true;
    try {
      files.value = await sessionFileApi.listBySession(sessionId);
    } catch {
      files.value = [];
    } finally {
      loading.value = false;
    }
  }

  /** 授权一个文件（通过本地路径） */
  async function authorizeFile(sessionId: string, absolutePath: string) {
    const toast = useToastStore();
    if (!sessionId || !absolutePath) return;

    // 确保 currentSessionId 与传入的 sessionId 一致
    currentSessionId.value = sessionId;
    authorizing.value = true;
    try {
      const ref = await sessionFileApi.authorize(sessionId, absolutePath);
      files.value = [...files.value, ref];
      toast.success(`已添加附件：${ref.originalFileName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '文件授权失败';
      toast.error(message);
      throw error;
    } finally {
      authorizing.value = false;
    }
  }

  /** 批量授权多个文件 */
  async function authorizeFiles(sessionId: string, absolutePaths: string[]) {
    const toast = useToastStore();
    if (!sessionId || absolutePaths.length === 0) return;

    // 确保 currentSessionId 与传入的 sessionId 一致
    currentSessionId.value = sessionId;
    authorizing.value = true;
    let successCount = 0;
    let failCount = 0;

    for (const p of absolutePaths) {
      try {
        const ref = await sessionFileApi.authorize(sessionId, p);
        files.value = [...files.value, ref];
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`已添加 ${successCount} 个附件`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} 个文件添加失败`);
    }

    authorizing.value = false;
  }

  /** 删除一个已授权文件 */
  async function removeFile(fileReferenceId: string, sessionId?: string) {
    const toast = useToastStore();
    const sid = sessionId || currentSessionId.value;
    if (!sid) return;

    try {
      await sessionFileApi.remove(fileReferenceId, sid);
      files.value = files.value.filter((f) => f.fileReferenceId !== fileReferenceId);
      toast.success('已移除附件');
    } catch (error) {
      const message = error instanceof Error ? error.message : '移除附件失败';
      toast.error(message);
    }
  }

  /** 清空文件列表（保留 currentSessionId，避免发送后无法删除附件） */
  function clear() {
    files.value = [];
  }

  /** 完全重置（切换会话时调用） */
  function reset() {
    files.value = [];
    currentSessionId.value = '';
  }

  return {
    files,
    loading,
    authorizing,
    currentSessionId,
    hasFiles,
    fileCount,
    loadForSession,
    authorizeFile,
    authorizeFiles,
    removeFile,
    clear,
    reset,
  };
});
