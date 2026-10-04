import { BaseAlgorithm } from './BaseAlgorithm';

export interface ParticleLifeSettings {
  interactionRadius: number;
  force: number;
  friction: number;
  coreRepulsion: number;
}

const SPECIES_COLORS = [
  [0.35, 0.88, 0.83],
  [0.65, 0.54, 1],
  [1, 0.55, 0.67],
  [1, 0.77, 0.42],
] as const;

const INTERACTIONS = [
  [0.26, -0.48, 0.36, -0.16],
  [-0.22, 0.24, -0.5, 0.42],
  [0.44, -0.18, 0.2, -0.46],
  [-0.42, 0.38, -0.2, 0.28],
] as const;

const DEFAULT_SETTINGS: ParticleLifeSettings = {
  interactionRadius: 52,
  force: 105,
  friction: 1.35,
  coreRepulsion: 1.4,
};

const MAX_NEIGHBORS_CHECKED = 128;

export class ParticleLifeAlgorithm extends BaseAlgorithm {
  settings: ParticleLifeSettings = { ...DEFAULT_SETTINGS };
  private cellHeads = new Int32Array(0);
  private nextInCell: Int32Array;
  private particleOrder: Int32Array;
  private species: Uint8Array;
  private nextX: Float32Array;
  private nextY: Float32Array;
  private nextVx: Float32Array;
  private nextVy: Float32Array;
  private columns = 1;
  private rows = 1;

  constructor(count: number) {
    super(count);
    this.nextInCell = new Int32Array(count);
    this.particleOrder = Int32Array.from({ length: count }, (_, index) => index);
    this.species = new Uint8Array(count);
    this.nextX = new Float32Array(count);
    this.nextY = new Float32Array(count);
    this.nextVx = new Float32Array(count);
    this.nextVy = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      this.species[i] = i % SPECIES_COLORS.length;
      const particle = this.particles[i]!;
      particle.vx = (Math.random() - 0.5) * 32;
      particle.vy = (Math.random() - 0.5) * 32;
      const color = SPECIES_COLORS[this.species[i]!]!;
      particle.r = color[0];
      particle.g = color[1];
      particle.b = color[2];
    }
  }

  setSettings(settings: Partial<ParticleLifeSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  update(deltaSeconds: number): void {
    const { interactionRadius, force, friction, coreRepulsion } = this.settings;
    const cellSize = interactionRadius;
    this.columns = Math.max(1, Math.ceil(this.width / cellSize));
    this.rows = Math.max(1, Math.ceil(this.height / cellSize));
    const cellCount = this.columns * this.rows;
    if (this.cellHeads.length !== cellCount) {
      this.cellHeads = new Int32Array(cellCount);
    }
    this.cellHeads.fill(-1);
    shuffle(this.particleOrder);
    for (let orderIndex = 0; orderIndex < this.particleOrder.length; orderIndex += 1) {
      const particleIndex = this.particleOrder[orderIndex]!;
      const particle = this.particles[particleIndex]!;
      const cell = this.cellIndex(particle.x, particle.y, cellSize);
      this.nextInCell[particleIndex] = this.cellHeads[cell]!;
      this.cellHeads[cell] = particleIndex;
    }

    const radiusSquared = interactionRadius * interactionRadius;
    const repulsionDistance = interactionRadius * 0.18;
    const repulsionDistanceSquared = repulsionDistance * repulsionDistance;
    const damping = Math.exp(-friction * deltaSeconds);
    const cellOffsets = [-1, 0, 1];
    let randomizedOffsets = false;

    for (let i = 0; i < this.particles.length; i += 1) {
      const particle = this.particles[i]!;
      let forceX = 0;
      let forceY = 0;
      let neighbors = 0;
      let inspected = 0;

      const column = Math.floor(particle.x / cellSize);
      const row = Math.floor(particle.y / cellSize);
      if (!randomizedOffsets) {
        shuffle(cellOffsets);
        randomizedOffsets = true;
      }
      neighborSearch: for (const rowOffset of cellOffsets) {
        const neighborRow = wrapCell(row + rowOffset, this.rows);
        for (const columnOffset of cellOffsets) {
          const neighborColumn = wrapCell(column + columnOffset, this.columns);
          let neighborIndex = this.cellHeads[neighborRow * this.columns + neighborColumn]!;
          while (neighborIndex !== -1) {
            inspected += 1;
            if (neighborIndex !== i) {
              const neighbor = this.particles[neighborIndex]!;
              let dx = neighbor.x - particle.x;
              let dy = neighbor.y - particle.y;
              if (dx > this.width / 2) dx -= this.width;
              else if (dx < -this.width / 2) dx += this.width;
              if (dy > this.height / 2) dy -= this.height;
              else if (dy < -this.height / 2) dy += this.height;

              const distanceSquared = dx * dx + dy * dy;
              if (distanceSquared > 0 && distanceSquared < radiusSquared) {
                const distance = Math.sqrt(distanceSquared);
                const interaction =
                  distanceSquared < repulsionDistanceSquared
                    ? -coreRepulsion * (1 - distance / repulsionDistance)
                    : INTERACTIONS[this.species[i]!]![this.species[neighborIndex]!]! *
                      (1 - distance / interactionRadius);
                const scale = interaction / distance;
                forceX += dx * scale;
                forceY += dy * scale;
                neighbors += 1;
              }
            }
            if (inspected >= MAX_NEIGHBORS_CHECKED) break neighborSearch;
            neighborIndex = this.nextInCell[neighborIndex]!;
          }
        }
      }

      const accelerationScale = neighbors > 0 ? force / neighbors : 0;
      const velocityX = (particle.vx + forceX * accelerationScale * deltaSeconds) * damping;
      const velocityY = (particle.vy + forceY * accelerationScale * deltaSeconds) * damping;
      this.nextVx[i] = velocityX;
      this.nextVy[i] = velocityY;
      this.nextX[i] = wrap(particle.x + velocityX * deltaSeconds, this.width);
      this.nextY[i] = wrap(particle.y + velocityY * deltaSeconds, this.height);
    }

    for (let i = 0; i < this.particles.length; i += 1) {
      const particle = this.particles[i]!;
      particle.x = this.nextX[i]!;
      particle.y = this.nextY[i]!;
      particle.vx = this.nextVx[i]!;
      particle.vy = this.nextVy[i]!;
    }
  }

  private cellIndex(x: number, y: number, cellSize: number): number {
    const column = Math.min(this.columns - 1, Math.floor(x / cellSize));
    const row = Math.min(this.rows - 1, Math.floor(y / cellSize));
    return row * this.columns + column;
  }
}

function wrap(value: number, limit: number): number {
  return (value + limit) % limit;
}

function wrapCell(value: number, limit: number): number {
  return (value + limit) % limit;
}

function shuffle(values: number[] | Int32Array): void {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const value = values[i]!;
    values[i] = values[j]!;
    values[j] = value;
  }
}
