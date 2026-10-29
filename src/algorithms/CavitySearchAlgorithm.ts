import { BaseAlgorithm, type Particle } from './BaseAlgorithm';

export interface CavitySearchSettings {
  explorationRate: number;
  attractionRadius: number;
  stepSize: number;
}

const DEFAULT_SETTINGS: CavitySearchSettings = {
  explorationRate: 0.15,
  attractionRadius: 48,
  stepSize: 92,
};

export class CavitySearchAlgorithm extends BaseAlgorithm {
  settings: CavitySearchSettings = { ...DEFAULT_SETTINGS };
  private potentialFieldX = new Float32Array(0);
  private potentialFieldY = new Float32Array(0);
  private highDensityRegions = new Set<number>();
  private columns = 1;
  private rows = 1;

  constructor(count: number) {
    super(count);
    this.reset();
  }

  setSettings(settings: Partial<CavitySearchSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  get avgPotential(): number {
    if (this.potentialFieldX.length === 0) return 0;
    return this.potentialFieldX.reduce((sum, val) => sum + val, 0) / this.potentialFieldX.length;
  }

  reset(): void {
    this.potentialFieldX.fill(0);
    this.potentialFieldY.fill(0);
    this.highDensityRegions.clear();
  }

  update(deltaSeconds: number): void {
    const count = this.particles.length;
    if (count === 0) return;

    // Calculate particle positions in normalized space
    const xNorms = new Float32Array(count);
    const yNorms = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const particle = this.particles[i]!;
      xNorms[i] = particle.x / this.width * 2 - 1;
      yNorms[i] = particle.y / this.height * 2 - 1;

      // Update potential field around each particle
      this.updatePotentialField(particle);
    }

    // Update particle positions based on gradient and exploration
    for (let i = 0; i < count; i += 1) {
      const particle = this.particles[i]!;
      
      // Get gradient at current position
      let gradientX = 0;
      let gradientY = 0;

      // Sample nearby points to estimate gradient
      const sampleRadius = this.settings.attractionRadius / 3;
      const sampleStep = sampleRadius / 4;
      for (let dx = -2; dx <= 2; dx += 1) {
        for (let dy = -2; dy <= 2; dy += 1) {
          const testX = xNorms[i] + dx * sampleStep;
          const testY = yNorms[i] + dy * sampleStep;
          
          // Estimate potential at sampled point
          let localGradientX = 0;
          let localGradientY = 0;

          for (let j = 0; j < count; j += 1) {
            if (i === j) continue;
            
            const particleJ = this.particles[j]!;
            const nx = particleJ.x / this.width * 2 - 1;
            const ny = particleJ.y / this.height * 2 - 1;

            const dxIJ = nx - testX;
            const dyIJ = ny - testY;
            const distSq = dxIJ * dxIJ + dyIJ * dyIJ;

            if (distSq > 0 && distSq < sampleRadius * sampleRadius) {
              const density = Math.exp(-distSq / (sampleRadius * 0.3));
              localGradientX += nx * density;
              localGradientY += ny * density;
            }
          }

          gradientX += localGradientX;
          gradientY += localGradientY;
        }
      }

      // Normalize gradient
      const mag = Math.sqrt(gradientX * gradientX + gradientY * gradientY);
      if (mag > 0) {
        gradientX /= mag;
        gradientY /= mag;
      }

      // Move particles: exploration + attraction to high density regions
      const explorationAngle = (Math.random() - 0.5) * this.settings.explorationRate * Math.PI * 2;
      const explorationX = Math.cos(explorationAngle) * this.settings.stepSize;
      const explorationY = Math.sin(explorationAngle) * this.settings.stepSize;

      const attractX = gradientX * this.settings.stepSize * 0.45;
      const attractY = gradientY * this.settings.stepSize * 0.45;

      const newX = xNorms[i] + explorationX + attractX;
      const newY = yNorms[i] + explorationY + attractY;

      xNorms[i] = clamp(newX, -1.2, 1.2);
      yNorms[i] = clamp(newY, -1.2, 1.2);

      // Update particle color based on potential (warm colors in high density)
      const localPotential = this.potentialFieldX[i]! + this.potentialFieldY[i]!;
      const normalizedPotential = Math.max(0, 1 - localPotential / this.avgPotential);
      colorByDensity(particle, normalizedPotential);
    }

    // Apply new positions
    for (let i = 0; i < count; i += 1) {
      const particle = this.particles[i]!;
      const xPx = (xNorms[i] + 1) * 0.5 * this.width;
      const yPx = (yNorms[i] + 1) * 0.5 * this.height;
      
      particle.x = clamp(xPx, 0, this.width);
      particle.y = clamp(yPx, 0, this.height);
    }

    // Update potential field for next frame
    for (let i = 0; i < count; i += 1) {
      const particle = this.particles[i]!;
      const nx = particle.x / this.width * 2 - 1;
      const ny = particle.y / this.height * 2 - 1;

      // Update potential field with Gaussian-like influence
      for (let j = 0; j < count; j += 1) {
        if (i === j) continue;

        const particleJ = this.particles[j]!;
        const dx = nx - particleJ.x / this.width * 2 + 1;
        const dy = ny - particleJ.y / this.height * 2 + 1;
        
        const distSq = dx * dx + dy * dy;
        if (distSq > 0 && distSq < this.settings.attractionRadius * this.settings.attractionRadius) {
          const influence = Math.exp(-distSq / (this.settings.attractionRadius * 0.25));
          this.potentialFieldX[j] += dx * influence;
          this.potentialFieldY[j] += dy * influence;
        }
      }
    }

    // Record high density regions for reference
    const hotspots = this.getHotspots(count, 10);
    this.highDensityRegions.clear();
    for (const hotspot of hotspots) {
      this.highDensityRegions.add(hotspot.index);
    }
  }

