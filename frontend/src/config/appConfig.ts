import { runtimeConfig } from '@/config/runtimeConfig';

export const appConfig = {
  brandName: runtimeConfig.appBrandName,
  workbenchTitle: runtimeConfig.workbenchTitle,
  workbenchSubtitle: runtimeConfig.workbenchSubtitle,
  featureFlags: {
    settingsEntry: true,
    attachmentEntry: true,
    modelPresetEntry: true,
    toolCallEntry: true,
  },
} as const;
