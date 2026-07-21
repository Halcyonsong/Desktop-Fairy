<script setup lang="ts">
import { ChevronLeft, Download, FileText, Play, Plus, RefreshCw, SquareTerminal } from '@lucide/vue';
import { computed, onBeforeUnmount, ref } from 'vue';
import { customText } from '@/config/customText';
import { modelProviderOptions } from '@/config/modelProviders';
import DraftModelsSection from '@/components/settings/model-source/DraftModelsSection.vue';
import SavedModelsSection from '@/components/settings/model-source/SavedModelsSection.vue';
import SourceFormSection from '@/components/settings/model-source/SourceFormSection.vue';
import SourceListSection from '@/components/settings/model-source/SourceListSection.vue';
import { useLocalModelInstallerStore } from '@/stores/localModelInstallerStore';
import { useModelSourceStore } from '@/stores/modelSourceStore';

const modelSourceStore = useModelSourceStore();
const localModelInstallerStore = useLocalModelInstallerStore();
const isDetailMode = ref(false);
const showInstallConfirm = ref(false);

const canSubmit = computed(() => {
  return Boolean(
    modelSourceStore.form.name.trim() &&
      modelSourceStore.form.baseUrl.trim() &&
      modelSourceStore.form.apiKey.trim() &&
      modelSourceStore.form.provider.trim() &&
      modelSourceStore.form.models.some((item) => item.modelName.trim()),
  );
});

const pageTitle = computed(() =>
  isDetailMode.value ? modelSourceStore.form.name || customText.modelSource.detailFallbackTitle : customText.modelSource.listTitle,
);
const pageStatus = computed(() =>
  isDetailMode.value ? customText.modelSource.detailStatus : customText.modelSource.listStatus,
);
const logButtonTitle = computed(() =>
  localModelInstallerStore.logPanelOpen ? customText.modelSource.localHideLogTitle : customText.modelSource.localViewLogTitle,
);
const localTaskBusy = computed(() => localModelInstallerStore.busy || localModelInstallerStore.polling);
const taskStatusText = computed(() => localModelInstallerStore.taskDetail?.status || localModelInstallerStore.taskLaunch?.status || 'IDLE');
const taskMessage = computed(() => localModelInstallerStore.taskDetail?.message || localModelInstallerStore.errorMessage || customText.modelSource.localTaskEmpty);
const taskStdout = computed(() => localModelInstallerStore.taskDetail?.stdout || '');
const taskStderr = computed(() => localModelInstallerStore.taskDetail?.stderr || '');
const taskScript = computed(() => localModelInstallerStore.taskDetail?.script || localModelInstallerStore.taskLaunch?.script || '-');
const taskExitCode = computed(() => localModelInstallerStore.taskDetail?.exitCode ?? '-');
const taskStartedAt = computed(() => localModelInstallerStore.taskDetail?.startedAt || '-');
const taskFinishedAt = computed(() => localModelInstallerStore.taskDetail?.finishedAt || '-');

async function save() {
  await modelSourceStore.saveCurrentForm();
}

async function testModel(localId: string) {
  await modelSourceStore.testModelDraft(localId);
}

async function fetchModels() {
  await modelSourceStore.fetchModelsFromProvider();
}

function getModelTestState(localId: string): 'idle' | 'testing' | 'success' | 'error' {
  if (modelSourceStore.testingModelLocalId === localId) {
    return 'testing';
  }

  const result = modelSourceStore.testResultByModelId[localId];
  if (!result) {
    return 'idle';
  }

  return result.success ? 'success' : 'error';
}

function getModelTestTitle(localId: string) {
  if (modelSourceStore.testingModelLocalId === localId) {
    return customText.modelSource.testPending;
  }

  const result = modelSourceStore.testResultByModelId[localId];
  return result?.message || customText.modelSource.testIdle;
}

function startCreate() {
  isDetailMode.value = true;
  modelSourceStore.activeSourceCode = '';
  modelSourceStore.activeSourceDetail = null;
  modelSourceStore.resetForm();
}

