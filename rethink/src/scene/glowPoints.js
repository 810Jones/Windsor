import * as THREE from 'three';

/**
 * Soft glowing point sprites (bright core + halo) with a per-point twinkle.
 * Expects `color` (vec3), `size` (px) and `phase` attributes.
 */
export function createGlowMaterial({ twinkle = 0.25, intensity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 1 },
      uTwinkle: { value: twinkle },
      uOpacity: { value: 1 },
      uIntensity: { value: intensity },
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
        vColor = pow(color, vec3(2.2)); // sRGB → linear
        vAlpha = 1.0 - uTwinkle + uTwinkle * sin(uTime * 1.6 + phase);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uScale * (10.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uIntensity;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float core = smoothstep(0.32, 0.12, d);
        float halo = exp(-d * d * 5.0) * 0.55;
        vec3 col = mix(vColor, vec3(1.0), core * 0.45) * uIntensity;
        gl_FragColor = vec4(col, (core + halo) * vAlpha * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
