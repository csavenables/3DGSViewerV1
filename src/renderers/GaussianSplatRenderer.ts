import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import { SplatAssetConfig } from '../config/schema';
import {
  RendererContext,
  SplatFitData,
  SplatHandle,
  SplatRenderer,
  SplatRevealBounds,
  SplatRevealParams,
} from './types';

const SUPPORTED_EXTENSIONS = ['.ply', '.splat', '.ksplat', '.spz'] as const;
const MAX_REVEAL_SCENES = 32;
const REVEAL_PATCH_FLAG = '__splatRevealPatched';
const ENABLE_SHADER_REVEAL = false;

interface RevealMaterialBinding {
  material: THREE.ShaderMaterial;
  uniforms: {
    uRevealEnabled: { value: number[] };
    uRevealY: { value: number[] };
    uRevealBand: { value: number[] };
    uRevealMinY: { value: number[] };
    uRevealMaxY: { value: number[] };
    uRevealAffectAlpha: { value: number[] };
    uRevealAffectSize: { value: number[] };
  };
}

interface InternalViewer {
  splatMesh?: {
    material?: THREE.ShaderMaterial;
  };
}

interface RevealSceneObject extends THREE.Object3D {
  opacity?: number;
}

function toQuaternionArray(rotationDegrees: [number, number, number]): [number, number, number, number] {
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(rotationDegrees[0]),
    THREE.MathUtils.degToRad(rotationDegrees[1]),
    THREE.MathUtils.degToRad(rotationDegrees[2]),
  );
  const q = new THREE.Quaternion().setFromEuler(euler);
  return [q.x, q.y, q.z, q.w];
}

function makeRevealUniformArrays(defaultValue: number): number[] {
  return new Array(MAX_REVEAL_SCENES).fill(defaultValue);
}

export class GaussianSplatRenderer implements SplatRenderer {
  private viewer: GaussianSplats3D.Viewer | null = null;
  private sceneIdOrder: string[] = [];
  private handles: SplatHandle[] = [];
  private fitData: SplatFitData | null = null;
  private warnedRevealFallback = false;
  private revealBinding: RevealMaterialBinding | null = null;
  private sceneGraphMutating = false;
  private sceneMutationQueue: Promise<void> = Promise.resolve();

  async initialize(context: RendererContext): Promise<void> {
    this.viewer = this.createViewer(context);
  }

  async loadSplat(asset: SplatAssetConfig): Promise<SplatHandle> {
    const handles = await this.loadSplats([asset]);
    return handles[0];
  }

  async loadSplats(assets: SplatAssetConfig[]): Promise<SplatHandle[]> {
    if (!this.viewer) {
      throw new Error('Renderer not initialized.');
    }
    if (assets.length === 0) {
      return [];
    }
    if (this.sceneIdOrder.length + assets.length > MAX_REVEAL_SCENES) {
      throw new Error(`Reveal system supports up to ${MAX_REVEAL_SCENES} loaded splat handles.`);
    }
    this.ensureSupportedAssetFormats(assets);

    return this.withSceneMutation(async () => {
      const sceneIndexStart = this.sceneIdOrder.length;
      await this.loadAssetsWithViewer(assets);

      const newHandles: SplatHandle[] = [];
      for (let i = 0; i < assets.length; i += 1) {
        const sceneIndex = sceneIndexStart + i;
        const scene = this.viewer!.getSplatScene(sceneIndex);
        const handle = this.createSplatHandle(assets[i], scene, sceneIndex);
        newHandles.push(handle);
      }

      this.sceneIdOrder.push(...assets.map((asset) => asset.id));
      this.handles.push(...newHandles);
      this.fitData = null;
      this.viewer!.forceRenderNextFrame();
      return newHandles;
    });
  }

  setVisible(id: string, visible: boolean): void {
    const handle = this.handles.find((entry) => entry.id === id);
    if (!handle) {
      return;
    }
    handle.object3D.visible = visible;
    this.viewer?.forceRenderNextFrame();
  }

  async clear(): Promise<void> {
    if (!this.viewer) {
      return;
    }
    await this.withSceneMutation(async () => {
      for (let sceneIndex = this.sceneIdOrder.length - 1; sceneIndex >= 0; sceneIndex -= 1) {
        await this.viewer!.removeSplatScene(sceneIndex, false);
      }
      for (const handle of this.handles) {
        handle.dispose();
      }
      this.sceneIdOrder.length = 0;
      this.handles.length = 0;
      this.fitData = null;
      this.revealBinding = null;
      this.viewer!.forceRenderNextFrame();
    });
  }