async function openSourceDetail(sourceCode: string) {
  isDetailMode.value = true;
  await modelSourceStore.fetchSourceDetail(sourceCode);
}

function backToList() {
  isDetailMode.value = false;
  modelSourceStore.activeSourceCode = '';
  modelSourceStore.activeSourceDetail = null;
  modelSourceStore.resetForm();
}

function promptInstallLocalTestModel() {
  showInstallConfirm.value = true;
}

function cancelInstallLocalTestModel() {
  showInstallConfirm.value = false;
}

async function confirmInstallLocalTestModel() {
  showInstallConfirm.value = false;
  await localModelInstallerStore.installLocalTestModel();
}

async function startLocalTestModel() {
  await localModelInstallerStore.startLocalTestModel();
}

async function stopLocalTestModel() {
  await localModelInstallerStore.stopLocalTestModel();
}

async function refreshModelSources() {
  await modelSourceStore.refreshSourceCatalog();
  if (!modelSourceStore.errorMessage) {
    modelSourceStore.successMessage = customText.modelSource.localRefreshSuccess;
  }
}

function toggleLogPanel() {
  if (localModelInstallerStore.logPanelOpen) {
    localModelInstallerStore.closeLogPanel();
    return;
  }
  localModelInstallerStore.openLogPanel();
}

function closeSuccessModal() {
  modelSourceStore.clearSuccessMessage();
}

onBeforeUnmount(() => {
  localModelInstallerStore.stopPolling();
});
</script>

