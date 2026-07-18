import { requestJson, jsonHeaders } from '@/api/httpClient';
import type {
  LocalModelTaskDetail,
  LocalModelTaskLaunchResult,
  ModelSourceDetail,
  ModelSourceFetchModelsPayload,
  ModelSourceListItem,
  ModelSourceSavePayload,
  ModelSourceTestPayload,
  ModelSourceTestResult,
} from '@/types/chat';

export const modelSourceApi = {
  createModelSource(payload: ModelSourceSavePayload) {
    return requestJson<string>('/api/model-source', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
  },

  updateModelSource(payload: ModelSourceSavePayload) {
    return requestJson<boolean>('/api/model-source', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
  },

  deleteModelSource(sourceCode: string) {
    return requestJson<boolean>(`/api/model-source/${encodeURIComponent(sourceCode)}`, {
      method: 'DELETE',
    });
  },

  deleteModelFromSource(sourceCode: string, modelName: string) {
    return requestJson<boolean>(
      `/api/model-source/${encodeURIComponent(sourceCode)}/models?modelName=${encodeURIComponent(modelName)}`,
      {
        method: 'DELETE',
      },
    );
  },

  listModelSources(params?: { name?: string; provider?: string }) {
    const search = new URLSearchParams();
    if (params?.name?.trim()) {
      search.set('name', params.name.trim());
    }
    if (params?.provider?.trim()) {
      search.set('provider', params.provider.trim());
    }

    const query = search.toString();
    return requestJson<ModelSourceListItem[]>(`/api/model-source/list${query ? `?${query}` : ''}`);
  },

  getModelSource(sourceCode: string) {
    return requestJson<ModelSourceDetail>(`/api/model-source/${encodeURIComponent(sourceCode)}`);
  },

  testModelSource(payload: ModelSourceTestPayload) {
    return requestJson<ModelSourceTestResult>('/api/model-source/test', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
  },

  fetchModelSourceModels(payload: ModelSourceFetchModelsPayload) {
    return requestJson<string[]>('/api/model-source/test/models', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
  },

  installLocalTestModel() {
    return requestJson<LocalModelTaskLaunchResult>('/api/model-source/local-test/install', {
      method: 'POST',
    });
  },

  startLocalTestModel() {
    return requestJson<LocalModelTaskLaunchResult>('/api/model-source/local-test/start', {
      method: 'POST',
    });
  },

  stopLocalTestModel() {
    return requestJson<LocalModelTaskLaunchResult>('/api/model-source/local-test/stop', {
      method: 'POST',
    });
  },

  getLocalTestTask(taskId: string) {
    return requestJson<LocalModelTaskDetail>(`/api/model-source/local-test/tasks/${encodeURIComponent(taskId)}`);
  },
};
