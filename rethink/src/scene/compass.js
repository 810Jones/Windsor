import * as THREE from 'three';
import { createGlowMaterial } from './glowPoints.js';

const REST_ANGLE = 0.62; // needle tip points up-left, as in the artwork
const TAU = Math.PI * 2;

const ringGradient = /* glsl */ `
  vec3 ringColor(vec2 p) {
    vec3 teal = vec3(0.31, 0.88, 0.77);
    vec3 purple = vec3(0.56, 0.42, 0.98);
    float t = 0.5 - 0.5 * dot(normalize(p), normalize(vec2(-0.55, 0.85)));
    return mix(teal, purple, smoothstep(0.15, 0.85, t));
  }
`;

function shaderMaterial({ fragmentShader, blending = THREE.NormalBlending, uniforms = {} }) {
  return new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 }, ...uniforms },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending,
  });
}

function triangles(vertices, colors) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function hex(value) {
  const c = new THREE.Color(value);
  return [c.r, c.g, c.b];
}

/**
 * The central compass, built at unit radius and scaled to the layout. The
 * needle is spring-driven: it spins in on load, idles with a gentle wobble and
 * swings toward the pointer while it moves.
 */
export function createCompass() {
  const group = new THREE.Group();
  const fadeMaterials = [];
  let order = 10;

  function add(object, opacity = 1) {
    object.renderOrder = order++;
    object.userData.opacity = opacity;
    if (object.material) fadeMaterials.push(object);
    group.add(object);
    return object;
  }

  // Outer glow
  add(new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 3.2),
    shaderMaterial({
      blending: THREE.AdditiveBlending,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        uniform float uTime;
        varying vec2 vPos;
        ${ringGradient}
        void main() {
          float r = length(vPos);
          float ring = exp(-pow((r - 1.0) * 7.0, 2.0)) * 0.55;
          float halo = exp(-pow(max(r - 1.0, 0.0) * 2.2, 2.0)) * 0.12 * step(0.95, r);
          float pulse = 0.85 + 0.15 * sin(uTime * 1.4);
          gl_FragColor = vec4(ringColor(vPos), (ring + halo) * pulse * uOpacity);
        }
      `,
    }),
  ));

  // Face with a slow radar sweep
  add(new THREE.Mesh(
    new THREE.CircleGeometry(0.97, 128),
    shaderMaterial({
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        uniform float uTime;
        varying vec2 vPos;
        void main() {
          float r = length(vPos);
          vec3 inner = vec3(0.10, 0.17, 0.33);
          vec3 outer = vec3(0.035, 0.05, 0.13);
          vec3 col = mix(inner, outer, smoothstep(0.0, 0.97, r));

          float angle = atan(vPos.y, vPos.x);
          float sweep = fract((angle - uTime * 0.6) / 6.2831853);
          col += vec3(0.2, 0.75, 0.68) * pow(sweep, 10.0) * 0.12 * smoothstep(0.97, 0.2, r);

          gl_FragColor = vec4(col, uOpacity);
        }
      `,
    }),
  ));

  // Gradient ring
  add(new THREE.Mesh(
    new THREE.RingGeometry(0.955, 1.0, 192),
    shaderMaterial({
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec2 vPos;
        ${ringGradient}
        void main() {
          gl_FragColor = vec4(ringColor(vPos), uOpacity);
        }
      `,
    }),
  ));

  // Dotted inner ring
  const dotCount = 72;
  const dots = new THREE.BufferGeometry();
  const dotPositions = [];
  for (let i = 0; i < dotCount; i++) {
    const a = (i / dotCount) * TAU;
    dotPositions.push(Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0);
  }
  dots.setAttribute('position', new THREE.Float32BufferAttribute(dotPositions, 3));
  dots.setAttribute('color', new THREE.Float32BufferAttribute(Array(dotCount).fill([0.45, 0.55, 0.75]).flat(), 3));
  dots.setAttribute('size', new THREE.Float32BufferAttribute(Array(dotCount).fill(3), 1));
  dots.setAttribute('phase', new THREE.Float32BufferAttribute(Array.from({ length: dotCount }, (_, i) => i * 0.4), 1));
  const dotMaterial = createGlowMaterial({ twinkle: 0.35 });
  add(new THREE.Points(dots, dotMaterial), 0.6);

  // Cardinal ticks
  const tickMaterial = new THREE.MeshBasicMaterial({ color: 0xcfd6e4, transparent: true, depthTest: false, depthWrite: false });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.12), tickMaterial.clone());
    tick.position.set(Math.sin(a) * 0.85, Math.cos(a) * 0.85, 0);
    tick.rotation.z = -a;
    add(tick, 0.85);
  }

  // Needle: orange "north" half and teal "south" half, each two-toned for a bevel.
  const L = 0.62;
  const W = 0.12;
  const needle = new THREE.Group();
  const needleMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const needleGeometry = triangles(
    [
      0, L, 0, -W, 0, 0, 0, 0, 0,
      0, L, 0, 0, 0, 0, W, 0, 0,
      0, -L, 0, 0, 0, 0, -W, 0, 0,
      0, -L, 0, W, 0, 0, 0, 0, 0,
    ],
    [
      ...hex('#f5b14c'), ...hex('#f5b14c'), ...hex('#f5b14c'),
      ...hex('#dc8f2e'), ...hex('#dc8f2e'), ...hex('#dc8f2e'),
      ...hex('#3dbfa5'), ...hex('#3dbfa5'), ...hex('#3dbfa5'),
      ...hex('#5ae0c4'), ...hex('#5ae0c4'), ...hex('#5ae0c4'),
    ],
  );
  const needleMesh = new THREE.Mesh(needleGeometry, needleMaterial);
  needle.add(needleMesh);

  const hubOuter = new THREE.Mesh(
    new THREE.CircleGeometry(0.085, 48),
    new THREE.MeshBasicMaterial({ color: 0xeaf4f2, transparent: true, depthTest: false, depthWrite: false }),
  );
  const hubInner = new THREE.Mesh(
    new THREE.CircleGeometry(0.042, 48),
    new THREE.MeshBasicMaterial({ color: 0x0b1328, transparent: true, depthTest: false, depthWrite: false }),
  );
  needle.add(hubOuter, hubInner);
  for (const part of [needleMesh, hubOuter, hubInner]) {
    part.renderOrder = order++;
    part.userData.opacity = 1;
    fadeMaterials.push(part);
  }
  group.add(needle);

  // Radar pings expanding out from the ring
  const pings = [0, 0.5].map((offset) => {
    const ping = add(new THREE.Mesh(
      new THREE.RingGeometry(0.985, 1.0, 160),
      new THREE.MeshBasicMaterial({
        color: 0x7fe6d4,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ), 0);
    ping.renderOrder = 9;
    return { mesh: ping, offset };
  });

  // Spring state for the needle
  let angle = REST_ANGLE + TAU * 2; // spins in on load
  let velocity = 0;
  const center = new THREE.Vector2();
  let radius = 1;

  return {
    object: group,
    center,

    resize(layout, { pixelRatio, pointScale }) {
      radius = layout.compassRadius;
      group.scale.setScalar(radius);
      group.position.set(0, (0.5 - layout.compassAnchor) * layout.height, 0);
      center.set(group.position.x, group.position.y);
      dotMaterial.uniforms.uScale.value = pixelRatio * pointScale;
    },

    update(time, { delta, intro, motion, pointerWorld, pointerActive }) {
      // Needle target: follow the pointer while it's active, otherwise idle wobble.
      let target = REST_ANGLE + (Math.sin(time * 0.9) * 0.09 + Math.sin(time * 2.3) * 0.03) * motion;
      if (pointerActive) {
        const dx = pointerWorld.x - center.x;
        const dy = pointerWorld.y - center.y;
        if (dx * dx + dy * dy > (radius * 0.3) ** 2) target = Math.atan2(dy, dx) - Math.PI / 2;
      }
      let diff = target - angle;
      if (Math.abs(diff) < TAU * 1.5) diff = THREE.MathUtils.euclideanModulo(diff + Math.PI, TAU) - Math.PI;

      const dt = Math.min(delta, 1 / 30);
      velocity += (diff * 14 - velocity * 4.2) * dt;
      angle += velocity * dt;
      if (Math.abs(angle) > TAU * 4) angle = THREE.MathUtils.euclideanModulo(angle, TAU);
      needle.rotation.z = angle;

      group.scale.setScalar(radius * (0.86 + 0.14 * intro));

      for (const object of fadeMaterials) {
        const material = object.material;
        const value = object.userData.opacity * intro;
        if (material.uniforms?.uOpacity) {
          material.uniforms.uOpacity.value = value;
          material.uniforms.uTime.value = time;
        } else {
          material.opacity = value;
        }
      }

      for (const { mesh, offset } of pings) {
        const t = (time * 0.28 + offset) % 1;
        mesh.scale.setScalar(1 + t * 0.9);
        mesh.material.opacity = (1 - t) ** 2 * 0.35 * intro * motion;
      }
    },
  };
}
