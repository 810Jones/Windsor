/**
 * Tracks the world-space size of the z = 0 plane so scene elements can be
 * placed with normalized screen coordinates (0..1, origin top-left), the same
 * way the original splash artwork is laid out.
 */
export function createLayout(camera, distance) {
  const layout = {
    /** Camera distance to the z = 0 plane once the intro fly-in settles. */
    distance,
    width: 1,
    height: 1,
    /** Compass centre as a fraction of the viewport height (from the top). */
    compassAnchor: 0.41,
    compassRadius: 1,
    iconSize: 1,

    update() {
      layout.height = 2 * Math.tan((camera.fov * Math.PI) / 360) * distance;
      layout.width = layout.height * camera.aspect;
      layout.compassRadius = Math.min(layout.width * 0.135, layout.height * 0.095);
      layout.iconSize = Math.min(layout.width * 0.085, layout.height * 0.06);
    },

    toWorld(nx, ny, target = { x: 0, y: 0 }) {
      target.x = (nx - 0.5) * layout.width;
      target.y = (0.5 - ny) * layout.height;
      return target;
    },
  };

  layout.update();
  return layout;
}
