import { runtimeConfig } from '@/config/runtimeConfig';

export const appConfig = {
  brandName: runtimeConfig.appBrandName,
  workbenchTitle: runtimeConfig.workbenchTitle,
  workbenchSubtitle: runtimeConfig.workbenchSubtitle,
  defaultModelLabel: runtimeConfig.defaultModelLabel,
  defaultModelHint: runtimeConfig.defaultModelHint,
  featureFlags: {
    settingsEntry: true,
    attachmentEntry: true,
    modelPresetEntry: true,
    toolCallEntry: true,
  },
} as const;
