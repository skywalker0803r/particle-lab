import { BaseAlgorithm } from './BaseAlgorithm';

export interface FlowFieldSettings {
  strength: number;
  fieldScale: number;
  drift: number;
  damping: number;
}

const DEFAULT_SETTINGS: FlowFieldSettings = {
  strength: 120,
  fieldScale: 6,
  drift: 0.8,
  damping: 0.16,
};

export class FlowFieldAlgorithm extends BaseAlgorithm {
  settings: FlowFieldSettings = { ...DEFAULT_SETTINGS };
  private seed: Float32Array;

  constructor(count: number) {
    super(count);
    this.seed = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const particle = this.particles[i]!;
      particle.vx = (Math.random() - 0.5) * 36;
      particle.vy = (Math.random() - 0.5) * 36;
      this.seed[i] = Math.random() * Math.PI * 2;
    }
  }

  setSettings(settings: Partial<FlowFieldSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  update(deltaSeconds: number): void {
    const time = performance.now() * 0.001;
    const damping = 1 - Math.min(0.28, this.settings.damping * deltaSeconds);

    for (let i = 0; i < this.particles.length; i += 1) {
      const particle = this.particles[i]!;
      const nx = particle.x / Math.max(1, this.width);
      const ny = particle.y / Math.max(1, this.height);

      const waveA = Math.sin((nx * this.settings.fieldScale + time * this.settings.drift) * 3.6);
      const waveB = Math.cos((ny * this.settings.fieldScale - time * this.settings.drift * 1.6) * 3.8);
      const waveC = Math.sin((nx + ny) * (this.settings.fieldScale * 2.2) + time * 1.2);
      const angle = waveA + waveB + waveC + this.seed[i]!;

      const flowX = Math.cos(angle) * this.settings.strength;
      const flowY = Math.sin(angle) * this.settings.strength;
      const localRipple = Math.sin((particle.x + particle.y) * 0.014 + time * 1.5);

      particle.vx = (particle.vx + (flowX + localRipple * 16) * deltaSeconds) * damping;
      particle.vy = (particle.vy + (flowY - localRipple * 12) * deltaSeconds) * damping;

      const speed = Math.hypot(particle.vx, particle.vy);
      const maxSpeed = 180;
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        particle.vx *= scale;
        particle.vy *= scale;
      }

      particle.x = wrap(particle.x + particle.vx * deltaSeconds, this.width);
      particle.y = wrap(particle.y + particle.vy * deltaSeconds, this.height);

      const intensity = Math.min(1, speed / maxSpeed);
      particle.r = 0.24 + intensity * 0.4;
      particle.g = 0.66 + (1 - intensity) * 0.2;
      particle.b = 0.95 - intensity * 0.15;
    }
  }
}

function wrap(value: number, limit: number): number {
  return (value + limit) % limit;
}
