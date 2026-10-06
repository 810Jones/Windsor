import * as THREE from 'three';

/**
 * Full-screen animated nebula: the deep-space gradient from the artwork plus
 * slowly churning fbm clouds (violet top-left, teal bottom-right).
 */
export function createNebula() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uPointer: { value: new THREE.Vector2() },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uAspect;
      uniform vec2 uPointer;
      varying vec2 vUv;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 4; i++) {
          value += amp * noise(p);
          p = p * 2.03 + vec2(1.7, 9.2);
          amp *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 uv = vUv;
        vec2 p = vec2((uv.x - 0.5) * uAspect, uv.y - 0.5) + uPointer * 0.015;
        float t = uTime * 0.02;

        // Domain-warped clouds (two fbm calls keeps this cheap on phones)
        float warp = fbm(p * 2.2 + t);
        float clouds = fbm(p * 1.6 + vec2(warp, 1.0 - warp) * 1.4 + vec2(t * 0.5, -t));

        vec3 deep = vec3(0.020, 0.026, 0.075);
        vec3 col = mix(vec3(0.045, 0.035, 0.12), deep, smoothstep(0.0, 0.55, 1.0 - uv.y));

        float violetMask = smoothstep(0.9, 0.0, length((uv - vec2(0.0, 1.0)) * vec2(1.0, 1.6)));
        float tealMask = smoothstep(0.85, 0.0, length((uv - vec2(1.0, 0.0)) * vec2(1.0, 1.8)));
        float centerMask = smoothstep(0.6, 0.0, length((uv - vec2(0.5, 0.58)) * vec2(1.0, 1.4)));

        col += vec3(0.24, 0.09, 0.42) * violetMask * (0.35 + clouds * 0.9);
        col += vec3(0.04, 0.26, 0.27) * tealMask * (0.3 + clouds * 0.9);
        col += vec3(0.06, 0.07, 0.17) * centerMask * clouds * 0.8;

        // Colours above are authored in sRGB; the pipeline works in linear.
        col = pow(col, vec3(2.2));
        // Fine film grain keeps the gradient from banding.
        col += (hash(uv * 900.0 + uTime) - 0.5) * 0.0015;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;

  return {
    object: mesh,
    resize({ aspect }) {
      material.uniforms.uAspect.value = aspect;
    },
    update(time, { pointer }) {
      material.uniforms.uTime.value = time;
      material.uniforms.uPointer.value.copy(pointer);
    },
  };
}
