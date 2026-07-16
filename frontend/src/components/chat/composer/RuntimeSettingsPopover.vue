<script setup lang="ts">
import { customText } from '@/config/customText';
const props = defineProps<{
  open: boolean;
  temperatureInput: string;
  maxTokensInput: string;
}>();

const emit = defineEmits<{
  toggle: [];
  'update:temperature-input': [value: string];
  'update:max-tokens-input': [value: string];
}>();
</script>

<template>
  <button class="composer-tool-button" type="button" :title="customText.runtimePopover.title" @click="emit('toggle')">
    <slot name="icon" />
  </button>

  <div v-if="open" class="composer-settings-popover">
    <label class="composer-settings-field">
      <span>{{ customText.runtimePopover.temperatureLabel }}</span>
      <input
        :value="props.temperatureInput"
        type="text"
        inputmode="decimal"
        :placeholder="customText.runtimePopover.defaultPlaceholder"
        @input="emit('update:temperature-input', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="composer-settings-field">
      <span>{{ customText.runtimePopover.maxTokensLabel }}</span>
      <input
        :value="props.maxTokensInput"
        type="text"
        inputmode="numeric"
        :placeholder="customText.runtimePopover.defaultPlaceholder"
        @input="emit('update:max-tokens-input', ($event.target as HTMLInputElement).value)"
      />
    </label>
  </div>
</template>
