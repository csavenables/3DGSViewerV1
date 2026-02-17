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
const REVEAL_PATCH_FLAG = '__splatRevealPatched';
const REVEAL_UNIFORMS = {
  uRevealEnabled: { value: 0 },
  uRevealY: { value: 0 },
  uRevealBand: { value: 0.12 },
  uRevealMinY: { value: -1 },
  uRevealMaxY: { value: 1 },
  uRevealAffectAlpha: { value: 1 },
  uRevealAffectSize: { value: 1 },
};

interface RevealMaterialBinding {
  material: THREE.Material;
  uniforms: {
    uRevealEnabled: { value: number };
    uRevealY: { value: number };
    uRevealBand: { value: number };
    uRevealMinY: { value: number };
    uRevealMaxY: { value: number };
    uRevealAffectAlpha: { value: number };
    uRevealAffectSize: { value: number };
  };
}

interface ShaderLike {
  uniforms: Record<string, unknown>;
  vertexShader: string;
  fragmentShader: string;
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

export class GaussianSplatRenderer implements SplatRenderer {
  private viewer: GaussianSplats3D.Viewer | null = null;
  private sceneIdOrder: string[] = [];
  private handles: SplatHandle[] = [];
  private fitData: SplatFitData | null = null;
  private warnedRevealFallback = false;

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
    this.ensureSupportedAssetFormats(assets);

    const sceneIndexStart = this.sceneIdOrder.length;
    await this.loadAssetsWithViewer(assets);

    const newHandles: SplatHandle[] = [];
    for (let i = 0; i < assets.length; i += 1) {
      const sceneIndex = sceneIndexStart + i;
      const scene = this.viewer.getSplatScene(sceneIndex);
      const handle = this.createSplatHandle(assets[i], scene);
      newHandles.push(handle);
    }

    this.sceneIdOrder.push(...assets.map((asset) => asset.id));
    this.handles.push(...newHandles);
    this.fitData = null;
    this.viewer.forceRenderNextFrame();
    return newHandles;
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
    for (let sceneIndex = this.sceneIdOrder.length - 1; sceneIndex >= 0; sceneIndex -= 1) {
      await this.viewer.removeSplatScene(sceneIndex, false);
    }
    for (const handle of this.handles) {
      handle.dispose();
    }
    this.sceneIdOrder.length = 0;
    this.handles.length = 0;
    this.fitData = null;
    this.viewer.forceRenderNextFrame();
  }

