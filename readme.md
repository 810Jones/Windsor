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
- `rethink/src/main.js` – renderer, camera, resize handling, pointer input, animation loop
- `rethink/src/scene/`
  - `starfield.js` – twinkling stars and drifting bokeh dust (clip-space shader, pointer parallax)
  - `constellation.js` – network of glowing nodes and lines, with signals travelling along edges
  - `icons.js` – floating line-art icons (brain, bolt, chart, …) drawn to canvas textures
  - `compass.js` – the central compass; the needle spins in on load and follows the pointer
  - `layout.js` – maps normalized screen coordinates to world space so the layout fits any aspect
  - `glowPoints.js` – shared glowing point-sprite material

Motion is reduced when the OS "reduce motion" setting is on.

The original Game Hub page (`index.html`) is still served at `/`.