  getFitData(): SplatFitData | null {
    if (this.fitData) {
      return {
        center: this.fitData.center.clone(),
        size: this.fitData.size.clone(),
        radius: this.fitData.radius,
      };
    }
    if (!this.viewer || this.handles.length === 0 || this.sceneGraphMutating) {
      return null;
    }

    const box = new THREE.Box3();
    const sample = new THREE.Vector3();
    const transform = new THREE.Matrix4();
    let sampledPoints = 0;

    for (let sceneIndex = 0; sceneIndex < this.handles.length; sceneIndex += 1) {
      const scene = this.viewer.getSplatScene(sceneIndex);
      if (!scene.visible) {
        continue;
      }
      transform.compose(scene.position, scene.quaternion, scene.scale);
      const count = scene.splatBuffer.getSplatCount();
      const maxSamplesPerScene = 15000;
      const step = Math.max(1, Math.floor(count / maxSamplesPerScene));
      for (let splatIndex = 0; splatIndex < count; splatIndex += step) {
        scene.splatBuffer.getSplatCenter(splatIndex, sample, transform);
        box.expandByPoint(sample);
        sampledPoints += 1;
      }
    }

    if (sampledPoints === 0 || box.isEmpty()) {
      return null;
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(0.6, center.distanceTo(box.max) * 1.1);
    this.fitData = { center: center.clone(), size: size.clone(), radius };
    return { center, size, radius };
  }

  update(): void {
    if (this.sceneGraphMutating) {
      return;
    }
    this.viewer?.update();
  }

  render(): void {
    if (this.sceneGraphMutating) {
      return;
    }
    this.viewer?.render();
  }

  async dispose(): Promise<void> {
    for (const handle of this.handles) {
      handle.dispose();
    }
    this.handles.length = 0;
    if (!this.viewer) {
      return;
    }
    await this.withSceneMutation(async () => {
      await this.viewer!.dispose();
    });
    this.viewer = null;
    this.sceneIdOrder = [];
    this.fitData = null;
    this.revealBinding = null;
  }

  private async withSceneMutation<T>(work: () => Promise<T>): Promise<T> {
    const run = this.sceneMutationQueue.then(async () => {
      this.sceneGraphMutating = true;
      try {
        return await work();
      } finally {
        this.sceneGraphMutating = false;
      }
    });
    this.sceneMutationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async loadAssetsWithViewer(assets: SplatAssetConfig[]): Promise<void> {
    if (!this.viewer) {
      throw new Error('Renderer not initialized.');
    }
    if (assets.length === 1) {
      const asset = assets[0];
      try {
        await this.viewer.addSplatScene(asset.src, {
          showLoadingUI: false,
          position: asset.transform.position,
          rotation: toQuaternionArray(asset.transform.rotation),
          scale: asset.transform.scale,
          opacity: 0,
          visible: asset.visibleDefault,
          splatAlphaRemovalThreshold: 1,
        });
      } catch (error) {
        throw new Error(this.buildAssetLoadErrorMessage([asset], error));
      }
      return;
    }

    try {
      await this.viewer.addSplatScenes(
        assets.map((asset) => ({
          path: asset.src,
          position: asset.transform.position,
          rotation: toQuaternionArray(asset.transform.rotation),
          scale: asset.transform.scale,
          opacity: 0,
          visible: asset.visibleDefault,
          splatAlphaRemovalThreshold: 1,
          showLoadingUI: false,
        })),
        false,
      );
    } catch (error) {
      throw new Error(this.buildAssetLoadErrorMessage(assets, error));
    }
  }

  private createSplatHandle(asset: SplatAssetConfig, object3D: THREE.Object3D, sceneIndex: number): SplatHandle {
    const bounds = this.computeBoundsFromObject(object3D);
    const revealBinding = this.ensureRevealPatch();

    const handle: SplatHandle = {
      id: asset.id,
      object3D,
      boundsY: { ...bounds },
      setRevealBounds: (nextBounds: SplatRevealBounds): void => {
        handle.boundsY = { ...nextBounds };
        if (revealBinding) {
          revealBinding.uniforms.uRevealMinY.value[sceneIndex] = nextBounds.minY;
          revealBinding.uniforms.uRevealMaxY.value[sceneIndex] = nextBounds.maxY;
        }
      },
      setRevealParams: (params: SplatRevealParams): void => {
        if (revealBinding) {
          revealBinding.uniforms.uRevealEnabled.value[sceneIndex] = params.enabled ? 1 : 0;
          revealBinding.uniforms.uRevealY.value[sceneIndex] = params.revealY;
          revealBinding.uniforms.uRevealBand.value[sceneIndex] = Math.max(0.0001, params.band);
          revealBinding.uniforms.uRevealAffectAlpha.value[sceneIndex] = params.affectAlpha ? 1 : 0;
          revealBinding.uniforms.uRevealAffectSize.value[sceneIndex] = params.affectSize ? 1 : 0;
        } else if (!this.warnedRevealFallback) {
          console.warn('Y-ramp shader reveal unavailable. Using scene opacity dissolve fallback.');
          this.warnedRevealFallback = true;
          this.applySceneOpacityReveal(object3D, params, handle.boundsY);
        } else {
          this.applySceneOpacityReveal(object3D, params, handle.boundsY);
        }
        this.viewer?.forceRenderNextFrame();
      },
      dispose: (): void => {
        if (revealBinding) {
          revealBinding.uniforms.uRevealEnabled.value[sceneIndex] = 0;
        }
      },
    };

    handle.setRevealBounds(bounds);
    return handle;
  }

  private computeBoundsFromObject(root: THREE.Object3D): SplatRevealBounds {
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) {
      return { minY: -1, maxY: 1 };
    }
    return { minY: box.min.y, maxY: box.max.y };
  }

  private ensureRevealPatch(): RevealMaterialBinding | null {
    if (!ENABLE_SHADER_REVEAL) {
      return null;
    }
    if (this.revealBinding) {
      return this.revealBinding;
    }
    const anyViewer = this.viewer as unknown as InternalViewer | null;
    const material = anyViewer?.splatMesh?.material;
    if (!material) {
      return null;
    }
    this.revealBinding = this.patchRevealMaterial(material);
    return this.revealBinding;
  }

  private patchRevealMaterial(material: THREE.ShaderMaterial): RevealMaterialBinding {
    const tagged = material as unknown as Record<string, unknown>;
    if (tagged[REVEAL_PATCH_FLAG] === true) {
      const existing = tagged.__splatRevealBinding as RevealMaterialBinding | undefined;
      if (existing) {
        return existing;
      }
    }

    const uniforms = {
      uRevealEnabled: { value: makeRevealUniformArrays(0) },
      uRevealY: { value: makeRevealUniformArrays(0) },
      uRevealBand: { value: makeRevealUniformArrays(0.12) },
      uRevealMinY: { value: makeRevealUniformArrays(-1) },
      uRevealMaxY: { value: makeRevealUniformArrays(1) },
      uRevealAffectAlpha: { value: makeRevealUniformArrays(1) },
      uRevealAffectSize: { value: makeRevealUniformArrays(1) },
    };

    material.uniforms.uRevealEnabled = uniforms.uRevealEnabled;
    material.uniforms.uRevealY = uniforms.uRevealY;
    material.uniforms.uRevealBand = uniforms.uRevealBand;
    material.uniforms.uRevealMinY = uniforms.uRevealMinY;
    material.uniforms.uRevealMaxY = uniforms.uRevealMaxY;
    material.uniforms.uRevealAffectAlpha = uniforms.uRevealAffectAlpha;
    material.uniforms.uRevealAffectSize = uniforms.uRevealAffectSize;

    material.vertexShader = injectRevealIntoVertexShader(material.vertexShader).shader;
    material.fragmentShader = injectRevealIntoFragmentShader(material.fragmentShader).shader;
    material.needsUpdate = true;

    const binding: RevealMaterialBinding = { material, uniforms };
    tagged[REVEAL_PATCH_FLAG] = true;
    tagged.__splatRevealBinding = binding;
    return binding;
  }

  private applySceneOpacityReveal(
    root: THREE.Object3D,
    params: SplatRevealParams,
    bounds: SplatRevealBounds,
  ): void {
    const range = Math.max(0.0001, bounds.maxY - bounds.minY);
    const revealProgress = Math.min(1, Math.max(0, (params.revealY - bounds.minY) / range));
    const sceneRoot = root as RevealSceneObject;
    if (typeof sceneRoot.opacity === 'number') {
      sceneRoot.opacity = params.enabled && params.affectAlpha ? revealProgress : 1;
      return;
    }

    root.traverse((node) => {
      const withMaterial = node as THREE.Object3D & { material?: THREE.Material | THREE.Material[] };
      if (!withMaterial.material) {
        return;
      }
      const materials = Array.isArray(withMaterial.material)
        ? withMaterial.material
        : [withMaterial.material];
      for (const material of materials) {
        const mat = material as THREE.Material & { opacity?: number; transparent?: boolean };
        if (typeof mat.opacity === 'number') {
          mat.transparent = true;
          mat.opacity = params.enabled && params.affectAlpha ? revealProgress : 1;
          mat.needsUpdate = true;
        }
      }
    });
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
      enableOptionalEffects: true,
      sharedMemoryForWorkers: false,
      gpuAcceleratedSort: false,
      logLevel: GaussianSplats3D.LogLevel.None,
    });
  }

  private ensureSupportedAssetFormats(assets: SplatAssetConfig[]): void {
    for (const asset of assets) {
      const extension = getAssetExtension(asset.src);
      if (!extension || !SUPPORTED_EXTENSIONS.includes(extension as (typeof SUPPORTED_EXTENSIONS)[number])) {
        throw new Error(
          `Unsupported asset format for "${asset.src}". Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}.`,
        );
      }
    }
  }

  private buildAssetLoadErrorMessage(assets: SplatAssetConfig[], error: unknown): string {
    const message = error instanceof Error ? error.message : 'Unknown renderer load error.';
    if (assets.length === 1) {
      return `Failed to load splat asset "${assets[0].src}". ${message}`;
    }
    const assetList = assets.map((asset) => asset.src).join(', ');
    return `Failed to load one or more splat assets [${assetList}]. ${message}`;
  }
}

