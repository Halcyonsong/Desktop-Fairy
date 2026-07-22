import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { fairyConfig } from '@/config/fairyConfig';

const STORAGE_KEY = 'desktop-fairy.fairy.v1';
const DEFAULT_PET_ID = 'kurisu-coder';
const DEFAULT_SCALE = fairyConfig.scale.default;
const MIN_SCALE = fairyConfig.scale.min;
const MAX_SCALE = fairyConfig.scale.max;
const DEFAULT_IDLE_TRIGGER_MS = fairyConfig.idleTrigger.default;
const MIN_IDLE_TRIGGER_MS = fairyConfig.idleTrigger.min;
const MAX_IDLE_TRIGGER_MS = fairyConfig.idleTrigger.max;

interface FairyPosition {
  x: number;
  y: number;
}

interface FairySnapshot {
  enabled: boolean;
  petId: string;
  scale: number;
  position: FairyPosition | null;
  residentChatEnabled: boolean;
  /**
   * 自动闲聊触发时间（毫秒）。
   * 向后兼容：旧版本 localStorage 中没有该字段，回退到默认值 3 分钟。
   */
  idleTriggerMs: number;
}

function buildDefaultSnapshot(): FairySnapshot {
  return {
    enabled: false,
    petId: DEFAULT_PET_ID,
    scale: DEFAULT_SCALE,
    position: null,
    residentChatEnabled: false,
    idleTriggerMs: DEFAULT_IDLE_TRIGGER_MS,
  };
}

function clampScale(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SCALE;
  }
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

/**
 * 将自动闲聊触发时间约束到合法范围，并对齐到步长（30 秒）。
 * 非法值（NaN/Infinity/字符串）回退到默认值。
 */
function clampIdleTriggerMs(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_IDLE_TRIGGER_MS;
  }
  const clamped = Math.min(MAX_IDLE_TRIGGER_MS, Math.max(MIN_IDLE_TRIGGER_MS, value));
  // 对齐到步长，避免持久化的值与滑动条刻度不一致
  const steps = Math.round((clamped - MIN_IDLE_TRIGGER_MS) / fairyConfig.idleTrigger.step);
  return MIN_IDLE_TRIGGER_MS + steps * fairyConfig.idleTrigger.step;
}

function normalizePosition(position: Partial<FairyPosition> | null | undefined) {
  if (!position) {
    return null;
  }

  const x = Number(position.x);
  const y = Number(position.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y } satisfies FairyPosition;
}

function normalizeSnapshot(snapshot: Partial<FairySnapshot> | null | undefined): FairySnapshot {
  const fallback = buildDefaultSnapshot();
  if (!snapshot) {
    return fallback;
  }

  return {
    enabled: Boolean(snapshot.enabled),
    petId: snapshot.petId?.trim() || fallback.petId,
    scale: clampScale(Number(snapshot.scale)),
    position: normalizePosition(snapshot.position),
    residentChatEnabled: Boolean(snapshot.residentChatEnabled),
    // 向后兼容：旧版本 localStorage 中无该字段，clampIdleTriggerMs 会回退到默认值
    idleTriggerMs: clampIdleTriggerMs(Number(snapshot.idleTriggerMs)),
  };
}

function loadSnapshot(): FairySnapshot {
  if (typeof window === 'undefined') {
    return buildDefaultSnapshot();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return buildDefaultSnapshot();
    }

    return normalizeSnapshot(JSON.parse(raw) as Partial<FairySnapshot>);
  } catch {
    return buildDefaultSnapshot();
  }
}

