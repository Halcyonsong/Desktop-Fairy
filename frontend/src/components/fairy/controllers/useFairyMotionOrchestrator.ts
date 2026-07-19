import type { Ref } from 'vue';
import type { PetDefinition } from '@/types/pet';

interface SetAnimationOptions {
  loop?: boolean;
  cycles?: number;
  onComplete?: () => void;
}

interface UseFairyMotionOrchestratorOptions {
  pet: Ref<PetDefinition | null>;
  usingTemporaryChat: Ref<boolean>;
  workbenchSending: Ref<boolean>;
  latestReasoningText: Ref<string>;
  streamPhase: Ref<'idle' | 'typing' | 'thinking' | 'replying'>;
  setAnimation: (name: string, options?: SetAnimationOptions) => void;
  petAnimations: {
    idle: string;
    typing: string;
    thinking: string;
    replying: string;
  };
}

/**
 * 精灵动作编排控制器。
 *
 * 负责：
 * - 安全切换动作（不存在时回退 idle）
 * - typing/thinking/replying 的阶段编排
 */
export function useFairyMotionOrchestrator(options: UseFairyMotionOrchestratorOptions) {
  const {
    pet,
    usingTemporaryChat,
    workbenchSending,
    latestReasoningText,
    streamPhase,
    setAnimation,
    petAnimations,
  } = options;

  function safeSetAnimation(name: string) {
    if (!pet.value) {
      return;
    }
    const fallback = pet.value.animations[name] ? name : petAnimations.idle;
    setAnimation(fallback);
  }

  function triggerTypingWithCycles() {
    if (!pet.value || !pet.value.animations[petAnimations.typing]) {
      safeSetAnimation(petAnimations.replying);
      return;
    }
    setAnimation(petAnimations.typing, {
      loop: false,
      cycles: 3,
      onComplete: () => {
        if (usingTemporaryChat.value) {
          const phase = streamPhase.value;
          if (phase === 'thinking') {
            safeSetAnimation(petAnimations.thinking);
          } else if (phase === 'replying') {
            safeSetAnimation(petAnimations.replying);
          } else {
            triggerTypingWithCycles();
          }
        } else if (workbenchSending.value) {
          if (latestReasoningText.value) {
            safeSetAnimation(petAnimations.thinking);
          } else {
            safeSetAnimation(petAnimations.replying);
          }
        } else {
          safeSetAnimation(petAnimations.idle);
        }
      },
    });
  }

  return {
    safeSetAnimation,
    triggerTypingWithCycles,
  };
}
