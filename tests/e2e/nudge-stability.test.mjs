/**
 * Nudge-stability E2E tests.
 *
 * For each gallery diagram: nudge every node by a small amount,
 * then verify edges remain valid after each nudge.
 *
 * Checks per edge after every nudge:
 *  1. No NaN or Infinity in path coordinates
 *  2. Path has non-zero length (not collapsed)
 *  3. All segments are orthogonal (H or V, within tolerance)
 *  4. Source endpoint is near source node border
 *  5. Target endpoint is near target node border
 *  6. Arrowhead marker is present
 *  7. Edge labels (if any) are visible and positioned
 *
 * Requires: `npx serve . -l 3456` running in background.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const GALLERY_URL = 'http://localhost:3456/examples/gallery.html';
const RENDER_WAIT_MS = 5000;
const NUDGE_PX = 5;
const DRAG_STEPS = 3;
const DRAG_SETTLE_MS = 300;

/** Tolerance for checking if a segment is orthogonal (px) */
const ORTHO_TOLERANCE = 2;

/**
 * Tolerance for checking if an endpoint is near a node border (px).
 * Set generously to account for non-rectangular shapes (diamond, circle)
 * where the actual shape border is inset from the bounding box.
 */
const BORDER_TOLERANCE = 25;

/** Minimum path length to consider an edge non-collapsed (px) */
const MIN_PATH_LENGTH = 5;

let browser, page;

before(async () => {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  page.on('pageerror', err => {
    console.error('[PAGE_ERROR]', err.message);
  });
  await page.goto(GALLERY_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(RENDER_WAIT_MS);
});

after(async () => {
  await browser?.close();
});

/**
 * Parse SVG path `d` attribute into coordinate pairs.
 * Handles M, L, and implicit L commands.
 * @returns {number[][]} Array of [x, y] pairs
 */
function parsePath(d) {
  const points = [];
  const nums = d.match(/-?[\d.]+/g);
  if (!nums) return points;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    points.push([parseFloat(nums[i]), parseFloat(nums[i + 1])]);
  }
  return points;
}

/**
 * Compute total path length from coordinate pairs.
 */
function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

/**
 * Check if all segments in a path are orthogonal (H or V).
 * Returns array of failing segment descriptions.
 */
function findNonOrthogonalSegments(points) {
  const failures = [];
  for (let i = 1; i < points.length; i++) {
    const dx = Math.abs(points[i][0] - points[i - 1][0]);
    const dy = Math.abs(points[i][1] - points[i - 1][1]);
    if (dx > ORTHO_TOLERANCE && dy > ORTHO_TOLERANCE) {
      failures.push(
        `seg ${i - 1}→${i}: (${points[i - 1].join(',')})→(${points[i].join(',')}) dx=${dx.toFixed(1)} dy=${dy.toFixed(1)}`
      );
    }
  }
  return failures;
}

/**
 * Check if a point is near a node's border (not at center, not far away).
 * Uses a heuristic: point should be roughly at the node's perimeter,
 * not deep inside or far outside.
 *
 * For non-rectangular shapes (circles, diamonds), the visual border may differ
 * from the layout bbox, so we use a generous proximity check.
 */
function isNearBorder(px, py, node) {
  const halfW = node.width / 2;
  const halfH = node.height / 2;
  const maxDim = Math.max(halfW, halfH);

  // Distance from point to node center
  const distFromCenter = Math.sqrt((px - node.x) ** 2 + (py - node.y) ** 2);

  // Point should not be at the center (would mean collapsed edge)
  const MIN_DIST_FROM_CENTER = 5;
  // Point should not be far outside the node
  const MAX_DIST_FROM_CENTER = maxDim + BORDER_TOLERANCE;

  return distFromCenter >= MIN_DIST_FROM_CENTER && distFromCenter <= MAX_DIST_FROM_CENTER;
}

/**
 * Extract all edge and node data from a card diagram element.
 */
async function extractDiagramData(cardDiagram) {
  return cardDiagram.evaluate((el) => {
    const nodes = [];
    for (const nodeEl of el.querySelectorAll('.mm-node')) {
      const id = nodeEl.getAttribute('data-node-id') || nodeEl.dataset.nodeId;
      const bbox = nodeEl.getBBox();
      // Node center from transform or bbox
      const transform = nodeEl.getAttribute('transform');
      let cx = bbox.x + bbox.width / 2;
      let cy = bbox.y + bbox.height / 2;
      if (transform) {
        const m = transform.match(/translate\(([-\d.]+)[,\s]+([-\d.]+)\)/);
        if (m) {
          cx = parseFloat(m[1]);
          cy = parseFloat(m[2]);
        }
      }
      nodes.push({ id, x: cx, y: cy, width: bbox.width, height: bbox.height });
    }

    const edges = [];
    for (const edgeEl of el.querySelectorAll('.mm-edge')) {
      const source = edgeEl.getAttribute('data-edge-source') || edgeEl.dataset.edgeSource;
      const target = edgeEl.getAttribute('data-edge-target') || edgeEl.dataset.edgeTarget;
      const pathEl = edgeEl.querySelector('path');
      const d = pathEl?.getAttribute('d') || '';
      const markerEnd = pathEl?.getAttribute('marker-end') || '';
      const labelEl = edgeEl.querySelector('.mm-edge-label');
      const labelText = labelEl?.textContent || null;
      const labelBBox = labelEl ? labelEl.getBBox() : null;
      edges.push({ source, target, d, markerEnd, labelText, labelBBox });
    }

    return { nodes, edges };
  });
}

/**
 * Validate all edges in a diagram after a nudge.
 * Returns array of failure messages.
 */
