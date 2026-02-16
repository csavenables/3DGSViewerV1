import * as THREE from 'three';
import { SplatAssetConfig } from '../config/schema';

export interface SplatFitData {
  center: THREE.Vector3;
  radius: number;
}

export interface RendererContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  rootElement: HTMLElement;
}

export interface SplatRenderer {
  initialize(context: RendererContext): Promise<void>;
  loadSplats(assets: SplatAssetConfig[]): Promise<void>;
  loadSplat(asset: SplatAssetConfig): Promise<void>;
  setVisible(id: string, visible: boolean): void;
  clear(): Promise<void>;
  getFitData(): SplatFitData | null;
  update(): void;
  render(): void;
  dispose(): Promise<void>;
}
