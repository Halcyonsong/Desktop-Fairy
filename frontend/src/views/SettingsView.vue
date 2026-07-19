<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { customText } from '@/config/customText';
import AppearanceSection from '@/components/settings/appearance/AppearanceSection.vue';
import ChatPreferencesSection from '@/components/settings/chat-preferences/ChatPreferencesSection.vue';
import DesktopBehaviorSection from '@/components/settings/desktop-behavior/DesktopBehaviorSection.vue';
import FilePathSection from '@/components/settings/file-paths/FilePathSection.vue';
import LogViewerSection from '@/components/settings/log-viewer/LogViewerSection.vue';
import SettingsSectionPlaceholder from '@/components/settings/SettingsSectionPlaceholder.vue';
import SettingsSidebar from '@/components/settings/SettingsSidebar.vue';
import ModelSourceSection from '@/components/settings/model-source/ModelSourceSection.vue';
import SystemActionsSection from '@/components/settings/system-actions/SystemActionsSection.vue';
import { settingsSections } from '@/config/settingsSections';
import { useModelSourceStore } from '@/stores/modelSourceStore';
import type { SettingsSectionKey } from '@/types/settings';

const emit = defineEmits<{
  back: [];
}>();

const modelSourceStore = useModelSourceStore();
const activeSection = ref<SettingsSectionKey>('model-source');

const activeSectionMeta = computed(() => {
  return settingsSections.find((item) => item.key === activeSection.value) ?? settingsSections[0];
});

onMounted(() => {
  void modelSourceStore.bootstrap();
});
</script>

<template>
  <div class="settings-page">
    <SettingsSidebar
      :active-section="activeSection"
      :sections="settingsSections"
      @back="emit('back')"
      @select-section="activeSection = $event"
    />

    <section class="settings-page__content">
      <Transition name="content-fade" mode="out-in">
        <ModelSourceSection v-if="activeSection === 'model-source'" :key="activeSection" />
        <ChatPreferencesSection v-else-if="activeSection === 'chat-preferences'" :key="activeSection" />
        <AppearanceSection v-else-if="activeSection === 'appearance'" :key="activeSection" />
        <SystemActionsSection v-else-if="activeSection === 'system-actions'" :key="activeSection" />
        <DesktopBehaviorSection v-else-if="activeSection === 'desktop-behavior'" :key="activeSection" />
        <LogViewerSection v-else-if="activeSection === 'log-viewer'" :key="activeSection" />
        <FilePathSection v-else-if="activeSection === 'file-paths'" :key="activeSection" />

        <div v-else :key="activeSection" class="settings-page__surface">
          <header class="settings-page__header settings-page__header--compact">
            <div>
              <span class="chat-header__status">{{ customText.settings.placeholderStatus }}</span>
              <h1>{{ activeSectionMeta.label }}</h1>
            </div>
          </header>

          <SettingsSectionPlaceholder :title="activeSectionMeta.label" :description="activeSectionMeta.description" />
        </div>
      </Transition>
    </section>
  </div>
</template>