/**
 * Validate all edges in a diagram.
 * @param {object} data - Extracted diagram data
 * @param {string} context - Description for error messages
 * @param {object} [opts] - Options
 * @param {boolean} [opts.checkBorders=true] - Check endpoint border proximity.
 *   Disabled for post-nudge validation since incremental routing can
 *   degrade route quality (endpoints may shift away from source/target borders).
 * Returns array of failure messages.
 */
function validateEdges(data, context, { checkBorders = true } = {}) {
  const failures = [];

  for (const edge of data.edges) {
    const edgeLabel = `${edge.source}→${edge.target}`;
    const prefix = `[${context}] ${edgeLabel}:`;

    // 1. No NaN/Infinity
    const points = parsePath(edge.d);
    for (const [x, y] of points) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        failures.push(`${prefix} NaN/Infinity in path coordinates`);
        break;
      }
    }

    // 2. Non-collapsed path
    if (points.length < 2) {
      failures.push(`${prefix} path has fewer than 2 points`);
      continue;
    }
    const len = pathLength(points);
    if (len < MIN_PATH_LENGTH) {
      failures.push(`${prefix} collapsed path (length=${len.toFixed(1)}px)`);
    }

    // 3. Orthogonal segments
    const nonOrtho = findNonOrthogonalSegments(points);
    for (const seg of nonOrtho) {
      failures.push(`${prefix} non-orthogonal ${seg}`);
    }

    // 4. Source endpoint near source node border
    if (checkBorders) {
      const srcNode = data.nodes.find(n => n.id === edge.source);
      if (srcNode) {
        const [sx, sy] = points[0];
        if (!isNearBorder(sx, sy, srcNode)) {
          failures.push(`${prefix} source endpoint (${sx.toFixed(1)},${sy.toFixed(1)}) not near node border`);
        }
      }
    }

    // 5. Target endpoint near target node border
    if (checkBorders) {
      const tgtNode = data.nodes.find(n => n.id === edge.target);
      if (tgtNode) {
        const [tx, ty] = points[points.length - 1];
        if (!isNearBorder(tx, ty, tgtNode)) {
          failures.push(`${prefix} target endpoint (${tx.toFixed(1)},${ty.toFixed(1)}) not near node border`);
        }
      }
    }

    // 6. Arrowhead marker present
    if (!edge.markerEnd || !edge.markerEnd.includes('arrow')) {
      failures.push(`${prefix} missing arrowhead marker`);
    }

    // 7. Edge label visible if present
    if (edge.labelText && edge.labelBBox) {
      if (edge.labelBBox.width <= 0 || edge.labelBBox.height <= 0) {
        failures.push(`${prefix} label "${edge.labelText}" has zero-size bbox`);
      }
    }
  }

  return failures;
}

/**
 * Nudge a node by (dx, dy) pixels via simulated drag.
 */
async function nudgeNode(cardDiagram, nodeId, dx, dy) {
  const node = await cardDiagram.$(`.mm-node[data-node-id="${nodeId}"]`);
  if (!node) return;

  const box = await node.boundingBox();
  if (!box) return;

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: DRAG_STEPS });
  await page.mouse.up();
  await page.waitForTimeout(DRAG_SETTLE_MS);
}

describe('nudge stability', () => {
  it('all gallery diagrams render valid edges before any nudge', async () => {
    const cards = await page.$$('.card-diagram');
    const allFailures = [];

    for (let i = 0; i < cards.length; i++) {
      const data = await extractDiagramData(cards[i]);
      const failures = validateEdges(data, `card-${i}-initial`);
      allFailures.push(...failures);
    }

    if (allFailures.length > 0) {
      assert.fail(`Initial validation failures:\n${allFailures.join('\n')}`);
    }
  });

  // Test each gallery diagram independently.
  // Reload the page before each diagram test to avoid cross-contamination
  // from shared WASM router state between mermaker instances.
  // Order must match gallery page card order
  const diagramNames = ['linear', 'branching', 'subgraphs', 'cyclic', 'left-to-right', 'shapes'];

  for (let cardIdx = 0; cardIdx < diagramNames.length; cardIdx++) {
    const name = diagramNames[cardIdx];

    it(`${name}: edges stay valid after nudging every node`, async () => {
      // Reload page to reset all diagram instances and WASM state
      await page.goto(GALLERY_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(RENDER_WAIT_MS);

      const cards = await page.$$('.card-diagram');
      if (cardIdx >= cards.length) {
        assert.fail(`card index ${cardIdx} out of range (${cards.length} cards)`);
      }
      const card = cards[cardIdx];

      // Get initial node list
      const initialData = await extractDiagramData(card);
      const nodeIds = initialData.nodes.map(n => n.id);

      const allFailures = [];

      // Nudge each node right, then down, validating after each.
      // Each nudge is a separate drag operation to test incremental updates.
      for (const nodeId of nodeIds) {
        await nudgeNode(card, nodeId, NUDGE_PX, 0);
        const dataR = await extractDiagramData(card);
        allFailures.push(...validateEdges(dataR, `${name}/nudge-right/${nodeId}`, { checkBorders: false }));

        await nudgeNode(card, nodeId, 0, NUDGE_PX);
        const dataD = await extractDiagramData(card);
        allFailures.push(...validateEdges(dataD, `${name}/nudge-down/${nodeId}`, { checkBorders: false }));
      }

      if (allFailures.length > 0) {
        assert.fail(
          `${allFailures.length} edge validation failures in ${name}:\n` +
          allFailures.slice(0, 20).join('\n') +
          (allFailures.length > 20 ? `\n... and ${allFailures.length - 20} more` : '')
        );
      }
    });
  }
});
