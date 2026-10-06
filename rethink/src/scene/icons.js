import * as THREE from 'three';

const TEAL = '#4fe0c4';
const PURPLE = '#8f74f2';

// Line-art glyphs drawn on a 24×24 grid. Each entry strokes onto a 2D canvas
// context that has already been scaled to that grid.
const GLYPHS = {
  brain(ctx) {
    ctx.stroke(new Path2D(
      'M12 5.5c-1-1.7-3.7-2-5.1-.4-1.3-.1-2.6 1-2.5 2.4-1.4.6-2 2.3-1.2 3.7-.9 1.3-.5 3 .8 3.8' +
      '.1 1.6 1.6 2.8 3.2 2.4.9 1.2 2.7 1.4 3.8.4' +
      'M12 5.5c1-1.7 3.7-2 5.1-.4 1.3-.1 2.6 1 2.5 2.4 1.4.6 2 2.3 1.2 3.7.9 1.3.5 3-.8 3.8' +
      '-.1 1.6-1.6 2.8-3.2 2.4-.9 1.2-2.7 1.4-3.8.4' +
      'M12 5.5v12.3M8.2 8.8c1 .1 1.8.8 2 1.8M15.8 8.8c-1 .1-1.8.8-2 1.8' +
      'M7.6 13.4c1-.1 2 .5 2.4 1.4M16.4 13.4c-1-.1-2 .5-2.4 1.4',
    ));
  },
  bolt(ctx) {
    ctx.stroke(new Path2D('M13.6 2.5 6 13.4h5.6l-1.2 8.1 7.6-11h-5.6z'));
  },
  network(ctx) {
    ctx.stroke(new Path2D('M8 8.8 15.4 6.4M7.6 10.2l3.2 6.2M16.7 8.1l-3.4 8.4'));
    for (const [x, y] of [[6.6, 9], [17, 6], [12, 18.2]]) {
      ctx.beginPath();
      ctx.arc(x, y, 2.1, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
  compass(ctx) {
    ctx.beginPath();
    ctx.arc(12, 12, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.stroke(new Path2D('M15.6 8.4 13.2 13.2 8.4 15.6 10.8 10.8z'));
  },
  document(ctx) {
    ctx.stroke(new Path2D('M6.5 2.8h7.8l3.9 3.9v14.5H6.5zM14.3 2.8v3.9h3.9M9.2 11h5.6M9.2 14h5.6M9.2 17h3'));
  },
  chart(ctx) {
    ctx.stroke(new Path2D('M3.5 3.5v17h17M8 17v-4.5M11.5 17V10M15 17v-5.5M6.5 10.5l4.5-4 3.5 3 5-5'));
  },
  chat(ctx) {
    ctx.stroke(new Path2D(
      'M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-8.5L6.5 20.5v-3.5H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z',
    ));
    for (const x of [8.5, 12, 15.5]) {
      ctx.beginPath();
      ctx.arc(x, 10.8, 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
  target(ctx) {
    for (const r of [8, 4.6, 1.4]) {
      ctx.beginPath();
      ctx.arc(12, 12, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.stroke(new Path2D('M12 1v3M12 20v3M1 12h3M20 12h3'));
  },
};

// Placement in normalized screen space, traced from the splash artwork.
const ICONS = [
  { glyph: 'brain', at: [0.2, 0.145], color: TEAL, scale: 1.1 },
  { glyph: 'bolt', at: [0.725, 0.215], color: PURPLE, scale: 0.9 },
  { glyph: 'network', at: [0.15, 0.315], color: TEAL, scale: 0.85 },
  { glyph: 'compass', at: [0.8, 0.355], color: TEAL, scale: 0.9 },
  { glyph: 'document', at: [0.095, 0.695], color: PURPLE, scale: 1 },
  { glyph: 'chart', at: [0.775, 0.74], color: TEAL, scale: 1.05 },
  { glyph: 'chat', at: [0.23, 0.86], color: TEAL, scale: 0.85 },
  { glyph: 'target', at: [0.715, 0.895], color: PURPLE, scale: 0.95 },
];

function makeTexture(draw, color) {
  const size = 256;
  const pad = size * 0.15;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.translate(pad, pad);
  ctx.scale((size - pad * 2) / 24, (size - pad * 2) / 24);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.shadowColor = color;

  // A blurred pass for the glow, then a crisp pass on top.
  ctx.lineWidth = 1.1;
  ctx.shadowBlur = 18;
  draw(ctx);
  ctx.shadowBlur = 0;
  draw(ctx);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Floating line-art icons that bob and breathe around the constellation. */
export function createIcons() {
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(1, 1);

  const items = ICONS.map((icon) => {
    const material = new THREE.MeshBasicMaterial({
      map: makeTexture(GLYPHS[icon.glyph], icon.color),
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 4;
    group.add(mesh);
    return {
      ...icon,
      mesh,
      base: new THREE.Vector2(),
      phase: Math.random() * Math.PI * 2,
      tilt: (Math.random() - 0.5) * 0.3,
    };
  });

  let bob = 0;
  const point = { x: 0, y: 0 };

  return {
    object: group,

    resize(layout) {
      bob = layout.height * 0.006;
      for (const item of items) {
        layout.toWorld(...item.at, point);
        item.base.set(point.x, point.y);
        // The glyph fills 70% of its texture, so oversize the plane to match.
        item.mesh.scale.setScalar((layout.iconSize * item.scale) / 0.7);
      }
    },

    update(time, { intro, pointer, motion }) {
      group.position.set(-pointer.x * bob * 9, -pointer.y * bob * 9, 0);
      for (const item of items) {
        const t = time * 0.5 + item.phase;
        item.mesh.position.set(
          item.base.x + Math.cos(t * 0.7) * bob * 0.5 * motion,
          item.base.y + Math.sin(t) * bob * motion,
          0,
        );
        item.mesh.rotation.z = item.tilt + Math.sin(t * 0.6) * 0.06 * motion;
        item.mesh.material.opacity = intro * (0.65 + 0.25 * Math.sin(t * 1.3));
      }
    },
  };
}
