import { BaseAlgorithm } from './BaseAlgorithm';

export interface VortexSettings {
  attractionStrength: number;
  swirlStrength: number;
  turbulence: number;
  damping: number;
}

const DEFAULT_SETTINGS: VortexSettings = {
  attractionStrength: 220,
  swirlStrength: 180,
  turbulence: 24,
  damping: 0.12,
};

export class VortexAlgorithm extends BaseAlgorithm {
  settings: VortexSettings = { ...DEFAULT_SETTINGS };
  private angles: Float32Array;

  constructor(count: number) {
    super(count);
    this.angles = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const particle = this.particles[i]!;
      particle.vx = (Math.random() - 0.5) * 18;
      particle.vy = (Math.random() - 0.5) * 18;
      this.angles[i] = Math.random() * Math.PI * 2;
    }
  }

  setSettings(settings: Partial<VortexSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  update(deltaSeconds: number): void {
    const time = performance.now() * 0.001;
    const attractorCount = 4;
    const damping = 1 - Math.min(0.2, this.settings.damping * deltaSeconds);

    for (let i = 0; i < this.particles.length; i += 1) {
      const particle = this.particles[i]!;
      let totalForceX = 0;
      let totalForceY = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      let nearestX = this.width * 0.5;
      let nearestY = this.height * 0.5;

      for (let attractorIndex = 0; attractorIndex < attractorCount; attractorIndex += 1) {
        const phase = attractorIndex * (Math.PI / 2);
        const attractorX =
          this.width * 0.5 +
          Math.cos(time * (0.65 + attractorIndex * 0.1) + phase) * this.width * (0.2 + attractorIndex * 0.06);
        const attractorY =
          this.height * 0.5 +
          Math.sin(time * (0.8 + attractorIndex * 0.12) + phase) * this.height * (0.18 + attractorIndex * 0.04);

        let dx = attractorX - particle.x;
        let dy = attractorY - particle.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestX = attractorX;
          nearestY = attractorY;
        }
        const pull = this.settings.attractionStrength / (distance + 70);
        const directionX = dx / distance;
        const directionY = dy / distance;
        const tangentX = -directionY;
        const tangentY = directionX;
        totalForceX += directionX * pull + tangentX * this.settings.swirlStrength * 0.018;
        totalForceY += directionY * pull + tangentY * this.settings.swirlStrength * 0.018;
      }

      const turbulence =
        Math.sin((particle.x + time * 60) * 0.015) +
        Math.cos((particle.y - time * 50) * 0.017) +
        Math.sin((particle.x * 0.015 + particle.y * 0.02 + time) * 2.1);
      const angleBias = this.angles[i]! + time * 2.2;
      totalForceX += Math.cos(angleBias) * this.settings.turbulence * turbulence * 0.15;
      totalForceY += Math.sin(angleBias) * this.settings.turbulence * turbulence * 0.15;

      const dxCenter = nearestX - particle.x;
      const dyCenter = nearestY - particle.y;
      const centerDistance = Math.hypot(dxCenter, dyCenter) || 1;
      const centerPull = 28 / (centerDistance + 20);
      totalForceX += (dxCenter / centerDistance) * centerPull;
      totalForceY += (dyCenter / centerDistance) * centerPull;

      particle.vx = (particle.vx + totalForceX * deltaSeconds) * damping;
      particle.vy = (particle.vy + totalForceY * deltaSeconds) * damping;

      const speed = Math.hypot(particle.vx, particle.vy);
      const clampSpeed = 120;
      if (speed > clampSpeed) {
        const scale = clampSpeed / speed;
        particle.vx *= scale;
        particle.vy *= scale;
      }

      particle.x = wrap(particle.x + particle.vx * deltaSeconds, this.width);
      particle.y = wrap(particle.y + particle.vy * deltaSeconds, this.height);

      const intensity = Math.min(1, speed / 120);
      particle.r = 0.3 + intensity * 0.7;
      particle.g = 0.72 + (1 - intensity) * 0.18;
      particle.b = 0.95 - intensity * 0.2;
    }
  }
}

function wrap(value: number, limit: number): number {
  return (value + limit) % limit;
}
