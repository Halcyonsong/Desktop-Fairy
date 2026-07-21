/**
 * UI 相关的通用常量集中管理。
 *
 * 设计目标：
 *   - 避免魔法数字散落在各组件/composable 中
 *   - 便于全局调整 UI 节奏（如复制反馈时长、防抖间隔）
 *   - 与业务相关的常量不放在这里（如 chatConstants、fairyConfig）
 *
 * 命名约定：使用领域语义命名而非数值命名（用 copyFeedbackResetMs 而不是 ms1500）
 */

export const UI_TIMING = {
  /** 复制按钮反馈持续时间（毫秒），用于"已复制！"提示自动复位 */
  copyFeedbackResetMs: 1500,

  /** 列表滚轮下拉触发加载更多的防抖时间（毫秒） */
  wheelPullDebounceMs: 260,
} as const;

export const FAIRY_TIMING = {
  /** 桌面精灵气泡自动隐藏时间（毫秒） */
  bubbleAutoHideMs: 5000,

  /** 桌面精灵闲置检测轮询间隔（毫秒） */
  idleCheckIntervalMs: 5000,

  /** 精灵动画帧回退间隔（毫秒），当 {petId}.json 未指定 fps 时使用 */
  petFrameFallbackIntervalMs: 180,
} as const;

export const VOSK_TIMING = {
  /** 语音识别中检测句子停顿的阈值（毫秒），超过则视为逗号停顿 */
  pauseThresholdMs: 500,
} as const;

export const LOG_VIEWER = {
  /** 后端日志默认读取的行数 */
  backendLogDefaultLines: 200,
} as const;
