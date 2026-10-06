# Windsor project

## Dev environment

Requires Node 20.19+ (or 22.12+).

```sh
npm install
npm run dev      # Vite dev server with hot reload, opens /rethink/
npm run build    # production build into dist/
npm run preview  # serve the production build
```

## ReThink 2.0 splash (`rethink/`)

An animated three.js version of the Social Solace "ReThink 2.0 / GPS Navigator 2.0" splash screen.

- `rethink/index.html` – page markup; the wordmark is HTML/CSS layered over the WebGL canvas
- `rethink/src/main.js` – renderer, tone mapping, environment lighting, bloom post-processing,
  camera fly-in, pointer-driven world tilt, animation loop
- `rethink/src/scene/`
  - `nebula.js` – full-screen animated fbm nebula background
  - `starfield.js` – a deep 3D volume of twinkling stars and drifting dust (real parallax)
  - `constellation.js` – glowing nodes on several depth layers, linked by lines, with travelling signals
  - `icons.js` – line-art icons parsed from SVG into 3D line geometry that turns in space
  - `compass.js` – 3D compass: metallic gradient bezel, faceted needle, orbiting coloured lights;
    the needle spins in on load and follows the pointer
  - `layout.js` – maps normalized screen coordinates to world space so the layout fits any aspect
  - `glowPoints.js` – shared glowing point-sprite material

Motion is reduced when the OS "reduce motion" setting is on.

The original Game Hub page (`index.html`) is still served at `/`.
