import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { copyText } from '@/utils/clipboard';
import { UI_TIMING } from '@/config/uiConstants';
import type { ModelProvider, ModelSourceFormState } from '@/types/chat';

interface UseSourceFormControllerOptions {
  form: ModelSourceFormState;
  providerOptions: ModelProvider[];
}

/**
 * Model Source 表单交互控制器。
 *
 * 负责：
 * - Provider 下拉展开/筛选/收起
 * - API Key 显示/隐藏
 * - 输入清空
 * - 复制反馈状态
 */
export function useSourceFormController(options: UseSourceFormControllerOptions) {
  const { form, providerOptions } = options;

  const apiKeyVisible = ref(false);
  const providerOpen = ref(false);
  const providerFilter = ref('');
  const providerRef = ref<HTMLElement | null>(null);

  const copiedField = ref<string>('');
  const copyFailedField = ref<string>('');

  const filteredProviderOptions = computed(() => {
    const keyword = providerFilter.value.trim().toLowerCase();
    if (!keyword) {
      return providerOptions;
    }

    return providerOptions.filter((provider) => provider.toLowerCase().includes(keyword));
  });

  function toggleApiKeyVisible() {
    apiKeyVisible.value = !apiKeyVisible.value;
  }

  function hideApiKey() {
    apiKeyVisible.value = false;
  }

  function clearField(field: 'name' | 'baseUrl' | 'apiKey') {
    form[field] = '';
    if (field === 'apiKey') {
      hideApiKey();
    }
  }

  function chooseProvider(provider: string) {
    form.provider = provider;
    providerFilter.value = '';
    providerOpen.value = false;
  }

  function toggleProviderOpen() {
    providerOpen.value = !providerOpen.value;
    if (!providerOpen.value) {
      providerFilter.value = '';
    }
  }

  function handlePointerDown(event: MouseEvent) {
    const target = event.target;
    if (providerOpen.value && providerRef.value && target instanceof Node && !providerRef.value.contains(target)) {
      providerOpen.value = false;
      providerFilter.value = '';
    }
  }

  async function copyValue(value: string, field: 'name' | 'baseUrl' | 'apiKey' = 'apiKey') {
    if (!value.trim()) {
      return;
    }
    await copyText(value, {
      onSuccess: () => {
        copiedField.value = field;
        copyFailedField.value = '';
        setTimeout(() => {
          copiedField.value = '';
        }, UI_TIMING.copyFeedbackResetMs);
      },
      onFail: () => {
        copyFailedField.value = field;
        copiedField.value = '';
        setTimeout(() => {
          copyFailedField.value = '';
        }, UI_TIMING.copyFeedbackResetMs);
      },
    });
  }

  onMounted(() => {
    window.addEventListener('mousedown', handlePointerDown);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('mousedown', handlePointerDown);
  });

  return {
    apiKeyVisible,
    providerOpen,
    providerFilter,
    providerRef,
    copiedField,
    copyFailedField,
    filteredProviderOptions,
    toggleApiKeyVisible,
    hideApiKey,
    clearField,
    chooseProvider,
    toggleProviderOpen,
    copyValue,
  };
}
