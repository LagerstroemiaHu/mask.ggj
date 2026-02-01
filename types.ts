
export enum AppState {
  HOME = 'HOME',
  TRANSITION = 'TRANSITION',
  LEVEL_SELECT = 'LEVEL_SELECT',
  GAMEPLAY = 'GAMEPLAY'
}

export enum ShapeType {
  SQUARE = 'SQUARE',
  CIRCLE = 'CIRCLE',
  TRIANGLE = 'TRIANGLE',
  HEXAGON = 'HEXAGON',
  DIAMOND = 'DIAMOND',
  STAR = 'STAR'
}

export type AudioKey = 
  | 'bgm_level1_routine'
  | 'bgm_level1_resistance'
  | 'bgm_level2_factory'
  | 'bgm_level2_revolution'
  | 'sfx_level2_tap_1'
  | 'sfx_level2_tap_2'
  | 'bgm_level3_capital'
  | 'bgm_level3_resistance'
  | 'sfx_level3_coin'
  | 'sfx_level3_burn'
  | 'sfx_level3_drain'
  | 'bgm_level4_mall'
  | 'bgm_level4_resistance'
  | 'sfx_level4_buy'
  | 'bgm_level5_epiphany';

export interface LevelConfig {
  id: number;
  title: string;
  description: string;
  locked: boolean;
}

export interface StudentEntity {
  id: string;
  originalShape: ShapeType; // The true self
  visualStartingShape: ShapeType; // What they look like at the start of the current cycle
  color: string;
  rotationOffset: number;
  // Simulation properties
  conformity: number; // 0 to 1
  baseSpeed: number; // How fast they naturally conform
  morphSpeed: number; // How fast they visually transition to a NEW teacher shape (seconds)
  isPlayer: boolean;
  // New morphing logic states
  mode: 'CONFORMING' | 'REVERTING';
  previousTeacherShape?: ShapeType;
}

export interface TeacherEntity {
  shape: ShapeType;
  color: string;
}
