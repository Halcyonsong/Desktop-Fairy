<script setup lang="ts">
import { ChevronDown } from '@lucide/vue';
import { computed, ref, watch } from 'vue';
import { customText } from '@/config/customText';
import type { SelectableModelGroup } from '@/types/chat';

const props = defineProps<{
  open: boolean;
  modelLabel: string;
  hasSelectableModels: boolean;
  selectableModelGroups: SelectableModelGroup[];
}>();

const emit = defineEmits<{
  toggle: [];
  selectModel: [sourceCode: string, modelName: string];
}>();

const filterKeyword = ref('');

const modelButtonLabel = computed(() => props.modelLabel || customText.composer.selectModel);

const filteredGroups = computed(() => {
  const keyword = filterKeyword.value.trim().toLowerCase();
  if (!keyword) {
    return props.selectableModelGroups;
  }

  return props.selectableModelGroups
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => ({
          ...item,
          models: item.models.filter(
            (model) =>
              group.provider.toLowerCase().includes(keyword) ||
              item.sourceName.toLowerCase().includes(keyword) ||
              model.modelName.toLowerCase().includes(keyword),
          ),
        }))
        .filter((item) => item.models.length > 0),
    }))
    .filter((group) => group.items.length > 0);
});

watch(
  () => props.open,
  (open) => {
    if (!open) {
      filterKeyword.value = '';
    }
  },
);
</script>

<template>
  <button
    class="model-select"
    type="button"
    :class="{ 'model-select--placeholder': !modelLabel, 'model-select--open': open }"
    :title="customText.composer.selectModel"
    @click="emit('toggle')"
  >
    <span class="model-select__text">{{ modelButtonLabel }}</span>
    <ChevronDown :size="16" :class="{ 'model-select__chevron--open': open }" />
  </button>

  <div v-if="open" class="model-picker-popover">
    <template v-if="hasSelectableModels">
      <div class="model-picker-filter">
        <input v-model="filterKeyword" type="text" :placeholder="customText.composer.filterModelsPlaceholder" />
      </div>

      <div v-if="filteredGroups.length > 0" class="model-picker-scroll">
        <div v-for="group in filteredGroups" :key="group.provider" class="model-picker-group">
          <div class="model-picker-group__title">{{ group.provider }}</div>
          <div v-for="item in group.items" :key="item.sourceCode" class="model-picker-source-card">
            <div class="model-picker-source-card__name">{{ item.sourceName }}</div>
            <div class="model-picker-source-card__models">
              <button
                v-for="model in item.models"
                :key="`${item.sourceCode}-${model.modelName}`"
                class="model-picker-option"
                type="button"
                @click="emit('selectModel', item.sourceCode, model.modelName)"
              >
                {{ model.modelName }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="model-picker-empty">{{ customText.composer.noFilteredModels }}</div>
    </template>
    <div v-else class="model-picker-empty">{{ customText.composer.noModels }}</div>
  </div>
</template>
