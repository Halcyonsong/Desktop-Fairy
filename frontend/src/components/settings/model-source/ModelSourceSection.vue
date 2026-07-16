<script setup lang="ts">
import { ChevronLeft, Download, FileText, Play, Plus, SquareTerminal } from '@lucide/vue';
import { computed, ref } from 'vue';
import { customText } from '@/config/customText';
import DraftModelsSection from '@/components/settings/model-source/DraftModelsSection.vue';
import SavedModelsSection from '@/components/settings/model-source/SavedModelsSection.vue';
import SourceFormSection from '@/components/settings/model-source/SourceFormSection.vue';
import SourceListSection from '@/components/settings/model-source/SourceListSection.vue';
import { useLocalModelInstallerStore } from '@/stores/localModelInstallerStore';
import { useModelSourceStore } from '@/stores/modelSourceStore';
import type { ModelProvider } from '@/types/chat';

const modelSourceStore = useModelSourceStore();
const localModelInstallerStore = useLocalModelInstallerStore();
const isDetailMode = ref(false);
const showScriptLog = ref(false);
const showInstallConfirm = ref(false);

const providerOptions: ModelProvider[] = [
  'deepseek',
  'openai',
  'anthropic',
  'google-gemini',
  'claude-compatible',
  'openrouter',
  'ollama',
  'openai-compatible',
  'azure-openai',
  'moonshot',
  'qwen',
  'doubao',
  'glm',
  'baichuan',
  'minimax',
  'siliconflow',
  'tencent-hunyuan',
  'local-llamacpp',
];

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
const installMessage = computed(() =>
  localModelInstallerStore.errorMessage ||
  (localModelInstallerStore.status === 'success'
    ? customText.modelSource.localInstallSuccess
    : localModelInstallerStore.status === 'running'
      ? customText.modelSource.localRunning
      : localModelInstallerStore.status === 'stopped'
        ? customText.modelSource.localStopped
        : customText.modelSource.localErrorFallback),
);
const scriptLogTitle = computed(() =>
  showScriptLog.value ? customText.modelSource.localHideLogTitle : customText.modelSource.localViewLogTitle,
);

async function save() {
  await modelSourceStore.saveCurrentForm();
}

async function testModel(localId: string) {
  await modelSourceStore.testModelDraft(localId);
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
  showScriptLog.value = false;
  modelSourceStore.activeSourceCode = '';
  modelSourceStore.activeSourceDetail = null;
  modelSourceStore.resetForm();
}

async function openSourceDetail(sourceCode: string) {
  isDetailMode.value = true;
  showScriptLog.value = false;
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
  const success = await localModelInstallerStore.installLocalTestModel();
  showScriptLog.value = !success;
}

async function startLocalTestModel() {
  const success = await localModelInstallerStore.startLocalTestModel();
  showScriptLog.value = !success;
}

async function stopLocalTestModel() {
  const success = await localModelInstallerStore.stopLocalTestModel();
  showScriptLog.value = !success;
}

function toggleScriptLog() {
  showScriptLog.value = !showScriptLog.value;
}
</script>

<template>
  <div class="settings-page__surface">
    <div v-if="showInstallConfirm" class="settings-modal-overlay" @click.self="cancelInstallLocalTestModel">
      <div class="settings-modal-card">
        <div class="settings-modal-card__header">
          <span class="chat-header__status">本地测试模型安装确认</span>
          <h2>安装 Qwen3.5-4B-UD-IQ2_XXS</h2>
        </div>

        <div class="settings-modal-card__content">
          <p>将尝试安装并启动本地测试模型 <code>Qwen3.5-4B-UD-IQ2_XXS</code>，并自动写入本地供应商配置。</p>
          <p>安装过程中会检查或补充 Python、huggingface_hub、llama.cpp / llama-server 等运行依赖，并下载模型文件到本地目录。</p>
          <p>如果你已经自行下载并启动了本地模型，也可以直接按 OpenAI 兼容模式手动新增供应商配置；<code>baseUrl</code> 填本地服务地址，<code>apiKey</code> 可以留空，但建议统一填写 <code>local</code>。</p>
          <p>首次下载和启动受网络与磁盘速度影响较大，通常需要 10 到 30 分钟不等。安装期间请不要重复点击安装按钮。</p>
        </div>

        <div class="settings-modal-card__actions">
          <button class="settings-panel__button" type="button" @click="cancelInstallLocalTestModel">取消</button>
          <button class="settings-panel__button settings-panel__button--primary" type="button" @click="confirmInstallLocalTestModel">
            确定安装
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
            :disabled="localModelInstallerStore.busy"
            @click="startLocalTestModel"
          >
            <Play :size="16" />
          </button>

          <button
            class="settings-icon-button"
            type="button"
            :title="customText.modelSource.localStopTitle"
            :disabled="localModelInstallerStore.busy"
            @click="stopLocalTestModel"
          >
            <SquareTerminal :size="16" />
          </button>

          <button
            class="settings-icon-button"
            type="button"
            :title="customText.modelSource.localInstallTitle"
            :disabled="localModelInstallerStore.busy"
            @click="promptInstallLocalTestModel"
          >
            <Download :size="16" />
          </button>

          <button
            v-if="localModelInstallerStore.lastResult"
            class="settings-icon-button"
            type="button"
            :title="scriptLogTitle"
            @click="toggleScriptLog"
          >
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

    <div v-if="!isDetailMode && (localModelInstallerStore.errorMessage || localModelInstallerStore.lastResult)" class="settings-script-feedback">
      <div class="message-alert">{{ installMessage }}</div>

      <div v-if="showScriptLog && localModelInstallerStore.lastResult" class="settings-script-log">
        <div class="settings-script-log__meta">
          <span>{{ customText.modelSource.localScriptLabel }}：{{ localModelInstallerStore.lastResult.script }}</span>
          <span>{{ customText.modelSource.localExitCodeLabel }}：{{ localModelInstallerStore.lastResult.exitCode }}</span>
        </div>

        <div class="settings-script-log__block">
          <span>{{ customText.modelSource.localStdoutTitle }}</span>
          <pre>{{ localModelInstallerStore.lastResult.stdout || '-' }}</pre>
        </div>

        <div v-if="localModelInstallerStore.lastResult.stderr" class="settings-script-log__block">
          <span>{{ customText.modelSource.localStderrTitle }}</span>
          <pre>{{ localModelInstallerStore.lastResult.stderr }}</pre>
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
        :provider-options="providerOptions"
        :can-submit="canSubmit"
        :saving="modelSourceStore.saving"
        @save="save"
      />

      <DraftModelsSection
        :models="modelSourceStore.form.models"
        :testing-model-local-id="modelSourceStore.testingModelLocalId"
        :get-model-test-state="getModelTestState"
        :get-model-test-title="getModelTestTitle"
        @add-model="modelSourceStore.addModelRow"
        @update-model="modelSourceStore.updateModelRow"
        @test-model="testModel"
        @remove-model="modelSourceStore.removeModelRow"
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
