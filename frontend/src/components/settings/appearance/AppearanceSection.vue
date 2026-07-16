<script setup lang="ts">
import { customText } from '@/config/customText';
import { useAppearanceStore } from '@/stores/appearanceStore';

const appearanceStore = useAppearanceStore();

const themeOptions = [
  { key: 'light', label: customText.appearance.lightTheme },
  { key: 'dark', label: customText.appearance.darkTheme },
  { key: 'jetbrains', label: customText.appearance.jetbrainsTheme },
] as const;
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
            :class="{ 'theme-option-card--active': appearanceStore.themeMode === option.key }"
            type="button"
            @click="appearanceStore.setThemeMode(option.key)"
          >
            <span class="theme-option-card__preview" :data-theme-preview="option.key" />
            <span class="theme-option-card__label">{{ option.label }}</span>
          </button>
        </div>
      </div>

      <div class="settings-card settings-card--compact">
        <div class="settings-card__header settings-card__header--row">
          <div>
            <h2>{{ customText.appearance.globalFontTitle }}</h2>
            <p>{{ customText.appearance.globalFontDescription }}</p>
          </div>

          <button
            class="toggle-switch"
            :class="{ 'toggle-switch--active': appearanceStore.globalSerifFontEnabled }"
            type="button"
            role="switch"
            :aria-checked="appearanceStore.globalSerifFontEnabled"
            :title="customText.appearance.globalFontToggleTitle"
            @click="appearanceStore.toggleGlobalSerifFont()"
          >
            <span class="toggle-switch__thumb" />
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
