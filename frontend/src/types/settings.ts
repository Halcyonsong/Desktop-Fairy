export type SettingsSectionKey = 'model-source' | 'chat-preferences' | 'appearance' | 'system-actions' | 'desktop-behavior' | 'log-viewer' | 'file-paths';

export interface SettingsSectionItem {
  key: SettingsSectionKey;
  label: string;
  description: string;
  enabled: boolean;
}
