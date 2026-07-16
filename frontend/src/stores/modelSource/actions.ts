import { chatApi } from '@/api/chatApi';
import { createEmptyForm, ensureAtLeastOneModelRow, toModelSourceForm, toModelSourceSavePayload } from '@/stores/modelSource/helpers';
import type { ModelSourceDetail, ModelSourceListItem, ModelSourceTestResult } from '@/types/chat';
import type { Ref } from 'vue';

export interface ModelSourceStateRefs {
  sources: Ref<ModelSourceListItem[]>;
  sourceDetails: Ref<Record<string, ModelSourceDetail>>;
  activeSourceCode: Ref<string>;
  activeSourceDetail: Ref<ModelSourceDetail | null>;
  loadingList: Ref<boolean>;
  loadingDetail: Ref<boolean>;
  loadingCatalog: Ref<boolean>;
  saving: Ref<boolean>;
  testingModelLocalId: Ref<string>;
  errorMessage: Ref<string>;
  testResultByModelId: Ref<Record<string, ModelSourceTestResult>>;
  selectedChatSourceCode: Ref<string>;
  selectedChatModelName: Ref<string>;
}

export interface ModelSourceFormRefs {
  form: Ref<ReturnType<typeof createEmptyForm>>;
}

export function resetModelSourceForm(state: ModelSourceStateRefs, formRefs: ModelSourceFormRefs) {
  formRefs.form.value = createEmptyForm();
  state.errorMessage.value = '';
  state.testingModelLocalId.value = '';
  state.testResultByModelId.value = {};
}

export function cacheSourceDetail(state: ModelSourceStateRefs, detail: ModelSourceDetail) {
  state.sourceDetails.value = {
    ...state.sourceDetails.value,
    [detail.sourceCode]: detail,
  };
}

export function removeCachedSourceDetail(state: ModelSourceStateRefs, sourceCode: string) {
  const next = { ...state.sourceDetails.value };
  delete next[sourceCode];
  state.sourceDetails.value = next;
}

export function syncSourceDetailCache(state: ModelSourceStateRefs) {
  const validSourceCodes = new Set(state.sources.value.map((item) => item.sourceCode));
  const next: Record<string, ModelSourceDetail> = {};
  for (const [sourceCode, detail] of Object.entries(state.sourceDetails.value)) {
    if (validSourceCodes.has(sourceCode)) {
      next[sourceCode] = detail;
    }
  }
  state.sourceDetails.value = next;

  if (state.selectedChatSourceCode.value && !validSourceCodes.has(state.selectedChatSourceCode.value)) {
    state.selectedChatSourceCode.value = '';
    state.selectedChatModelName.value = '';
  }
}

export function loadFormFromDetail(state: ModelSourceStateRefs, formRefs: ModelSourceFormRefs, detail: ModelSourceDetail) {
  formRefs.form.value = toModelSourceForm(detail);
  state.testingModelLocalId.value = '';
  state.testResultByModelId.value = {};
}

export function normalizeModelSourcePayload(formRefs: ModelSourceFormRefs) {
  return toModelSourceSavePayload(formRefs.form.value);
}

export function ensureModelRow(formRefs: ModelSourceFormRefs) {
  formRefs.form.value.models = ensureAtLeastOneModelRow(formRefs.form.value.models);
}

export async function fetchModelSources(state: ModelSourceStateRefs, filters?: { name?: string; provider?: string }) {
  state.loadingList.value = true;
  try {
    state.sources.value = await chatApi.listModelSources(filters);
    syncSourceDetailCache(state);
    if (
      state.activeSourceCode.value &&
      !state.sources.value.some((item) => item.sourceCode === state.activeSourceCode.value)
    ) {
      state.activeSourceCode.value = '';
      state.activeSourceDetail.value = null;
    }
  } finally {
    state.loadingList.value = false;
  }
}

export async function fetchModelSourceDetail(
  state: ModelSourceStateRefs,
  formRefs: ModelSourceFormRefs,
  sourceCode: string,
) {
  if (!sourceCode) {
    state.activeSourceCode.value = '';
    state.activeSourceDetail.value = null;
    resetModelSourceForm(state, formRefs);
    return null;
  }

  state.loadingDetail.value = true;
  try {
    const detail = await chatApi.getModelSource(sourceCode);
    state.activeSourceCode.value = sourceCode;
    state.activeSourceDetail.value = detail;
    cacheSourceDetail(state, detail);
    loadFormFromDetail(state, formRefs, detail);

    if (state.selectedChatSourceCode.value === sourceCode) {
      if (!detail.models.some((item) => item.modelName === state.selectedChatModelName.value)) {
        state.selectedChatModelName.value = '';
      }
    }
    return detail;
  } finally {
    state.loadingDetail.value = false;
  }
}

