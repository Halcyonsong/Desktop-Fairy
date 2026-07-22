<script setup lang="ts">
import { LoaderCircle, Trash2 } from '@lucide/vue';
import { ref } from 'vue';
import { customText } from '@/config/customText';
import { useModelSourceStore } from '@/stores/modelSourceStore';
import { useToastStore } from '@/stores/toastStore';
import type { ModelSourceDetail } from '@/types/chat';

defineProps<{
  sourceDetail: ModelSourceDetail;
}>();

const modelSourceStore = useModelSourceStore();
const toast = useToastStore();

// 删除进行中标记，禁用所有删除按钮防止重复点击
const deleting = ref(false);

// 确认弹窗状态
type ConfirmType = 'source' | 'model';
interface ConfirmState {
  type: ConfirmType;
  name: string;
  sourceCode: string;
  modelName?: string;
}

const confirmOpen = ref(false);
const confirmState = ref<ConfirmState | null>(null);

function askRemoveSource() {
  if (deleting.value) return;
  confirmState.value = {
    type: 'source',
    name: modelSourceStore.activeSourceDetail?.name ?? '',
    sourceCode: modelSourceStore.activeSourceDetail?.sourceCode ?? '',
  };
  confirmOpen.value = true;
}

function askRemoveModel(sourceCode: string, modelName: string) {
  if (deleting.value) return;
  confirmState.value = {
    type: 'model',
    name: modelName,
    sourceCode,
    modelName,
  };
  confirmOpen.value = true;
}

function cancelConfirm() {
  if (deleting.value) return;
  confirmOpen.value = false;
  confirmState.value = null;
}

async function confirmDelete() {
  const state = confirmState.value;
  if (!state || deleting.value) {
    return;
  }

  deleting.value = true;
  try {
    if (state.type === 'source') {
      await modelSourceStore.removeSource(state.sourceCode);
    } else if (state.modelName) {
      await modelSourceStore.removeModel(state.sourceCode, state.modelName);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除失败';
    toast.error(message);
  } finally {
    deleting.value = false;
    confirmOpen.value = false;
    confirmState.value = null;
  }
}
</script>

<template>
  <section class="settings-section settings-section--compact">
    <div class="settings-models__header settings-models__header--compact">
      <h3>{{ customText.modelSource.savedModelsTitle }}</h3>
      <button
        class="settings-icon-button settings-icon-button--danger"
        type="button"
        :title="customText.modelSource.removeSourceTitle"
        :disabled="deleting"
        @click="askRemoveSource"
      >
        <LoaderCircle v-if="deleting && confirmState?.type === 'source'" :size="16" class="spin-icon" />
        <Trash2 v-else :size="16" />
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
            :disabled="deleting"
            @click="askRemoveModel(sourceDetail.sourceCode, model.modelName)"
          >
            <LoaderCircle v-if="deleting && confirmState?.type === 'model' && confirmState?.modelName === model.modelName" :size="16" class="spin-icon" />
            <Trash2 v-else :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <Transition name="modal-fade">
      <div v-if="confirmOpen" class="settings-modal-overlay" @click.self="cancelConfirm">
        <div class="settings-modal-card settings-modal-card--success" role="dialog" aria-modal="true">
          <div class="settings-modal-card__header">
            <span class="chat-header__status">确认删除</span>
            <h2>无法撤销</h2>
          </div>

          <div class="settings-modal-card__content">
            <p v-if="confirmState?.type === 'source'">确认删除供应商 {{ confirmState?.name }}？</p>
            <p v-else>确认删除模型 {{ confirmState?.name }}？</p>
          </div>

          <div class="settings-modal-card__actions">
            <button class="settings-panel__button" type="button" :disabled="deleting" @click="cancelConfirm">
              {{ customText.session.modalCancel }}
            </button>
            <button class="settings-panel__button settings-panel__button--danger" type="button" :disabled="deleting" @click="confirmDelete">
              <LoaderCircle v-if="deleting" :size="14" class="spin-icon" />
              {{ customText.session.modalConfirm }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
