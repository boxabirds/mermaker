/**
 * Compute the distance between two points.
 */
export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Clamp a value to a range.
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Check if two axis-aligned rectangles overlap.
 * Rects are { x, y, width, height } where x,y is top-left.
 */
export function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Find the point where a line from a node center toward (tx, ty) exits the node border.
 * Dispatches to shape-specific clipping based on nodePos.shape.
 *
 * @param {{ x: number, y: number, width: number, height: number, shape?: string }} nodePos
 * @param {number} tx - Target X
 * @param {number} ty - Target Y
 * @returns {number[]} [x, y] on the node border
 */
export function clipToNodeBorder(nodePos, tx, ty) {
  if (nodePos.shape === 'diamond') {
    return clipToDiamondBorder(nodePos, tx, ty);
  }
  return clipToRectBorder(nodePos, tx, ty);
}

/**
 * Clip to axis-aligned rectangle border.
 */
export function clipToRectBorder(nodePos, tx, ty) {
  const dx = tx - nodePos.x;
  const dy = ty - nodePos.y;

  if (dx === 0 && dy === 0) return [nodePos.x, nodePos.y];

  const halfW = nodePos.width / 2;
  const halfH = nodePos.height / 2;

  const scaleX = halfW / Math.abs(dx || 1);
  const scaleY = halfH / Math.abs(dy || 1);
  const scale = Math.min(scaleX, scaleY);

  return [
    nodePos.x + dx * scale,
    nodePos.y + dy * scale,
  ];
}

/**
 * Detect which side of a node an edge approaches from, based on the opposite endpoint.
 * Uses dx/dy ratio against node half-dimensions to determine dominant axis.
 *
 * @param {{ x: number, y: number, width: number, height: number }} nodePos
 * @param {number} oppositeX
 * @param {number} oppositeY
 * @returns {'top'|'bottom'|'left'|'right'}
 */
export function detectSide(nodePos, oppositeX, oppositeY) {
  const dx = oppositeX - nodePos.x;
  const dy = oppositeY - nodePos.y;
  const halfW = nodePos.width / 2;
  const halfH = nodePos.height / 2;

  // Compare normalized distances to determine dominant axis
  const ratioX = Math.abs(dx) / (halfW || 1);
  const ratioY = Math.abs(dy) / (halfH || 1);

  if (ratioX > ratioY) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'bottom' : 'top';
}

/**
 * Clip to diamond border.
 * Diamond vertices are at (0, -h/2), (w/2, 0), (0, h/2), (-w/2, 0) relative to center.
 * Border equation: |x/halfW| + |y/halfH| = 1
 */
export function clipToDiamondBorder(nodePos, tx, ty) {
  const dx = tx - nodePos.x;
  const dy = ty - nodePos.y;

  if (dx === 0 && dy === 0) return [nodePos.x, nodePos.y];

  const halfW = nodePos.width / 2;
  const halfH = nodePos.height / 2;

  // Scale factor: point on diamond border along direction (dx, dy)
  const scale = 1 / (Math.abs(dx) / halfW + Math.abs(dy) / halfH);

  return [
    nodePos.x + dx * scale,
    nodePos.y + dy * scale,
  ];
}
