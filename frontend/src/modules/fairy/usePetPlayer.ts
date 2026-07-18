import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { PetAnimationClip, PetDefinition } from '@/types/pet';

const FALLBACK_INTERVAL = 180;

function getFrameInterval(clip: PetAnimationClip | undefined) {
  if (!clip?.fps || clip.fps <= 0) {
    return FALLBACK_INTERVAL;
  }
  return Math.max(1000 / clip.fps, 80);
}

export function usePetPlayer(pet: Ref<PetDefinition | null>) {
  const animationName = ref('idle');
  const framePointer = ref(0);
  const animationCycle = ref(0);

  let timer: number | null = null;

  const animationEntries = computed(() => {
    const definition = pet.value;
    if (!definition) {
      return [] as Array<{ key: string; clip: PetAnimationClip }>;
    }
    return Object.entries(definition.animations).map(([key, clip]) => ({ key, clip }));
  });

  const currentAnimation = computed(() => {
    const definition = pet.value;
    if (!definition) {
      return null;
    }

    return definition.animations[animationName.value] ?? definition.animations[definition.defaultAnimation] ?? null;
  });

  const currentFrame = computed(() => {
    const definition = pet.value;
    const clip = currentAnimation.value;
    if (!definition || !clip || clip.frames.length === 0) {
      return null;
    }

    const frameIndex = clip.frames[Math.min(framePointer.value, clip.frames.length - 1)] ?? clip.frames[0];
    return definition.frames[frameIndex] ?? null;
  });

  function clearTimer() {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  }

  function setAnimation(name: string) {
    if (!pet.value) {
      return;
    }

    const targetName = pet.value.animations[name] ? name : pet.value.defaultAnimation;
    animationName.value = targetName;
    framePointer.value = 0;
  }

  function scheduleNextTick() {
    clearTimer();

    const clip = currentAnimation.value;
    if (!clip || clip.frames.length <= 1) {
      return;
    }

    timer = window.setTimeout(() => {
      const nextFrame = framePointer.value + 1;
      if (nextFrame >= clip.frames.length) {
        if (clip.loop) {
          framePointer.value = 0;
          animationCycle.value += 1;
        } else {
          const definition = pet.value;
          const fallbackAnimation = definition?.defaultAnimation ?? animationName.value;
          if (animationName.value !== fallbackAnimation && definition?.animations[fallbackAnimation]) {
            animationName.value = fallbackAnimation;
            framePointer.value = 0;
          } else {
            framePointer.value = clip.frames.length - 1;
          }
        }
      } else {
        framePointer.value = nextFrame;
      }

      scheduleNextTick();
    }, getFrameInterval(clip));
  }

  watch(
    [pet, animationName, framePointer],
    () => {
      if (!pet.value) {
        clearTimer();
        return;
      }
      scheduleNextTick();
    },
    { immediate: true },
  );

  watch(
    pet,
    (definition) => {
      if (!definition) {
        return;
      }
      animationName.value = definition.defaultAnimation;
      framePointer.value = 0;
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    clearTimer();
  });

  return {
    animationName,
    animationEntries,
    currentAnimation,
    currentFrame,
    animationCycle,
    setAnimation,
  };
}