  getFitData(): SplatFitData | null {
    if (this.fitData) {
      return {
        center: this.fitData.center.clone(),
        size: this.fitData.size.clone(),
        radius: this.fitData.radius,
      };
    }
    if (this.handles.length === 0) {
      return null;
    }

    const box = new THREE.Box3();
    for (const handle of this.handles) {
      const objectBox = new THREE.Box3().setFromObject(handle.object3D);
      if (!objectBox.isEmpty()) {
        box.union(objectBox);
      }
    }

    if (box.isEmpty()) {
      return null;
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(0.6, center.distanceTo(box.max) * 1.1);
    this.fitData = { center: center.clone(), size: size.clone(), radius };
    return { center, size, radius };
  }

  update(): void {
    this.viewer?.update();
  }

  render(): void {
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
    await this.viewer.dispose();
    this.viewer = null;
    this.sceneIdOrder = [];
    this.fitData = null;
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

  private createSplatHandle(asset: SplatAssetConfig, object3D: THREE.Object3D): SplatHandle {
    const bounds = this.computeBoundsFromObject(object3D);
    const revealBindings = this.tryAttachRevealPatch(object3D);

    const handle: SplatHandle = {
      id: asset.id,
      object3D,
      boundsY: { ...bounds },
      setRevealBounds: (nextBounds: SplatRevealBounds): void => {
        handle.boundsY = { ...nextBounds };
        for (const binding of revealBindings) {
          binding.uniforms.uRevealMinY.value = nextBounds.minY;
          binding.uniforms.uRevealMaxY.value = nextBounds.maxY;
        }
      },
      setRevealParams: (params: SplatRevealParams): void => {
        if (revealBindings.length > 0) {
          for (const binding of revealBindings) {
            binding.uniforms.uRevealEnabled.value = params.enabled ? 1 : 0;
            binding.uniforms.uRevealY.value = params.revealY;
            binding.uniforms.uRevealBand.value = Math.max(0.0001, params.band);
            binding.uniforms.uRevealAffectAlpha.value = params.affectAlpha ? 1 : 0;
            binding.uniforms.uRevealAffectSize.value = params.affectSize ? 1 : 0;
          }
        } else {
          this.applyFallbackAlphaReveal(object3D, params, handle.boundsY);
        }
        this.viewer?.forceRenderNextFrame();
      },
      dispose: (): void => {
        for (const binding of revealBindings) {
          const anyMat = binding.material as unknown as Record<string, unknown>;
          anyMat[REVEAL_PATCH_FLAG] = false;
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

  private tryAttachRevealPatch(root: THREE.Object3D): RevealMaterialBinding[] {
    const bindings: RevealMaterialBinding[] = [];
    root.traverse((node) => {
      const withMaterial = node as THREE.Object3D & { material?: THREE.Material | THREE.Material[] };
      if (!withMaterial.material) {
        return;
      }
      const materials = Array.isArray(withMaterial.material)
        ? withMaterial.material
        : [withMaterial.material];
      for (const material of materials) {
        const binding = this.patchRevealMaterial(material);
        if (binding) {
          bindings.push(binding);
        }
      }
    });
    return bindings;
  }

  private patchRevealMaterial(material: THREE.Material): RevealMaterialBinding | null {
    const tagged = material as unknown as Record<string, unknown>;
    if (tagged[REVEAL_PATCH_FLAG] === true) {
      const existing = tagged.__splatRevealBinding as RevealMaterialBinding | undefined;
      return existing ?? null;
    }

    const uniforms = {
      uRevealEnabled: { ...REVEAL_UNIFORMS.uRevealEnabled },
      uRevealY: { ...REVEAL_UNIFORMS.uRevealY },
      uRevealBand: { ...REVEAL_UNIFORMS.uRevealBand },
      uRevealMinY: { ...REVEAL_UNIFORMS.uRevealMinY },
      uRevealMaxY: { ...REVEAL_UNIFORMS.uRevealMaxY },
      uRevealAffectAlpha: { ...REVEAL_UNIFORMS.uRevealAffectAlpha },
      uRevealAffectSize: { ...REVEAL_UNIFORMS.uRevealAffectSize },
    };

    material.onBeforeCompile = (shader: ShaderLike) => {
      shader.uniforms.uRevealEnabled = uniforms.uRevealEnabled;
      shader.uniforms.uRevealY = uniforms.uRevealY;
      shader.uniforms.uRevealBand = uniforms.uRevealBand;
      shader.uniforms.uRevealMinY = uniforms.uRevealMinY;
      shader.uniforms.uRevealMaxY = uniforms.uRevealMaxY;
      shader.uniforms.uRevealAffectAlpha = uniforms.uRevealAffectAlpha;
      shader.uniforms.uRevealAffectSize = uniforms.uRevealAffectSize;

      const vertexResult = injectRevealIntoVertexShader(shader.vertexShader);
      const fragmentResult = injectRevealIntoFragmentShader(shader.fragmentShader);
      shader.vertexShader = vertexResult.shader;
      shader.fragmentShader = fragmentResult.shader;
    };

    material.needsUpdate = true;

    const binding: RevealMaterialBinding = {
      material,
      uniforms,
    };

    tagged[REVEAL_PATCH_FLAG] = true;
    tagged.__splatRevealBinding = binding;
    return binding;
  }

  private applyFallbackAlphaReveal(
    root: THREE.Object3D,
    params: SplatRevealParams,
    bounds: SplatRevealBounds,
  ): void {
    if (!this.warnedRevealFallback) {
      console.warn('Splat reveal shader injection unavailable. Falling back to global alpha fade.');
      this.warnedRevealFallback = true;
    }
    const range = Math.max(0.0001, bounds.maxY - bounds.minY);
    const revealProgress = Math.min(1, Math.max(0, (params.revealY - bounds.minY) / range));

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
    shader = `varying float vRevealWorldY;\n${shader}`;
  }

  if (shader.includes('#include <begin_vertex>')) {
    shader = shader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vRevealWorldY = (modelMatrix * vec4(transformed, 1.0)).y;',
    );
  } else {
    shader = shader.replace(
      /void\s+main\s*\(\)\s*{/,
      'void main() {\n  vec3 revealPosition = position;\n  vRevealWorldY = (modelMatrix * vec4(revealPosition, 1.0)).y;',
    );
  }
  return { shader };
}

function injectRevealIntoFragmentShader(source: string): { shader: string } {
  let shader = source;
  if (!shader.includes('varying float vRevealWorldY;')) {
    shader = `varying float vRevealWorldY;\n${shader}`;
  }
  if (!shader.includes('uniform float uRevealEnabled;')) {
    shader =
      `uniform float uRevealEnabled;\n` +
      `uniform float uRevealY;\n` +
      `uniform float uRevealBand;\n` +
      `uniform float uRevealMinY;\n` +
      `uniform float uRevealMaxY;\n` +
      `uniform float uRevealAffectAlpha;\n` +
      `uniform float uRevealAffectSize;\n` +
      shader;
  }

  const revealSnippet =
    '\n  float revealBand = max(0.0001, uRevealBand);\n' +
    '  float revealRamp = smoothstep(uRevealY - revealBand, uRevealY + revealBand, vRevealWorldY);\n' +
    '  if (uRevealEnabled > 0.5 && uRevealAffectAlpha > 0.5) {\n' +
    '    gl_FragColor.a *= revealRamp;\n' +
    '  }\n';

  if (shader.includes('#include <dithering_fragment>')) {
    shader = shader.replace('#include <dithering_fragment>', `${revealSnippet}\n  #include <dithering_fragment>`);
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
