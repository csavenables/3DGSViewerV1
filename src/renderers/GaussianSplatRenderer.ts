import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import { SplatAssetConfig } from '../config/schema';
import { RendererContext, SplatRenderer } from './types';

function toQuaternionArray(rotationDegrees: [number, number, number]): [number, number, number, number] {
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(rotationDegrees[0]),
    THREE.MathUtils.degToRad(rotationDegrees[1]),
    THREE.MathUtils.degToRad(rotationDegrees[2]),
  );
  const q = new THREE.Quaternion().setFromEuler(euler);
  return [q.x, q.y, q.z, q.w];
}

export class GaussianSplatRenderer implements SplatRenderer {
  private context: RendererContext | null = null;
  private viewer: GaussianSplats3D.Viewer | null = null;
  private sceneIdOrder: string[] = [];

  async initialize(context: RendererContext): Promise<void> {
    this.context = context;
    this.viewer = this.createViewer(context);
  }

  async loadSplat(asset: SplatAssetConfig): Promise<void> {
    if (!this.viewer) {
      throw new Error('Renderer not initialized.');
    }

    await this.viewer.addSplatScene(asset.src, {
      showLoadingUI: false,
      position: asset.transform.position,
      rotation: toQuaternionArray(asset.transform.rotation),
      scale: asset.transform.scale,
      visible: asset.visibleDefault,
      splatAlphaRemovalThreshold: 1,
    });

    this.sceneIdOrder.push(asset.id);
    this.viewer.forceRenderNextFrame();
  }

  setVisible(id: string, visible: boolean): void {
    if (!this.viewer) {
      return;
    }

    const sceneIndex = this.sceneIdOrder.indexOf(id);
    if (sceneIndex < 0) {
      return;
    }

    const splatScene = this.viewer.getSplatScene(sceneIndex);
    splatScene.visible = visible;
    this.viewer.forceRenderNextFrame();
  }

  async clear(): Promise<void> {
    if (!this.context || !this.viewer) {
      return;
    }

    await this.viewer.dispose();
    this.viewer = this.createViewer(this.context);
    this.sceneIdOrder = [];
  }

  update(): void {
    this.viewer?.update();
  }

  render(): void {
    this.viewer?.render();
  }

  async dispose(): Promise<void> {
    if (!this.viewer) {
      return;
    }
    await this.viewer.dispose();
    this.viewer = null;
    this.context = null;
    this.sceneIdOrder = [];
  }

  private createViewer(context: RendererContext): GaussianSplats3D.Viewer {
    return new GaussianSplats3D.Viewer({
      selfDrivenMode: false,
      useBuiltInControls: false,
      renderer: context.renderer,
      camera: context.camera,
      threeScene: context.scene,
      rootElement: context.rootElement,
      renderMode: GaussianSplats3D.RenderMode.Always,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
      sharedMemoryForWorkers: false,
      gpuAcceleratedSort: false,
      logLevel: GaussianSplats3D.LogLevel.None,
    });
  }
}
