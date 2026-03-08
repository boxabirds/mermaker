import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectSide } from '../../src/util/geometry.js';
import { assignPorts, reassignPorts } from '../../src/layout/port-assigner.js';

const CENTER_X = 100;
const CENTER_Y = 100;
const WIDTH = 120;
const HEIGHT = 40;

function makeNode(id, x, y, w = WIDTH, h = HEIGHT) {
  return { id, x, y, width: w, height: h };
}

function makePositions(nodeList, edgeList) {
  const nodes = new Map();
  for (const n of nodeList) nodes.set(n.id, { x: n.x, y: n.y, width: n.width, height: n.height });
  return {
    nodes,
    edges: edgeList,
    groups: new Map(),
  };
}

function makeSpec(nodeList, edgeList) {
  return {
    nodes: nodeList,
    edges: edgeList.map(e => ({ source: e.source, target: e.target })),
  };
}

describe('detectSide', () => {
  const node = { x: CENTER_X, y: CENTER_Y, width: WIDTH, height: HEIGHT };

  it('returns top for opposite above', () => {
    assert.equal(detectSide(node, CENTER_X, CENTER_Y - 200), 'top');
  });

  it('returns bottom for opposite below', () => {
    assert.equal(detectSide(node, CENTER_X, CENTER_Y + 200), 'bottom');
  });

  it('returns right for opposite to the right', () => {
    assert.equal(detectSide(node, CENTER_X + 200, CENTER_Y), 'right');
  });

  it('returns left for opposite to the left', () => {
    assert.equal(detectSide(node, CENTER_X - 200, CENTER_Y), 'left');
  });

  it('returns correct side for diagonal with wide node', () => {
    // Node is 120 wide, 40 tall — horizontally dominant offset should give left/right
    const side = detectSide(node, CENTER_X + 100, CENTER_Y + 10);
    assert.equal(side, 'right');
  });

  it('returns correct side for diagonal with tall approach', () => {
    // Same node — vertically dominant offset should give top/bottom
    const side = detectSide(node, CENTER_X + 10, CENTER_Y + 100);
    assert.equal(side, 'bottom');
  });
});

describe('assignPorts: single edge per side', () => {
  it('places single edge at center of side', () => {
    const A = makeNode('A', 100, 0);
    const B = makeNode('B', 100, 200);
    const edges = [{ source: 'A', target: 'B', waypoints: [[100, 20], [100, 180]] }];
    const positions = makePositions([A, B], edges);
    const spec = makeSpec([A, B], edges);

    assignPorts(positions, spec);

    // A's bottom side center is at (100, 20), B's top side center is at (100, 180)
    // With single edge, should stay at center of side
    const [ax] = positions.edges[0].waypoints[0];
    const [bx] = positions.edges[0].waypoints[positions.edges[0].waypoints.length - 1];
    assert.equal(ax, A.x, 'source endpoint at center X of A');
    assert.equal(bx, B.x, 'target endpoint at center X of B');
  });
});

