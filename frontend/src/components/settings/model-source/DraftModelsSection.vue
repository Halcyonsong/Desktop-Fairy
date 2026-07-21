<script setup lang="ts">
import { Eraser, FlaskConical, ListRestart, Plus, Trash2 } from '@lucide/vue';
import { customText } from '@/config/customText';
import type { ModelSourceModelInput } from '@/types/chat';

export type DraftModelTestState = 'idle' | 'testing' | 'success' | 'error';

defineProps<{
  models: ModelSourceModelInput[];
  fetchingModels: boolean;
  testingModelLocalId: string;
  getModelTestState: (localId: string) => DraftModelTestState;
  getModelTestTitle: (localId: string) => string;
}>();

const emit = defineEmits<{
  clearModels: [];
  fetchModels: [];
  addModel: [];
  updateModel: [localId: string, modelName: string];
  testModel: [localId: string];
  removeModel: [localId: string];
}>();
</script>

<template>
  <section class="settings-section settings-section--compact">
    <div class="settings-models__header settings-models__header--compact">
      <h3>{{ customText.modelSource.draftModelsTitle }}</h3>

      <div class="settings-models__header-actions">
        <button
          class="settings-icon-button"
          type="button"
          :title="customText.modelSource.clearDraftModelsTitle"
          @click="emit('clearModels')"
        >
          <Eraser :size="16" />
        </button>

        <button
          class="settings-icon-button"
          type="button"
          :title="customText.modelSource.fetchDraftModelsTitle"
          :disabled="fetchingModels"
          @click="emit('fetchModels')"
        >
          <ListRestart :size="16" />
        </button>

        <button class="settings-icon-button settings-icon-button--filled" type="button" :title="customText.modelSource.addDraftModelTitle" @click="emit('addModel')">
          <Plus :size="16" />
        </button>
      </div>
    </div>

    <div class="settings-models__list settings-models__list--lines settings-models__list--scroll">
      <div v-for="model in models" :key="model.localId" class="settings-model-row settings-model-row--line">
        <input
          :value="model.modelName"
          type="text"
          :placeholder="customText.modelSource.draftModelPlaceholder"
          @input="emit('updateModel', model.localId, ($event.target as HTMLInputElement).value)"
        />

        <div class="settings-model-row__actions">
          <span
            class="settings-model-row__status"
            :class="`settings-model-row__status--${getModelTestState(model.localId)}`"
            :title="getModelTestTitle(model.localId)"
          >
            <span v-if="getModelTestState(model.localId) === 'success'">✓</span>
            <span v-else-if="getModelTestState(model.localId) === 'error'">!</span>
            <span v-else-if="getModelTestState(model.localId) === 'testing'" class="settings-model-row__status-spinner"></span>
            <span v-else>·</span>
          </span>

          <button
            class="settings-icon-button settings-icon-button--ghost"
            type="button"
            :title="customText.modelSource.testConnectionTitle"
            :disabled="!model.modelName.trim() || testingModelLocalId === model.localId"
            @click="emit('testModel', model.localId)"
          >
            <FlaskConical :size="16" />
          </button>

          <button
            class="settings-icon-button settings-icon-button--ghost settings-icon-button--danger"
            type="button"
            :title="customText.modelSource.removeDraftModelTitle"
            @click="emit('removeModel', model.localId)"
          >
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
