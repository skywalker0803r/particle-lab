import Stats from 'stats.js';
import { Pane } from 'tweakpane';
import type { BaseAlgorithm } from './algorithms/BaseAlgorithm';
import { BoidsAlgorithm, type BoidsSettings } from './algorithms/BoidsAlgorithm';
import { ParticleSwarmOptimization, type PsoSettings } from './algorithms/ParticleSwarmOptimization';
import { ParticleRenderer } from './ParticleRenderer';
import './style.css';

type AlgorithmName = 'boids' | 'pso';

const canvas = getElement<HTMLCanvasElement>('#simulation');
const canvasWrap = getElement<HTMLDivElement>('#canvas-wrap');
const algorithmSelect = getElement<HTMLSelectElement>('#algorithm-select');
const particleCountInput = getElement<HTMLInputElement>('#particle-count');
const particleCountValue = getElement<HTMLSpanElement>('#particle-count-value');
const pauseButton = getElement<HTMLButtonElement>('#pause-button');
const simulationToolbar = getElement<HTMLDivElement>('.simulation-toolbar');
const pauseLabel = getElement<HTMLSpanElement>('#pause-label');
const resetButton = getElement<HTMLButtonElement>('#reset-button');
const paneContainer = getElement<HTMLDivElement>('#tweakpane-container');
const statusLabel = getElement<HTMLSpanElement>('#metric-status');
const fpsLabel = getElement<HTMLSpanElement>('#metric-fps');
const countMetric = getElement<HTMLElement>('#metric-particles');
const algorithmMetric = getElement<HTMLElement>('#metric-algorithm');
const algorithmDetail = getElement<HTMLElement>('#metric-detail');
const algorithmLabel = getElement<HTMLElement>('#algorithm-label');
const canvasMode = getElement<HTMLElement>('#canvas-mode');
const statusDot = getElement<HTMLElement>('.status-dot');

const boidsSettings: BoidsSettings = {
  perceptionRadius: 30,
  separationWeight: 1.5,
  alignmentWeight: 1,
  cohesionWeight: 1,
  maxSpeed: 82,
};
const psoSettings: PsoSettings = {
  inertia: 0.72,
  cognitive: 1.45,
  social: 1.45,
};

let algorithmName: AlgorithmName = 'boids';
let algorithm: BaseAlgorithm;
let renderer: ParticleRenderer;
let pane: Pane | undefined;
let paused = false;
let previousTime = 0;
let frames = 0;
let fpsElapsed = 0;

function getElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required page element not found: ${selector}`);
  return element;
}

function createAlgorithm(name: AlgorithmName, count: number): BaseAlgorithm {
  if (name === 'boids') {
    const boids = new BoidsAlgorithm(count);
    boids.setSettings(boidsSettings);
    return boids;
  }
  const pso = new ParticleSwarmOptimization(count);
  pso.setSettings(psoSettings);
  return pso;
}

function updateViewport(): void {
  const { width, height } = canvasWrap.getBoundingClientRect();
  renderer.resize(width, height);
  algorithm.resize(width, height);
}

function setAlgorithm(name: AlgorithmName, count: number): void {
  algorithmName = name;
  algorithm = createAlgorithm(name, count);
  updateViewport();
  renderer.setParticleCount(count);
  updateLabels(count);
  createPane();
  renderer.render(algorithm.particles);
}

function updateLabels(count: number): void {
  const formattedCount = count.toLocaleString('en-US');
  particleCountValue.textContent = formattedCount;
  countMetric.textContent = formattedCount;
  if (algorithmName === 'boids') {
    algorithmLabel.textContent = 'BOIDS FLOCKING';
    canvasMode.textContent = 'SEPARATION · ALIGNMENT · COHESION';
    algorithmMetric.textContent = 'BOIDS';
    algorithmDetail.textContent = 'EMERGENT FLOCKING';
    return;
  }
  algorithmLabel.textContent = 'PARTICLE SWARM OPTIMIZATION';
  canvasMode.textContent = 'PERSONAL BEST · GLOBAL BEST · CONVERGENCE';
  algorithmMetric.textContent = 'PSO';
  algorithmDetail.textContent = 'GLOBAL OPTIMIZATION';
}

function createPane(): void {
  pane?.dispose();
  pane = new Pane({ container: paneContainer, title: '演算法參數' });
  if (algorithmName === 'boids') {
    pane.addInput(boidsSettings, 'perceptionRadius', {
      label: '感知距離',
      min: 15,
      max: 100,
      step: 1,
    }).on('change', ({ value }) => {
      if (algorithm instanceof BoidsAlgorithm) {
        algorithm.setSettings({ perceptionRadius: value });
      }
    });
    pane.addInput(boidsSettings, 'separationWeight', {
      label: '分離 Separation',
      min: 0,
      max: 3,
      step: 0.05,
    }).on('change', ({ value }) => {
      if (algorithm instanceof BoidsAlgorithm) {
        algorithm.setSettings({ separationWeight: value });
      }
    });
    pane.addInput(boidsSettings, 'alignmentWeight', {
      label: '對齊 Alignment',
      min: 0,
      max: 3,
      step: 0.05,
    }).on('change', ({ value }) => {
      if (algorithm instanceof BoidsAlgorithm) {
        algorithm.setSettings({ alignmentWeight: value });
      }
    });
    pane.addInput(boidsSettings, 'cohesionWeight', {
      label: '凝聚 Cohesion',
      min: 0,
      max: 3,
      step: 0.05,
    }).on('change', ({ value }) => {
      if (algorithm instanceof BoidsAlgorithm) {
        algorithm.setSettings({ cohesionWeight: value });
      }
    });
    pane.addInput(boidsSettings, 'maxSpeed', {
      label: '最大速度',
      min: 20,
      max: 180,
      step: 1,
    }).on('change', ({ value }) => {
      if (algorithm instanceof BoidsAlgorithm) {
        algorithm.setSettings({ maxSpeed: value });
      }
    });
    return;
  }

  pane.addInput(psoSettings, 'inertia', {
    label: '慣性權重',
    min: 0.1,
    max: 1.2,
    step: 0.01,
  }).on('change', ({ value }) => {
    if (algorithm instanceof ParticleSwarmOptimization) {
      algorithm.setSettings({ inertia: value });
    }
  });
  pane.addInput(psoSettings, 'cognitive', {
    label: '個體學習',
    min: 0,
    max: 3,
    step: 0.05,
  }).on('change', ({ value }) => {
    if (algorithm instanceof ParticleSwarmOptimization) {
      algorithm.setSettings({ cognitive: value });
    }
  });
  pane.addInput(psoSettings, 'social', {
    label: '群體學習',
    min: 0,
    max: 3,
    step: 0.05,
  }).on('change', ({ value }) => {
    if (algorithm instanceof ParticleSwarmOptimization) {
      algorithm.setSettings({ social: value });
    }
  });
}

function setPaused(nextPaused: boolean): void {
  paused = nextPaused;
  pauseButton.setAttribute('aria-label', paused ? '繼續模擬' : '暫停模擬');
  pauseLabel.textContent = paused ? '繼續' : '暫停';
  statusLabel.textContent = paused ? '已暫停' : '運作中';
  statusDot.classList.toggle('is-paused', paused);
}

function animate(time: number): void {
  const elapsedSeconds = previousTime === 0 ? 0 : (time - previousTime) / 1000;
  const deltaSeconds = Math.min(elapsedSeconds, 0.04);
  previousTime = time;
  if (!paused) {
    algorithm.update(deltaSeconds);
    renderer.render(algorithm.particles);
  }
  stats.update();
  frames += 1;
  fpsElapsed += elapsedSeconds;
  if (fpsElapsed >= 0.5) {
    fpsLabel.textContent = String(Math.round(frames / fpsElapsed));
    if (algorithm instanceof ParticleSwarmOptimization) {
      algorithmDetail.textContent = `BEST FITNESS ${algorithm.bestFitness.toFixed(4)}`;
    }
    frames = 0;
    fpsElapsed = 0;
  }
  requestAnimationFrame(animate);
}

function start(): void {
  const count = Number(particleCountInput.value);
  algorithm = createAlgorithm(algorithmName, count);
  renderer = new ParticleRenderer(canvas, count);
  updateViewport();
  updateLabels(count);
  createPane();

  const resizeObserver = new ResizeObserver(updateViewport);
  resizeObserver.observe(canvasWrap);

  algorithmSelect.addEventListener('change', () => {
    setAlgorithm(algorithmSelect.value as AlgorithmName, Number(particleCountInput.value));
  });
  particleCountInput.addEventListener('input', () => {
    particleCountValue.textContent = Number(particleCountInput.value).toLocaleString('en-US');
  });
  particleCountInput.addEventListener('change', () => {
    setAlgorithm(algorithmName, Number(particleCountInput.value));
  });
  pauseButton.addEventListener('click', () => setPaused(!paused));
  resetButton.addEventListener('click', () => {
    setAlgorithm(algorithmName, Number(particleCountInput.value));
    setPaused(false);
  });

  stats.showPanel(0);
  stats.domElement.classList.add('stats-panel');
  simulationToolbar.insertBefore(stats.domElement, pauseButton);
  requestAnimationFrame(animate);
}

const stats = new Stats();

try {
  start();
} catch (error) {
  console.error('Unable to start the particle simulation.', error);
  const alert = document.createElement('div');
  alert.className = 'fatal-error';
  alert.setAttribute('role', 'alert');
  alert.textContent = '無法啟動 WebGL 粒子模擬，請確認瀏覽器支援 WebGL 2.0 後重新載入。';
  document.body.append(alert);
  statusLabel.textContent = '啟動失敗';
}
