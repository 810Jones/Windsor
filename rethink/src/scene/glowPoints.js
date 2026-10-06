import * as THREE from 'three';

/**
 * Soft glowing point sprites (bright core + halo) with a per-point twinkle.
 * Expects `color` (vec3), `size` (px) and `phase` attributes.
 */
export function createGlowMaterial({ twinkle = 0.25 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 1 },
      uTwinkle: { value: twinkle },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float size;
      attribute float phase;
      uniform float uTime;
      uniform float uScale;
      uniform float uTwinkle;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vColor = color;
        vAlpha = 1.0 - uTwinkle + uTwinkle * sin(uTime * 1.6 + phase);
        gl_PointSize = size * uScale;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float core = smoothstep(0.32, 0.12, d);
        float halo = exp(-d * d * 5.0) * 0.55;
        vec3 col = mix(vColor, vec3(1.0), core * 0.45);
        gl_FragColor = vec4(col, (core + halo) * vAlpha * uOpacity);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