function injectRevealIntoVertexShader(source: string): { shader: string } {
  let shader = source;
  if (!shader.includes('varying float vRevealWorldY;')) {
    shader = `varying float vRevealWorldY;\nvarying float vRevealSceneIndex;\n${shader}`;
  }

  if (shader.includes('uint sceneIndex = uint(0);')) {
    shader = shader.replace(
      'uint sceneIndex = uint(0);',
      'uint sceneIndex = uint(0);\n            vRevealSceneIndex = 0.0;',
    );
  }
  if (shader.includes('sceneIndex = texture(sceneIndexesTexture, getDataUV(1, 0, sceneIndexesTextureSize)).r;')) {
    shader = shader.replace(
      'sceneIndex = texture(sceneIndexesTexture, getDataUV(1, 0, sceneIndexesTextureSize)).r;',
      'sceneIndex = texture(sceneIndexesTexture, getDataUV(1, 0, sceneIndexesTextureSize)).r;\n                vRevealSceneIndex = float(sceneIndex);',
    );
  }
  if (shader.includes('vec3 splatCenter = uintBitsToFloat(uvec3(sampledCenterColor.gba));')) {
    shader = shader.replace(
      'vec3 splatCenter = uintBitsToFloat(uvec3(sampledCenterColor.gba));',
      'vec3 splatCenter = uintBitsToFloat(uvec3(sampledCenterColor.gba));\n            vRevealWorldY = splatCenter.y;',
    );
  }

  return { shader };
}