export async function hydrateModelSourceDetail(state: ModelSourceStateRefs, sourceCode: string, force = false) {
  if (!sourceCode) {
    return null;
  }

  const cached = state.sourceDetails.value[sourceCode];
  if (cached && !force) {
    return cached;
  }

  const detail = await chatApi.getModelSource(sourceCode);
  cacheSourceDetail(state, detail);
  if (state.activeSourceCode.value === sourceCode) {
    state.activeSourceDetail.value = detail;
  }
  return detail;
}

export async function refreshModelSourceCatalog(state: ModelSourceStateRefs, formRefs: ModelSourceFormRefs) {
  state.loadingCatalog.value = true;
  state.errorMessage.value = '';
  try {
    await fetchModelSources(state);
    if (!state.sources.value.length) {
      return;
    }

    const details = await Promise.all(
      state.sources.value.map((item) => hydrateModelSourceDetail(state, item.sourceCode, true)),
    );

    if (state.activeSourceCode.value) {
      const activeDetail = details.find((item) => item?.sourceCode === state.activeSourceCode.value) ?? null;
      state.activeSourceDetail.value = activeDetail;
      if (activeDetail) {
        loadFormFromDetail(state, formRefs, activeDetail);
      }
    }
  } catch (error) {
    state.errorMessage.value = error instanceof Error ? error.message : '加载模型源失败';
    throw error;
  } finally {
    state.loadingCatalog.value = false;
  }
}

export async function saveModelSourceForm(state: ModelSourceStateRefs, formRefs: ModelSourceFormRefs) {
  const payload = normalizeModelSourcePayload(formRefs);
  state.saving.value = true;
  state.errorMessage.value = '';
  try {
    let sourceCode = payload.sourceCode;
    if (sourceCode) {
      await chatApi.updateModelSource(payload);
    } else {
      sourceCode = await chatApi.createModelSource(payload);
    }

    await refreshModelSourceCatalog(state, formRefs);
    if (sourceCode) {
      await fetchModelSourceDetail(state, formRefs, sourceCode);
    }
  } catch (error) {
    state.errorMessage.value = error instanceof Error ? error.message : '保存模型源失败';
    throw error;
  } finally {
    state.saving.value = false;
  }
}

export async function testDraftModel(state: ModelSourceStateRefs, formRefs: ModelSourceFormRefs, localId: string) {
  const target = formRefs.form.value.models.find((item) => item.localId === localId);
  const normalizedModelName = target?.modelName.trim() ?? '';
  if (!normalizedModelName) {
    throw new Error('请先填写模型名称后再测试连接');
  }

  const payload = normalizeModelSourcePayload(formRefs);
  state.testingModelLocalId.value = localId;
  state.errorMessage.value = '';
  state.testResultByModelId.value = {
    ...state.testResultByModelId.value,
    [localId]: { success: false, message: '测试中...' },
  };
  try {
    const result = await chatApi.testModelSource({
      provider: payload.provider,
      baseUrl: payload.baseUrl,
      apiKey: payload.apiKey,
      modelName: normalizedModelName,
    });
    state.testResultByModelId.value = {
      ...state.testResultByModelId.value,
      [localId]: result,
    };
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : '测试连接失败';
    state.testResultByModelId.value = {
      ...state.testResultByModelId.value,
      [localId]: { success: false, message },
    };
    state.errorMessage.value = message;
    throw error;
  } finally {
    state.testingModelLocalId.value = '';
  }
}

export async function removeModelSource(state: ModelSourceStateRefs, formRefs: ModelSourceFormRefs, sourceCode: string) {
  await chatApi.deleteModelSource(sourceCode);
  removeCachedSourceDetail(state, sourceCode);
  if (state.selectedChatSourceCode.value === sourceCode) {
    state.selectedChatSourceCode.value = '';
    state.selectedChatModelName.value = '';
  }
  await refreshModelSourceCatalog(state, formRefs);
  if (state.activeSourceCode.value === sourceCode) {
    resetModelSourceForm(state, formRefs);
    state.activeSourceCode.value = '';
    state.activeSourceDetail.value = null;
  }
}

export async function removeModelFromSource(
  state: ModelSourceStateRefs,
  formRefs: ModelSourceFormRefs,
  sourceCode: string,
  modelName: string,
) {
  await chatApi.deleteModelFromSource(sourceCode, modelName);
  if (state.selectedChatSourceCode.value === sourceCode && state.selectedChatModelName.value === modelName) {
    state.selectedChatModelName.value = '';
  }
  await refreshModelSourceCatalog(state, formRefs);
  if (state.sources.value.some((item) => item.sourceCode === sourceCode)) {
    await fetchModelSourceDetail(state, formRefs, sourceCode);
  } else {
    removeCachedSourceDetail(state, sourceCode);
    if (state.activeSourceCode.value === sourceCode) {
      state.activeSourceCode.value = '';
      state.activeSourceDetail.value = null;
      resetModelSourceForm(state, formRefs);
    }
  }
}
