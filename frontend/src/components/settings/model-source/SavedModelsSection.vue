<script setup lang="ts">
import { Trash2 } from '@lucide/vue';
import { customText } from '@/config/customText';
import type { ModelSourceDetail } from '@/types/chat';

defineProps<{
  sourceDetail: ModelSourceDetail;
}>();

const emit = defineEmits<{
  removeSource: [sourceCode: string];
  removeModel: [sourceCode: string, modelName: string];
}>();
</script>

<template>
  <section class="settings-section settings-section--compact">
    <div class="settings-models__header settings-models__header--compact">
      <h3>{{ customText.modelSource.savedModelsTitle }}</h3>
      <button class="settings-icon-button settings-icon-button--danger" type="button" :title="customText.modelSource.removeSourceTitle" @click="emit('removeSource', sourceDetail.sourceCode)">
        <Trash2 :size="16" />
      </button>
    </div>

    <div class="settings-saved-models settings-saved-models--lines settings-saved-models--scroll">
      <div v-for="model in sourceDetail.models" :key="model.id" class="settings-saved-model-item settings-saved-model-item--line">
        <strong>{{ model.modelName }}</strong>

        <div class="settings-saved-model-item__actions">
          <button
            class="settings-icon-button settings-icon-button--ghost settings-icon-button--danger"
            type="button"
            :title="customText.modelSource.removeModelTitle"
            @click="emit('removeModel', sourceDetail.sourceCode, model.modelName)"
          >
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
