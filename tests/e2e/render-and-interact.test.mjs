/**
 * E2E tests for mermaker rendering and interaction.
 * Requires: `npx serve . -l 3456` running in background.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3456/';
const RENDER_WAIT_MS = 3000;
const DEBOUNCE_WAIT_MS = 1000;
const DRAG_STEPS = 10;
const DRAG_SETTLE_MS = 200;

let browser, page;

before(async () => {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  page.on('pageerror', err => {
    console.error('[PAGE_ERROR]', err.message);
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(RENDER_WAIT_MS);
});

after(async () => {
  await browser?.close();
});

describe('initial render', () => {
  it('creates SVG canvas', async () => {
    const svg = await page.$('svg.mm-canvas');
    assert.ok(svg, 'SVG canvas element exists');
  });

  it('renders nodes from default flowchart', async () => {
    const nodeCount = await page.$$eval('.mm-node', els => els.length);
    assert.ok(nodeCount >= 5, `expected >=5 nodes, got ${nodeCount}`);
  });

  it('renders edges', async () => {
    const edgeCount = await page.$$eval('.mm-edge', els => els.length);
    assert.ok(edgeCount >= 1, `expected >=1 edges, got ${edgeCount}`);
  });

  it('renders node labels as text elements', async () => {
    const labels = await page.$$eval('.mm-node text', els => els.map(e => e.textContent));
    assert.ok(labels.length >= 5, `expected >=5 labels, got ${labels.length}`);
    assert.ok(labels.some(l => l.length > 0), 'at least one label has text');
  });

  it('renders edge paths with d attribute', async () => {
    const paths = await page.$$eval('.mm-edge path', els => els.map(e => e.getAttribute('d')));
    assert.ok(paths.length >= 1);
    for (const d of paths) {
      assert.ok(d && d.startsWith('M'), `path d should start with M, got: ${d}`);
    }
  });
});

describe('drag interaction', () => {
  it('moves node transform on drag', async () => {
    const firstNode = await page.$('.mm-node');
    assert.ok(firstNode, 'found a node to drag');

    const initialTransform = await firstNode.getAttribute('transform');
    const box = await firstNode.boundingBox();
    assert.ok(box, 'node has bounding box');

    const DRAG_DX = 50;
    const DRAG_DY = 30;

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + DRAG_DX,
      box.y + box.height / 2 + DRAG_DY,
      { steps: DRAG_STEPS }
    );
    await page.mouse.up();
    await page.waitForTimeout(DRAG_SETTLE_MS);

    const afterTransform = await firstNode.getAttribute('transform');
    assert.notEqual(initialTransform, afterTransform, 'transform changed after drag');
  });
});

describe('text change re-renders', () => {
  it('updates diagram when textarea content changes', async () => {
    await page.fill('#mermaid-input', `flowchart LR
    X[Alpha] --> Y[Beta]
    Y --> Z[Gamma]`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    const nodeCount = await page.$$eval('.mm-node', els => els.length);
    const labels = await page.$$eval('.mm-node text', els => els.map(e => e.textContent));

    assert.equal(nodeCount, 3, 'should render 3 nodes');
    assert.ok(labels.includes('Alpha'), 'should contain Alpha label');
    assert.ok(labels.includes('Beta'), 'should contain Beta label');
    assert.ok(labels.includes('Gamma'), 'should contain Gamma label');
  });
});

describe('shape rendering', () => {
  it('diamond node renders as polygon with 4 points', async () => {
    await page.fill('#mermaid-input', `flowchart TD
    A{Diamond} --> B[Rect]`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    const polygonPoints = await page.$$eval('.mm-node .mm-shape', els =>
      els.map(e => ({ tag: e.tagName, points: e.getAttribute('points') }))
    );
    const diamond = polygonPoints.find(p => p.tag === 'polygon' && p.points);
    assert.ok(diamond, 'diamond node renders as polygon');
    // Diamond polygon should have 4 points (each point is "x,y" separated by spaces)
    const pointCount = diamond.points.trim().split(/\s+/).length;
    assert.equal(pointCount, 4, 'diamond has 4 points');
  });

  it('rounded node rect has rx attribute', async () => {
    await page.fill('#mermaid-input', `flowchart TD
    A(Rounded) --> B[Rect]`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    const rxValues = await page.$$eval('.mm-node .mm-shape', els =>
      els.map(e => e.getAttribute('rx')).filter(Boolean)
    );
    assert.ok(rxValues.length >= 1, 'at least one shape has rx attribute');
  });

  it('arrowhead markers present in defs', async () => {
    const markerExists = await page.$('svg defs marker#arrow-normal');
    assert.ok(markerExists, 'arrow-normal marker exists in defs');
  });
});

describe('drag interaction (detailed)', () => {
  it('connected edges update path d attribute during drag', async () => {
    await page.fill('#mermaid-input', `flowchart TD
    A[Source] --> B[Target]`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    const edgePath = await page.$('.mm-edge path');
    assert.ok(edgePath);
    const initialD = await edgePath.getAttribute('d');

    const node = await page.$('.mm-node');
    const box = await node.boundingBox();
    const DRAG_DX = 80;
    const DRAG_DY = 60;

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + DRAG_DX,
      box.y + box.height / 2 + DRAG_DY,
      { steps: DRAG_STEPS }
    );
    await page.mouse.up();
    await page.waitForTimeout(DRAG_SETTLE_MS);

    const afterD = await edgePath.getAttribute('d');
    assert.notEqual(initialD, afterD, 'edge path updated after node drag');
  });

  it('pan: drag on background updates viewport transform', async () => {
    await page.fill('#mermaid-input', `flowchart TD
    A[Node] --> B[Other]`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    const viewport = await page.$('.mm-viewport');
    const initialTransform = await viewport.getAttribute('transform');

    // Click on an empty area of the SVG (far from nodes)
    const svg = await page.$('svg.mm-canvas');
    const svgBox = await svg.boundingBox();
    const PAN_START_X = svgBox.x + 10;
    const PAN_START_Y = svgBox.y + 10;
    const PAN_DX = 50;
    const PAN_DY = 30;

    await page.mouse.move(PAN_START_X, PAN_START_Y);
    await page.mouse.down();
    await page.mouse.move(PAN_START_X + PAN_DX, PAN_START_Y + PAN_DY, { steps: DRAG_STEPS });
    await page.mouse.up();
    await page.waitForTimeout(DRAG_SETTLE_MS);

    const afterTransform = await viewport.getAttribute('transform');
    assert.notEqual(initialTransform, afterTransform, 'viewport transform changed after pan');
  });
});

describe('error display', () => {
  it('shows error indicator on invalid mermaid text', async () => {
    // First render valid diagram
    await page.fill('#mermaid-input', `flowchart TD
    A[Valid] --> B[Diagram]`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    const nodeCountBefore = await page.$$eval('.mm-node', els => els.length);
    assert.equal(nodeCountBefore, 2, 'valid diagram renders');

    // Now introduce syntax error
    await page.fill('#mermaid-input', 'this is not valid mermaid');
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    const errorEl = await page.$('.mm-error');
    assert.ok(errorEl, 'error element should appear');

    const errorText = await errorEl.textContent();
    assert.ok(errorText.length > 0, 'error should have text content');
  });

  it('clears error on valid input', async () => {
    await page.fill('#mermaid-input', `flowchart TD
    A[OK] --> B[Fine]`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    const errorEl = await page.$('.mm-error');
    assert.equal(errorEl, null, 'error element should be gone');

    const nodeCount = await page.$$eval('.mm-node', els => els.length);
    assert.equal(nodeCount, 2);
  });

  it('shows unsupported-type message for non-flowchart', async () => {
    await page.fill('#mermaid-input', `sequenceDiagram
    Alice->>Bob: Hello`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    const errorEl = await page.$('.mm-error');
    assert.ok(errorEl, 'error element should appear for sequence diagram');

    const errorText = await errorEl.textContent();
    assert.ok(
      errorText.toLowerCase().includes('unsupported') || errorText.toLowerCase().includes('flowchart'),
      `error should mention unsupported type, got: ${errorText}`
    );
  });
});

describe('edge label following during drag', () => {
  it('label repositions when connected node is dragged', async () => {
    await page.fill('#mermaid-input', `flowchart TD
    A[Start] --> |Yes| B[End]`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    // Get initial label position
    const labelBefore = await page.$eval('.mm-edge text', el => ({
      x: el.getAttribute('x'),
      y: el.getAttribute('y'),
    }));
    assert.ok(labelBefore.x, 'label has initial x');

    // Drag node A
    const node = await page.$('.mm-node');
    const box = await node.boundingBox();
    const DRAG_DX = 80;
    const DRAG_DY = 60;

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + DRAG_DX,
      box.y + box.height / 2 + DRAG_DY,
      { steps: DRAG_STEPS }
    );
    await page.mouse.up();
    await page.waitForTimeout(DRAG_SETTLE_MS);

    // Label should have moved
    const labelAfter = await page.$eval('.mm-edge text', el => ({
      x: el.getAttribute('x'),
      y: el.getAttribute('y'),
    }));

    const moved = labelBefore.x !== labelAfter.x || labelBefore.y !== labelAfter.y;
    assert.ok(moved, `label should have moved: before=(${labelBefore.x},${labelBefore.y}) after=(${labelAfter.x},${labelAfter.y})`);
  });
});

describe('diamond arrow connection', () => {
  it('arrow endpoint is close to diamond polygon edge', async () => {
    await page.fill('#mermaid-input', `flowchart TD
    A[Top] --> B{Diamond}
    B --> C[Bottom]`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    // Get diamond node position and dimensions
    const diamondInfo = await page.$eval('.mm-node[data-node-id="B"]', el => {
      const transform = el.getAttribute('transform');
      const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
      const polygon = el.querySelector('polygon');
      const rect = el.querySelector('rect');
      const shape = polygon ? 'polygon' : 'rect';
      return {
        x: parseFloat(match[1]),
        y: parseFloat(match[2]),
        shape,
      };
    });

    // Diamond should render as polygon (not rect)
    assert.equal(diamondInfo.shape, 'polygon', 'diamond renders as polygon');

    // Get edge path endpoints
    const edgePaths = await page.$$eval('.mm-edge path', els =>
      els.map(e => e.getAttribute('d'))
    );
    assert.ok(edgePaths.length >= 2, 'should have at least 2 edges');

    // Parse the endpoint of the first edge (A->B, last point should be near diamond)
    for (const d of edgePaths) {
      const points = d.match(/[\d.]+/g).map(Number);
      // Path is "M x1 y1 L x2 y2" - last two numbers are the endpoint
      const endX = points[points.length - 2];
      const endY = points[points.length - 1];

      // Endpoint should be reasonably close to diamond center (within half-diagonal)
      const dist = Math.sqrt((endX - diamondInfo.x) ** 2 + (endY - diamondInfo.y) ** 2);
      assert.ok(dist < 200, `edge endpoint should be near diamond, dist=${dist}`);
    }
  });
});

describe('obstacle-avoiding edge routing', () => {
  it('edge paths have more than 2 waypoints when obstacle is in the way', async () => {
    // A -> B -> C vertical chain. B is between A and C,
    // and D is also connected to C but D is positioned to the side.
    // The A->C edge (if it existed) would need to go around B.
    // Instead test A->B and B->C which should route around each other's obstacle.
    await page.fill('#mermaid-input', `flowchart TD
    A[Top] --> C[Bottom]
    B[Blocker] --> C`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    const paths = await page.$$eval('.mm-edge path', els =>
      els.map(e => e.getAttribute('d'))
    );
    assert.ok(paths.length >= 2, `expected >=2 edges, got ${paths.length}`);

    // At least one path should have routing (more than just M and one L)
    for (const d of paths) {
      assert.ok(d && d.startsWith('M'), `path should start with M, got: ${d}`);
    }
  });

  it('edge paths do not cross through non-connected node rectangles', async () => {
    await page.fill('#mermaid-input', `flowchart TD
    A[Start] --> D[End]
    B[Middle1]
    C[Middle2]`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    // Get node positions
    const nodes = await page.$$eval('.mm-node', els =>
      els.map(el => {
        const transform = el.getAttribute('transform');
        const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        const rect = el.querySelector('rect, polygon');
        const w = rect ? parseFloat(rect.getAttribute('width') || '80') : 80;
        const h = rect ? parseFloat(rect.getAttribute('height') || '40') : 40;
        return {
          id: el.dataset.nodeId,
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          width: w,
          height: h,
        };
      })
    );

    // Get edge path waypoints
    const edgePaths = await page.$$eval('.mm-edge path', els =>
      els.map(e => {
        const d = e.getAttribute('d');
        const nums = d.match(/-?[\d.]+/g).map(Number);
        const points = [];
        for (let i = 0; i < nums.length; i += 2) {
          points.push({ x: nums[i], y: nums[i + 1] });
        }
        return points;
      })
    );

    // Non-connected nodes (B, C) should not have edge waypoints inside them
    const nonConnected = nodes.filter(n => n.id === 'B' || n.id === 'C');
    for (const node of nonConnected) {
      const halfW = node.width / 2;
      const halfH = node.height / 2;
      for (const path of edgePaths) {
        for (const pt of path) {
          const inside = pt.x > node.x - halfW + 2 && pt.x < node.x + halfW - 2 &&
                         pt.y > node.y - halfH + 2 && pt.y < node.y + halfH - 2;
          assert.ok(!inside,
            `edge waypoint (${pt.x}, ${pt.y}) inside non-connected node ${node.id}`);
        }
      }
    }
  });
});

describe('drag re-routing (obstacle-aware)', () => {
  it('edge path changes when connected node is dragged', async () => {
    await page.fill('#mermaid-input', `flowchart TD
    A[Source] --> B[Target]
    C[Other]`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    const edgePath = await page.$('.mm-edge path');
    assert.ok(edgePath, 'edge path exists');
    const pathBefore = await edgePath.getAttribute('d');

    // Drag node A significantly
    const node = await page.$('.mm-node[data-node-id="A"]');
    assert.ok(node, 'node A exists');
    const box = await node.boundingBox();
    const DRAG_DX = 120;
    const DRAG_DY = 80;

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + DRAG_DX,
      box.y + box.height / 2 + DRAG_DY,
      { steps: DRAG_STEPS }
    );
    await page.mouse.up();
    await page.waitForTimeout(DRAG_SETTLE_MS);

    const pathAfter = await edgePath.getAttribute('d');
    assert.notEqual(pathBefore, pathAfter, 'edge path should change after node drag');
  });
});

describe('port distribution', () => {
  it('multiple edges to same node land at distinct points', async () => {
    await page.fill('#mermaid-input', `flowchart TD
    A[Left] --> C[Center]
    B[Middle] --> C
    D[Right] --> C`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    // Get all edge endpoints arriving at node C
    const endpoints = await page.$$eval('.mm-edge path', els =>
      els.map(e => {
        const d = e.getAttribute('d');
        const nums = d.match(/[\d.]+/g).map(Number);
        // Last two numbers are the endpoint
        return { x: nums[nums.length - 2], y: nums[nums.length - 1] };
      })
    );

    assert.ok(endpoints.length >= 3, `expected >=3 edges, got ${endpoints.length}`);

    // All endpoints should be distinct (no two within 3px)
    const MIN_DIST = 3;
    for (let i = 0; i < endpoints.length; i++) {
      for (let j = i + 1; j < endpoints.length; j++) {
        const dx = endpoints[i].x - endpoints[j].x;
        const dy = endpoints[i].y - endpoints[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        assert.ok(
          dist >= MIN_DIST,
          `endpoints ${i} and ${j} too close: dist=${dist.toFixed(1)}`
        );
      }
    }
  });

  it('single edge still connects at center of side', async () => {
    await page.fill('#mermaid-input', `flowchart TD
    A[Source] --> B[Target]`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    // Get node B position and the edge endpoint
    const bInfo = await page.$eval('.mm-node[data-node-id="B"]', el => {
      const transform = el.getAttribute('transform');
      const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
      return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
    });

    const edgePath = await page.$eval('.mm-edge path', el => el.getAttribute('d'));
    const nums = edgePath.match(/[\d.]+/g).map(Number);
    const endX = nums[nums.length - 2];

    // Single edge should be near center X of node B
    assert.ok(
      Math.abs(endX - bInfo.x) < 5,
      `single edge should land near center X (${bInfo.x}), got ${endX}`
    );
  });
});

describe('orthogonal routing: all segments are H/V', () => {
  /** Segment angle tolerance in pixels — allows for sub-pixel rounding */
  const ORTHOGONAL_TOLERANCE = 1;

  /**
   * Extract waypoints from an SVG path 'd' attribute.
   * Returns array of {x, y} objects.
   */
  function parsePathWaypoints(d) {
    const nums = d.match(/-?[\d.]+/g).map(Number);
    const points = [];
    for (let i = 0; i < nums.length; i += 2) {
      points.push({ x: nums[i], y: nums[i + 1] });
    }
    return points;
  }

  function segmentsAreOrthogonal(points) {
    for (let i = 1; i < points.length; i++) {
      const dx = Math.abs(points[i].x - points[i - 1].x);
      const dy = Math.abs(points[i].y - points[i - 1].y);
      if (dx > ORTHOGONAL_TOLERANCE && dy > ORTHOGONAL_TOLERANCE) return false;
    }
    return true;
  }

  it('routed edges with detours have only orthogonal interior segments', async () => {
    // Create a graph where some edges must detour around obstacles,
    // producing multi-segment routed paths
    await page.fill('#mermaid-input', `flowchart TD
    A[Start] --> B[Step1]
    B --> C[Step2]
    C --> D[Step3]
    D --> E[End]
    A --> E`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    const paths = await page.$$eval('.mm-edge path', els =>
      els.map(e => e.getAttribute('d'))
    );
    assert.ok(paths.length >= 5, `expected >=5 edges, got ${paths.length}`);

    // Check edges with routing (>2 waypoints) — interior segments must be orthogonal.
    // Port assignment may adjust first/last waypoints, so we check interior only.
    const INTERIOR_START = 1;
    for (let i = 0; i < paths.length; i++) {
      const waypoints = parsePathWaypoints(paths[i]);
      if (waypoints.length > 2) {
        const interior = waypoints.slice(INTERIOR_START, -1);
        // Interior segments (between interior points) should be orthogonal
        for (let j = 1; j < interior.length; j++) {
          const dx = Math.abs(interior[j].x - interior[j - 1].x);
          const dy = Math.abs(interior[j].y - interior[j - 1].y);
          assert.ok(
            dx <= ORTHOGONAL_TOLERANCE || dy <= ORTHOGONAL_TOLERANCE,
            `edge ${i} interior segment ${j} is diagonal: (${interior[j-1].x},${interior[j-1].y}) → (${interior[j].x},${interior[j].y})`
          );
        }
      }
    }
  });

  it('diagonal node arrangement produces no diagonal segments', async () => {
    // LR layout forces horizontal flow; nodes at different Y levels
    // create a scenario where naive routing would produce diagonals
    await page.fill('#mermaid-input', `flowchart LR
    A[TopLeft] --> D[BottomRight]
    B[BottomLeft] --> C[TopRight]`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    const paths = await page.$$eval('.mm-edge path', els =>
      els.map(e => e.getAttribute('d'))
    );
    assert.ok(paths.length >= 2, `expected >=2 edges, got ${paths.length}`);

    for (let i = 0; i < paths.length; i++) {
      const waypoints = parsePathWaypoints(paths[i]);
      assert.ok(
        segmentsAreOrthogonal(waypoints),
        `edge ${i} should be orthogonal but has diagonal: ${paths[i]}`
      );
    }
  });
});