function injectRevealIntoFragmentShader(source: string): { shader: string } {
  let shader = source;
  if (!shader.includes('varying float vRevealWorldY;')) {
    shader = `varying float vRevealWorldY;\nvarying float vRevealSceneIndex;\n${shader}`;
  }
  if (!shader.includes('uniform float uRevealEnabled[32];')) {
    shader =
      `uniform float uRevealEnabled[32];\n` +
      `uniform float uRevealY[32];\n` +
      `uniform float uRevealBand[32];\n` +
      `uniform float uRevealMinY[32];\n` +
      `uniform float uRevealMaxY[32];\n` +
      `uniform float uRevealAffectAlpha[32];\n` +
      `uniform float uRevealAffectSize[32];\n` +
      shader;
  }

  const revealSnippet =
    '\n  int revealScene = int(vRevealSceneIndex + 0.5);\n' +
    '  revealScene = clamp(revealScene, 0, 31);\n' +
    '  float revealBand = max(0.0001, uRevealBand[revealScene]);\n' +
    '  float revealRamp = smoothstep(uRevealY[revealScene] - revealBand, uRevealY[revealScene] + revealBand, vRevealWorldY);\n' +
    '  if (uRevealEnabled[revealScene] > 0.5 && uRevealAffectAlpha[revealScene] > 0.5) {\n' +
    '    gl_FragColor.a *= revealRamp;\n' +
    '  }\n';

  if (shader.includes('#include <dithering_fragment>')) {
    shader = shader.replace(
      '#include <dithering_fragment>',
      `${revealSnippet}\n  #include <dithering_fragment>`,
    );
  } else {
    shader = shader.replace(/\}\s*$/, `${revealSnippet}\n}`);
  }

  return { shader };
}

function getAssetExtension(path: string): string | null {
  const clean = path.split('?')[0].split('#')[0];
  const dotIndex = clean.lastIndexOf('.');
  if (dotIndex < 0) {
    return null;
  }
  return clean.slice(dotIndex).toLowerCase();
}
