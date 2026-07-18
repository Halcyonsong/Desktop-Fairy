import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useFairyStore } from '@/stores/fairyStore';
import { useWindowModeStore, type WindowMode } from '@/stores/windowModeStore';
import './styles/global.css';

declare global {
  interface Window {
    desktopFairy?: {
      getWindowMode?: () => Promise<string>;
      getFairyPreferences?: () => Promise<{ enabled?: boolean }>;
      resetFairyPosition?: () => Promise<{ x: number; y: number; width: number; height: number }>;
      beginFairyDrag?: (payload: { screenX: number; screenY: number }) => void;
      updateFairyDrag?: (payload: { screenX: number; screenY: number }) => void;
      endFairyDrag?: () => void;
      setFairyMouseIgnore?: (ignore: boolean) => void;
      setFairyDragging?: (dragging: boolean) => void;
      setFairyEnabled?: (enabled: boolean) => void;
    };
  }
}

function resolveWindowModeFromLocation(): WindowMode | null {
  const queryMode = new URLSearchParams(window.location.search).get('windowMode');
  if (queryMode === 'fairy' || queryMode === 'workbench') {
    return queryMode;
  }

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const hashMode = new URLSearchParams(hash).get('windowMode');
  if (hashMode === 'fairy' || hashMode === 'workbench') {
    return hashMode;
  }

  return null;
}

async function resolveInitialWindowMode(): Promise<WindowMode> {
  const locationMode = resolveWindowModeFromLocation();
  if (locationMode) {
    return locationMode;
  }

  const bridgeMode = await window.desktopFairy?.getWindowMode?.();
  return bridgeMode === 'fairy' || bridgeMode === 'workbench' ? bridgeMode : 'workbench';
}

async function preloadFairyNativePreferences(fairyStore: ReturnType<typeof useFairyStore>) {
  const nativePreferences = await window.desktopFairy?.getFairyPreferences?.();
  if (typeof nativePreferences?.enabled === 'boolean') {
    fairyStore.hydrateEnabled(nativePreferences.enabled);
  }
}

async function bootstrap() {
  const app = createApp(App);
  const pinia = createPinia();

  app.use(pinia);

  const appearanceStore = useAppearanceStore();
  const fairyStore = useFairyStore();
  const windowModeStore = useWindowModeStore();

  await preloadFairyNativePreferences(fairyStore);

  appearanceStore.initializeAppearance();
  appearanceStore.initializeSync();
  fairyStore.initializeSync();
  fairyStore.syncNativeWindowState();
  windowModeStore.setWindowMode(await resolveInitialWindowMode());

  app.mount('#app');
}

void bootstrap();
