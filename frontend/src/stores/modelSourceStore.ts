import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { chatApi } from '@/api';
import { useChatPreferencesStore } from '@/stores/chatPreferencesStore';
import { useToastStore } from '@/stores/toastStore';
import {
  buildGroupedSources,
  buildSelectableChatGroups,
  createEmptyForm,
  createModelInput,
  parseMaxTokensInput,
  parseTemperatureInput,
} from '@/stores/modelSource/helpers';
import {
  ensureModelRow,
  fetchModelSourceDetail,
  fetchModelSources,
  hydrateModelSourceDetail,
  refreshModelSourceCatalog,
  removeModelFromSource,
  removeModelSource,
  resetModelSourceForm,
  saveModelSourceForm,
  testDraftModel,
  type ModelSourceFormRefs,
  type ModelSourceStateRefs,
} from '@/stores/modelSource/actions';
import type { ChatModelConfig, ModelSourceDetail, ModelSourceListItem, ModelSourceTestResult } from '@/types/chat';

const CHAT_MODEL_STORAGE_KEY = 'desktop-fairy.selected-chat-model.v1';
const MODEL_PARAMS_STORAGE_KEY = 'desktop-fairy.chat-preferences.v1';

interface SelectedChatModelSnapshot {
  sourceCode: string;
  modelName: string;
}

function loadSelectedChatModelSnapshot(): SelectedChatModelSnapshot {
  if (typeof window === 'undefined') {
    return { sourceCode: '', modelName: '' };
  }

  try {
    const raw = window.localStorage.getItem(CHAT_MODEL_STORAGE_KEY);
    if (!raw) {
      return { sourceCode: '', modelName: '' };
    }

    const parsed = JSON.parse(raw) as Partial<SelectedChatModelSnapshot>;
    return {
      sourceCode: typeof parsed.sourceCode === 'string' ? parsed.sourceCode : '',
      modelName: typeof parsed.modelName === 'string' ? parsed.modelName : '',
    };
  } catch {
    return { sourceCode: '', modelName: '' };
  }
}

