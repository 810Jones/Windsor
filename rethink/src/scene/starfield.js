import * as THREE from 'three';

const STAR_TINTS = [
  [1.0, 1.0, 1.0],
  [1.0, 1.0, 1.0],
  [0.85, 0.95, 1.0],
  [0.62, 0.95, 0.88],
  [0.78, 0.7, 1.0],
];

/**
 * A deep 3D volume of stars plus out-of-focus dust motes. Points use
 * perspective size attenuation, so tilting the world gives real parallax.
 */
export function createStarfield({ stars = 3200, dust = 90 } = {}) {
  const count = stars + dust;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const kinds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const isDust = i >= stars;
    // Stars fill a deep slab behind the compass; dust floats closer in.
    const z = isDust ? -2 - Math.random() * 10 : -4 - Math.random() ** 0.7 * 70;
    const spread = 6 + (10 - z) * 0.62;

    positions[i * 3] = (Math.random() * 2 - 1) * spread * 1.4;
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * spread;
    positions[i * 3 + 2] = z;

    const tint = isDust ? [0.5, 0.56, 0.7] : STAR_TINTS[(Math.random() * STAR_TINTS.length) | 0];
    colors.set(tint, i * 3);

    sizes[i] = isDust ? 18 + Math.random() * 26 : 1.4 + Math.random() * 2.4 + (Math.random() < 0.025 ? 3 : 0);
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
      uScale: { value: 1 },
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float size;
      attribute float phase;
      attribute float kind;
      uniform float uTime;
      uniform float uScale;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vKind;

      void main() {
        vec3 p = position;
        p.xy += kind * vec2(sin(uTime * 0.07 + phase), cos(uTime * 0.05 + phase * 1.3)) * 0.35;

        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        float depth = -mvPosition.z;

        float twinkle = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.8 + fract(phase) * 2.2) + phase));
        vColor = pow(color, vec3(2.2)); // sRGB → linear
        vAlpha = mix(twinkle * clamp(1.6 - depth / 60.0, 0.25, 1.0), 0.11, kind);
        vKind = kind;

        gl_PointSize = size * uScale * (10.0 / depth);
        gl_Position = projectionMatrix * mvPosition;
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
        float bokeh = smoothstep(1.0, 0.7, d) * (0.75 + 0.25 * d);
        float shape = mix(star, bokeh, vKind);
        gl_FragColor = vec4(vColor * (1.0 + (1.0 - vKind) * 0.6), shape * vAlpha * uOpacity);
      }
    `,
    transparent: true,
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
    update(time, { intro }) {
      material.uniforms.uTime.value = time;
      material.uniforms.uOpacity.value = intro;
    },
  };
}
