<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Sparkles } from '@lucide/vue';
import { loadPetDefinition } from '@/components/fairy/controllers/petLoader';
import { usePetPlayer } from '@/components/fairy/controllers/usePetPlayer';
import type { PetDefinition } from '@/types/pet';

const props = withDefaults(
  defineProps<{
    petId?: string;
    scale?: number;
  }>(),
  {
    petId: 'kurisu-coder',
    scale: 1.9,
  },
);

const pet = ref<PetDefinition | null>(null);
const loading = ref(true);
const errorMessage = ref('');
const interactionHint = ref('轻点角色、切换动作，先确认素材播放效果。');

const {
  animationName,
  animationEntries,
  currentAnimation,
  currentFrame,
  animationCycle,
  setAnimation,
} = usePetPlayer(pet);

const displayScale = computed(() => props.scale);
const stageWidth = computed(() => Math.round((currentFrame.value?.w ?? 160) * displayScale.value));
const stageHeight = computed(() => Math.round((currentFrame.value?.h ?? 200) * displayScale.value));

const spriteStyle = computed(() => {
  const definition = pet.value;
  const frame = currentFrame.value;
  if (!definition || !frame) {
    return {};
  }

  return {
    width: `${frame.w}px`,
    height: `${frame.h}px`,
    backgroundImage: `url(${definition.spritesheetPath})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `${-frame.x}px ${-frame.y}px`,
    backgroundSize: `${definition.canvas.width}px ${definition.canvas.height}px`,
    transform: `scale(${displayScale.value})`,
  };
});

const idleAnimationNames = ['idle', 'hover', 'think', 'rest'];
const burstAnimationNames = ['blink', 'wave', 'emotion', 'type'];

function chooseNextIdleAnimation() {
  const options = idleAnimationNames.filter((name) => pet.value?.animations[name]);
  if (options.length === 0) {
    return pet.value?.defaultAnimation ?? 'idle';
  }

  const currentIndex = options.indexOf(animationName.value);
  return options[(currentIndex + 1 + options.length) % options.length] ?? options[0];
}

function triggerAmbientAnimation() {
  const options = burstAnimationNames.filter((name) => pet.value?.animations[name]);
  if (options.length === 0) {
    return;
  }

  const randomIndex = Math.floor(Math.random() * options.length);
  setAnimation(options[randomIndex] ?? options[0]);
}

function handleStageClick() {
  triggerAmbientAnimation();
  interactionHint.value = '已触发一个非循环动作，结束后会回到默认待机。';
}

function handleSelectAnimation(name: string) {
  setAnimation(name);
  interactionHint.value = `当前动作：${name}`;
}

watch(animationCycle, (value) => {
  if (!pet.value || value === 0) {
    return;
  }

  if (animationName.value === pet.value.defaultAnimation && value % 3 === 0) {
    setAnimation(chooseNextIdleAnimation());
    interactionHint.value = '已自动切换到另一组待机动作。';
  }
});

watch(
  () => currentAnimation.value?.loop,
  (looping) => {
    if (looping === false) {
      interactionHint.value = '正在播放一次性动作，结束后将回到默认动画。';
    }
  },
);

onMounted(async () => {
  loading.value = true;
  errorMessage.value = '';

  try {
    pet.value = await loadPetDefinition(props.petId);
    interactionHint.value = `已载入 ${pet.value.displayName}，当前默认动作：${pet.value.defaultAnimation}`;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '精灵资源读取失败';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="pet-stage-card">
    <header class="pet-stage-card__header">
      <div>
        <span class="pet-stage-card__eyebrow">桌面精灵预览</span>
        <h2>{{ pet?.displayName ?? '正在加载精灵资源' }}</h2>
        <p>{{ pet?.description ?? '使用 spritesheet + JSON 动画描述进行首版渲染。' }}</p>
      </div>

      <div class="pet-stage-card__meta">
        <Sparkles :size="16" />
        <span>{{ animationName }}</span>
      </div>
    </header>

    <div class="pet-stage-shell">
      <div class="pet-stage-backdrop"></div>
      <div class="pet-stage-platform"></div>

      <button class="pet-stage-avatar-button" type="button" :disabled="loading || !!errorMessage" @click="handleStageClick">
        <div class="pet-stage-avatar" :style="{ width: `${stageWidth}px`, height: `${stageHeight}px` }">
          <div v-if="currentFrame" class="pet-stage-sprite" :style="spriteStyle"></div>
          <div v-else class="pet-stage-skeleton"></div>
        </div>
      </button>

      <div class="pet-stage-orbit pet-stage-orbit--a"></div>
      <div class="pet-stage-orbit pet-stage-orbit--b"></div>
    </div>

    <div class="pet-stage-status" :class="{ 'pet-stage-status--error': !!errorMessage }">
      {{ errorMessage || interactionHint }}
    </div>

    <div v-if="loading" class="pet-stage-loading">正在读取测试精灵资源…</div>

    <div v-else class="pet-animation-list">
      <button
        v-for="entry in animationEntries"
        :key="entry.key"
        class="pet-animation-chip"
        :class="{ 'pet-animation-chip--active': entry.key === animationName }"
        type="button"
        @click="handleSelectAnimation(entry.key)"
      >
        <span>{{ entry.key }}</span>
        <small>{{ entry.clip.loop ? `${entry.clip.fps}fps loop` : `${entry.clip.fps}fps once` }}</small>
      </button>
    </div>
  </section>
</template>
