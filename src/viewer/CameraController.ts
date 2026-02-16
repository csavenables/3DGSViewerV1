import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CameraHomeConfig, CameraLimitsConfig } from '../config/schema';
import { clamp } from '../utils/clamp';
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

  getCurrentHome(): CameraHomeConfig {
    return {
      position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      target: [this.controls.target.x, this.controls.target.y, this.controls.target.z],
      fov: this.camera.fov,
    };
  }

  frameTarget(
    target: THREE.Vector3,
    size: THREE.Vector3,
    radius: number,
    fovDegrees: number,
    limits: CameraLimitsConfig,
    referenceDirection: THREE.Vector3,
  ): number {
    const direction = referenceDirection.clone().normalize();
    if (direction.lengthSq() === 0) {
      direction.set(0, 0, 1);
    }

    const halfVerticalFov = Math.max(0.01, THREE.MathUtils.degToRad(fovDegrees * 0.5));
    const halfHorizontalFov = Math.max(0.01, Math.atan(Math.tan(halfVerticalFov) * this.camera.aspect));
    const halfWidth = Math.max(0.001, size.x * 0.5);
    const halfHeight = Math.max(0.001, size.y * 0.5);

    // Fit by projected box dimensions first, then fall back to sphere fit for depth safety.
    const distanceForHeight = halfHeight / Math.tan(halfVerticalFov);
    const distanceForWidth = halfWidth / Math.tan(halfHorizontalFov);
    const distanceForSphere = radius / Math.sin(Math.min(halfVerticalFov, halfHorizontalFov));
    const desiredDistance = Math.max(distanceForHeight, distanceForWidth, distanceForSphere) * 1.1;
    const distance = clamp(desiredDistance, limits.minDistance, limits.maxDistance);

    this.controls.target.copy(target);
    this.camera.position.copy(target.clone().add(direction.multiplyScalar(distance)));
    this.camera.fov = fovDegrees;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    return distance;
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
