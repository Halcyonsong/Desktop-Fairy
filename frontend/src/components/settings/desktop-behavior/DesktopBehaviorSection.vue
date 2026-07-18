<script setup lang="ts">
import { RotateCcw } from '@lucide/vue';
import { fairyConfig } from '@/config/fairyConfig';
import { customText } from '@/config/customText';
import { useFairyStore } from '@/stores/fairyStore';

const fairyStore = useFairyStore();
</script>

<template>
  <div class="settings-page__surface">
    <header class="settings-page__header settings-page__header--compact">
      <div>
        <span class="chat-header__status">{{ customText.desktopBehavior.status }}</span>
        <h1>{{ customText.desktopBehavior.title }}</h1>
      </div>
    </header>

    <section class="settings-card-grid">
      <div class="settings-card settings-card--compact">
        <div class="settings-card__header settings-card__header--row">
          <div>
            <h2>{{ customText.desktopBehavior.enableTitle }}</h2>
            <p>{{ customText.desktopBehavior.enableDescription }}</p>
          </div>

          <button
            class="toggle-switch"
            :class="{ 'toggle-switch--active': fairyStore.enabled }"
            type="button"
            role="switch"
            :aria-checked="fairyStore.enabled"
            :title="customText.desktopBehavior.enableToggleTitle"
            @click="fairyStore.toggleEnabled()"
          >
            <span class="toggle-switch__thumb" />
          </button>
        </div>

        <div class="settings-section-stack settings-section-stack--compact">
          <div class="settings-inline-panel settings-inline-panel--split">
            <div>
              <h3>{{ customText.desktopBehavior.residentChatTitle }}</h3>
              <p>{{ customText.desktopBehavior.residentChatDescription }}</p>
            </div>

            <button
              class="toggle-switch"
              :class="{ 'toggle-switch--active': fairyStore.residentChatEnabled }"
              type="button"
              role="switch"
              :aria-checked="fairyStore.residentChatEnabled"
              :title="customText.desktopBehavior.residentChatToggleTitle"
              @click="fairyStore.toggleResidentChatEnabled()"
            >
              <span class="toggle-switch__thumb" />
            </button>
          </div>

          <div class="settings-tag-list">
            <span class="settings-tag">{{ fairyStore.statusText }}</span>
            <span class="settings-tag">{{ fairyStore.enabled ? customText.desktopBehavior.visibleTag : customText.desktopBehavior.hiddenTag }}</span>
            <span class="settings-tag">{{ fairyStore.residentChatEnabled ? customText.desktopBehavior.residentChatEnabledTag : customText.desktopBehavior.residentChatDisabledTag }}</span>
            <span class="settings-tag">Pet: {{ fairyStore.petId }}</span>
          </div>
        </div>
      </div>

      <div class="settings-card settings-card--compact">
        <div class="settings-card__header">
          <div>
            <h2>{{ customText.desktopBehavior.sizeTitle }}</h2>
            <p>{{ customText.desktopBehavior.sizeDescription }}</p>
          </div>
        </div>

        <div class="settings-section-stack settings-section-stack--compact">
          <div class="settings-form-grid">
            <label class="settings-field">
              <div class="desktop-behavior-field__header">
                <span>{{ customText.desktopBehavior.sizeLabel }} · {{ fairyStore.scalePercent }}</span>
              </div>
              <input
                type="range"
                :min="fairyConfig.scale.min"
                :max="fairyConfig.scale.max"
                :step="fairyConfig.scale.step"
                :value="fairyStore.scale"
                @input="fairyStore.setScale(Number(($event.target as HTMLInputElement).value))"
                @change="fairyStore.commitScale()"
              />
            </label>
          </div>

          <div class="settings-inline-panel settings-inline-panel--soft">
            <div>
              <h3>{{ customText.desktopBehavior.positionTitle }}</h3>
              <p>{{ customText.desktopBehavior.positionDescription }}</p>
            </div>

            <div class="settings-tag-list">
              <span class="settings-tag">
                {{ fairyStore.position ? `${customText.desktopBehavior.positionTag} (${Math.round(fairyStore.position.x)}, ${Math.round(fairyStore.position.y)})` : customText.desktopBehavior.positionDefaultTag }}
              </span>
            </div>
          </div>

          <div class="desktop-behavior-actions-row">
            <button
              class="desktop-behavior-action-button desktop-behavior-action-button--secondary"
              type="button"
              :title="customText.desktopBehavior.resetScaleTitle"
              @click="fairyStore.resetScale()"
            >
              <RotateCcw :size="14" />
              {{ customText.desktopBehavior.resetScaleButton }}
            </button>

            <button
              class="desktop-behavior-action-button desktop-behavior-action-button--secondary"
              type="button"
              :title="customText.desktopBehavior.resetPositionTitle"
              @click="fairyStore.resetNativePosition()"
            >
              <RotateCcw :size="14" />
              {{ customText.desktopBehavior.resetPositionButton }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
