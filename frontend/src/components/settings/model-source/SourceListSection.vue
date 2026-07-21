<script setup lang="ts">
import { ChevronRight, CirclePlus } from '@lucide/vue';
import { customText } from '@/config/customText';
import type { ModelProvider, ModelSourceListItem } from '@/types/chat';

defineProps<{
  errorMessage: string;
  groupedSources: Array<{
    provider: ModelProvider;
    items: ModelSourceListItem[];
  }>;
}>();

const emit = defineEmits<{
  openSource: [sourceCode: string];
}>();
</script>

<template>
  <section class="settings-section settings-section--compact">
    <div v-if="errorMessage" class="message-alert">{{ errorMessage }}</div>

    <div v-if="groupedSources.length === 0" class="settings-empty-state settings-empty-state--compact">
      <CirclePlus :size="18" />
      <span>{{ customText.modelSource.emptySourcesText }}</span>
    </div>

    <div v-else class="settings-provider-groups">
      <section v-for="group in groupedSources" :key="group.provider" class="settings-provider-group">
        <div class="settings-provider-group__title">{{ group.provider }}</div>

        <button
          v-for="source in group.items"
          :key="source.sourceCode"
          class="settings-provider-card"
          type="button"
          @click="emit('openSource', source.sourceCode)"
        >
          <div class="settings-provider-card__main">
            <strong>{{ source.name }}</strong>
            <p>{{ source.baseUrl }}</p>
          </div>
          <div class="settings-provider-card__meta">
            <ChevronRight :size="16" />
          </div>
        </button>
      </section>
    </div>
  </section>
</template>