export const useModelSourceStore = defineStore('modelSource', () => {
  const sources = ref<ModelSourceListItem[]>([]);
  const sourceDetails = ref<Record<string, ModelSourceDetail>>({});
  const activeSourceCode = ref('');
  const activeSourceDetail = ref<ModelSourceDetail | null>(null);
  const loadingList = ref(false);
  const loadingDetail = ref(false);
  const loadingCatalog = ref(false);
  const saving = ref(false);
  const fetchingModels = ref(false);
  const testingModelLocalId = ref('');
  const errorMessage = ref('');
  const successMessage = ref('');
  const testResultByModelId = ref<Record<string, ModelSourceTestResult>>({});
  const form = ref(createEmptyForm());
  const selectedSnapshot = loadSelectedChatModelSnapshot();
  const selectedChatSourceCode = ref(selectedSnapshot.sourceCode);
  const selectedChatModelName = ref(selectedSnapshot.modelName);
  const chatPreferencesStore = useChatPreferencesStore();
  const toast = useToastStore();

  const state: ModelSourceStateRefs = {
    sources,
    sourceDetails,
    activeSourceCode,
    activeSourceDetail,
    loadingList,
    loadingDetail,
    loadingCatalog,
    saving,
    testingModelLocalId,
    errorMessage,
    testResultByModelId,
    selectedChatSourceCode,
    selectedChatModelName,
  };

  const formRefs: ModelSourceFormRefs = {
    form,
  };

  const groupedSources = computed(() => buildGroupedSources(sources.value));
  const selectedChatSource = computed(() => sourceDetails.value[selectedChatSourceCode.value] ?? null);
  const selectedChatModelDetail = computed(() => {
    const source = selectedChatSource.value;
    const modelName = selectedChatModelName.value;
    if (!source || !modelName) {
      return null;
    }
    return source.models.find((item) => item.modelName === modelName) ?? null;
  });
  const availableChatModels = computed(() => selectedChatSource.value?.models ?? []);
  const selectableChatGroups = computed(() => buildSelectableChatGroups(groupedSources.value, sourceDetails.value));

  const selectedChatModelLabel = computed(() => {
    const source = selectedChatSource.value;
    const model = selectedChatModelDetail.value;
    if (!source || !model) {
      return '';
    }
    return `${source.name} / ${model.modelName}`;
  });

  const hasSelectableChatModels = computed(() => selectableChatGroups.value.length > 0);
  const parsedTemperature = computed<number | undefined>(() => parseTemperatureInput(chatPreferencesStore.temperatureInput));
  const parsedMaxTokens = computed<number | undefined>(() => parseMaxTokensInput(chatPreferencesStore.maxTokensInput));

  const selectedChatModelConfig = computed<ChatModelConfig | null>(() => {
    const source = selectedChatSource.value;
    const model = selectedChatModelDetail.value;
    if (!source || !model) {
      return null;
    }

    return {
      baseUrl: source.baseUrl,
      apiKey: source.apiKey,
      model: model.modelName,
      temperature: parsedTemperature.value,
      maxTokens: parsedMaxTokens.value,
    };
  });

  function applySelectedSnapshot(snapshot: SelectedChatModelSnapshot) {
    selectedChatSourceCode.value = snapshot.sourceCode;
    selectedChatModelName.value = snapshot.modelName;
  }

  async function syncSelectedChatModelFromStorage() {
    const snapshot = loadSelectedChatModelSnapshot();
    applySelectedSnapshot(snapshot);
    if (snapshot.sourceCode) {
      await hydrateSourceDetail(snapshot.sourceCode, true);
    }
    reconcileSelectedChatModel();
  }

  // 幂等保护：避免 HMR 或重复初始化导致 storage 监听器叠加
  // 参考 fairyChatStore.ts 的 syncInitialized 模式
  const syncInitialized = ref(false);

  function initializeStorageSync() {
    if (syncInitialized.value || typeof window === 'undefined') {
      return;
    }

    // 使用具名函数而非内联匿名函数，便于未来需要 removeEventListener 时移除
    const handleStorage = (event: StorageEvent) => {
      if (event.key === CHAT_MODEL_STORAGE_KEY) {
        void syncSelectedChatModelFromStorage();
        return;
      }

      if (event.key === MODEL_PARAMS_STORAGE_KEY) {
        chatPreferencesStore.syncFromStorage();
      }
    };

    window.addEventListener('storage', handleStorage);
    syncInitialized.value = true;
  }

  function persistSelectedChatModel() {
    if (typeof window === 'undefined') {
      return;
    }

    const payload: SelectedChatModelSnapshot = {
      sourceCode: selectedChatSourceCode.value,
      modelName: selectedChatModelName.value,
    };
    try {
      window.localStorage.setItem(CHAT_MODEL_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('[ModelSourceStore] Failed to persist to localStorage:', error);
    }
  }

  function clearSelectedChatModel() {
    selectedChatSourceCode.value = '';
    selectedChatModelName.value = '';
  }

  function reconcileSelectedChatModel() {
    if (!selectedChatSourceCode.value || !selectedChatModelName.value) {
      return;
    }

    const source = sourceDetails.value[selectedChatSourceCode.value];
    if (!source) {
      clearSelectedChatModel();
      return;
    }

    const exists = source.models.some((item) => item.modelName === selectedChatModelName.value);
    if (!exists) {
      clearSelectedChatModel();
    }
  }

  function clearSuccessMessage() {
    successMessage.value = '';
  }

  watch([selectedChatSourceCode, selectedChatModelName], () => {
    persistSelectedChatModel();
  });

  initializeStorageSync();

  function setTemperatureInput(value: string) {
    chatPreferencesStore.setTemperatureInput(value);
  }

  function setMaxTokensInput(value: string) {
    chatPreferencesStore.setMaxTokensInput(value);
  }

  function resetForm() {
    resetModelSourceForm(state, formRefs);
  }

  async function fetchSources(filters?: { name?: string; provider?: string }) {
    await fetchModelSources(state, filters);
    reconcileSelectedChatModel();
  }

  async function fetchSourceDetail(sourceCode: string) {
    const detail = await fetchModelSourceDetail(state, formRefs, sourceCode);
    reconcileSelectedChatModel();
    return detail;
  }

  async function hydrateSourceDetail(sourceCode: string, force = false) {
    const detail = await hydrateModelSourceDetail(state, sourceCode, force);
    reconcileSelectedChatModel();
    return detail;
  }

  async function refreshSourceCatalog() {
    try {
      await refreshModelSourceCatalog(state, formRefs);
      reconcileSelectedChatModel();
    } catch (error) {
      // 后端不可达时静默处理，错误信息已由 refreshModelSourceCatalog 设置到 errorMessage
      console.error('[ModelSourceStore] Failed to refresh catalog:', error);
    }
  }

  async function bootstrap() {
    try {
      await refreshSourceCatalog();
      await syncSelectedChatModelFromStorage();
    } catch (error) {
      // bootstrap 失败不应阻塞设置页加载
      console.error('[ModelSourceStore] Bootstrap failed:', error);
    }
  }

  async function saveCurrentForm() {
    try {
      await saveModelSourceForm(state, formRefs);
      reconcileSelectedChatModel();
      successMessage.value = '供应商配置已保存';
      toast.success('供应商配置已保存');
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存供应商配置失败';
      toast.error(message);
      throw error;
    }
  }

  async function testModelDraftAction(localId: string) {
    return testDraftModel(state, formRefs, localId);
  }

  async function fetchModelsFromProvider() {
    const provider = form.value.provider.trim();
    const baseUrl = form.value.baseUrl.trim();
    const apiKey = form.value.apiKey.trim();

    if (!provider || !baseUrl || !apiKey) {
      throw new Error('请先填写 provider、Base URL 和 API Key');
    }

    fetchingModels.value = true;
    errorMessage.value = '';
    try {
      const models = await chatApi.fetchModelSourceModels({
        provider,
        baseUrl,
        apiKey,
      });
      const uniqueModels = Array.from(new Set(models.map((item) => item.trim()).filter(Boolean)));
      form.value.models = uniqueModels.length > 0 ? uniqueModels.map((modelName) => createModelInput(modelName)) : [createModelInput()];
      testResultByModelId.value = {};
      successMessage.value = uniqueModels.length > 0 ? `已拉取 ${uniqueModels.length} 个模型` : '未拉取到可用模型';
      if (uniqueModels.length > 0) {
        toast.success(`已拉取 ${uniqueModels.length} 个模型`);
      } else {
        toast.warning('未拉取到可用模型');
      }
      return uniqueModels;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '拉取模型列表失败';
      toast.error(errorMessage.value);
      throw error;
    } finally {
      fetchingModels.value = false;
    }
  }

  async function removeSource(sourceCode: string) {
    try {
      await removeModelSource(state, formRefs, sourceCode);
      reconcileSelectedChatModel();
      successMessage.value = '供应商配置已删除';
      toast.success('供应商配置已删除');
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除供应商失败';
      toast.error(message);
      throw error;
    }
  }

  async function removeModel(sourceCode: string, modelName: string) {
    try {
      await removeModelFromSource(state, formRefs, sourceCode, modelName);
      reconcileSelectedChatModel();
      successMessage.value = '模型已删除';
      toast.success('模型已删除');
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除模型失败';
      toast.error(message);
      throw error;
    }
  }

  function addModelRow() {
    form.value.models = [...form.value.models, createModelInput()];
  }

  function updateModelRow(localId: string, modelName: string) {
    form.value.models = form.value.models.map((item) => (item.localId === localId ? { ...item, modelName } : item));
  }

  function removeModelRow(localId: string) {
    form.value.models = form.value.models.filter((item) => item.localId !== localId);
    const nextResults = { ...testResultByModelId.value };
    delete nextResults[localId];
    testResultByModelId.value = nextResults;
    ensureModelRow(formRefs);
  }

  function clearDraftModels() {
    form.value.models = [createModelInput()];
    testResultByModelId.value = {};
  }

  async function selectChatModel(sourceCode: string, modelName: string) {
    selectedChatSourceCode.value = sourceCode;
    selectedChatModelName.value = modelName;
    await hydrateSourceDetail(sourceCode, true);
    reconcileSelectedChatModel();
  }

  return {
    sources,
    sourceDetails,
    groupedSources,
    selectableChatGroups,
    hasSelectableChatModels,
    activeSourceCode,
    activeSourceDetail,
    loadingList,
    loadingDetail,
    loadingCatalog,
    saving,
    fetchingModels,
    testingModelLocalId,
    errorMessage,
    successMessage,
    testResultByModelId,
    form,
    selectedChatSourceCode,
    selectedChatModelName,
    selectedChatModelLabel,
    availableChatModels,
    selectedChatModelConfig,
    // 使用 computed 包装，保持跨 store 响应式
    // 直接返回 chatPreferencesStore.temperatureInput 会丢失响应式
    temperatureInput: computed(() => chatPreferencesStore.temperatureInput),
    maxTokensInput: computed(() => chatPreferencesStore.maxTokensInput),
    bootstrap,
    refreshSourceCatalog,
    fetchSources,
    fetchSourceDetail,
    hydrateSourceDetail,
    resetForm,
    saveCurrentForm,
    testModelDraft: testModelDraftAction,
    fetchModelsFromProvider,
    removeSource,
    removeModel,
    addModelRow,
    updateModelRow,
    removeModelRow,
    clearDraftModels,
    selectChatModel,
    setTemperatureInput,
    setMaxTokensInput,
    clearSuccessMessage,
  };
});