<template>
  <div class="settings-page__surface">
    <div v-if="showInstallConfirm" class="settings-modal-overlay" @click.self="cancelInstallLocalTestModel">
      <div class="settings-modal-card">
        <div class="settings-modal-card__header">
          <span class="chat-header__status">{{ customText.modelSource.localInstallConfirmStatus }}</span>
          <h2>{{ customText.modelSource.localInstallConfirmTitle }}</h2>
        </div>

        <div class="settings-modal-card__content">
          <p>{{ customText.modelSource.localInstallConfirmDescription }}</p>
          <p>{{ customText.modelSource.localInstallConfirmPythonNotice }}</p>
          <p>{{ customText.modelSource.localInstallConfirmDependencyNotice }}</p>
          <p>{{ customText.modelSource.localInstallConfirmManualHint }}</p>
          <p>{{ customText.modelSource.localInstallConfirmDurationHint }}</p>
        </div>

        <div class="settings-modal-card__actions">
          <button class="settings-panel__button" type="button" @click="cancelInstallLocalTestModel">
            {{ customText.modelSource.localInstallConfirmCancel }}
          </button>
          <button class="settings-panel__button settings-panel__button--primary" type="button" @click="confirmInstallLocalTestModel">
            {{ customText.modelSource.localInstallConfirmSubmit }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="modelSourceStore.successMessage" class="settings-modal-overlay" @click.self="closeSuccessModal">
      <div class="settings-modal-card settings-modal-card--success">
        <div class="settings-modal-card__header">
          <span class="chat-header__status">{{ customText.modelSource.localSuccessStatus }}</span>
          <h2>{{ customText.modelSource.localSuccessTitle }}</h2>
        </div>

        <div class="settings-modal-card__content">
          <p>{{ modelSourceStore.successMessage }}</p>
        </div>

        <div class="settings-modal-card__actions">
          <button class="settings-panel__button settings-panel__button--primary" type="button" @click="closeSuccessModal">
            {{ customText.modelSource.localSuccessConfirm }}
          </button>
        </div>
      </div>
    </div>

    <header class="settings-page__header settings-page__header--compact">
      <div>
        <span class="chat-header__status">{{ pageStatus }}</span>
        <h1>{{ pageTitle }}</h1>
      </div>

      <div class="settings-header-actions">
        <template v-if="!isDetailMode">
          <button
            class="settings-icon-button"
            type="button"
            :title="customText.modelSource.localStartTitle"
            :disabled="localTaskBusy"
            @click="startLocalTestModel"
          >
            <Play :size="16" />
          </button>

          <button
            class="settings-icon-button"
            type="button"
            :title="customText.modelSource.localStopTitle"
            :disabled="localTaskBusy"
            @click="stopLocalTestModel"
          >
            <SquareTerminal :size="16" />
          </button>

          <button
            class="settings-icon-button"
            type="button"
            :title="customText.modelSource.localInstallTitle"
            :disabled="localTaskBusy"
            @click="promptInstallLocalTestModel"
          >
            <Download :size="16" />
          </button>

          <button
            class="settings-icon-button"
            type="button"
            :title="customText.modelSource.localRefreshTitle"
            :disabled="modelSourceStore.loadingCatalog"
            @click="refreshModelSources"
          >
            <RefreshCw :size="16" />
          </button>

          <button class="settings-icon-button" type="button" :title="logButtonTitle" @click="toggleLogPanel">
            <FileText :size="16" />
          </button>
        </template>

        <button
          v-if="isDetailMode"
          class="settings-icon-button"
          type="button"
          :title="customText.modelSource.backToListTitle"
          @click="backToList"
        >
          <ChevronLeft :size="18" />
        </button>

        <button
          v-else
          class="settings-icon-button settings-icon-button--filled"
          type="button"
          :title="customText.modelSource.createTooltip"
          @click="startCreate"
        >
          <Plus :size="16" />
        </button>
      </div>
    </header>

    <div v-if="!isDetailMode && localModelInstallerStore.logPanelOpen" class="settings-script-feedback">
      <div class="settings-script-log">
        <div class="settings-script-log__meta">
          <span>{{ customText.modelSource.localTaskStatusLabel }}：{{ taskStatusText }}</span>
          <span>{{ customText.modelSource.localScriptLabel }}：{{ taskScript }}</span>
          <span>{{ customText.modelSource.localExitCodeLabel }}：{{ taskExitCode }}</span>
          <span>{{ customText.modelSource.localTaskStartedAtLabel }}：{{ taskStartedAt }}</span>
          <span>{{ customText.modelSource.localTaskFinishedAtLabel }}：{{ taskFinishedAt }}</span>
        </div>

        <div class="settings-script-log__block">
          <span>{{ customText.modelSource.localTaskMessageLabel }}</span>
          <pre>{{ taskMessage }}</pre>
        </div>

        <div class="settings-script-log__block">
          <span>{{ customText.modelSource.localStdoutTitle }}</span>
          <pre>{{ taskStdout || customText.modelSource.localTaskEmpty }}</pre>
        </div>

        <div v-if="taskStderr" class="settings-script-log__block">
          <span>{{ customText.modelSource.localStderrTitle }}</span>
          <pre>{{ taskStderr }}</pre>
        </div>
      </div>
    </div>

    <SourceListSection
      v-if="!isDetailMode"
      :error-message="modelSourceStore.errorMessage"
      :grouped-sources="modelSourceStore.groupedSources"
      @open-source="openSourceDetail"
    />

    <template v-else>
      <SourceFormSection
        :error-message="modelSourceStore.errorMessage"
        :form="modelSourceStore.form"
        :provider-options="modelProviderOptions"
        :can-submit="canSubmit"
        :saving="modelSourceStore.saving"
        @save="save"
      />

      <DraftModelsSection
        :models="modelSourceStore.form.models"
        :fetching-models="modelSourceStore.fetchingModels"
        :testing-model-local-id="modelSourceStore.testingModelLocalId"
        :get-model-test-state="getModelTestState"
        :get-model-test-title="getModelTestTitle"
        @fetch-models="fetchModels"
        @add-model="modelSourceStore.addModelRow"
        @update-model="modelSourceStore.updateModelRow"
        @test-model="testModel"
        @remove-model="modelSourceStore.removeModelRow"
        @clear-models="modelSourceStore.clearDraftModels"
      />

      <SavedModelsSection
        v-if="modelSourceStore.activeSourceDetail"
        :source-detail="modelSourceStore.activeSourceDetail"
        @remove-source="modelSourceStore.removeSource"
        @remove-model="modelSourceStore.removeModel"
      />
    </template>
  </div>
</template>
