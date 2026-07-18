import { computed, ref, watch, type Ref } from 'vue';
import type { PetDefinition } from '@/types/pet';

export interface FairyMotionState {
  dragging: Ref<boolean>;
  statusMessage: Ref<string>;
}

export function useFairyMotionController(pet: Ref<PetDefinition | null>, animationName: Ref<string>) {
  const dragging = ref(false);
  const statusMessage = ref('桌面精灵待机中');

  function setDragging(value: boolean) {
    dragging.value = value;
    if (value) {
      statusMessage.value = '拖拽中…';
      return;
    }

    const fallbackAnimation = animationName.value || pet.value?.defaultAnimation || 'idle';
    statusMessage.value = `当前动作：${fallbackAnimation}`;
  }

  function setStatusMessage(message: string) {
    statusMessage.value = message;
  }

  watch(
    animationName,
    (value) => {
      if (!value || dragging.value) {
        return;
      }
      statusMessage.value = `当前动作：${value}`;
    },
    { immediate: true },
  );

  watch(
    pet,
    (definition) => {
      if (!definition || dragging.value) {
        return;
      }
      statusMessage.value = `当前动作：${animationName.value || definition.defaultAnimation}`;
    },
    { immediate: true },
  );

  return {
    dragging,
    statusMessage,
    setDragging,
    setStatusMessage,
  };
}
