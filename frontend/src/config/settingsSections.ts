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
    key: 'system-actions',
    label: '系统性操作',
    description: '存放重载等系统级操作入口',
    enabled: true,
  },
  {
    key: 'desktop-behavior',
    label: customText.desktopBehavior.title,
    description: '配置桌面精灵显示与悬浮行为',
    enabled: true,
  },
  {
    key: 'log-viewer',
    label: '日志查看',
    description: '查看应用运行日志，用于开发调试和问题排查',
    enabled: true,
  },
  {
    key: 'file-paths',
    label: '文件路径',
    description: '查看所有应用数据的存储位置',
    enabled: true,
  },
];
