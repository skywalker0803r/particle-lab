import { BaseAlgorithm } from './BaseAlgorithm';

export interface VicsekSettings {
  perceptionRadius: number;
  noise: number;
  speed: number;
}

const DEFAULT_SETTINGS: VicsekSettings = {
  perceptionRadius: 36,
  noise: 0.35,
  speed: 76,
};

export class VicsekAlgorithm extends BaseAlgorithm {
  settings: VicsekSettings = { ...DEFAULT_SETTINGS };
  private cellHeads = new Int32Array(0);
  private nextInCell: Int32Array;
  private nextX: Float32Array;
  private nextY: Float32Array;
  private nextVx: Float32Array;
  private nextVy: Float32Array;
  private columns = 1;
  private rows = 1;

  constructor(count: number) {
    super(count);
    this.nextInCell = new Int32Array(count);
    this.nextX = new Float32Array(count);
    this.nextY = new Float32Array(count);
    this.nextVx = new Float32Array(count);
    this.nextVy = new Float32Array(count);
    for (const particle of this.particles) {
      const angle = Math.random() * Math.PI * 2;
      particle.vx = Math.cos(angle) * DEFAULT_SETTINGS.speed;
      particle.vy = Math.sin(angle) * DEFAULT_SETTINGS.speed;
      setDirectionColor(particle, angle);
    }
  }

  setSettings(settings: Partial<VicsekSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  update(deltaSeconds: number): void {
    const { perceptionRadius, noise, speed } = this.settings;
    const cellSize = perceptionRadius;
    this.columns = Math.max(1, Math.ceil(this.width / cellSize));
    this.rows = Math.max(1, Math.ceil(this.height / cellSize));
    const cellCount = this.columns * this.rows;
    if (this.cellHeads.length !== cellCount) {
      this.cellHeads = new Int32Array(cellCount);
    }
    if (this.nextInCell.length !== this.particles.length) {
      this.nextInCell = new Int32Array(this.particles.length);
      this.nextX = new Float32Array(this.particles.length);
      this.nextY = new Float32Array(this.particles.length);
      this.nextVx = new Float32Array(this.particles.length);
      this.nextVy = new Float32Array(this.particles.length);
    }

    this.cellHeads.fill(-1);
    for (let i = 0; i < this.particles.length; i += 1) {
      const particle = this.particles[i]!;
      const cell = this.cellIndex(particle.x, particle.y, cellSize);
      this.nextInCell[i] = this.cellHeads[cell]!;
      this.cellHeads[cell] = i;
    }

    const radiusSquared = perceptionRadius * perceptionRadius;
    const angularNoise = noise * Math.PI;
    for (let i = 0; i < this.particles.length; i += 1) {
      const particle = this.particles[i]!;
      let directionX = particle.vx;
      let directionY = particle.vy;
      const column = Math.floor(particle.x / cellSize);
      const row = Math.floor(particle.y / cellSize);

      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        const neighborRow = wrapCell(row + rowOffset, this.rows);
        for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
          const neighborColumn = wrapCell(column + columnOffset, this.columns);
          let neighborIndex = this.cellHeads[neighborRow * this.columns + neighborColumn]!;
          while (neighborIndex !== -1) {
            if (neighborIndex !== i) {
              const neighbor = this.particles[neighborIndex]!;
              let dx = neighbor.x - particle.x;
              let dy = neighbor.y - particle.y;
              if (dx > this.width / 2) dx -= this.width;
              else if (dx < -this.width / 2) dx += this.width;
              if (dy > this.height / 2) dy -= this.height;
              else if (dy < -this.height / 2) dy += this.height;
              if (dx * dx + dy * dy < radiusSquared) {
                directionX += neighbor.vx;
                directionY += neighbor.vy;
              }
            }
            neighborIndex = this.nextInCell[neighborIndex]!;
          }
        }
      }

      const angle =
        Math.atan2(directionY, directionX) + (Math.random() * 2 - 1) * angularNoise;
      const velocityX = Math.cos(angle) * speed;
      const velocityY = Math.sin(angle) * speed;
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
      setDirectionColor(particle, Math.atan2(particle.vy, particle.vx));
    }
  }

  private cellIndex(x: number, y: number, cellSize: number): number {
    const column = Math.min(this.columns - 1, Math.floor(x / cellSize));
    const row = Math.min(this.rows - 1, Math.floor(y / cellSize));
    return row * this.columns + column;
  }
}

function wrap(value: number, limit: number): number {
  return ((value % limit) + limit) % limit;
}

function wrapCell(value: number, limit: number): number {
  return (value + limit) % limit;
}

function setDirectionColor(particle: { r: number; g: number; b: number }, angle: number): void {
  const hue = ((angle + Math.PI) / (Math.PI * 2)) % 1;
  const saturation = 0.78;
  const lightness = 0.68;
  const channel = (offset: number): number => {
    const k = (offset + hue * 12) % 12;
    const a = saturation * Math.min(lightness, 1 - lightness);
    return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  particle.r = channel(0);
  particle.g = channel(8);
  particle.b = channel(4);
}
