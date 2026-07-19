export type ViewMode = 'chat' | 'settings';

// ===== 旧格式类型（显式帧枚举）=====

export interface PetFrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PetAnimationClip {
  fps: number;
  loop: boolean;
  frames: number[];
}

export interface PetDefinition {
  id: string;
  displayName: string;
  description?: string;
  spritesheetPath: string;
  schemaVersion: number;
  canvas: {
    width: number;
    height: number;
  };
  defaultAnimation: string;
  anchor?: {
    x: number;
    y: number;
  };
  frames: PetFrameRect[];
  animations: Record<string, PetAnimationClip>;
}

// ===== 新网格格式类型（row + frameCount + playOrder）=====

export interface PetSheetConfig {
  width: number;
  height: number;
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
}

export type PetPlayOrder = 'left-to-right' | 'right-to-left' | 'ping-pong';

export interface GridPetAnimationClip {
  row: number;
  frameCount: number;
  fps: number;
  loop: boolean;
  playOrder?: PetPlayOrder;
}

export interface GridPetDefinition {
  id: string;
  displayName: string;
  description?: string;
  spritesheetPath: string;
  schemaVersion: number;
  defaultAnimation: string;
  sheet: PetSheetConfig;
  anchor?: {
    x: number;
    y: number;
  };
  animations: Record<string, GridPetAnimationClip>;
}
