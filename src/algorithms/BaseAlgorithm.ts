export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  g: number;
  b: number;
}

export abstract class BaseAlgorithm {
  readonly particles: Particle[] = [];
  protected width = 1;
  protected height = 1;

  constructor(count: number) {
    for (let i = 0; i < count; i += 1) {
      const hue = 0.52 + Math.random() * 0.18;
      const saturation = 0.58 + Math.random() * 0.28;
      const lightness = 0.58 + Math.random() * 0.25;
      const [r, g, b] = hslToRgb(hue, saturation, lightness);
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 70,
        vy: (Math.random() - 0.5) * 70,
        r,
        g,
        b,
      });
    }
  }

  resize(width: number, height: number): void {
    const nextWidth = Math.max(1, width);
    const nextHeight = Math.max(1, height);
    const scaleX = nextWidth / this.width;
    const scaleY = nextHeight / this.height;
    for (const particle of this.particles) {
      particle.x *= scaleX;
      particle.y *= scaleY;
    }
    this.width = nextWidth;
    this.height = nextHeight;
  }

  abstract update(deltaSeconds: number): void;
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const channel = (n: number): number => {
    const k = (n + hue * 12) % 12;
    const a = saturation * Math.min(lightness, 1 - lightness);
    return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
}
