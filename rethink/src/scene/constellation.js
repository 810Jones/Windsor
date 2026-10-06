import * as THREE from 'three';
import { createGlowMaterial } from './glowPoints.js';

const TEAL = [0.31, 0.88, 0.77];
const PURPLE = [0.55, 0.45, 0.98];
const DIM = [0.45, 0.5, 0.6];

// Node positions in normalized screen space (0..1, top-left origin), traced
// from the splash artwork. `compass` is a virtual node at the compass centre.
const NODES = {
  a: { at: [0.27, 0.078], color: TEAL },
  b: { at: [0.505, 0.07], color: TEAL },
  c: { at: [0.315, 0.104], color: TEAL, size: 1.3 },
  d: { at: [0.355, 0.186], color: TEAL },
  e: { at: [0.235, 0.212], color: TEAL },
  f: { at: [0.31, 0.232], color: PURPLE },
  g: { at: [0.36, 0.27], color: PURPLE },
  h: { at: [0.215, 0.322], color: PURPLE },
  i: { at: [0.265, 0.345], color: TEAL },
  j: { at: [0.64, 0.49], color: TEAL },
  k: { at: [0.255, 0.545], color: TEAL },
  l: { at: [0.075, 0.595], color: PURPLE },
  m: { at: [0.42, 0.548], color: PURPLE, size: 0.8 },
  n: { at: [0.09, 0.695], color: DIM, size: 0.7 },
  o: { at: [0.605, 0.663], color: PURPLE },
  p: { at: [0.425, 0.725], color: TEAL },
  q: { at: [0.695, 0.775], color: TEAL },
  r: { at: [0.695, 0.825], color: DIM, size: 0.7 },
  s: { at: [0.615, 0.912], color: TEAL },
  t: { at: [0.7, 0.9], color: PURPLE, size: 0.8 },
  compass: { at: null, hidden: true },
};

const EDGES = [
  ['a', 'b'], ['a', 'c'], ['c', 'b'], ['c', 'd'], ['c', 'h'],
  ['d', 'e'], ['d', 'f'], ['d', 'g'], ['e', 'f'], ['e', 'h'],
  ['f', 'g'], ['f', 'h'], ['g', 'i'], ['h', 'i'], ['f', 'i'],
  ['compass', 'j'], ['j', 'm'], ['m', 'l'], ['k', 'l'], ['l', 'n'],
  ['o', 'p'], ['o', 'q'], ['q', 'r'], ['r', 's'], ['s', 't'],
];

const SIGNAL_COUNT = 4;

/**
 * The constellation network: drifting glow nodes linked by faint lines, with
 * a few bright "signals" travelling along the edges.
 */
