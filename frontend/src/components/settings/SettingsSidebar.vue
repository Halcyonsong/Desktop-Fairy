<script setup lang="ts">
import { ArrowLeft, DatabaseZap, MonitorCog, Palette, RefreshCw, SlidersHorizontal } from '@lucide/vue';
import { customText } from '@/config/customText';
import type { SettingsSectionKey, SettingsSectionItem } from '@/types/settings';

const props = defineProps<{
  activeSection: SettingsSectionKey;
  sections: SettingsSectionItem[];
}>();

const emit = defineEmits<{
  back: [];
  selectSection: [section: SettingsSectionKey];
}>();

function resolveIcon(section: SettingsSectionKey) {
  switch (section) {
    case 'model-source':
      return DatabaseZap;
    case 'chat-preferences':
      return SlidersHorizontal;
    case 'appearance':
      return Palette;
    case 'system-actions':
      return RefreshCw;
    case 'desktop-behavior':
      return MonitorCog;
  }
}
</script>

<template>
  <aside class="settings-sidebar">
    <button class="settings-sidebar__back" type="button" @click="emit('back')">
      <ArrowLeft :size="18" />
      <span>{{ customText.settings.backToApp }}</span>
    </button>

    <div class="settings-sidebar__section-label">{{ customText.settings.title }}</div>

    <div class="settings-nav-list">
      <button
        v-for="section in props.sections"
        :key="section.key"
        class="settings-nav-item"
        :class="{
          'settings-nav-item--active': activeSection === section.key,
          'settings-nav-item--disabled': !section.enabled,
        }"
        type="button"
        :disabled="!section.enabled"
        :title="section.description"
        @click="emit('selectSection', section.key)"
      >
        <component :is="resolveIcon(section.key)" :size="16" />
        <span>{{ section.label }}</span>
      </button>
    </div>
  </aside>
</template>
