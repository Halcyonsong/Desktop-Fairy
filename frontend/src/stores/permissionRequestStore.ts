import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { PermissionRequestEvent } from '@/types/chat';

/**
 * 权限申请 Store
 *
 * 当后端发出 1008 PERMISSION_REQUEST 事件时，将申请信息存入此 store。
 * UI 通过 hasPending 计算属性决定是否显示权限申请栏。
 * 用户处理后（批准/拒绝/关闭），调用 clear() 清除。
 */
export const usePermissionRequestStore = defineStore('permissionRequest', () => {
  const pendingRequest = ref<PermissionRequestEvent | null>(null);
  const sessionId = ref<string>('');

  const hasPending = computed(() => pendingRequest.value !== null);
  const requestType = computed(() => pendingRequest.value?.requestType ?? '');
  const absolutePath = computed(() => pendingRequest.value?.absolutePath ?? '');
  const reason = computed(() => pendingRequest.value?.reason ?? '');
  const isFileRequest = computed(() => requestType.value === 'FILE');
  const isFolderRequest = computed(() => requestType.value === 'FOLDER');

  /** 设置待处理的权限申请 */
  function setRequest(sid: string, request: PermissionRequestEvent) {
    sessionId.value = sid;
    pendingRequest.value = request;
  }

  /** 清除待处理的权限申请 */
  function clear() {
    pendingRequest.value = null;
    sessionId.value = '';
  }

  return {
    pendingRequest,
    sessionId,
    hasPending,
    requestType,
    absolutePath,
    reason,
    isFileRequest,
    isFolderRequest,
    setRequest,
    clear,
  };
});
