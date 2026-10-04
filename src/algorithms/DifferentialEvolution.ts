import { BaseAlgorithm, type Particle } from './BaseAlgorithm';

export interface DifferentialEvolutionSettings {
  differentialWeight: number;
  crossoverRate: number;
  generationSpeed: number;
}

const DEFAULT_SETTINGS: DifferentialEvolutionSettings = {
  differentialWeight: 0.72,
  crossoverRate: 0.82,
  generationSpeed: 6,
};

export class DifferentialEvolution extends BaseAlgorithm {
  settings: DifferentialEvolutionSettings = { ...DEFAULT_SETTINGS };
  private nextX: Float32Array;
  private nextY: Float32Array;
  private fitness: Float32Array;
  private best = Number.POSITIVE_INFINITY;
  private generationAccumulator = 0;

  constructor(count: number) {
    super(count);
    this.nextX = new Float32Array(count);
    this.nextY = new Float32Array(count);
    this.fitness = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const particle = this.particles[i]!;
      particle.vx = randomRange(-1, 1);
      particle.vy = randomRange(-1, 1);
      particle.x = (particle.vx + 1) * 0.5 * this.width;
      particle.y = (particle.vy + 1) * 0.5 * this.height;
      const score = objective(particle.vx, particle.vy);
      this.fitness[i] = score;
      this.best = Math.min(this.best, score);
      colorByFitness(particle, score);
    }
  }

  get bestFitness(): number {
    return this.best;
  }

  setSettings(settings: Partial<DifferentialEvolutionSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  update(deltaSeconds: number): void {
    const generationInterval = 1 / this.settings.generationSpeed;
    this.generationAccumulator += Math.min(deltaSeconds, 0.04);
    if (this.generationAccumulator < generationInterval || this.particles.length < 4) return;
    this.generationAccumulator %= generationInterval;

    const count = this.particles.length;
    for (let i = 0; i < count; i += 1) {
      const [first, second, third] = this.selectDonors(i);
      const target = this.particles[i]!;
      const base = this.particles[first]!;
      const difference1 = this.particles[second]!;
      const difference2 = this.particles[third]!;
      const forceX =
        base.vx + this.settings.differentialWeight * (difference1.vx - difference2.vx);
      const forceY =
        base.vy + this.settings.differentialWeight * (difference1.vy - difference2.vy);
      const forcedDimension = Math.floor(Math.random() * 2);
      const trialX =
        forcedDimension === 0 || Math.random() < this.settings.crossoverRate
          ? reflect(forceX)
          : target.vx;
      const trialY =
        forcedDimension === 1 || Math.random() < this.settings.crossoverRate
          ? reflect(forceY)
          : target.vy;
      const trialFitness = objective(trialX, trialY);
      const currentFitness = this.fitness[i]!;
      if (trialFitness <= currentFitness) {
        this.nextX[i] = trialX;
        this.nextY[i] = trialY;
        this.fitness[i] = trialFitness;
      } else {
        this.nextX[i] = target.vx;
        this.nextY[i] = target.vy;
      }
    }

    for (let i = 0; i < count; i += 1) {
      const particle = this.particles[i]!;
      particle.vx = this.nextX[i]!;
      particle.vy = this.nextY[i]!;
      particle.x = (particle.vx + 1) * 0.5 * this.width;
      particle.y = (particle.vy + 1) * 0.5 * this.height;
      const score = this.fitness[i]!;
      this.best = Math.min(this.best, score);
      colorByFitness(particle, score);
    }
  }

  override resize(width: number, height: number): void {
    super.resize(width, height);
    for (const particle of this.particles) {
      particle.x = (particle.vx + 1) * 0.5 * this.width;
      particle.y = (particle.vy + 1) * 0.5 * this.height;
    }
  }

  private selectDonors(target: number): [number, number, number] {
    const first = randomIndex(this.particles.length, target);
    const second = randomIndex(this.particles.length, target, first);
    const third = randomIndex(this.particles.length, target, first, second);
    return [first, second, third];
  }
}

function randomIndex(count: number, ...excluded: number[]): number {
  let index = Math.floor(Math.random() * count);
  while (excluded.includes(index)) {
    index = Math.floor(Math.random() * count);
  }
  return index;
}

function objective(x: number, y: number): number {
  return x * x + y * y;
}

function colorByFitness(particle: Particle, fitness: number): void {
  const intensity = Math.max(0, 1 - Math.sqrt(fitness) / Math.SQRT2);
  particle.r = 0.37 + intensity * 0.46;
  particle.g = 0.55 + intensity * 0.38;
  particle.b = 0.82 + intensity * 0.16;
}

function randomRange(minimum: number, maximum: number): number {
  return minimum + Math.random() * (maximum - minimum);
}

function reflect(value: number): number {
  const folded = ((value + 1) % 4 + 4) % 4;
  return folded <= 2 ? folded - 1 : 3 - folded;
}