export function createConstellation() {
  const ids = Object.keys(NODES);
  const index = Object.fromEntries(ids.map((id, i) => [id, i]));
  const visible = ids.filter((id) => !NODES[id].hidden);

  const base = ids.map(() => new THREE.Vector2());
  const current = ids.map(() => new THREE.Vector2());
  const drift = ids.map(() => ({
    phase: Math.random() * Math.PI * 2,
    speed: 0.15 + Math.random() * 0.2,
  }));

  // Lines
  const linePositions = new Float32Array(EDGES.length * 2 * 3);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x7d8fc4,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  lines.frustumCulled = false;
  lines.renderOrder = 1;

  // Nodes
  const nodePositions = new Float32Array(visible.length * 3);
  const nodeGeometry = new THREE.BufferGeometry();
  nodeGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
  nodeGeometry.setAttribute(
    'color',
    new THREE.BufferAttribute(new Float32Array(visible.flatMap((id) => NODES[id].color)), 3),
  );
  nodeGeometry.setAttribute(
    'size',
    new THREE.BufferAttribute(new Float32Array(visible.map((id) => 20 * (NODES[id].size ?? 1))), 1),
  );
  nodeGeometry.setAttribute(
    'phase',
    new THREE.BufferAttribute(new Float32Array(visible.map(() => Math.random() * Math.PI * 2)), 1),
  );
  const nodeMaterial = createGlowMaterial({ twinkle: 0.25 });
  const nodes = new THREE.Points(nodeGeometry, nodeMaterial);
  nodes.frustumCulled = false;
  nodes.renderOrder = 2;

  // Signals travelling along edges
  const signalPositions = new Float32Array(SIGNAL_COUNT * 3);
  const signalGeometry = new THREE.BufferGeometry();
  signalGeometry.setAttribute('position', new THREE.BufferAttribute(signalPositions, 3));
  signalGeometry.setAttribute(
    'color',
    new THREE.BufferAttribute(new Float32Array(Array.from({ length: SIGNAL_COUNT }, () => [0.75, 1, 0.95]).flat()), 3),
  );
  signalGeometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(SIGNAL_COUNT).fill(10), 1));
  signalGeometry.setAttribute('phase', new THREE.BufferAttribute(new Float32Array(SIGNAL_COUNT), 1));
  const signalMaterial = createGlowMaterial({ twinkle: 0 });
  const signals = new THREE.Points(signalGeometry, signalMaterial);
  signals.frustumCulled = false;
  signals.renderOrder = 3;

  const signalState = Array.from({ length: SIGNAL_COUNT }, (_, i) => newSignal(i * 0.9));

  function newSignal(delay = 0) {
    const [from, to] = EDGES[(Math.random() * EDGES.length) | 0];
    const forward = Math.random() < 0.5;
    return {
      from: index[forward ? from : to],
      to: index[forward ? to : from],
      start: -delay,
      duration: 1.8 + Math.random() * 1.6,
    };
  }

  const group = new THREE.Group();
  group.add(lines, nodes, signals);

  let elapsed = 0;
  const point = { x: 0, y: 0 };

  return {
    object: group,

    resize(layout, { pixelRatio, pointScale, compassCenter }) {
      ids.forEach((id, i) => {
        if (id === 'compass') {
          base[i].copy(compassCenter);
        } else {
          layout.toWorld(...NODES[id].at, point);
          base[i].set(point.x, point.y);
        }
      });
      nodeMaterial.uniforms.uScale.value = pixelRatio * pointScale;
      signalMaterial.uniforms.uScale.value = pixelRatio * pointScale;
      this.driftAmount = layout.height * 0.004;
    },

    driftAmount: 0,

    update(time, { delta, intro, pointer, motion }) {
      elapsed += delta;

      const offsetX = -pointer.x * this.driftAmount * 6;
      const offsetY = -pointer.y * this.driftAmount * 6;
      group.position.set(offsetX, offsetY, 0);

      ids.forEach((id, i) => {
        if (id === 'compass') {
          // The compass doesn't parallax, so cancel the group offset for it.
          current[i].set(base[i].x - offsetX, base[i].y - offsetY);
          return;
        }
        const { phase, speed } = drift[i];
        const amount = this.driftAmount * motion;
        current[i].set(
          base[i].x + Math.sin(time * speed + phase) * amount,
          base[i].y + Math.cos(time * speed * 0.8 + phase) * amount,
        );
      });

      EDGES.forEach(([from, to], e) => {
        const a = current[index[from]];
        const b = current[index[to]];
        linePositions.set([a.x, a.y, 0, b.x, b.y, 0], e * 6);
      });
      lineGeometry.attributes.position.needsUpdate = true;

      visible.forEach((id, v) => {
        const p = current[index[id]];
        nodePositions.set([p.x, p.y, 0], v * 3);
      });
      nodeGeometry.attributes.position.needsUpdate = true;

      signalState.forEach((signal, s) => {
        let t = (elapsed - signal.start) / signal.duration;
        if (t >= 1) {
          signalState[s] = newSignal(Math.random() * 1.5);
          signalState[s].start += elapsed;
          t = 0;
        }
        const a = current[signal.from];
        const b = current[signal.to];
        const k = THREE.MathUtils.clamp(t, 0, 1);
        signalPositions.set([a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 0], s * 3);
        // Fade in/out at the ends of each trip.
        signalGeometry.attributes.size.array[s] = t <= 0 ? 0 : 10 * Math.sin(Math.PI * k);
      });
      signalGeometry.attributes.position.needsUpdate = true;
      signalGeometry.attributes.size.needsUpdate = true;

      nodeMaterial.uniforms.uTime.value = time;
      nodeMaterial.uniforms.uOpacity.value = intro;
      signalMaterial.uniforms.uOpacity.value = intro * motion;
      lineMaterial.opacity = 0.34 * intro;
    },
  };
}
