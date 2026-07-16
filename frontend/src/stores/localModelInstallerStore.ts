import { defineStore } from 'pinia';
import { ref } from 'vue';
import { chatApi } from '@/api/chatApi';
import type {
  LocalModelInstallStatus,
  LocalModelScriptResult,
  ModelSourceDetail,
  ModelSourceListItem,
  ModelSourceSavePayload,
} from '@/types/chat';
import { useModelSourceStore } from '@/stores/modelSourceStore';

function getLastNonEmptyLine(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .pop() ?? '';
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '');
}

function normalizeModelNames(payload: ModelSourceSavePayload) {
  return payload.models.map((item) => item.modelName.trim()).filter(Boolean).sort();
}

function isSameLocalModelSource(detail: ModelSourceDetail, payload: ModelSourceSavePayload) {
  if (detail.provider !== payload.provider) {
    return false;
  }

  if (normalizeBaseUrl(detail.baseUrl) !== normalizeBaseUrl(payload.baseUrl)) {
    return false;
  }

  const detailModels = detail.models.map((item) => item.modelName.trim()).filter(Boolean).sort();
  const payloadModels = normalizeModelNames(payload);

  if (detailModels.length !== payloadModels.length) {
    return false;
  }

  return detailModels.every((modelName, index) => modelName === payloadModels[index]);
}

async function findExistingLocalModelSource(payload: ModelSourceSavePayload) {
  const candidates = await chatApi.listModelSources({ provider: payload.provider });
  if (!candidates.length) {
    return null;
  }

  const details = await Promise.all(
    candidates.map(async (source: ModelSourceListItem) => {
      try {
        return await chatApi.getModelSource(source.sourceCode);
      } catch {
        return null;
      }
    }),
  );

  const existing = details.filter((detail): detail is ModelSourceDetail => detail !== null).find((detail) => isSameLocalModelSource(detail, payload));
  return existing ?? null;
}

async function upsertLocalModelSource(payload: ModelSourceSavePayload) {
  const existing = await findExistingLocalModelSource(payload);

  if (existing) {
    await chatApi.updateModelSource({
      sourceCode: existing.sourceCode,
      name: payload.name,
      provider: payload.provider,
      baseUrl: payload.baseUrl,
      apiKey: payload.apiKey,
      models: payload.models,
    });
    return existing.sourceCode;
  }

  return chatApi.createModelSource(payload);
}

export const useLocalModelInstallerStore = defineStore('localModelInstaller', () => {
  const status = ref<LocalModelInstallStatus>('idle');
  const lastResult = ref<LocalModelScriptResult | null>(null);
  const errorMessage = ref('');
  const busy = ref(false);

  async function installLocalTestModel() {
    const modelSourceStore = useModelSourceStore();
    busy.value = true;
    status.value = 'installing';
    errorMessage.value = '';

    try {
      const result = await chatApi.installLocalTestModel();
      lastResult.value = result;

      if (result.exitCode !== 0) {
        status.value = 'failed';
        errorMessage.value = result.stderr?.trim() || result.stdout?.trim() || '本地测试模型安装失败';
        return false;
      }

      const jsonLine = getLastNonEmptyLine(result.stdout);
      if (!jsonLine) {
        status.value = 'failed';
        errorMessage.value = '安装脚本未输出模型源配置 JSON';
        return false;
      }

      let payload: ModelSourceSavePayload;
      try {
        payload = JSON.parse(jsonLine) as ModelSourceSavePayload;
      } catch {
        status.value = 'failed';
        errorMessage.value = `无法解析安装脚本输出的 JSON: ${jsonLine}`;
        return false;
      }

      await upsertLocalModelSource(payload);
      await modelSourceStore.refreshSourceCatalog();
      status.value = 'success';
      return true;
    } catch (error) {
      status.value = 'failed';
      errorMessage.value = error instanceof Error ? error.message : '本地测试模型安装失败';
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function startLocalTestModel() {
    busy.value = true;
    errorMessage.value = '';
    try {
      const result = await chatApi.startLocalTestModel();
      lastResult.value = result;
      if (result.exitCode !== 0) {
        status.value = 'failed';
        errorMessage.value = result.stderr?.trim() || result.stdout?.trim() || '本地测试模型启动失败';
        return false;
      }
      status.value = 'running';
      return true;
    } catch (error) {
      status.value = 'failed';
      errorMessage.value = error instanceof Error ? error.message : '本地测试模型启动失败';
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function stopLocalTestModel() {
    busy.value = true;
    errorMessage.value = '';
    try {
      const result = await chatApi.stopLocalTestModel();
      lastResult.value = result;
      if (result.exitCode !== 0) {
        status.value = 'failed';
        errorMessage.value = result.stderr?.trim() || result.stdout?.trim() || '本地测试模型停止失败';
        return false;
      }
      status.value = 'stopped';
      return true;
    } catch (error) {
      status.value = 'failed';
      errorMessage.value = error instanceof Error ? error.message : '本地测试模型停止失败';
      return false;
    } finally {
      busy.value = false;
    }
  }

  return {
    status,
    lastResult,
    errorMessage,
    busy,
    installLocalTestModel,
    startLocalTestModel,
    stopLocalTestModel,
  };
});