export const useFairyStore = defineStore('fairy', () => {
  const snapshot = loadSnapshot();
  const enabled = ref(snapshot.enabled);
  const petId = ref(snapshot.petId);
  const scale = ref(snapshot.scale);
  const position = ref<FairyPosition | null>(snapshot.position);
  const residentChatEnabled = ref(snapshot.residentChatEnabled);
  const idleTriggerMs = ref(snapshot.idleTriggerMs);
  const syncInitialized = ref(false);

  const statusText = computed(() => (enabled.value ? '已启用悬浮精灵' : '当前未启用桌面精灵'));
  const scalePercent = computed(() => `${Math.round(scale.value * 100)}%`);
  const residentChatStatusText = computed(() => (residentChatEnabled.value ? '常驻闲聊已开启' : '常驻闲聊未开启'));
  // 自动闲聊触发时间的友好显示（分钟 + 秒），用于滑动条标签
  const idleTriggerLabel = computed(() => {
    const totalSeconds = Math.round(idleTriggerMs.value / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (seconds === 0) {
      return minutes >= 1 ? `${minutes} 分钟` : `${seconds} 秒`;
    }
    return `${minutes} 分 ${seconds} 秒`;
  });

  function applySnapshot(nextSnapshot: FairySnapshot) {
    enabled.value = nextSnapshot.enabled;
    petId.value = nextSnapshot.petId;
    scale.value = nextSnapshot.scale;
    position.value = nextSnapshot.position;
    residentChatEnabled.value = nextSnapshot.residentChatEnabled;
    idleTriggerMs.value = nextSnapshot.idleTriggerMs;
  }

  function persist() {
    if (typeof window === 'undefined') {
      return;
    }

    const payload: FairySnapshot = {
      enabled: enabled.value,
      petId: petId.value,
      scale: scale.value,
      position: position.value,
      residentChatEnabled: residentChatEnabled.value,
      idleTriggerMs: idleTriggerMs.value,
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('[FairyStore] Failed to persist to localStorage:', error);
    }
  }

  function syncNativeWindowState() {
    if (typeof window === 'undefined') {
      return;
    }

    window.desktopFairy?.setFairyEnabled?.(enabled.value);
  }

  function syncFromStorage() {
    applySnapshot(loadSnapshot());
    syncNativeWindowState();
  }

  function initializeSync() {
    if (syncInitialized.value || typeof window === 'undefined') {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }
      syncFromStorage();
    };

    window.addEventListener('storage', handleStorage);
    syncInitialized.value = true;
  }

  function setEnabled(value: boolean) {
    enabled.value = value;
    persist();
    syncNativeWindowState();
  }

  function toggleEnabled() {
    setEnabled(!enabled.value);
  }

  function hydrateEnabled(value: boolean) {
    enabled.value = Boolean(value);
    persist();
  }

  function setResidentChatEnabled(value: boolean) {
    residentChatEnabled.value = value;
    persist();
  }

  function toggleResidentChatEnabled() {
    setResidentChatEnabled(!residentChatEnabled.value);
  }

  function setPetId(value: string) {
    const nextValue = value.trim();
    if (!nextValue) {
      return;
    }

    petId.value = nextValue;
    persist();
  }

  function setScale(value: number) {
    scale.value = clampScale(value);
  }

  function commitScale() {
    persist();
  }

  function resetScale() {
    scale.value = DEFAULT_SCALE;
    persist();
  }

  /**
   * 设置自动闲聊触发时间（毫秒）。
   * 值会被约束到 [30s, 5min] 并对齐到 30 秒步长。
   * 仅在拖动结束（@change）时调用 commit 持久化，避免拖动过程中频繁写 localStorage。
   */
  function setIdleTriggerMs(value: number) {
    idleTriggerMs.value = clampIdleTriggerMs(value);
  }

  function commitIdleTriggerMs() {
    persist();
  }

  function resetIdleTriggerMs() {
    idleTriggerMs.value = DEFAULT_IDLE_TRIGGER_MS;
    persist();
  }

  function setPosition(nextPosition: FairyPosition | null) {
    position.value = normalizePosition(nextPosition);
  }

  function commitPosition() {
    persist();
  }

  function resetPosition() {
    position.value = null;
    persist();
  }

  async function resetNativePosition() {
    if (typeof window === 'undefined') {
      resetPosition();
      return;
    }

    position.value = null;
    persist();
    await window.desktopFairy?.resetFairyPosition?.();
  }

  return {
    enabled,
    petId,
    scale,
    position,
    residentChatEnabled,
    idleTriggerMs,
    statusText,
    scalePercent,
    residentChatStatusText,
    idleTriggerLabel,
    initializeSync,
    syncFromStorage,
    syncNativeWindowState,
    setEnabled,
    toggleEnabled,
    hydrateEnabled,
    setResidentChatEnabled,
    toggleResidentChatEnabled,
    setPetId,
    setScale,
    commitScale,
    resetScale,
    setIdleTriggerMs,
    commitIdleTriggerMs,
    resetIdleTriggerMs,
    setPosition,
    commitPosition,
    resetPosition,
    resetNativePosition,
  };
});
