export type SettingsSectionKey = 'model-source' | 'chat-preferences' | 'appearance' | 'system-actions' | 'desktop-behavior';

export interface SettingsSectionItem {
  key: SettingsSectionKey;
  label: string;
  description: string;
  enabled: boolean;
}
