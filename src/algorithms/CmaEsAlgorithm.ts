import { BaseAlgorithm, type Particle } from './BaseAlgorithm';

export interface CmaEsSettings {
  sigma: number;
  learningRate: number;
}

const DEFAULT_SETTINGS: CmaEsSettings = {
  sigma: 0.48,
  learningRate: 1,
};
const DIMENSIONS = 2;

export class CmaEsAlgorithm extends BaseAlgorithm {
  settings: CmaEsSettings = { ...DEFAULT_SETTINGS };
  private meanX = 0;
  private meanY = 0;
  private sigma = DEFAULT_SETTINGS.sigma;
  private c11 = 1;
  private c12 = 0;
  private c22 = 1;
  private pathSigmaX = 0;
  private pathSigmaY = 0;
  private pathCX = 0;
  private pathCY = 0;
  private best = Number.POSITIVE_INFINITY;
  private generation = 0;
  private generationElapsed = 0;

  constructor(count: number) {
    super(count);
    this.meanX = randomRange(-0.8, 0.8);
    this.meanY = randomRange(-0.8, 0.8);
    for (const particle of this.particles) {
      particle.vx = 0;
      particle.vy = 0;
    }
    this.samplePopulation();
  }

  get bestFitness(): number {
    return this.best;
  }

  setSettings(settings: Partial<CmaEsSettings>): void {
    if (settings.sigma !== undefined && settings.sigma !== this.settings.sigma) {
      this.sigma = settings.sigma;
    }
    this.settings = { ...this.settings, ...settings };
  }

  update(deltaSeconds: number): void {
    this.generationElapsed += deltaSeconds;
    if (this.generationElapsed < 0.12) return;
    this.generationElapsed %= 0.12;

    const count = this.particles.length;
    if (count < 4) return;
    const ranked = this.particles
      .map((particle) => ({
        x: particle.vx,
        y: particle.vy,
        fitness: objective(particle.vx, particle.vy),
      }))
      .sort((a, b) => a.fitness - b.fitness);

    const mu = Math.max(2, Math.floor(count / 2));
    const rawWeights = Array.from(
      { length: mu },
      (_, index) => Math.log(mu + 0.5) - Math.log(index + 1),
    );
    const weightSum = rawWeights.reduce((sum, weight) => sum + weight, 0);
    const weights = rawWeights.map((weight) => weight / weightSum);
    const muEffective = 1 / weights.reduce((sum, weight) => sum + weight * weight, 0);
    const cc = (4 + muEffective / DIMENSIONS) / (DIMENSIONS + 4 + 2 * muEffective / DIMENSIONS);
    const cs = (muEffective + 2) / (DIMENSIONS + muEffective + 5);
    const c1 = 2 / ((DIMENSIONS + 1.3) ** 2 + muEffective);
    const cmu = Math.min(
      1 - c1,
      (2 * (muEffective - 2 + 1 / muEffective)) / ((DIMENSIONS + 2) ** 2 + muEffective),
    );
    const damping =
      1 +
      2 * Math.max(0, Math.sqrt((muEffective - 1) / (DIMENSIONS + 1)) - 1) +
      cs;
    const expectedNorm =
      Math.sqrt(DIMENSIONS) *
      (1 - 1 / (4 * DIMENSIONS) + 1 / (21 * DIMENSIONS * DIMENSIONS));

    let nextMeanX = 0;
    let nextMeanY = 0;
    for (let i = 0; i < mu; i += 1) {
      nextMeanX += weights[i]! * ranked[i]!.x;
      nextMeanY += weights[i]! * ranked[i]!.y;
    }

    const meanStepX = (nextMeanX - this.meanX) / this.sigma;
    const meanStepY = (nextMeanY - this.meanY) / this.sigma;
    const inverseSqrtStep = inverseSqrtCovariance(
      meanStepX,
      meanStepY,
      this.c11,
      this.c12,
      this.c22,
    );
    this.pathSigmaX =
      (1 - cs) * this.pathSigmaX +
      Math.sqrt(cs * (2 - cs) * muEffective) * inverseSqrtStep.x;
    this.pathSigmaY =
      (1 - cs) * this.pathSigmaY +
      Math.sqrt(cs * (2 - cs) * muEffective) * inverseSqrtStep.y;
    const pathSigmaNorm = Math.hypot(this.pathSigmaX, this.pathSigmaY);
    const normalization = Math.sqrt(1 - (1 - cs) ** (2 * (this.generation + 1)));
    const hsig =
      pathSigmaNorm / normalization / expectedNorm <
      1.4 + 2 / (DIMENSIONS + 1)
        ? 1
        : 0;
    this.pathCX =
      (1 - cc) * this.pathCX + hsig * Math.sqrt(cc * (2 - cc) * muEffective) * meanStepX;
    this.pathCY =
      (1 - cc) * this.pathCY + hsig * Math.sqrt(cc * (2 - cc) * muEffective) * meanStepY;

    let rankMu11 = 0;
    let rankMu12 = 0;
    let rankMu22 = 0;
    for (let i = 0; i < mu; i += 1) {
      const candidate = ranked[i]!;
      const dx = (candidate.x - this.meanX) / this.sigma;
      const dy = (candidate.y - this.meanY) / this.sigma;
      const weight = weights[i]!;
      rankMu11 += weight * dx * dx;
      rankMu12 += weight * dx * dy;
      rankMu22 += weight * dy * dy;
    }

    const oldScale = 1 - c1 - cmu + c1 * (1 - hsig) * cc * (2 - cc);
    this.c11 =
      oldScale * this.c11 +
      c1 * this.pathCX * this.pathCX +
      cmu * rankMu11;
    this.c12 =
      oldScale * this.c12 +
      c1 * this.pathCX * this.pathCY +
      cmu * rankMu12;
    this.c22 =
      oldScale * this.c22 +
      c1 * this.pathCY * this.pathCY +
      cmu * rankMu22;

    this.sigma *= Math.exp(
      (cs / damping) * (pathSigmaNorm / expectedNorm - 1) * this.settings.learningRate,
    );
    this.sigma = clamp(this.sigma, 0.002, 1.5);
    this.meanX = clamp(nextMeanX, -1.2, 1.2);
    this.meanY = clamp(nextMeanY, -1.2, 1.2);
    this.generation += 1;
    this.samplePopulation();
  }