describe('assignPorts: multiple edges on same side', () => {
  it('distributes 3 edges evenly on top side', () => {
    // Center node B at (200, 200), three nodes above approaching from left, center, right
    const B = makeNode('B', 200, 200);
    const A1 = makeNode('A1', 100, 0);
    const A2 = makeNode('A2', 200, 0);
    const A3 = makeNode('A3', 300, 0);
    const edges = [
      { source: 'A1', target: 'B', waypoints: [[100, 20], [200, 180]] },
      { source: 'A2', target: 'B', waypoints: [[200, 20], [200, 180]] },
      { source: 'A3', target: 'B', waypoints: [[300, 20], [200, 180]] },
    ];
    const positions = makePositions([B, A1, A2, A3], edges);
    const spec = makeSpec([B, A1, A2, A3], edges);

    assignPorts(positions, spec);

    // B's top side: y = 200 - 20 = 180, x ranges from 140 to 260 (width=120)
    // 3 edges: spacing = 120 / 4 = 30
    // Points at: 140 + 30 = 170, 140 + 60 = 200, 140 + 90 = 230
    const targetPoints = edges.map(e => positions.edges[positions.edges.indexOf(e)].waypoints[1]);

    // All should have same Y (top side of B)
    const EXPECTED_Y = B.y - B.height / 2;
    for (const pt of targetPoints) {
      assert.ok(Math.abs(pt[1] - EXPECTED_Y) < 0.01, `y should be ${EXPECTED_Y}, got ${pt[1]}`);
    }

    // All X values should be distinct
    const xs = targetPoints.map(p => p[0]);
    assert.equal(new Set(xs).size, 3, 'all 3 endpoints should have distinct X');

    // Should be sorted left-to-right (A1 is leftmost, A3 is rightmost)
    assert.ok(xs[0] < xs[1], 'leftmost source should have leftmost endpoint');
    assert.ok(xs[1] < xs[2], 'center source between left and right');
  });

  it('distributes 2 edges evenly', () => {
    const B = makeNode('B', 200, 200);
    const A1 = makeNode('A1', 100, 0);
    const A2 = makeNode('A2', 300, 0);
    const edges = [
      { source: 'A1', target: 'B', waypoints: [[100, 20], [200, 180]] },
      { source: 'A2', target: 'B', waypoints: [[300, 20], [200, 180]] },
    ];
    const positions = makePositions([B, A1, A2], edges);
    const spec = makeSpec([B, A1, A2], edges);

    assignPorts(positions, spec);

    const targetPoints = [
      positions.edges[0].waypoints[1],
      positions.edges[1].waypoints[1],
    ];

    // 2 edges on width=120: spacing = 120/3 = 40, points at 1/3 and 2/3
    const xs = targetPoints.map(p => p[0]);
    assert.equal(new Set(xs).size, 2, 'both endpoints should have distinct X');
    assert.ok(xs[0] < xs[1], 'left source gets left endpoint');
  });
});

describe('assignPorts: edges on multiple sides', () => {
  it('distributes independently per side', () => {
    const B = makeNode('B', 200, 200, 120, 40);
    const top1 = makeNode('T1', 200, 0);
    const right1 = makeNode('R1', 400, 200);
    const edges = [
      { source: 'T1', target: 'B', waypoints: [[200, 20], [200, 180]] },
      { source: 'B', target: 'R1', waypoints: [[260, 200], [340, 200]] },
    ];
    const positions = makePositions([B, top1, right1], edges);
    const spec = makeSpec([B, top1, right1], edges);

    assignPorts(positions, spec);

    // Top side: single edge, should be at center X = 200
    const topPt = positions.edges[0].waypoints[1];
    assert.equal(topPt[0], B.x, 'top side single edge at center X');

    // Right side: single edge, should be at center Y = 200
    const rightPt = positions.edges[1].waypoints[0];
    assert.equal(rightPt[1], B.y, 'right side single edge at center Y');
  });
});

describe('assignPorts: zero edges', () => {
  it('handles node with no edges', () => {
    const A = makeNode('A', 100, 100);
    const positions = makePositions([A], []);
    const spec = makeSpec([A], []);

    // Should not throw
    assignPorts(positions, spec);
    assert.equal(positions.edges.length, 0);
  });
});

describe('assignPorts: approach-angle sorting', () => {
  it('sorts left-to-right for top side', () => {
    const B = makeNode('B', 200, 200, 200, 40);
    const A1 = makeNode('A1', 300, 0); // right
    const A2 = makeNode('A2', 100, 0); // left
    const A3 = makeNode('A3', 200, 0); // center
    // Note: edges intentionally out of order
    const edges = [
      { source: 'A1', target: 'B', waypoints: [[300, 20], [200, 180]] },
      { source: 'A2', target: 'B', waypoints: [[100, 20], [200, 180]] },
      { source: 'A3', target: 'B', waypoints: [[200, 20], [200, 180]] },
    ];
    const positions = makePositions([B, A1, A2, A3], edges);
    const spec = makeSpec([B, A1, A2, A3], edges);

    assignPorts(positions, spec);

    // Edge from A2 (x=100, leftmost) should get leftmost endpoint on B
    // Edge from A3 (x=200, center) should get center endpoint
    // Edge from A1 (x=300, rightmost) should get rightmost endpoint
    const xA2 = positions.edges[1].waypoints[1][0]; // A2's target point
    const xA3 = positions.edges[2].waypoints[1][0]; // A3's target point
    const xA1 = positions.edges[0].waypoints[1][0]; // A1's target point

    assert.ok(xA2 < xA3, `A2 endpoint (${xA2}) should be left of A3 (${xA3})`);
    assert.ok(xA3 < xA1, `A3 endpoint (${xA3}) should be left of A1 (${xA1})`);
  });

  it('sorts top-to-bottom for right side', () => {
    const B = makeNode('B', 0, 200, 40, 120);
    const R1 = makeNode('R1', 200, 100); // above
    const R2 = makeNode('R2', 200, 300); // below
    const edges = [
      { source: 'B', target: 'R2', waypoints: [[20, 260], [180, 300]] },
      { source: 'B', target: 'R1', waypoints: [[20, 140], [180, 100]] },
    ];
    const positions = makePositions([B, R1, R2], edges);
    const spec = makeSpec([B, R1, R2], edges);

    assignPorts(positions, spec);

    // R1 is above (y=100), R2 is below (y=300)
    // On B's right side, R1 endpoint should be above R2 endpoint
    const yR2 = positions.edges[0].waypoints[0][1];
    const yR1 = positions.edges[1].waypoints[0][1];

    assert.ok(yR1 < yR2, `R1 endpoint (${yR1}) should be above R2 (${yR2})`);
  });
});

