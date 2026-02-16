declare module '@mkkellogg/gaussian-splats-3d' {
  import * as THREE from 'three';

  export const LogLevel: {
    None: number;
  };

  export const RenderMode: {
    Always: number;
    OnChange: number;
    Never: number;
  };

  export const SceneRevealMode: {
    Default: number;
    Gradual: number;
    Instant: number;
  };

  export interface ViewerOptions {
    selfDrivenMode?: boolean;
    useBuiltInControls?: boolean;
    renderer?: THREE.WebGLRenderer;
    camera?: THREE.Camera;
    threeScene?: THREE.Scene;
    rootElement?: HTMLElement;
    renderMode?: number;
    sceneRevealMode?: number;
    sharedMemoryForWorkers?: boolean;
    gpuAcceleratedSort?: boolean;
    logLevel?: number;
  }

  export interface AddSplatSceneOptions {
    showLoadingUI?: boolean;
    position?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    visible?: boolean;
    splatAlphaRemovalThreshold?: number;
  }

  export interface SplatBufferHandle {
    getSplatCount(): number;
    getSplatCenter(index: number, outCenter: THREE.Vector3, transform?: THREE.Matrix4): void;
    sceneCenter?: THREE.Vector3;
  }

  export interface SplatSceneHandle extends THREE.Object3D {
    visible: boolean;
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    scale: THREE.Vector3;
    splatBuffer: SplatBufferHandle;
  }

  export class Viewer {
    constructor(options?: ViewerOptions);
    addSplatScene(path: string, options?: AddSplatSceneOptions): Promise<void>;
    addSplatScenes(
      scenes: Array<AddSplatSceneOptions & { path: string }>,
      showLoadingUI?: boolean,
    ): Promise<void>;
    removeSplatScene(sceneIndex: number, showLoadingUI?: boolean): Promise<void>;
    getSplatScene(sceneIndex: number): SplatSceneHandle;
    forceRenderNextFrame(): void;
    update(): void;
    render(): void;
    dispose(): Promise<void>;
  }
}
