import type {
  GridPetAnimationClip,
  GridPetDefinition,
  PetAnimationClip,
  PetDefinition,
  PetFrameRect,
  PetPlayOrder,
  PetSheetConfig,
} from '@/types/pet';

function buildPetUrl(pathname: string) {
  return new URL(pathname.replace(/^\/+/, ''), window.location.href).href;
}

/**
 * 优先加载 {petId}.json（新网格格式约定），失败则回退到 pet.json（旧格式）。
 * 这样既能支持新素材约定，又能兼容旧素材。
 */
function buildPetJsonUrls(petId: string): string[] {
  return [
    buildPetUrl(`pets/${petId}/${petId}.json`),
    buildPetUrl(`pets/${petId}/pet.json`),
  ];
}

function buildPetAssetUrl(petId: string, relativePath: string) {
  if (/^(https?:)?\/\//i.test(relativePath) || relativePath.startsWith('file:') || relativePath.startsWith('data:')) {
    return relativePath;
  }

  return buildPetUrl(`pets/${petId}/${relativePath.replace(/^\.\//, '')}`);
}

// ===== 新网格格式 → 内部 PetDefinition 的转换 =====

/**
 * 把网格配置展开为完整的帧矩形列表。
 * 帧索引按行优先：第 0 行第 0 列 = 索引 0，第 0 行第 1 列 = 索引 1，依此推。
 */
function expandGridToFrames(sheet: PetSheetConfig): PetFrameRect[] {
  const frames: PetFrameRect[] = [];
  for (let row = 0; row < sheet.rows; row++) {
    for (let col = 0; col < sheet.columns; col++) {
      frames.push({
        x: col * sheet.cellWidth,
        y: row * sheet.cellHeight,
        w: sheet.cellWidth,
        h: sheet.cellHeight,
      });
    }
  }
  return frames;
}

/**
 * 根据 playOrder 把 row + frameCount 展开为帧索引序列。
 *   - left-to-right: [0, 1, 2, 3, ...]
 *   - right-to-left: [N-1, N-2, ..., 1, 0]
 *   - ping-pong: [0, 1, 2, ..., N-1, N-2, ..., 1]（来回播放）
 */
function expandAnimationFrames(
  animation: GridPetAnimationClip,
  columns: number,
): number[] {
  const baseIndex = animation.row * columns;
  const indices = Array.from(
    { length: animation.frameCount },
    (_, i) => baseIndex + i,
  );

  const playOrder: PetPlayOrder = animation.playOrder ?? 'left-to-right';
  switch (playOrder) {
    case 'right-to-left':
      return [...indices].reverse();
    case 'ping-pong':
      // 去首尾后再反向，避免首尾帧重复播放
      return [...indices, ...indices.slice(1, -1).reverse()];
    case 'left-to-right':
    default:
      return indices;
  }
}

/**
 * 把新网格格式定义转换为内部使用的 PetDefinition。
 * usePetPlayer 只认 PetDefinition（显式帧索引），所以这里做一次展开。
 */
function convertGridPetDefinition(grid: GridPetDefinition): PetDefinition {
  const frames = expandGridToFrames(grid.sheet);
  const animations: Record<string, PetAnimationClip> = {};

  for (const [name, clip] of Object.entries(grid.animations)) {
    animations[name] = {
      fps: clip.fps,
      loop: clip.loop,
      frames: expandAnimationFrames(clip, grid.sheet.columns),
    };
  }

  return {
    id: grid.id,
    displayName: grid.displayName,
    description: grid.description,
    spritesheetPath: grid.spritesheetPath,
    schemaVersion: grid.schemaVersion,
    canvas: {
      width: grid.sheet.width,
      height: grid.sheet.height,
    },
    defaultAnimation: grid.defaultAnimation,
    anchor: grid.anchor,
    frames,
    animations,
  };
}

/**
 * 检测 JSON 是否为新网格格式（包含 sheet 字段）。
 */
function isGridPetDefinition(raw: unknown): raw is GridPetDefinition {
  return (
    typeof raw === 'object'
    && raw !== null
    && 'sheet' in raw
    && typeof (raw as { sheet?: unknown }).sheet === 'object'
  );
}

export async function loadPetDefinition(petId: string) {
  const candidates = buildPetJsonUrls(petId);
  let lastError: unknown = null;
  let response: Response | null = null;

  // 依次尝试候选地址，直到成功
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        response = res;
        break;
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    throw new Error(
      `无法读取精灵配置：${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
  }

  const raw = await response.json();

  // 新网格格式展开为内部 PetDefinition；旧格式直接使用
  let petDefinition: PetDefinition;
  if (isGridPetDefinition(raw)) {
    petDefinition = convertGridPetDefinition(raw);
  } else {
    petDefinition = raw as PetDefinition;
  }

  return {
    ...petDefinition,
    spritesheetPath: buildPetAssetUrl(petId, petDefinition.spritesheetPath),
  } satisfies PetDefinition;
}