describe('reassignPorts', () => {
  it('updates ports for moved node and neighbors', () => {
    const B = makeNode('B', 200, 200, 120, 40);
    const A1 = makeNode('A1', 100, 0);
    const A2 = makeNode('A2', 300, 0);
    const edges = [
      { source: 'A1', target: 'B', waypoints: [[100, 20], [200, 180]] },
      { source: 'A2', target: 'B', waypoints: [[300, 20], [200, 180]] },
    ];
    const positions = makePositions([B, A1, A2], edges);
    const spec = makeSpec([B, A1, A2], edges);

    assignPorts(positions, spec);
    const bwp0 = positions.edges[0].waypoints;
    const bwp1 = positions.edges[1].waypoints;
    const beforeX0 = bwp0[bwp0.length - 1][0];
    const beforeX1 = bwp1[bwp1.length - 1][0];

    // Move B to a different position (simulating drag, which resets edges to 2 waypoints)
    positions.nodes.get('B').x = 400;
    positions.edges[0].waypoints = [[100, 20], [400, 180]];
    positions.edges[1].waypoints = [[300, 20], [400, 180]];

    reassignPorts('B', positions, spec);

    // Use last waypoint — fixDiagonalEdges may insert L-bend midpoints
    const wp0 = positions.edges[0].waypoints;
    const wp1 = positions.edges[1].waypoints;
    const afterX0 = wp0[wp0.length - 1][0];
    const afterX1 = wp1[wp1.length - 1][0];

    // Endpoints should have changed since B moved
    assert.notEqual(beforeX0, afterX0, 'endpoint 0 should change after B moves');
    assert.notEqual(beforeX1, afterX1, 'endpoint 1 should change after B moves');
  });

  it('handles moved node with no edges', () => {
    const A = makeNode('A', 100, 100);
    const positions = makePositions([A], []);
    const spec = makeSpec([A], []);

    // Should not throw
    reassignPorts('A', positions, spec);
  });
});

describe('assignPorts: minimum spacing clamp', () => {
  it('clamps spacing on very small node with many edges', () => {
    // Node only 20px wide but 5 edges on top
    const B = makeNode('B', 100, 200, 20, 40);
    const sources = [];
    const edges = [];
    const EDGE_COUNT = 5;
    for (let i = 0; i < EDGE_COUNT; i++) {
      const id = `S${i}`;
      sources.push(makeNode(id, 60 + i * 20, 0));
      edges.push({ source: id, target: 'B', waypoints: [[60 + i * 20, 20], [100, 180]] });
    }
    const allNodes = [B, ...sources];
    const positions = makePositions(allNodes, edges);
    const spec = makeSpec(allNodes, edges);

    assignPorts(positions, spec);

    // All endpoints should still be distinct
    const xs = edges.map(e => positions.edges[positions.edges.indexOf(e)].waypoints[1][0]);
    const uniqueXs = new Set(xs.map(x => x.toFixed(2)));
    assert.equal(uniqueXs.size, EDGE_COUNT, `all ${EDGE_COUNT} endpoints should be distinct`);
  });
});
