import '@fontsource/pacifico/400.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/800.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/orbitron/700.css';
import './style.css';

import * as THREE from 'three';
import { createLayout } from './scene/layout.js';
import { createStarfield } from './scene/starfield.js';
import { createConstellation } from './scene/constellation.js';
import { createIcons } from './scene/icons.js';
import { createCompass } from './scene/compass.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 0, 10);

const layout = createLayout(camera);
const starfield = createStarfield();
const constellation = createConstellation();
const icons = createIcons();
const compass = createCompass();
scene.add(starfield.object, constellation.object, icons.object, compass.object);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const state = {
  delta: 0,
  intro: 0,
  motion: reducedMotion.matches ? 0.2 : 1,
  pointer: new THREE.Vector2(), // smoothed, -1..1
  pointerTarget: new THREE.Vector2(),
  pointerWorld: new THREE.Vector2(),
  pointerActive: false,
};
let lastPointerMove = -Infinity;

reducedMotion.addEventListener('change', (event) => {
  state.motion = event.matches ? 0.2 : 1;
});

window.addEventListener('pointermove', (event) => {
  state.pointerTarget.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1,
  );
  lastPointerMove = performance.now();
});

window.addEventListener('pointerleave', () => {
  state.pointerTarget.set(0, 0);
  lastPointerMove = -Infinity;
});

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio, 2);

  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  layout.update();

  // Glow sprites are sized in CSS pixels; keep them proportionate on small/large screens.
  const pointScale = THREE.MathUtils.clamp(Math.min(width, height) / 700, 0.7, 1.3);
  const context = { pixelRatio, pointScale, compassCenter: compass.center };

  compass.resize(layout, context);
  starfield.resize(context);
  constellation.resize(layout, context);
  icons.resize(layout);

  // Let the HTML wordmark sit just under the compass.
  const pxPerUnit = height / layout.height;
  const root = document.documentElement.style;
  root.setProperty('--compass-center-y', `${layout.compassAnchor * height}px`);
  root.setProperty('--compass-radius', `${layout.compassRadius * pxPerUnit}px`);
}

window.addEventListener('resize', resize);
resize();

const timer = new THREE.Timer();
timer.connect(document);

renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  const time = timer.getElapsed();
  state.delta = timer.getDelta();

  state.intro = Math.min(1, state.intro + state.delta / 1.6);
  const easedIntro = 1 - (1 - state.intro) ** 3;

  state.pointer.lerp(state.pointerTarget, 1 - Math.exp(-state.delta * 3));
  state.pointerActive = performance.now() - lastPointerMove < 2500;
  state.pointerWorld.set(
    (state.pointerTarget.x * layout.width) / 2,
    (state.pointerTarget.y * layout.height) / 2,
  );

  const frame = { ...state, intro: easedIntro };
  starfield.update(time, frame);
  constellation.update(time, frame);
  icons.update(time, frame);
  compass.update(time, frame);

  renderer.render(scene, camera);
});
