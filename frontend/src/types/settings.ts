export type SettingsSectionKey = 'model-source' | 'chat-preferences' | 'appearance' | 'desktop-behavior';

export interface SettingsSectionItem {
  key: SettingsSectionKey;
  label: string;
  description: string;
  enabled: boolean;
}
