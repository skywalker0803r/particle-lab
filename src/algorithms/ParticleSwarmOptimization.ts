import { BaseAlgorithm, type Particle } from './BaseAlgorithm';

export interface PsoSettings {
  inertia: number;
  cognitive: number;
  social: number;
}

const DEFAULT_SETTINGS: PsoSettings = {
  inertia: 0.72,
  cognitive: 1.45,
  social: 1.45,
};

export class ParticleSwarmOptimization extends BaseAlgorithm {
  settings: PsoSettings = { ...DEFAULT_SETTINGS };
  private personalBestX = new Float32Array(0);
  private personalBestY = new Float32Array(0);
  private personalBestFitness = new Float32Array(0);
  private globalBestX = 0;
  private globalBestY = 0;
  private globalBestFitness = Number.POSITIVE_INFINITY;

  constructor(count: number) {
    super(count);
    for (const particle of this.particles) {
      particle.vx = (Math.random() - 0.5) * 0.4;
      particle.vy = (Math.random() - 0.5) * 0.4;
    }
    this.personalBestX = new Float32Array(count);
    this.personalBestY = new Float32Array(count);
    this.personalBestFitness = new Float32Array(count);
    this.resetBestPositions();
  }

  setSettings(settings: Partial<PsoSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  get bestFitness(): number {
    return this.globalBestFitness;
  }

  update(deltaSeconds: number): void {
    const step = Math.min(deltaSeconds, 0.04) * 3;
    const particles = this.particles;
    for (let i = 0; i < particles.length; i += 1) {
      const particle = particles[i]!;
      const x = particle.x / this.width * 2 - 1;
      const y = particle.y / this.height * 2 - 1;
      const fitness = objective(x, y);
      if (fitness < this.personalBestFitness[i]!) {
        this.personalBestFitness[i] = fitness;
        this.personalBestX[i] = x;
        this.personalBestY[i] = y;
      }
      if (fitness < this.globalBestFitness) {
        this.globalBestFitness = fitness;
        this.globalBestX = x;
        this.globalBestY = y;
      }

      const personalX = this.personalBestX[i]!;
      const personalY = this.personalBestY[i]!;
      particle.vx =
        this.settings.inertia * particle.vx +
        Math.random() * this.settings.cognitive * (personalX - x) +
        Math.random() * this.settings.social * (this.globalBestX - x);
      particle.vy =
        this.settings.inertia * particle.vy +
        Math.random() * this.settings.cognitive * (personalY - y) +
        Math.random() * this.settings.social * (this.globalBestY - y);

      const nextX = clamp(x + particle.vx * step, -1, 1);
      const nextY = clamp(y + particle.vy * step, -1, 1);
      particle.x = (nextX + 1) * 0.5 * this.width;
      particle.y = (nextY + 1) * 0.5 * this.height;
      if (nextX === -1 || nextX === 1) particle.vx *= -0.35;
      if (nextY === -1 || nextY === 1) particle.vy *= -0.35;
      colorByFitness(particle, fitness);
    }
  }

  private resetBestPositions(): void {
    this.globalBestFitness = Number.POSITIVE_INFINITY;
    this.globalBestX = 0;
    this.globalBestY = 0;
    if (this.personalBestFitness.length !== this.particles.length) return;
    for (let i = 0; i < this.particles.length; i += 1) {
      const particle: Particle = this.particles[i]!;
      const x = particle.x / this.width * 2 - 1;
      const y = particle.y / this.height * 2 - 1;
      const fitness = objective(x, y);
      this.personalBestX[i] = x;
      this.personalBestY[i] = y;
      this.personalBestFitness[i] = fitness;
      if (fitness < this.globalBestFitness) {
        this.globalBestFitness = fitness;
        this.globalBestX = x;
        this.globalBestY = y;
      }
    }
  }
}

function objective(x: number, y: number): number {
  return x * x + y * y;
}

function colorByFitness(particle: Particle, fitness: number): void {
  const intensity = Math.max(0, 1 - Math.sqrt(fitness) / Math.SQRT2);
  particle.r = 0.36 + intensity * 0.45;
  particle.g = 0.49 + intensity * 0.44;
  particle.b = 0.88 + intensity * 0.12;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
