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
 * 新网格格式约定：每个精灵使用 pets/{petId}/{petId}.json。
 * 旧版 pet.json 已不再支持，配置必须是网格格式（含 sheet 字段）。
 */
function buildPetJsonUrl(petId: string): string {
  return buildPetUrl(`pets/${petId}/${petId}.json`);
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
 * 运行时校验：必须是新网格格式（包含 sheet 字段）。
 * 旧版 pet.json（显式帧枚举）已不再支持，遇到会直接抛错。
 */
function assertGridPetDefinition(raw: unknown): asserts raw is GridPetDefinition {
  if (
    typeof raw !== 'object'
    || raw === null
    || !('sheet' in raw)
    || typeof (raw as { sheet?: unknown }).sheet !== 'object'
  ) {
    throw new Error(
      '精灵配置必须是新网格格式（含 sheet 字段）。旧版 pet.json 已不再支持，请迁移到 {petId}.json 网格格式。',
    );
  }
}

export async function loadPetDefinition(petId: string) {
  const url = buildPetJsonUrl(petId);

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(
      `无法读取精灵配置：${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!response.ok) {
    throw new Error(`无法读取精灵配置：HTTP ${response.status}`);
  }

  const raw = await response.json();
  assertGridPetDefinition(raw);
  const petDefinition = convertGridPetDefinition(raw);

  return {
    ...petDefinition,
    spritesheetPath: buildPetAssetUrl(petId, petDefinition.spritesheetPath),
  } satisfies PetDefinition;
}
