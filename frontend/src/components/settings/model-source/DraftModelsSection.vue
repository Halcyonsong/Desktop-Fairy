<script setup lang="ts">
import { Eraser, FlaskConical, ListRestart, Plus, Trash2 } from '@lucide/vue';
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
      <h3>新增模型</h3>

      <div class="settings-models__header-actions">
        <button
          class="settings-icon-button"
          type="button"
          title="清空当前新增模型"
          @click="emit('clearModels')"
        >
          <Eraser :size="16" />
        </button>

        <button
          class="settings-icon-button"
          type="button"
          title="从供应商拉取模型列表"
          :disabled="fetchingModels"
          @click="emit('fetchModels')"
        >
          <ListRestart :size="16" />
        </button>

        <button class="settings-icon-button settings-icon-button--filled" type="button" title="新增模型" @click="emit('addModel')">
          <Plus :size="16" />
        </button>
      </div>
    </div>

    <div class="settings-models__list settings-models__list--lines settings-models__list--scroll">
      <div v-for="model in models" :key="model.localId" class="settings-model-row settings-model-row--line">
        <input
          :value="model.modelName"
          type="text"
          placeholder="例如：deepseek-chat"
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
            title="测试连接"
            :disabled="!model.modelName.trim() || testingModelLocalId === model.localId"
            @click="emit('testModel', model.localId)"
          >
            <FlaskConical :size="16" />
          </button>

          <button
            class="settings-icon-button settings-icon-button--ghost settings-icon-button--danger"
            type="button"
            title="移除模型"
            @click="emit('removeModel', model.localId)"
          >
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
