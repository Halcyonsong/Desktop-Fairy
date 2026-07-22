import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { sessionFileApi } from '@/api/sessionApi';
import { useToastStore } from '@/stores/toastStore';
import type { SessionFileReference } from '@/types/electron';

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

  // 主附件：限制一个文件，用于工具对话时优先注入
  const primaryAttachmentFileReferenceId = ref<string>('');

  const hasFiles = computed(() => files.value.length > 0);
  const fileCount = computed(() => files.value.length);

  /** 检查路径是否已存在（去重） */
  function findDuplicate(absolutePath: string): SessionFileReference | undefined {
    return files.value.find(
      (f) => f.absolutePath === absolutePath || f.originalFileName === absolutePath.split(/[\\/]/).pop(),
    );
  }

  /** 加载指定会话的已授权文件列表 */
  async function loadForSession(sessionId: string) {
    if (!sessionId) {
      files.value = [];
      currentSessionId.value = '';
      primaryAttachmentFileReferenceId.value = '';
      return;
    }
    currentSessionId.value = sessionId;
    loading.value = true;
    try {
      const result = await sessionFileApi.listBySession(sessionId);
      // 会话可能已切换，校验避免数据错乱
      if (currentSessionId.value !== sessionId) return;
      files.value = result;
    } catch {
      if (currentSessionId.value !== sessionId) return;
      files.value = [];
    } finally {
      // 仅在仍是当前会话时关闭 loading，避免影响后续会话的加载状态
      if (currentSessionId.value === sessionId) {
        loading.value = false;
      }
    }
  }

  /** 授权一个文件（通过本地路径） */
  async function authorizeFile(sessionId: string, absolutePath: string) {
    const toast = useToastStore();
    if (!sessionId || !absolutePath) return;

    // 去重检查
    const existing = findDuplicate(absolutePath);
    if (existing) {
      toast.warning(`文件已添加：${existing.originalFileName}`);
      return;
    }

    // 确保 currentSessionId 与传入的 sessionId 一致
    currentSessionId.value = sessionId;
    authorizing.value = true;
    try {
      const ref = await sessionFileApi.authorize(sessionId, absolutePath);
      // 会话可能已切换，校验避免数据错乱
      if (currentSessionId.value !== sessionId) return;
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

    // 去重过滤
    const newPaths: string[] = [];
    let duplicateCount = 0;
    for (const p of absolutePaths) {
      const existing = findDuplicate(p);
      if (existing) {
        duplicateCount++;
      } else {
        newPaths.push(p);
      }
    }

    if (duplicateCount > 0) {
      toast.warning(`${duplicateCount} 个文件已存在，跳过添加`);
    }

    if (newPaths.length === 0) {
      authorizing.value = false;
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const p of newPaths) {
      try {
        const ref = await sessionFileApi.authorize(sessionId, p);
        // 会话可能已切换，校验避免数据错乱
        if (currentSessionId.value !== sessionId) return;
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
      // 如果删除的是主附件，清除主附件标记
      if (primaryAttachmentFileReferenceId.value === fileReferenceId) {
        primaryAttachmentFileReferenceId.value = '';
      }
      toast.success('已移除附件');
    } catch (error) {
      const message = error instanceof Error ? error.message : '移除附件失败';
      toast.error(message);
    }
  }

  /** 设置主附件（限制一个文件） */
  function setPrimaryAttachment(fileReferenceId: string) {
    const toast = useToastStore();
    const exists = files.value.some((f) => f.fileReferenceId === fileReferenceId);
    if (!exists) return;
    primaryAttachmentFileReferenceId.value = fileReferenceId;
    const file = files.value.find((f) => f.fileReferenceId === fileReferenceId);
    toast.success(`已设为主附件：${file?.originalFileName ?? ''}`);
  }

  /** 取消主附件 */
  function clearPrimaryAttachment() {
    primaryAttachmentFileReferenceId.value = '';
  }

  /** 清空文件列表（保留 currentSessionId，避免发送后无法删除附件） */
  function clear() {
    files.value = [];
    primaryAttachmentFileReferenceId.value = '';
  }

  /** 完全重置（切换会话时调用） */
  function reset() {
    files.value = [];
    currentSessionId.value = '';
    primaryAttachmentFileReferenceId.value = '';
  }

  return {
    files,
    loading,
    authorizing,
    currentSessionId,
    primaryAttachmentFileReferenceId,
    hasFiles,
    fileCount,
    loadForSession,
    authorizeFile,
    authorizeFiles,
    removeFile,
    setPrimaryAttachment,
    clearPrimaryAttachment,
    clear,
    reset,
  };
});
