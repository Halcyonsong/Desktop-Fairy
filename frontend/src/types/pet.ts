export type ViewMode = 'chat' | 'settings';

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
