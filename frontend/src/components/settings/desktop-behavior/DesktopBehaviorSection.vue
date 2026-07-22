<script setup lang="ts">
import { onMounted } from 'vue';
import { Inbox, PanelBottom, RotateCcw, Timer } from '@lucide/vue';
import { fairyConfig } from '@/config/fairyConfig';
import { customText } from '@/config/customText';
import { useFairyStore } from '@/stores/fairyStore';
import { useMinimizePreferencesStore } from '@/stores/minimizePreferencesStore';
import type { MinimizeBehavior } from '@/main';

const fairyStore = useFairyStore();
const minimizePrefs = useMinimizePreferencesStore();

onMounted(() => {
  void minimizePrefs.load();
});

function selectMinimizeBehavior(behavior: MinimizeBehavior | 'ask') {
  if (behavior === 'ask') {
    void minimizePrefs.setPrefs({ behavior: minimizePrefs.behavior, askAgain: true });
  } else {
    void minimizePrefs.setPrefs({ behavior, askAgain: false });
  }
}

// 当前选中的模式（含"每次询问"）
function currentMode(): MinimizeBehavior | 'ask' {
  return minimizePrefs.askAgain ? 'ask' : minimizePrefs.behavior;
}
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

          <!-- 自动闲聊触发时间滑动条 -->
          <!-- 常驻闲聊未开启时灰显但仍可调整，便于用户预览配置；实际触发逻辑在 fairyChatStore 中根据 residentChatEnabled 判断 -->
          <div
            class="settings-inline-panel settings-inline-panel--soft desktop-behavior-idle-trigger"
            :class="{ 'desktop-behavior-idle-trigger--disabled': !fairyStore.residentChatEnabled }"
          >
            <div class="desktop-behavior-idle-trigger__info">
              <h3>
                <Timer :size="14" />
                {{ customText.desktopBehavior.idleTriggerTitle }}
              </h3>
              <p>{{ customText.desktopBehavior.idleTriggerDescription }}</p>
            </div>

            <div class="desktop-behavior-idle-trigger__control">
              <label class="settings-field">
                <div class="desktop-behavior-field__header">
                  <span>{{ customText.desktopBehavior.idleTriggerLabel }} · {{ fairyStore.idleTriggerLabel }}</span>
                </div>
                <input
                  type="range"
                  :min="fairyConfig.idleTrigger.min"
                  :max="fairyConfig.idleTrigger.max"
                  :step="fairyConfig.idleTrigger.step"
                  :value="fairyStore.idleTriggerMs"
                  :disabled="!fairyStore.residentChatEnabled"
                  :aria-label="customText.desktopBehavior.idleTriggerTitle"
                  @input="fairyStore.setIdleTriggerMs(Number(($event.target as HTMLInputElement).value))"
                  @change="fairyStore.commitIdleTriggerMs()"
                />
              </label>

              <button
                class="desktop-behavior-action-button desktop-behavior-action-button--secondary"
                type="button"
                :disabled="!fairyStore.residentChatEnabled"
                :title="customText.desktopBehavior.idleTriggerResetTitle"
                @click="fairyStore.resetIdleTriggerMs()"
              >
                <RotateCcw :size="14" />
                {{ customText.desktopBehavior.idleTriggerResetButton }}
              </button>
            </div>
          </div>

          <div class="settings-tag-list">
            <span class="settings-tag">{{ fairyStore.statusText }}</span>
            <span class="settings-tag">{{ fairyStore.enabled ? customText.desktopBehavior.visibleTag : customText.desktopBehavior.hiddenTag }}</span>
            <span class="settings-tag">{{ fairyStore.residentChatEnabled ? customText.desktopBehavior.residentChatEnabledTag : customText.desktopBehavior.residentChatDisabledTag }}</span>
            <span class="settings-tag">{{ customText.desktopBehavior.petTagPrefix }}: {{ fairyStore.petId }}</span>
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

      <!-- 最小化行为 -->
      <div class="settings-card settings-card--compact">
        <div class="settings-card__header">
          <div>
            <h2>{{ customText.desktopBehavior.minimizeBehaviorTitle }}</h2>
            <p>{{ customText.desktopBehavior.minimizeBehaviorDescription }}</p>
          </div>
        </div>

        <div class="settings-section-stack settings-section-stack--compact">
          <div class="settings-inline-panel settings-inline-panel--soft">
            <div class="minimize-behavior-options">
              <button
                class="minimize-behavior-option"
                :class="{ 'minimize-behavior-option--active': currentMode() === 'taskbar' }"
                type="button"
                :title="customText.desktopBehavior.minimizeBehaviorToggleTitle"
                @click="selectMinimizeBehavior('taskbar')"
              >
                <PanelBottom :size="18" />
                <span>{{ customText.desktopBehavior.minimizeOptionTaskbar }}</span>
              </button>

              <button
                class="minimize-behavior-option"
                :class="{ 'minimize-behavior-option--active': currentMode() === 'tray' }"
                type="button"
                :title="customText.desktopBehavior.minimizeBehaviorToggleTitle"
                @click="selectMinimizeBehavior('tray')"
              >
                <Inbox :size="18" />
                <span>{{ customText.desktopBehavior.minimizeOptionTray }}</span>
              </button>

              <button
                class="minimize-behavior-option"
                :class="{ 'minimize-behavior-option--active': currentMode() === 'ask' }"
                type="button"
                :title="customText.desktopBehavior.minimizeBehaviorToggleTitle"
                @click="selectMinimizeBehavior('ask')"
              >
                <Timer :size="18" />
                <span>{{ customText.desktopBehavior.minimizeOptionAsk }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 自动闲聊触发时间滑动条区块 */
.desktop-behavior-idle-trigger {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 320px);
  align-items: center;
  gap: 18px;
  margin-top: 12px;
}

.desktop-behavior-idle-trigger__info {
  min-width: 0;
}

.desktop-behavior-idle-trigger__info h3 {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 4px;
  font-size: 14px;
}

.desktop-behavior-idle-trigger__info p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.desktop-behavior-idle-trigger__control {
  display: grid;
  gap: 8px;
}

.desktop-behavior-idle-trigger__control .settings-field {
  gap: 6px;
}

.desktop-behavior-idle-trigger__control input[type='range'] {
  width: 100%;
  accent-color: var(--color-accent);
}

/* 常驻闲聊未开启时灰显滑动条区块 */
.desktop-behavior-idle-trigger--disabled {
  opacity: 0.55;
  pointer-events: none;
}

.desktop-behavior-idle-trigger--disabled .desktop-behavior-idle-trigger__info {
  pointer-events: auto;
}

@media (max-width: 720px) {
  .desktop-behavior-idle-trigger {
    grid-template-columns: 1fr;
  }
}

/* ===== 最小化行为选项 ===== */
.minimize-behavior-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.minimize-behavior-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.minimize-behavior-option:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text);
}

.minimize-behavior-option--active {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface));
  color: var(--color-accent);
}
</style>