  private updatePotentialField(particle: Particle): void {
    const nx = particle.x / this.width * 2 - 1;
    const ny = particle.y / this.height * 2 - 1;

    // Update potential at all positions
    for (let i = 0; i < this.potentialFieldX.length; i += 1) {
      const px = (this.potentialFieldX.indexOf(i)) / (this.potentialFieldX.length - 1);
      const py = (this.potentialFieldY.indexOf(i)) / (this.potentialFieldY.length - 1);

      if (isNaN(px) || isNaN(py)) continue;

      const dx = px - nx;
      const dy = py - ny;
      const distSq = dx * dx + dy * dy;
      
      if (distSq > 0 && distSq < this.settings.attractionRadius * this.settings.attractionRadius) {
        const influence = Math.exp(-distSq / (this.settings.attractionRadius * 0.25));
        this.potentialFieldX[i] -= dx * influence;
        this.potentialFieldY[i] -= dy * influence;
      }
    }
  }

  private getHotspots(count: number, num: number): { index: number; potential: number }[] {
    if (this.potentialFieldX.length === 0) return [];

    const potentials = this.potentialFieldX
      .map((_, i) => ({
        index: i,
        potential: this.potentialFieldX[i] + this.potentialFieldY[i],
      }))
      .sort((a, b) => b.potential - a.potential);

    return potentials.slice(0, num);
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function colorByDensity(particle: Particle, normalized: number): void {
  // Warm colors for high density (red/yellow), cool for low (blue)
  const hue = 0.35 + normalized * 0.42;
  const saturation = 0.75;
  const lightness = 0.62 + normalized * 0.28;

  const [r, g, b] = hslToRgb(hue, saturation, lightness);
  particle.r = r;
  particle.g = g;
  particle.b = b;
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const channel = (n: number): number => {
    const k = (n + hue * 12) % 12;
    const a = saturation * Math.min(lightness, 1 - lightness);
    return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
}
