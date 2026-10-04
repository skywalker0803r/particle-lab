import { BaseAlgorithm } from './BaseAlgorithm';

export interface BoidsSettings {
  perceptionRadius: number;
  separationWeight: number;
  alignmentWeight: number;
  cohesionWeight: number;
  maxSpeed: number;
}

const DEFAULT_SETTINGS: BoidsSettings = {
  perceptionRadius: 30,
  separationWeight: 1.5,
  alignmentWeight: 1,
  cohesionWeight: 1,
  maxSpeed: 82,
};

export class BoidsAlgorithm extends BaseAlgorithm {
  settings: BoidsSettings = { ...DEFAULT_SETTINGS };
  private cellHeads = new Int32Array(0);
  private nextInCell = new Int32Array(0);
  private particleOrder: Int32Array;
  private nextX: Float32Array;
  private nextY: Float32Array;
  private nextVx: Float32Array;
  private nextVy: Float32Array;
  private columns = 1;
  private rows = 1;

  constructor(count: number) {
    super(count);
    this.particleOrder = Int32Array.from({ length: count }, (_, index) => index);
    this.nextX = new Float32Array(count);
    this.nextY = new Float32Array(count);
    this.nextVx = new Float32Array(count);
    this.nextVy = new Float32Array(count);
  }

  setSettings(settings: Partial<BoidsSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  update(deltaSeconds: number): void {
    const { perceptionRadius, maxSpeed } = this.settings;
    const cellSize = perceptionRadius;
    this.columns = Math.max(1, Math.ceil(this.width / cellSize));
    this.rows = Math.max(1, Math.ceil(this.height / cellSize));
    const requiredCells = this.columns * this.rows;
    if (this.cellHeads.length !== requiredCells) {
      this.cellHeads = new Int32Array(requiredCells);
    }
    if (this.nextInCell.length !== this.particles.length) {
      this.nextInCell = new Int32Array(this.particles.length);
      this.particleOrder = Int32Array.from(
        { length: this.particles.length },
        (_, index) => index,
      );
      this.nextX = new Float32Array(this.particles.length);
      this.nextY = new Float32Array(this.particles.length);
      this.nextVx = new Float32Array(this.particles.length);
      this.nextVy = new Float32Array(this.particles.length);
    }
    this.cellHeads.fill(-1);
    shuffle(this.particleOrder);
    for (let orderIndex = 0; orderIndex < this.particleOrder.length; orderIndex += 1) {
      const i = this.particleOrder[orderIndex]!;
      const particle = this.particles[i]!;
      const cell = this.cellIndex(particle.x, particle.y, cellSize);
      this.nextInCell[i] = this.cellHeads[cell]!;
      this.cellHeads[cell] = i;
    }

    const deltaSquared = perceptionRadius * perceptionRadius;
    const maxSpeedSquared = maxSpeed * maxSpeed;
    const cellOffsets = [-1, 0, 1];
    shuffle(cellOffsets);
    for (let i = 0; i < this.particles.length; i += 1) {
      const particle = this.particles[i]!;
      let separationX = 0;
      let separationY = 0;
      let alignmentX = 0;
      let alignmentY = 0;
      let centerX = 0;
      let centerY = 0;
      let neighbors = 0;

      const column = Math.floor(particle.x / cellSize);
      const row = Math.floor(particle.y / cellSize);
      cellSearch: for (const rowOffset of cellOffsets) {
        let neighborRow = row + rowOffset;
        if (neighborRow < 0) neighborRow += this.rows;
        else if (neighborRow >= this.rows) neighborRow -= this.rows;
        for (const columnOffset of cellOffsets) {
          let neighborColumn = column + columnOffset;
          if (neighborColumn < 0) neighborColumn += this.columns;
          else if (neighborColumn >= this.columns) neighborColumn -= this.columns;
          let neighborIndex = this.cellHeads[neighborRow * this.columns + neighborColumn]!;
          while (neighborIndex !== -1) {
            if (neighborIndex !== i) {
              const neighbor = this.particles[neighborIndex]!;
              let dx = neighbor.x - particle.x;
              let dy = neighbor.y - particle.y;
              if (dx > this.width / 2) dx -= this.width;
              if (dx < -this.width / 2) dx += this.width;
              if (dy > this.height / 2) dy -= this.height;
              if (dy < -this.height / 2) dy += this.height;
              const distanceSquared = dx * dx + dy * dy;
              if (distanceSquared > 0 && distanceSquared < deltaSquared) {
                separationX -= dx / distanceSquared;
                separationY -= dy / distanceSquared;
                alignmentX += neighbor.vx;
                alignmentY += neighbor.vy;
                centerX += dx;
                centerY += dy;
                neighbors += 1;
                if (neighbors === 48) break cellSearch;
              }
            }
            neighborIndex = this.nextInCell[neighborIndex]!;
          }
        }
      }

      let forceX = 0;
      let forceY = 0;
      if (neighbors > 0) {
        forceX += separationX * this.settings.separationWeight;
        forceY += separationY * this.settings.separationWeight;
        forceX += (alignmentX / neighbors - particle.vx) * this.settings.alignmentWeight * 0.045;
        forceY += (alignmentY / neighbors - particle.vy) * this.settings.alignmentWeight * 0.045;
        forceX += (centerX / neighbors) * this.settings.cohesionWeight * 0.035;
        forceY += (centerY / neighbors) * this.settings.cohesionWeight * 0.035;
      }
      let velocityX = particle.vx + forceX * deltaSeconds;
      let velocityY = particle.vy + forceY * deltaSeconds;
      const speedSquared = velocityX * velocityX + velocityY * velocityY;
      if (speedSquared > maxSpeedSquared) {
        const scale = maxSpeed / Math.sqrt(speedSquared);
        velocityX *= scale;
        velocityY *= scale;
      } else if (speedSquared < 16) {
        velocityX += (Math.random() - 0.5) * 12;
        velocityY += (Math.random() - 0.5) * 12;
      }
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

function shuffle(values: number[] | Int32Array): void {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const value = values[i]!;
    values[i] = values[j]!;
    values[j] = value;
  }
}
