import * as THREE from 'three';
import { RevealConfig, SplatAssetConfig } from '../config/schema';

export interface SplatFitData {
  center: THREE.Vector3;
  size: THREE.Vector3;
  radius: number;
}

export interface SplatRevealBounds {
  minY: number;
  maxY: number;
}

export interface SplatRevealParams {
  enabled: boolean;
  revealY: number;
  band: number;
  affectAlpha: boolean;
  affectSize: boolean;
}

export interface SplatHandle {
  id: string;
  object3D: THREE.Object3D;
  boundsY: SplatRevealBounds;
  setRevealParams(params: SplatRevealParams): void;
  setRevealBounds(bounds: SplatRevealBounds): void;
  dispose(): void;
}

export const REVEAL_CONFIG_DEFAULTS: RevealConfig = {
  enabled: false,
  mode: 'yRamp',
  durationMs: 450,
  band: 0.12,
  ease: 'easeInOut',
  affectAlpha: true,
  affectSize: true,
  startPadding: 0,
  endPadding: 0,
};

export interface RendererContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  rootElement: HTMLElement;
}

export interface SplatRenderer {
  initialize(context: RendererContext): Promise<void>;
  loadSplats(assets: SplatAssetConfig[]): Promise<SplatHandle[]>;
  loadSplat(asset: SplatAssetConfig): Promise<SplatHandle>;
  setVisible(id: string, visible: boolean): void;
  clear(): Promise<void>;
  getFitData(): SplatFitData | null;
  update(): void;
  render(): void;
  dispose(): Promise<void>;
}
