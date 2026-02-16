import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CameraHomeConfig, CameraLimitsConfig } from '../config/schema';
import { easeInOutCubic } from '../utils/easing';

interface ResetAnimation {
  startTime: number;
  durationMs: number;
  fromPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toPosition: THREE.Vector3;
  toTarget: THREE.Vector3;
}

export class CameraController {
  private readonly controls: OrbitControls;
  private resetAnimation: ResetAnimation | null = null;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
  ) {
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
  }

  applyLimits(limits: CameraLimitsConfig, enablePan: boolean): void {
    this.controls.minDistance = limits.minDistance;
    this.controls.maxDistance = limits.maxDistance;
    this.controls.minPolarAngle = limits.minPolarAngle;
    this.controls.maxPolarAngle = limits.maxPolarAngle;
    this.controls.enablePan = enablePan;
  }

  setAutoRotate(enabled: boolean): void {
    this.controls.autoRotate = enabled;
    this.controls.autoRotateSpeed = 1;
  }

  resetToHome(home: CameraHomeConfig, durationMs: number): void {
    this.resetAnimation = {
      startTime: performance.now(),
      durationMs,
      fromPosition: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      toPosition: new THREE.Vector3(...home.position),
      toTarget: new THREE.Vector3(...home.target),
    };
  }

  setHomeImmediately(home: CameraHomeConfig): void {
    this.camera.position.set(...home.position);
    this.controls.target.set(...home.target);
    this.camera.fov = home.fov;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  update(nowMs: number): void {
    if (this.resetAnimation) {
      const elapsed = nowMs - this.resetAnimation.startTime;
      const t = Math.min(1, elapsed / this.resetAnimation.durationMs);
      const eased = easeInOutCubic(t);

      this.camera.position.lerpVectors(
        this.resetAnimation.fromPosition,
        this.resetAnimation.toPosition,
        eased,
      );
      this.controls.target.lerpVectors(
        this.resetAnimation.fromTarget,
        this.resetAnimation.toTarget,
        eased,
      );

      if (t >= 1) {
        this.resetAnimation = null;
      }
    }

    this.controls.update();
  }

  dispose(): void {
    this.controls.dispose();
  }
}
