import * as THREE from 'three';
import { createGlowMaterial } from './glowPoints.js';

const REST_ANGLE = 0.62; // needle tip points up-left, as in the artwork
const TAU = Math.PI * 2;
const TEAL = new THREE.Color('#4fe0c4');
const PURPLE = new THREE.Color('#8f6cf6');

/** Teal (top-left) → violet (bottom) around the ring, as in the artwork. */
function ringColorAt(angle, target = new THREE.Color()) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const t = 0.5 - 0.5 * (dx * -0.543 + dy * 0.84);
  return target.copy(TEAL).lerp(PURPLE, THREE.MathUtils.smoothstep(t, 0.15, 0.85));
}

/** A 1D gradient texture that wraps around a torus via its u coordinate. */
function ringGradientTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 4;
  const ctx = canvas.getContext('2d');
  const color = new THREE.Color();
  for (let x = 0; x < canvas.width; x++) {
    ctx.fillStyle = `#${ringColorAt((x / canvas.width) * TAU, color).getHexString()}`;
    ctx.fillRect(x, 0, 1, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

/** One faceted half of the needle: a pyramid from the hub out to a tip. */
function needleHalf(length, width, height) {
  const tip = [0, length, 0];
  const left = [-width, 0, 0];
  const right = [width, 0, 0];
  const top = [0, 0, height];
  const bottom = [0, 0, -height];
  const faces = [
    [tip, left, top], [tip, top, right],
    [tip, bottom, left], [tip, right, bottom],
    [left, bottom, top], [right, top, bottom],
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(faces.flat(2), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The central compass as a real 3D object: metallic gradient bezel, recessed
 * face with a radar sweep, faceted needle and orbiting coloured lights. Built at unit radius and scaled to the layout. The needle is
 * spring-driven: it spins in on load, idles with a wobble and swings toward
 * the pointer while it moves.
 */
export function createCompass() {
  const group = new THREE.Group();
  const faders = [];

  function fade(object, opacity = 1) {
    object.material.transparent = true;
    object.userData.opacity = opacity;
    faders.push(object);
    return object;
  }

  // Bezel: a metal torus whose emissive gradient feeds the bloom.
  const bezel = fade(new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.05, 40, 200),
    new THREE.MeshPhysicalMaterial({
      color: 0x1b1f33,
      metalness: 0.85,
      roughness: 0.38,
      clearcoat: 0.6,
      clearcoatRoughness: 0.35,
      emissive: 0xffffff,
      emissiveMap: ringGradientTexture(),
      emissiveIntensity: 1.1,
    }),
  ));
  group.add(bezel);

  // Body: a dark disc with a bevelled edge sitting just inside the bezel.
  const body = fade(new THREE.Mesh(
    new THREE.CylinderGeometry(0.97, 0.94, 0.14, 128, 1),
    new THREE.MeshStandardMaterial({ color: 0x0a0f24, metalness: 0.6, roughness: 0.45 }),
  ));
  body.rotation.x = Math.PI / 2;
  body.position.z = -0.03;
  group.add(body);

  // Face: unlit shader with a radial gradient and a slow radar sweep.
  const faceMaterial = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vPos;
      void main() {
        float r = length(vPos);
        vec3 col = mix(vec3(0.10, 0.17, 0.33), vec3(0.03, 0.045, 0.12), smoothstep(0.0, 0.94, r));
        float sweep = fract((atan(vPos.y, vPos.x) - uTime * 0.6) / 6.2831853);
        col += vec3(0.2, 0.8, 0.7) * pow(sweep, 10.0) * 0.16 * smoothstep(0.94, 0.2, r);
        // Fine graduation ring
        col += vec3(0.35, 0.45, 0.7) * smoothstep(0.006, 0.0, abs(r - 0.66)) * 0.25;
        gl_FragColor = vec4(pow(col, vec3(2.2)), uOpacity);
      }
    `,
    transparent: true,
  });
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.94, 128), faceMaterial);
  face.position.z = 0.041;
  face.userData.opacity = 1;
  faders.push(face);
  group.add(face);

  // Dotted inner ring
  const dotCount = 72;
  const dots = new THREE.BufferGeometry();
  const dotPositions = [];
  for (let i = 0; i < dotCount; i++) {
    const a = (i / dotCount) * TAU;
    dotPositions.push(Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0.045);
  }
  dots.setAttribute('position', new THREE.Float32BufferAttribute(dotPositions, 3));
  dots.setAttribute('color', new THREE.Float32BufferAttribute(Array(dotCount).fill([0.45, 0.55, 0.75]).flat(), 3));
  dots.setAttribute('size', new THREE.Float32BufferAttribute(Array(dotCount).fill(3), 1));
  dots.setAttribute('phase', new THREE.Float32BufferAttribute(Array.from({ length: dotCount }, (_, i) => i * 0.4), 1));
  const dotMaterial = createGlowMaterial({ twinkle: 0.35 });
  const dotPoints = new THREE.Points(dots, dotMaterial);
  dotPoints.userData.opacity = 0.6;
  faders.push(dotPoints);
  group.add(dotPoints);

  // Cardinal ticks, raised slightly off the face.
  const tickMaterial = new THREE.MeshStandardMaterial({
    color: 0xd7deec,
    metalness: 0.3,
    roughness: 0.4,
    emissive: 0x9aa6c4,
    emissiveIntensity: 0.4,
  });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const tick = fade(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), tickMaterial.clone()));
    tick.position.set(Math.sin(a) * 0.85, Math.cos(a) * 0.85, 0.06);
    tick.rotation.z = -a;
    group.add(tick);
  }

  // Needle: faceted orange "north" and teal "south" halves.
  const needle = new THREE.Group();
  needle.position.z = 0.12;
  const north = fade(new THREE.Mesh(
    needleHalf(0.62, 0.12, 0.05),
    new THREE.MeshStandardMaterial({
      color: 0xf5a83a,
      emissive: 0xf09a2a,
      emissiveIntensity: 0.18,
      metalness: 0.25,
      roughness: 0.35,
      flatShading: true,
    }),
  ));
  const south = fade(new THREE.Mesh(
    needleHalf(0.62, 0.12, 0.05),
    new THREE.MeshStandardMaterial({
      color: 0x48d6b9,
      emissive: 0x2fbfa2,
      emissiveIntensity: 0.18,
      metalness: 0.25,
      roughness: 0.35,
      flatShading: true,
    }),
  ));
  south.rotation.z = Math.PI;

  const hub = fade(new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.08, 48),
    new THREE.MeshStandardMaterial({ color: 0xeaf4f2, metalness: 0.2, roughness: 0.55 }),
  ));
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.03;
  const pin = fade(new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.02, 32),
    new THREE.MeshStandardMaterial({ color: 0x0b1328, roughness: 0.6 }),
  ));
  pin.rotation.x = Math.PI / 2;
  pin.position.z = 0.075;
  needle.add(north, south, hub, pin);
  group.add(needle);

  // Soft additive halo and radar pings around the bezel.
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
    new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vPos;
        void main() {
          vPos = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        uniform float uTime;
        varying vec2 vPos;
        void main() {
          float r = length(vPos);
          vec2 dir = normalize(vPos);
          float t = 0.5 - 0.5 * dot(dir, normalize(vec2(-0.55, 0.85)));
          vec3 col = mix(vec3(0.31, 0.88, 0.77), vec3(0.56, 0.42, 0.98), smoothstep(0.15, 0.85, t));
          float glow = exp(-pow((r - 1.0) * 5.0, 2.0)) * 0.35 * step(1.0, r);
          float pulse = 0.85 + 0.15 * sin(uTime * 1.4);
          gl_FragColor = vec4(pow(col, vec3(2.2)), glow * pulse * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.position.z = -0.05;
  halo.userData.opacity = 1;
  faders.push(halo);
  group.add(halo);

  const pings = [0, 0.5].map((offset) => {
    const ping = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.006, 8, 160),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x7fe6d4).multiplyScalar(1.6),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    group.add(ping);
    return { mesh: ping, offset };
  });

  // Two coloured lights orbit the compass so highlights slide over the metal.
  const tealLight = new THREE.PointLight(0x4fe0c4, 1.8, 6, 1.5);
  const violetLight = new THREE.PointLight(0x9a7bff, 1.8, 6, 1.5);
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
  keyLight.position.set(-2, 3, 4);
  group.add(tealLight, violetLight, keyLight);

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
      for (const light of [tealLight, violetLight]) light.distance = 6 * radius;
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

      const orbit = time * 0.6 * motion + 1;
      tealLight.position.set(Math.cos(orbit) * 1.6, Math.sin(orbit) * 1.6, 1.2);
      violetLight.position.set(Math.cos(orbit + Math.PI) * 1.6, Math.sin(orbit + Math.PI) * 1.6, 1.2);

      for (const object of faders) {
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
        mesh.material.opacity = (1 - t) ** 2 * 0.4 * intro * motion;
      }
    },
  };
}
