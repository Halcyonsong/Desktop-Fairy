import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { fairyConfig } from '@/config/fairyConfig';

const STORAGE_KEY = 'desktop-fairy.fairy.v1';
const DEFAULT_PET_ID = 'kurisu-coder';
const DEFAULT_SCALE = fairyConfig.scale.default;
const MIN_SCALE = fairyConfig.scale.min;
const MAX_SCALE = fairyConfig.scale.max;

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
}

function buildDefaultSnapshot(): FairySnapshot {
  return {
    enabled: false,
    petId: DEFAULT_PET_ID,
    scale: DEFAULT_SCALE,
    position: null,
    residentChatEnabled: false,
  };
}

function clampScale(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SCALE;
  }
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
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
  const syncInitialized = ref(false);

  const statusText = computed(() => (enabled.value ? '已启用悬浮精灵' : '当前未启用桌面精灵'));
  const scalePercent = computed(() => `${Math.round(scale.value * 100)}%`);
  const residentChatStatusText = computed(() => (residentChatEnabled.value ? '常驻闲聊已开启' : '常驻闲聊未开启'));

  function applySnapshot(nextSnapshot: FairySnapshot) {
    enabled.value = nextSnapshot.enabled;
    petId.value = nextSnapshot.petId;
    scale.value = nextSnapshot.scale;
    position.value = nextSnapshot.position;
    residentChatEnabled.value = nextSnapshot.residentChatEnabled;
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
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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
    statusText,
    scalePercent,
    residentChatStatusText,
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
    setPosition,
    commitPosition,
    resetPosition,
    resetNativePosition,
  };
});
