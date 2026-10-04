import * as THREE from 'three';
import type { Particle } from './algorithms/BaseAlgorithm';

export class ParticleRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10);
  private readonly geometry: THREE.BufferGeometry;
  private readonly positions: THREE.BufferAttribute;
  private readonly colors: THREE.BufferAttribute;
  private readonly points: THREE.Points;
  private width = 1;
  private height = 1;

  constructor(canvas: HTMLCanvasElement, count: number) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x080b14, 0);

    this.geometry = new THREE.BufferGeometry();
    this.positions = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    this.colors = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    this.positions.setUsage(THREE.DynamicDrawUsage);
    this.colors.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positions);
    this.geometry.setAttribute('color', this.colors);

    const material = new THREE.PointsMaterial({
      size: 2.5,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.resize(canvas.clientWidth, canvas.clientHeight);
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.left = 0;
    this.camera.right = this.width;
    this.camera.top = 0;
    this.camera.bottom = this.height;
    this.camera.updateProjectionMatrix();
  }

  setParticleCount(count: number): void {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const position = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const color = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    position.setUsage(THREE.DynamicDrawUsage);
    color.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setDrawRange(0, count);
  }

  render(particles: Particle[]): void {
    const position = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const color = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    const positionArray = position.array as Float32Array;
    const colorArray = color.array as Float32Array;
    for (let i = 0; i < particles.length; i += 1) {
      const particle = particles[i]!;
      const offset = i * 3;
      positionArray[offset] = particle.x;
      positionArray[offset + 1] = particle.y;
      positionArray[offset + 2] = 0;
      colorArray[offset] = particle.r;
      colorArray[offset + 1] = particle.g;
      colorArray[offset + 2] = particle.b;
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.renderer.dispose();
  }
}
