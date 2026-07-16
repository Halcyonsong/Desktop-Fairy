import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useChatPreferencesStore } from '@/stores/chatPreferencesStore';
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

export const useModelSourceStore = defineStore('modelSource', () => {
  const sources = ref<ModelSourceListItem[]>([]);
  const sourceDetails = ref<Record<string, ModelSourceDetail>>({});
  const activeSourceCode = ref('');
  const activeSourceDetail = ref<ModelSourceDetail | null>(null);
  const loadingList = ref(false);
  const loadingDetail = ref(false);
  const loadingCatalog = ref(false);
  const saving = ref(false);
  const testingModelLocalId = ref('');
  const errorMessage = ref('');
  const testResultByModelId = ref<Record<string, ModelSourceTestResult>>({});
  const form = ref(createEmptyForm());
  const selectedChatSourceCode = ref('');
  const selectedChatModelName = ref('');
  const chatPreferencesStore = useChatPreferencesStore();

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
  const availableChatModels = computed(() => selectedChatSource.value?.models ?? []);
  const selectableChatGroups = computed(() => buildSelectableChatGroups(groupedSources.value, sourceDetails.value));

  const selectedChatModelLabel = computed(() => {
    const source = selectedChatSource.value;
    const modelName = selectedChatModelName.value;
    if (!source || !modelName) {
      return '';
    }
    return `${source.name} / ${modelName}`;
  });

  const hasSelectableChatModels = computed(() => selectableChatGroups.value.length > 0);
  const parsedTemperature = computed<number | undefined>(() => parseTemperatureInput(chatPreferencesStore.temperatureInput));
  const parsedMaxTokens = computed<number | undefined>(() => parseMaxTokensInput(chatPreferencesStore.maxTokensInput));

  const selectedChatModelConfig = computed<ChatModelConfig | null>(() => {
    const source = selectedChatSource.value;
    const modelName = selectedChatModelName.value;
    if (!source || !modelName) {
      return null;
    }

    return {
      baseUrl: source.baseUrl,
      apiKey: source.apiKey,
      model: modelName,
      temperature: parsedTemperature.value,
      maxTokens: parsedMaxTokens.value,
    };
  });

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
  }

  async function fetchSourceDetail(sourceCode: string) {
    return fetchModelSourceDetail(state, formRefs, sourceCode);
  }

  async function hydrateSourceDetail(sourceCode: string, force = false) {
    return hydrateModelSourceDetail(state, sourceCode, force);
  }

  async function refreshSourceCatalog() {
    await refreshModelSourceCatalog(state, formRefs);
  }

  async function bootstrap() {
    await refreshSourceCatalog();
  }

  async function saveCurrentForm() {
    await saveModelSourceForm(state, formRefs);
  }

  async function testModelDraftAction(localId: string) {
    return testDraftModel(state, formRefs, localId);
  }

  async function removeSource(sourceCode: string) {
    await removeModelSource(state, formRefs, sourceCode);
  }

  async function removeModel(sourceCode: string, modelName: string) {
    await removeModelFromSource(state, formRefs, sourceCode, modelName);
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

  async function selectChatModel(sourceCode: string, modelName: string) {
    selectedChatSourceCode.value = sourceCode;
    selectedChatModelName.value = modelName;
    await hydrateSourceDetail(sourceCode, true);
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
    testingModelLocalId,
    errorMessage,
    testResultByModelId,
    form,
    selectedChatSourceCode,
    selectedChatModelName,
    selectedChatModelLabel,
    availableChatModels,
    selectedChatModelConfig,
    temperatureInput: chatPreferencesStore.temperatureInput,
    maxTokensInput: chatPreferencesStore.maxTokensInput,
    bootstrap,
    refreshSourceCatalog,
    fetchSources,
    fetchSourceDetail,
    hydrateSourceDetail,
    resetForm,
    saveCurrentForm,
    testModelDraft: testModelDraftAction,
    removeSource,
    removeModel,
    addModelRow,
    updateModelRow,
    removeModelRow,
    selectChatModel,
    setTemperatureInput,
    setMaxTokensInput,
  };
});
