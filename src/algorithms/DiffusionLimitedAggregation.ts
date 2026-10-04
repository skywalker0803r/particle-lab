import { BaseAlgorithm, type Particle } from './BaseAlgorithm';

export interface DlaSettings {
  walkSpeed: number;
  launchDistance: number;
  maxStepPerFrame: number;
}

const CELL_SIZE = 4;
const DEFAULT_SETTINGS: DlaSettings = {
  walkSpeed: 90,
  launchDistance: 20,
  maxStepPerFrame: 8,
};
const CARDINAL_X = [1, 0, -1, 0] as const;
const CARDINAL_Y = [0, 1, 0, -1] as const;

export class DiffusionLimitedAggregation extends BaseAlgorithm {
  settings: DlaSettings = { ...DEFAULT_SETTINGS };
  private stuck: Uint8Array;
  private occupied = new Int32Array(0);
  private columns = 1;
  private rows = 1;
  private centerX = 0;
  private centerY = 0;
  private maxRadius = 0;
  private clusterRadius = 0;
  private walkerAccumulator = 0;
  private attached = 1;
  private initialized = false;

  constructor(count: number) {
    super(count);
    this.stuck = new Uint8Array(count);
  }

  get attachedCount(): number {
    return this.attached;
  }

  setSettings(settings: Partial<DlaSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  override resize(width: number, height: number): void {
    super.resize(width, height);
    this.columns = Math.max(1, Math.ceil(this.width / CELL_SIZE));
    this.rows = Math.max(1, Math.ceil(this.height / CELL_SIZE));
    this.centerX = Math.floor(this.columns / 2);
    this.centerY = Math.floor(this.rows / 2);
    this.maxRadius = Math.max(2, Math.floor(Math.min(this.columns, this.rows) * 0.43));
    this.occupied = new Int32Array(this.columns * this.rows);

    if (!this.initialized) {
      this.initializeWalkers();
      this.initialized = true;
      return;
    }

    this.clusterRadius = 0;
    for (let i = 0; i < this.particles.length; i += 1) {
      const particle = this.particles[i]!;
      const cellX = this.toCellX(particle.x);
      const cellY = this.toCellY(particle.y);
      particle.x = this.toPixelX(cellX);
      particle.y = this.toPixelY(cellY);
      if (this.stuck[i] === 1) {
        this.occupied[this.cellIndex(cellX, cellY)] = i + 1;
        this.clusterRadius = Math.max(
          this.clusterRadius,
          Math.hypot(cellX - this.centerX, cellY - this.centerY),
        );
      }
    }
    this.relaunchWalkers();
  }

  update(deltaSeconds: number): void {
    if (this.attached >= this.particles.length) return;

    this.walkerAccumulator += Math.min(deltaSeconds, 0.04) * this.settings.walkSpeed;
    const steps = Math.min(this.settings.maxStepPerFrame, Math.floor(this.walkerAccumulator));
    if (steps === 0) return;
    this.walkerAccumulator -= steps;

    const launchRadius = Math.min(
      this.maxRadius - 2,
      Math.max(8, this.clusterRadius + this.settings.launchDistance / CELL_SIZE),
    );
    const killRadius = Math.min(this.maxRadius, launchRadius + 10);

    for (let step = 0; step < steps; step += 1) {
      for (let i = 0; i < this.particles.length; i += 1) {
        if (this.stuck[i] === 1) continue;
        const particle = this.particles[i]!;
        let cellX = this.toCellX(particle.x);
        let cellY = this.toCellY(particle.y);
        const direction = Math.floor(Math.random() * 4);
        cellX += CARDINAL_X[direction]!;
        cellY += CARDINAL_Y[direction]!;

        if (
          cellX < 1 ||
          cellX >= this.columns - 1 ||
          cellY < 1 ||
          cellY >= this.rows - 1 ||
          Math.hypot(cellX - this.centerX, cellY - this.centerY) > killRadius
        ) {
          this.spawnWalker(particle, launchRadius);
          continue;
        }

        const cell = this.cellIndex(cellX, cellY);
        particle.x = this.toPixelX(cellX);
        particle.y = this.toPixelY(cellY);
        particle.vx = CARDINAL_X[direction]! * CELL_SIZE;
        particle.vy = CARDINAL_Y[direction]! * CELL_SIZE;
        if (this.occupied[cell] !== 0) {
          this.spawnWalker(particle, launchRadius);
          continue;
        }

        if (this.hasAttachedNeighbor(cellX, cellY)) {
          this.attachWalker(i, cellX, cellY);
        }
      }
    }
  }

  private initializeWalkers(): void {
    this.stuck.fill(0);
    this.occupied.fill(0);
    this.attached = 1;
    this.clusterRadius = 0;
    const seed = this.particles[0]!;
    seed.x = this.toPixelX(this.centerX);
    seed.y = this.toPixelY(this.centerY);
    seed.vx = 0;
    seed.vy = 0;
    seed.r = 1;
    seed.g = 0.76;
    seed.b = 0.42;
    this.stuck[0] = 1;
    this.occupied[this.cellIndex(this.centerX, this.centerY)] = 1;
    this.relaunchWalkers();
  }

  private relaunchWalkers(): void {
    const radius = Math.min(
      this.maxRadius - 2,
      Math.max(8, this.clusterRadius + this.settings.launchDistance / CELL_SIZE),
    );
    for (let i = 0; i < this.particles.length; i += 1) {
      if (this.stuck[i] === 1) continue;
      this.spawnWalker(this.particles[i]!, radius);
    }
  }

  private spawnWalker(particle: Particle, radius: number): void {
    const angle = Math.random() * Math.PI * 2;
    const cellX = clampCell(
      Math.round(this.centerX + Math.cos(angle) * radius),
      1,
      this.columns - 2,
    );
    const cellY = clampCell(
      Math.round(this.centerY + Math.sin(angle) * radius),
      1,
      this.rows - 2,
    );
    particle.x = this.toPixelX(cellX);
    particle.y = this.toPixelY(cellY);
    particle.vx = 0;
    particle.vy = 0;
    particle.r = 0.38;
    particle.g = 0.78;
    particle.b = 0.94;
  }

  private attachWalker(index: number, cellX: number, cellY: number): void {
    const particle = this.particles[index]!;
    this.stuck[index] = 1;
    this.occupied[this.cellIndex(cellX, cellY)] = index + 1;
    this.attached += 1;
    this.clusterRadius = Math.max(
      this.clusterRadius,
      Math.hypot(cellX - this.centerX, cellY - this.centerY),
    );

    const growth = Math.min(1, this.clusterRadius / this.maxRadius);
    particle.r = 0.46 + growth * 0.54;
    particle.g = 0.78 - growth * 0.3;
    particle.b = 0.94 - growth * 0.12;
    particle.vx = 0;
    particle.vy = 0;
  }

  private hasAttachedNeighbor(cellX: number, cellY: number): boolean {
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (offsetX === 0 && offsetY === 0) continue;
        if (this.occupied[this.cellIndex(cellX + offsetX, cellY + offsetY)] !== 0) {
          return true;
        }
      }
    }
    return false;
  }

  private cellIndex(x: number, y: number): number {
    return y * this.columns + x;
  }

  private toCellX(value: number): number {
    return clampCell(Math.round((value - CELL_SIZE / 2) / CELL_SIZE), 1, this.columns - 2);
  }

  private toCellY(value: number): number {
    return clampCell(Math.round((value - CELL_SIZE / 2) / CELL_SIZE), 1, this.rows - 2);
  }

  private toPixelX(cell: number): number {
    return cell * CELL_SIZE + CELL_SIZE / 2;
  }

  private toPixelY(cell: number): number {
    return cell * CELL_SIZE + CELL_SIZE / 2;
  }
}

function clampCell(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
