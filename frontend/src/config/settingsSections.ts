import { customText } from '@/config/customText';
import type { SettingsSectionItem } from '@/types/settings';

export const settingsSections: SettingsSectionItem[] = [
  {
    key: 'model-source',
    label: customText.modelSource.listTitle,
    description: '管理模型源与模型列表',
    enabled: true,
  },
  {
    key: 'chat-preferences',
    label: customText.chatPreferences.status,
    description: '预留默认聊天参数配置',
    enabled: true,
  },
  {
    key: 'appearance',
    label: customText.appearance.title,
    description: '全局字体与界面外观设置',
    enabled: true,
  },
  {
    key: 'desktop-behavior',
    label: '桌面行为',
    description: '预留桌面精灵行为配置',
    enabled: false,
  },
];
