<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { customText } from '@/config/customText';
import { useAppearanceStore } from '@/stores/appearanceStore';

const appearanceStore = useAppearanceStore();
const { globalSerifFontEnabled, themeMode } = storeToRefs(appearanceStore);

const themeOptions = [
  { key: 'light', label: customText.appearance.lightTheme },
  { key: 'dark', label: customText.appearance.darkTheme },
  { key: 'jetbrains', label: customText.appearance.jetbrainsTheme },
] as const;

function handleThemeChange(theme: 'light' | 'dark' | 'jetbrains') {
  appearanceStore.setThemeMode(theme);
}

function handleFontToggle() {
  appearanceStore.toggleGlobalSerifFont();
}
</script>

<template>
  <div class="settings-page__surface">
    <header class="settings-page__header settings-page__header--compact">
      <div>
        <span class="chat-header__status">{{ customText.appearance.status }}</span>
        <h1>{{ customText.appearance.title }}</h1>
      </div>
    </header>

    <section class="settings-card-grid">
      <div class="settings-card settings-card--compact">
        <div class="settings-card__header">
          <div>
            <h2>{{ customText.appearance.themeTitle }}</h2>
            <p>{{ customText.appearance.themeDescription }}</p>
          </div>
        </div>

        <div class="theme-option-grid">
          <button
            v-for="option in themeOptions"
            :key="option.key"
            class="theme-option-card"
            :class="{ 'theme-option-card--active': themeMode === option.key }"
            type="button"
            @click="handleThemeChange(option.key)"
          >
            <span class="theme-option-card__preview" :data-theme-preview="option.key">
              <span class="theme-preview-window">
                <span class="theme-preview-window__toolbar">
                  <span class="theme-preview-window__dot" />
                  <span class="theme-preview-window__dot" />
                  <span class="theme-preview-window__dot" />
                </span>
                <span class="theme-preview-window__content">
                  <span class="theme-preview-window__sidebar" />
                  <span class="theme-preview-window__main">
                    <span class="theme-preview-window__line theme-preview-window__line--title" />
                    <span class="theme-preview-window__line" />
                    <span class="theme-preview-window__chips">
                      <span class="theme-preview-window__chip" />
                      <span class="theme-preview-window__chip theme-preview-window__chip--muted" />
                    </span>
                  </span>
                </span>
              </span>
            </span>
            <span class="theme-option-card__label">{{ option.label }}</span>
          </button>
        </div>
      </div>

      <div class="settings-card settings-card--compact settings-card--dense">
        <div
          class="settings-card__header settings-card__header--row settings-card__header--tight appearance-font-card"
          role="button"
          tabindex="0"
          @click="handleFontToggle"
          @keydown.enter.prevent="handleFontToggle"
          @keydown.space.prevent="handleFontToggle"
        >
          <div class="appearance-font-card__content">
            <h2>{{ customText.appearance.globalFontTitle }}</h2>
            <p>{{ customText.appearance.globalFontDescription }}</p>
          </div>

          <button
            class="toggle-switch appearance-font-card__toggle"
            :class="{ 'toggle-switch--active': globalSerifFontEnabled }"
            type="button"
            role="switch"
            :aria-checked="globalSerifFontEnabled"
            :title="customText.appearance.globalFontToggleTitle"
            @click.stop="handleFontToggle"
          >
            <span class="toggle-switch__thumb" />
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
