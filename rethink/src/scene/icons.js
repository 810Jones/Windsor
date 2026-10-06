import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const TEAL = new THREE.Color('#4fe0c4');
const PURPLE = new THREE.Color('#8f74f2');

// Line-art glyphs on a 24×24 grid, as SVG markup.
const GLYPHS = {
  brain: `<path d="M12 5.5c-1-1.7-3.7-2-5.1-.4-1.3-.1-2.6 1-2.5 2.4-1.4.6-2 2.3-1.2 3.7-.9 1.3-.5 3 .8 3.8
    .1 1.6 1.6 2.8 3.2 2.4.9 1.2 2.7 1.4 3.8.4M12 5.5c1-1.7 3.7-2 5.1-.4 1.3-.1 2.6 1 2.5 2.4 1.4.6 2 2.3 1.2 3.7
    .9 1.3.5 3-.8 3.8-.1 1.6-1.6 2.8-3.2 2.4-.9 1.2-2.7 1.4-3.8.4M12 5.5v12.3M8.2 8.8c1 .1 1.8.8 2 1.8
    M15.8 8.8c-1 .1-1.8.8-2 1.8M7.6 13.4c1-.1 2 .5 2.4 1.4M16.4 13.4c-1-.1-2 .5-2.4 1.4"/>`,
  bolt: '<path d="M13.6 2.5 6 13.4h5.6l-1.2 8.1 7.6-11h-5.6z"/>',
  network: `<path d="M8.6 8.4 15 6.6M7.6 10.9l3.4 5.4M16.4 7.9l-3.6 8.4"/>
    <circle cx="6.6" cy="9" r="2.1"/><circle cx="17" cy="6" r="2.1"/><circle cx="12" cy="18.2" r="2.1"/>`,
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4 13.2 13.2 8.4 15.6 10.8 10.8z"/>',
  document: '<path d="M6.5 2.8h7.8l3.9 3.9v14.5H6.5zM14.3 2.8v3.9h3.9M9.2 11h5.6M9.2 14h5.6M9.2 17h3"/>',
  chart: '<path d="M3.5 3.5v17h17M8 17v-4.5M11.5 17V10M15 17v-5.5M6.5 10.5l4.5-4 3.5 3 5-5"/>',
  chat: `<path d="M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-8.5L6.5 20.5v-3.5H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"/>
    <circle cx="8.5" cy="10.8" r=".6"/><circle cx="12" cy="10.8" r=".6"/><circle cx="15.5" cy="10.8" r=".6"/>`,
  target: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.4"/>
    <path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>`,
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

const loader = new SVGLoader();

/** Turns a glyph's SVG into line-segment pairs on a unit square centred at the origin. */
function glyphSegments(markup) {
  const { paths } = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${markup}</svg>`);
  const segments = [];
  for (const path of paths) {
    for (const subPath of path.subPaths) {
      const points = subPath.getPoints(24);
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        segments.push((a.x - 12) / 24, (12 - a.y) / 24, 0, (b.x - 12) / 24, (12 - b.y) / 24, 0);
      }
    }
  }
  return segments;
}

/**
 * Floating icons built from real 3D line geometry. They sit at different
 * depths, turn slowly in space, and glow through the bloom pass.
 */
export function createIcons() {
  const group = new THREE.Group();
  const materials = [];

  const items = ICONS.map((icon, i) => {
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(glyphSegments(GLYPHS[icon.glyph]));

    const material = new LineMaterial({
      color: icon.color.clone().multiplyScalar(1.5),
      linewidth: 1.6,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    materials.push(material);

    const lines = new LineSegments2(geometry, material);
    lines.renderOrder = 4;
    group.add(lines);

    return {
      ...icon,
      lines,
      material,
      depth: -1.8 + ((i * 0.618 + 0.3) % 1) * 2.6,
      base: new THREE.Vector3(),
      phase: Math.random() * Math.PI * 2,
      tilt: (Math.random() - 0.5) * 0.3,
    };
  });

  let bob = 0;
  const point = { x: 0, y: 0 };

  return {
    object: group,

    resize(layout, { width, height }) {
      bob = layout.height * 0.006;
      for (const item of items) {
        layout.toWorld(...item.at, point);
        const k = (layout.distance - item.depth) / layout.distance;
        item.base.set(point.x * k, point.y * k, item.depth);
        item.lines.scale.setScalar(layout.iconSize * item.scale * k);
      }
      // Line widths are in CSS pixels relative to this resolution.
      for (const material of materials) material.resolution.set(width, height);
    },

    update(time, { intro, motion }) {
      for (const item of items) {
        const t = time * 0.5 + item.phase;
        item.lines.position.set(
          item.base.x + Math.cos(t * 0.7) * bob * 0.5 * motion,
          item.base.y + Math.sin(t) * bob * motion,
          item.base.z,
        );
        item.lines.rotation.set(
          Math.sin(t * 0.45) * 0.35 * motion,
          Math.sin(t * 0.3) * 0.6 * motion,
          item.tilt + Math.sin(t * 0.6) * 0.06 * motion,
        );
        item.material.opacity = intro * (0.7 + 0.25 * Math.sin(t * 1.3));
      }
    },
  };
}
