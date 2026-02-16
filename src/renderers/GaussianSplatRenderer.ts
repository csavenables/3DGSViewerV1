import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import { SplatAssetConfig } from '../config/schema';
import { RendererContext, SplatFitData, SplatRenderer } from './types';

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
  private fitData: SplatFitData | null = null;

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
    this.fitData = null;
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
    this.fitData = null;
  }

  getFitData(): SplatFitData | null {
    if (this.fitData) {
      return {
        center: this.fitData.center.clone(),
        radius: this.fitData.radius,
      };
    }
    if (!this.viewer) {
      return null;
    }

    const box = new THREE.Box3();
    const temp = new THREE.Vector3();
    const transform = new THREE.Matrix4();
    let sampledPoints = 0;

    for (let sceneIndex = 0; sceneIndex < this.sceneIdOrder.length; sceneIndex += 1) {
      const scene = this.viewer.getSplatScene(sceneIndex);
      const count = scene.splatBuffer.getSplatCount();
      if (count <= 0) {
        continue;
      }

      transform.compose(scene.position, scene.quaternion, scene.scale);
      const maxSamplesPerScene = 20000;
      const step = Math.max(1, Math.floor(count / maxSamplesPerScene));
      for (let splatIndex = 0; splatIndex < count; splatIndex += step) {
        scene.splatBuffer.getSplatCenter(splatIndex, temp, transform);
        box.expandByPoint(temp);
        sampledPoints += 1;
      }
    }

    if (sampledPoints === 0 || box.isEmpty()) {
      return null;
    }

    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.1, center.distanceTo(box.max) * 1.15);
    this.fitData = { center, radius };
    return {
      center: center.clone(),
      radius,
    };
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
    this.fitData = null;
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
