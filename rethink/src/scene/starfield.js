import * as THREE from 'three';

const STAR_TINTS = [
  [1.0, 1.0, 1.0],
  [1.0, 1.0, 1.0],
  [0.85, 0.95, 1.0],
  [0.62, 0.95, 0.88],
  [0.78, 0.7, 1.0],
];

/**
 * Background stars and out-of-focus dust, drawn directly in clip space so the
 * density stays even at any aspect ratio. `depth` (0 far .. 1 near) drives
 * pointer parallax and size.
 */
export function createStarfield({ stars = 1400, dust = 70 } = {}) {
  const count = stars + dust;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const kinds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const isDust = i >= stars;
    const depth = isDust ? 0.6 + Math.random() * 0.4 : Math.random() ** 2;

    positions[i * 3] = (Math.random() * 2 - 1) * 1.08;
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * 1.08;
    positions[i * 3 + 2] = depth;

    const tint = isDust ? [0.55, 0.6, 0.72] : STAR_TINTS[(Math.random() * STAR_TINTS.length) | 0];
    colors.set(tint, i * 3);

    sizes[i] = isDust ? 7 + Math.random() * 12 : 0.8 + depth * 2.2 + (Math.random() < 0.03 ? 2 : 0);
    phases[i] = Math.random() * Math.PI * 2;
    kinds[i] = isDust ? 1 : 0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('kind', new THREE.BufferAttribute(kinds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
      uScale: { value: 1 },
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float size;
      attribute float phase;
      attribute float kind;
      uniform float uTime;
      uniform vec2 uPointer;
      uniform float uScale;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vKind;

      void main() {
        float depth = position.z;
        vec2 p = position.xy;
        // Dust drifts slowly; everything shifts a little with the pointer.
        p += kind * vec2(sin(uTime * 0.07 + phase), cos(uTime * 0.05 + phase * 1.3)) * 0.015;
        p -= uPointer * (0.004 + depth * 0.02);

        float twinkle = mix(0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.8 + fract(phase) * 2.2) + phase)), 1.0, kind);
        vColor = color;
        vAlpha = mix(twinkle * (0.45 + depth * 0.55), 0.16, kind);
        vKind = kind;

        gl_PointSize = size * uScale;
        gl_Position = vec4(p, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vKind;

      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float star = smoothstep(1.0, 0.0, d);
        star *= star;
        float bokeh = smoothstep(1.0, 0.75, d);
        float shape = mix(star, bokeh, vKind);
        gl_FragColor = vec4(vColor, shape * vAlpha * uOpacity);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 0;

  return {
    object: points,
    resize({ pixelRatio }) {
      material.uniforms.uScale.value = pixelRatio;
    },
    update(time, { pointer, intro }) {
      material.uniforms.uTime.value = time;
      material.uniforms.uPointer.value.copy(pointer);
      material.uniforms.uOpacity.value = intro;
    },
  };
}
