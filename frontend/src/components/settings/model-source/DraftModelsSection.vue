<script setup lang="ts">
import { FlaskConical, Plus, Trash2 } from '@lucide/vue';
import type { ModelSourceModelInput } from '@/types/chat';

export type DraftModelTestState = 'idle' | 'testing' | 'success' | 'error';

defineProps<{
  models: ModelSourceModelInput[];
  testingModelLocalId: string;
  getModelTestState: (localId: string) => DraftModelTestState;
  getModelTestTitle: (localId: string) => string;
}>();

const emit = defineEmits<{
  addModel: [];
  updateModel: [localId: string, modelName: string];
  testModel: [localId: string];
  removeModel: [localId: string];
}>();
</script>

<template>
  <section class="settings-section settings-section--compact">
    <div class="settings-models__header settings-models__header--compact">
      <h3>模型</h3>
      <button class="settings-icon-button settings-icon-button--filled" type="button" title="新增模型" @click="emit('addModel')">
        <Plus :size="16" />
      </button>
    </div>

    <div class="settings-models__list">
      <div v-for="model in models" :key="model.localId" class="settings-model-item">
        <div class="settings-model-row settings-model-row--compact">
          <input
            :value="model.modelName"
            type="text"
            placeholder="deepseek-chat"
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
              class="settings-icon-button"
              type="button"
              title="测试连接"
              :disabled="!model.modelName.trim() || testingModelLocalId === model.localId"
              @click="emit('testModel', model.localId)"
            >
              <FlaskConical :size="16" />
            </button>

            <button class="settings-icon-button settings-icon-button--danger" type="button" title="移除模型" @click="emit('removeModel', model.localId)">
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