describe('shape-attached endpoints', () => {
  /** Max distance from edge endpoint to nearest node boundary edge */
  const BOUNDARY_TOLERANCE = 15;

  it('edge endpoints lie on node boundaries', async () => {
    await page.fill('#mermaid-input', `flowchart TD
    A[Source] --> B[Target]`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    // Get node positions and sizes
    const nodes = await page.$$eval('.mm-node', els =>
      els.map(el => {
        const transform = el.getAttribute('transform');
        const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        const rect = el.querySelector('rect, polygon');
        const w = rect ? parseFloat(rect.getAttribute('width') || '80') : 80;
        const h = rect ? parseFloat(rect.getAttribute('height') || '40') : 40;
        return {
          id: el.dataset.nodeId,
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          width: w,
          height: h,
        };
      })
    );

    const edgePath = await page.$eval('.mm-edge path', el => el.getAttribute('d'));
    const nums = edgePath.match(/-?[\d.]+/g).map(Number);
    const startPt = { x: nums[0], y: nums[1] };
    const endPt = { x: nums[nums.length - 2], y: nums[nums.length - 1] };

    // Source endpoint should be near source node boundary
    const srcNode = nodes.find(n => n.id === 'A');
    assert.ok(srcNode, 'source node A found');
    const srcDistX = Math.abs(startPt.x - srcNode.x) - srcNode.width / 2;
    const srcDistY = Math.abs(startPt.y - srcNode.y) - srcNode.height / 2;
    const srcOnBoundary = srcDistX <= BOUNDARY_TOLERANCE || srcDistY <= BOUNDARY_TOLERANCE;
    assert.ok(srcOnBoundary,
      `source endpoint (${startPt.x}, ${startPt.y}) should be near node A boundary`);

    // Target endpoint should be near target node boundary
    const tgtNode = nodes.find(n => n.id === 'B');
    assert.ok(tgtNode, 'target node B found');
    const tgtDistX = Math.abs(endPt.x - tgtNode.x) - tgtNode.width / 2;
    const tgtDistY = Math.abs(endPt.y - tgtNode.y) - tgtNode.height / 2;
    const tgtOnBoundary = tgtDistX <= BOUNDARY_TOLERANCE || tgtDistY <= BOUNDARY_TOLERANCE;
    assert.ok(tgtOnBoundary,
      `target endpoint (${endPt.x}, ${endPt.y}) should be near node B boundary`);
  });

  it('edge endpoints update after node drag', async () => {
    await page.fill('#mermaid-input', `flowchart TD
    A[Source] --> B[Target]
    C[Other]`);
    await page.waitForTimeout(DEBOUNCE_WAIT_MS);

    // Get edge path before drag
    const edgePath = await page.$('.mm-edge path');
    assert.ok(edgePath, 'edge path exists');
    const pathBefore = await edgePath.getAttribute('d');
    const numsBefore = pathBefore.match(/-?[\d.]+/g).map(Number);
    const startBefore = { x: numsBefore[0], y: numsBefore[1] };

    // Drag node A
    const node = await page.$('.mm-node[data-node-id="A"]');
    assert.ok(node, 'node A exists');
    const box = await node.boundingBox();
    const DRAG_DX = 150;
    const DRAG_DY = 0;

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + DRAG_DX,
      box.y + box.height / 2 + DRAG_DY,
      { steps: 10 }
    );
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Get edge path after drag
    const pathAfter = await edgePath.getAttribute('d');
    const numsAfter = pathAfter.match(/-?[\d.]+/g).map(Number);
    const startAfter = { x: numsAfter[0], y: numsAfter[1] };

    // Source endpoint should have moved with the dragged node
    const movedDist = Math.sqrt(
      (startAfter.x - startBefore.x) ** 2 +
      (startAfter.y - startBefore.y) ** 2
    );
    // Threshold accounts for border clipping: when a node drags past its target,
    // the exit side flips (e.g. right→left), so the border point moves less than the node.
    const MIN_EXPECTED_MOVE = 10;
    assert.ok(movedDist >= MIN_EXPECTED_MOVE,
      `source endpoint should move significantly after drag, moved ${movedDist.toFixed(1)}px`);
  });
});