  private samplePopulation(): void {
    const l11 = Math.sqrt(Math.max(this.c11, 1e-8));
    const l21 = this.c12 / l11;
    const l22 = Math.sqrt(Math.max(this.c22 - l21 * l21, 1e-8));
    for (const particle of this.particles) {
      const z1 = gaussianRandom();
      const z2 = gaussianRandom();
      const x = clamp(this.meanX + this.sigma * l11 * z1, -1, 1);
      const y = clamp(this.meanY + this.sigma * (l21 * z1 + l22 * z2), -1, 1);
      particle.vx = x;
      particle.vy = y;
      particle.x = (x + 1) * 0.5 * this.width;
      particle.y = (y + 1) * 0.5 * this.height;
      const fitness = objective(x, y);
      this.best = Math.min(this.best, fitness);
      colorByFitness(particle, fitness);
    }
  }
}

function inverseSqrtCovariance(
  x: number,
  y: number,
  c11: number,
  c12: number,
  c22: number,
): { x: number; y: number } {
  const angle = 0.5 * Math.atan2(2 * c12, c11 - c22);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const eigenvalue1 = Math.max(
    1e-8,
    cosine * cosine * c11 + 2 * cosine * sine * c12 + sine * sine * c22,
  );
  const eigenvalue2 = Math.max(
    1e-8,
    sine * sine * c11 - 2 * cosine * sine * c12 + cosine * cosine * c22,
  );
  const component1 = cosine * x + sine * y;
  const component2 = -sine * x + cosine * y;
  const scaled1 = component1 / Math.sqrt(eigenvalue1);
  const scaled2 = component2 / Math.sqrt(eigenvalue2);
  return {
    x: cosine * scaled1 - sine * scaled2,
    y: sine * scaled1 + cosine * scaled2,
  };
}

function objective(x: number, y: number): number {
  return x * x + y * y;
}

function colorByFitness(particle: Particle, fitness: number): void {
  const intensity = Math.max(0, 1 - Math.sqrt(fitness) / Math.SQRT2);
  particle.r = 0.38 + intensity * 0.47;
  particle.g = 0.5 + intensity * 0.42;
  particle.b = 0.92 + intensity * 0.08;
}

function gaussianRandom(): number {
  const first = Math.max(Math.random(), Number.EPSILON);
  const second = Math.random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function randomRange(minimum: number, maximum: number): number {
  return minimum + Math.random() * (maximum - minimum);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
