import { SHAPES, SVG_NS, ROUNDED_CORNER_RADIUS } from '../util/constants.js';

/**
 * Create an SVG shape element for a node.
 * @param {string} shape - One of SHAPES constants
 * @param {number} width
 * @param {number} height
 * @returns {SVGElement}
 */
export function createShape(shape, width, height) {
  const halfW = width / 2;
  const halfH = height / 2;

  switch (shape) {
    case SHAPES.ROUNDED_RECT:
      return createRect(width, height, ROUNDED_CORNER_RADIUS);

    case SHAPES.DIAMOND:
      return createPolygon([
        [0, -halfH],
        [halfW, 0],
        [0, halfH],
        [-halfW, 0],
      ]);

    case SHAPES.CIRCLE: {
      const radius = Math.max(halfW, halfH);
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('r', String(radius));
      circle.setAttribute('cx', '0');
      circle.setAttribute('cy', '0');
      return circle;
    }

    case SHAPES.HEXAGON:
      return createPolygon([
        [-halfW + halfH, -halfH],
        [halfW - halfH, -halfH],
        [halfW, 0],
        [halfW - halfH, halfH],
        [-halfW + halfH, halfH],
        [-halfW, 0],
      ]);

    case SHAPES.STADIUM:
      return createRect(width, height, halfH);

    case SHAPES.RECT:
    default:
      return createRect(width, height, 0);
  }
}

function createRect(width, height, rx) {
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', String(-width / 2));
  rect.setAttribute('y', String(-height / 2));
  rect.setAttribute('width', String(width));
  rect.setAttribute('height', String(height));
  if (rx > 0) {
    rect.setAttribute('rx', String(rx));
    rect.setAttribute('ry', String(rx));
  }
  return rect;
}

function createPolygon(points) {
  const polygon = document.createElementNS(SVG_NS, 'polygon');
  polygon.setAttribute('points', points.map(p => p.join(',')).join(' '));
  return polygon;
}
