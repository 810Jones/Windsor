import '@fontsource/pacifico/400.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/800.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/orbitron/700.css';
import './style.css';

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createLayout } from './scene/layout.js';
import { createNebula } from './scene/nebula.js';
import { createStarfield } from './scene/starfield.js';
import { createConstellation } from './scene/constellation.js';
import { createIcons } from './scene/icons.js';
import { createCompass } from './scene/compass.js';

const CAMERA_DISTANCE = 10;
const INTRO_SECONDS = 2.4;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
camera.position.set(0, 0, CAMERA_DISTANCE);

// Studio reflections for the metal bezel, needle and glass dome.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
scene.add(new THREE.AmbientLight(0x6a6fa8, 0.25));

const layout = createLayout(camera, CAMERA_DISTANCE);
const nebula = createNebula();
const starfield = createStarfield();
const constellation = createConstellation();
const icons = createIcons();
const compass = createCompass();

// Everything except the nebula lives in a "world" that tilts around the
// compass centre, so the compass stays put while depth layers parallax.
const world = new THREE.Group();
const content = new THREE.Group();
content.add(starfield.object, constellation.object, icons.object, compass.object);
world.add(content);
scene.add(nebula.object, world);

// Post-processing: multisampled render → bloom → tone mapping/sRGB output.
const composer = new EffectComposer(
  renderer,
  new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
);
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.35, 0.82);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(bloom);
composer.addPass(new OutputPass());

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
  // Bloom is fill-rate heavy, so cap the pixel ratio a little lower than usual.
  const pixelRatio = Math.min(window.devicePixelRatio, 1.75);

  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);
  bloom.resolution.set(width / 2, height / 2);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  layout.update();

  // Glow sprites are sized in CSS pixels; keep them proportionate on small/large screens.
  const pointScale = THREE.MathUtils.clamp(Math.min(width, height) / 700, 0.7, 1.3);
  const context = { width, height, pixelRatio, pointScale, aspect: camera.aspect, compassCenter: compass.center };

  compass.resize(layout, context);
  nebula.resize(context);
  starfield.resize(context);
  constellation.resize(layout, context);
  icons.resize(layout, context);

  // Tilt the world around the compass centre.
  world.position.set(compass.center.x, compass.center.y, 0);
  content.position.set(-compass.center.x, -compass.center.y, 0);

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
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  const time = timer.getElapsed();
  state.delta = timer.getDelta();

  state.intro = Math.min(1, state.intro + state.delta / INTRO_SECONDS);
  const easedIntro = easeOutCubic(state.intro);

  state.pointer.lerp(state.pointerTarget, 1 - Math.exp(-state.delta * 3));
  state.pointerActive = performance.now() - lastPointerMove < 2500;
  state.pointerWorld.set(
    (state.pointerTarget.x * layout.width) / 2,
    (state.pointerTarget.y * layout.height) / 2,
  );

  // Camera flies in from deep space, then the world tilts with the pointer
  // (or sways on its own when nobody is touching it).
  const flyIn = reducedMotion.matches ? 1 : easedIntro;
  camera.position.z = CAMERA_DISTANCE + (1 - flyIn) * 26;
  const sway = state.motion * 0.05;
  world.rotation.y = state.pointer.x * 0.16 + Math.sin(time * 0.21) * sway;
  world.rotation.x = -state.pointer.y * 0.12 + Math.cos(time * 0.17) * sway * 0.6;
  world.rotation.z = (1 - flyIn) * 0.35;

  const frame = { ...state, intro: easedIntro };
  nebula.update(time, frame);
  starfield.update(time, frame);
  constellation.update(time, frame);
  icons.update(time, frame);
  compass.update(time, frame);

  composer.render();
});
