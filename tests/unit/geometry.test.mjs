import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clipToNodeBorder, clipToDiamondBorder, clipToRectBorder } from '../../src/util/geometry.js';

/**
 * Unit tests for shape-aware border clipping.
 */

function diamondNode(x, y, w, h) {
  return { x, y, width: w, height: h, shape: 'diamond' };
}

function rectNode(x, y, w, h) {
  return { x, y, width: w, height: h, shape: 'rect' };
}

const CENTER_X = 100;
const CENTER_Y = 100;
const WIDTH = 80;
const HEIGHT = 60;
const HALF_W = WIDTH / 2;
const HALF_H = HEIGHT / 2;

describe('clipToDiamondBorder', () => {
  const node = diamondNode(CENTER_X, CENTER_Y, WIDTH, HEIGHT);

  it('clips approach from directly above (dx=0, dy<0)', () => {
    const [x, y] = clipToDiamondBorder(node, CENTER_X, CENTER_Y - 200);
    // Should hit top vertex at (center_x, center_y - halfH)
    assert.ok(Math.abs(x - CENTER_X) < 0.01, `x should be ${CENTER_X}, got ${x}`);
    assert.ok(Math.abs(y - (CENTER_Y - HALF_H)) < 0.01, `y should be ${CENTER_Y - HALF_H}, got ${y}`);
  });

  it('clips approach from directly below (dx=0, dy>0)', () => {
    const [x, y] = clipToDiamondBorder(node, CENTER_X, CENTER_Y + 200);
    assert.ok(Math.abs(x - CENTER_X) < 0.01);
    assert.ok(Math.abs(y - (CENTER_Y + HALF_H)) < 0.01);
  });

  it('clips approach from directly right (dx>0, dy=0)', () => {
    const [x, y] = clipToDiamondBorder(node, CENTER_X + 200, CENTER_Y);
    assert.ok(Math.abs(x - (CENTER_X + HALF_W)) < 0.01);
    assert.ok(Math.abs(y - CENTER_Y) < 0.01);
  });

  it('clips approach from directly left (dx<0, dy=0)', () => {
    const [x, y] = clipToDiamondBorder(node, CENTER_X - 200, CENTER_Y);
    assert.ok(Math.abs(x - (CENTER_X - HALF_W)) < 0.01);
    assert.ok(Math.abs(y - CENTER_Y) < 0.01);
  });

  it('clips approach at 45 degrees (top-right)', () => {
    const [x, y] = clipToDiamondBorder(node, CENTER_X + 200, CENTER_Y - 200);
    // Point should lie on diamond border: |dx/halfW| + |dy/halfH| = 1
    const relX = Math.abs(x - CENTER_X) / HALF_W;
    const relY = Math.abs(y - CENTER_Y) / HALF_H;
    assert.ok(Math.abs(relX + relY - 1) < 0.01, `point should be on diamond border, got ${relX + relY}`);
  });

  it('clips approach from bottom-left diagonal', () => {
    const [x, y] = clipToDiamondBorder(node, CENTER_X - 150, CENTER_Y + 100);
    const relX = Math.abs(x - CENTER_X) / HALF_W;
    const relY = Math.abs(y - CENTER_Y) / HALF_H;
    assert.ok(Math.abs(relX + relY - 1) < 0.01, `point should be on diamond border, got ${relX + relY}`);
  });

  it('returns center when target is at center (dx=0, dy=0)', () => {
    const [x, y] = clipToDiamondBorder(node, CENTER_X, CENTER_Y);
    assert.equal(x, CENTER_X);
    assert.equal(y, CENTER_Y);
  });
});

describe('clipToNodeBorder dispatches by shape', () => {
  it('uses diamond clip for diamond shape', () => {
    const node = diamondNode(100, 100, 80, 60);
    const diamondResult = clipToNodeBorder(node, 200, 100);
    const rectResult = clipToRectBorder(node, 200, 100);

    // Diamond right vertex is at (140, 100), rect right edge is also at (140, 100)
    // But for diagonal approaches they differ
    const diagDiamond = clipToNodeBorder(node, 200, 50);
    const diagRect = clipToRectBorder(node, 200, 50);

    // These should be different points
    const dist = Math.sqrt((diagDiamond[0] - diagRect[0]) ** 2 + (diagDiamond[1] - diagRect[1]) ** 2);
    assert.ok(dist > 1, `diamond and rect clip should differ for diagonal approach, dist=${dist}`);
  });

  it('uses rect clip for non-diamond shapes', () => {
    const node = rectNode(100, 100, 80, 60);
    const result = clipToNodeBorder(node, 200, 100);
    const rectResult = clipToRectBorder(node, 200, 100);
    assert.deepEqual(result, rectResult);
  });

  it('uses rect clip when shape is undefined', () => {
    const node = { x: 100, y: 100, width: 80, height: 60 };
    const result = clipToNodeBorder(node, 200, 100);
    const rectResult = clipToRectBorder(node, 200, 100);
    assert.deepEqual(result, rectResult);
  });
});

describe('diamond vs rect clip comparison', () => {
  const node = { x: 0, y: 0, width: 100, height: 100 };

  it('diamond clips closer to center on diagonal than rect', () => {
    // For a square node, diamond inscribes inside rect
    // Diagonal approach: rect clips at corner (50, -50), diamond clips midway
    const rectPt = clipToRectBorder(node, 100, -100);
    const diamondPt = clipToDiamondBorder(node, 100, -100);

    const rectDist = Math.sqrt(rectPt[0] ** 2 + rectPt[1] ** 2);
    const diamondDist = Math.sqrt(diamondPt[0] ** 2 + diamondPt[1] ** 2);

    assert.ok(diamondDist < rectDist, `diamond clip (${diamondDist}) should be closer than rect (${rectDist})`);
  });
});
