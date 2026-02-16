import * as THREE from 'three';
import { SplatAssetConfig } from '../config/schema';

export interface RendererContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  rootElement: HTMLElement;
}

export interface SplatRenderer {
  initialize(context: RendererContext): Promise<void>;
  loadSplat(asset: SplatAssetConfig): Promise<void>;
  setVisible(id: string, visible: boolean): void;
  clear(): Promise<void>;
  update(): void;
  render(): void;
  dispose(): Promise<void>;
}
