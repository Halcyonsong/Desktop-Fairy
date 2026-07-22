<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { helpDialogText, type HelpSectionKey } from '@/config/helpText';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const helpSection = ref<HelpSectionKey>('chat');

const currentSection = computed(() => helpDialogText.sections.find((section) => section.key === helpSection.value) ?? helpDialogText.sections[0]);

watch(
  () => props.open,
  (open) => {
    if (open) {
      helpSection.value = 'chat';
    }
  },
);

// ===== ESC 键关闭支持 =====
function handleEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close');
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      window.addEventListener('keydown', handleEsc);
    } else {
      window.removeEventListener('keydown', handleEsc);
    }
  },
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleEsc);
});
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="open" class="session-modal-overlay" @click.self="emit('close')">
      <div class="session-help-dialog" role="dialog" aria-modal="true">
        <div class="session-help-dialog__header">
          <div>
            <p class="session-help-dialog__eyebrow">{{ helpDialogText.eyebrow }}</p>
            <h3 class="session-help-dialog__title">{{ helpDialogText.title }}</h3>
          </div>
          <button type="button" class="session-help-dialog__close" :aria-label="helpDialogText.closeLabel" @click="emit('close')">×</button>
        </div>

        <div class="session-help-dialog__layout">
          <aside class="session-help-dialog__nav">
            <button
              v-for="section in helpDialogText.sections"
              :key="section.key"
              type="button"
              class="session-help-dialog__nav-item"
              :class="{ 'session-help-dialog__nav-item--active': helpSection === section.key }"
              @click="helpSection = section.key"
            >
              {{ section.label }}
            </button>
          </aside>

          <div class="session-help-dialog__content">
            <div class="session-help-card session-help-card--rich">
              <h4>{{ currentSection.title }}</h4>
              <p v-if="currentSection.intro" class="session-help-card__intro">{{ currentSection.intro }}</p>

              <div v-for="topic in currentSection.topics" :key="topic.title" class="session-help-topic">
                <h5>{{ topic.title }}</h5>
                <ul>
                  <li v-for="item in topic.items" :key="item">{{ item }}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.session-help-dialog {
  width: min(1080px, calc(100vw - 48px));
  height: min(88vh, 920px);
  border-radius: 28px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 82%, var(--color-accent) 18%);
  background: linear-gradient(180deg, var(--color-surface-strong) 0%, var(--color-surface) 100%);
  box-shadow:
    var(--shadow-soft),
    0 0 0 1px color-mix(in srgb, var(--color-border) 70%, transparent) inset;
  color: var(--color-text);
  padding: 1.35rem 1.35rem 1.2rem;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.session-help-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 84%, transparent);
}

.session-help-dialog__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.session-help-dialog__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.session-help-dialog__close {
  width: 2.15rem;
  height: 2.15rem;
  border: 1px solid color-mix(in srgb, var(--color-border) 86%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-surface-strong) 82%, var(--color-accent) 18%);
  color: var(--color-text);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

.session-help-dialog__layout {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 1rem;
  min-height: 0;
}

.session-help-dialog__nav {
  display: grid;
  gap: 0.5rem;
  align-content: start;
  min-height: 0;
  overflow: hidden;
  padding-right: 0.25rem;
}

.session-help-dialog__nav-item {
  width: 100%;
  text-align: left;
  padding: 0.82rem 0.95rem;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--color-border) 82%, transparent);
  background: color-mix(in srgb, var(--color-surface) 88%, transparent);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease, color 0.18s ease;
}

.session-help-dialog__nav-item:hover {
  background: color-mix(in srgb, var(--color-surface-strong) 92%, var(--color-accent) 8%);
  border-color: color-mix(in srgb, var(--color-border-strong) 78%, var(--color-accent) 22%);
  color: var(--color-text);
}

.session-help-dialog__nav-item--active {
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 18%, var(--color-surface-strong) 82%) 0%, color-mix(in srgb, var(--color-accent) 10%, var(--color-surface) 90%) 100%);
  border-color: color-mix(in srgb, var(--color-accent) 42%, var(--color-border-strong) 58%);
  color: var(--color-text);
  box-shadow: 0 8px 20px color-mix(in srgb, var(--color-accent) 16%, rgba(15, 23, 42, 0.16));
}

.session-help-dialog__content {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding-right: 0.35rem;
}

.session-help-card {
  padding: 1.05rem 1.1rem;
  border-radius: 20px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-surface-strong) 92%, transparent) 0%, color-mix(in srgb, var(--color-surface) 96%, transparent) 100%);
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 82%, var(--color-accent) 18%);
  box-shadow: 0 14px 30px color-mix(in srgb, var(--color-shadow) 72%, transparent);
}

.session-help-card--rich {
  display: grid;
  gap: 1rem;
}

.session-help-card__intro {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.session-help-topic {
  display: grid;
  gap: 0.45rem;
}

.session-help-topic h5 {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-text);
}

.session-help-card h4 {
  margin: 0 0 0.6rem;
  font-size: 0.98rem;
  color: var(--color-text);
}

.session-help-card ul {
  margin: 0;
  padding-left: 1rem;
  display: grid;
  gap: 0.45rem;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

@media (max-width: 720px) {
  .session-help-dialog {
    width: min(94vw, 1080px);
    height: min(90vh, 920px);
    padding: 1rem;
  }

  .session-help-dialog__layout {
    grid-template-columns: 1fr;
  }

  .session-help-dialog__nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: auto;
  }
}

@media (max-width: 560px) {
  .session-help-dialog__nav {
    grid-template-columns: 1fr;
  }
}
</style>
