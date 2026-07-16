import type {
  ModelProvider,
  ModelSourceDetail,
  ModelSourceFormState,
  ModelSourceListItem,
  ModelSourceModelInput,
  ModelSourceSavePayload,
  SelectableModelGroup,
} from '@/types/chat';

export const DEFAULT_PROVIDER: ModelProvider = 'deepseek';

export function createLocalId() {
  return `model-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createModelInput(modelName = ''): ModelSourceModelInput {
  return {
    localId: createLocalId(),
    modelName,
  };
}

export function createEmptyForm(): ModelSourceFormState {
  return {
    sourceCode: '',
    name: '',
    provider: DEFAULT_PROVIDER,
    baseUrl: '',
    apiKey: '',
    models: [createModelInput()],
  };
}

export function buildGroupedSources(items: ModelSourceListItem[]) {
  const groups = new Map<ModelProvider, ModelSourceListItem[]>();
  for (const item of items) {
    const list = groups.get(item.provider) ?? [];
    list.push(item);
    groups.set(item.provider, list);
  }
  return Array.from(groups.entries()).map(([provider, groupedItems]) => ({ provider, items: groupedItems }));
}

export function buildSelectableChatGroups(
  groupedSources: Array<{ provider: ModelProvider; items: ModelSourceListItem[] }>,
  sourceDetails: Record<string, ModelSourceDetail>,
): SelectableModelGroup[] {
  return groupedSources
    .map(({ provider, items }) => ({
      provider,
      items: items
        .map((item) => {
          const detail = sourceDetails[item.sourceCode];
          return {
            sourceCode: item.sourceCode,
            sourceName: item.name,
            models: detail?.models ?? [],
          };
        })
        .filter((item) => item.models.length > 0),
    }))
    .filter((group) => group.items.length > 0);
}

export function toModelSourceForm(detail: ModelSourceDetail): ModelSourceFormState {
  return {
    sourceCode: detail.sourceCode,
    name: detail.name,
    provider: detail.provider,
    baseUrl: detail.baseUrl,
    apiKey: detail.apiKey,
    models: detail.models.map((item) => createModelInput(item.modelName)),
  };
}

export function toModelSourceSavePayload(form: ModelSourceFormState): ModelSourceSavePayload {
  return {
    sourceCode: form.sourceCode || undefined,
    name: form.name.trim(),
    provider: form.provider,
    baseUrl: form.baseUrl.trim(),
    apiKey: form.apiKey.trim(),
    models: form.models.map((item) => ({ modelName: item.modelName.trim() })).filter((item) => item.modelName),
  };
}

export function ensureAtLeastOneModelRow(models: ModelSourceModelInput[]) {
  return models.length === 0 ? [createModelInput()] : models;
}

export function parseTemperatureInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseMaxTokensInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
