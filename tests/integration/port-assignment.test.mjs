import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph } from '../../src/layout/graph-builder.js';
import { computeLayout } from '../../src/layout/layout-engine.js';
import { reassignPorts } from '../../src/layout/port-assigner.js';
import { MIN_PORT_SPACING } from '../../src/util/constants.js';

/**
 * Integration tests for port assignment through the full layout pipeline.
 */

function makeDiagramModel(nodes, edges, direction = 'TD') {
  return {
    nodes: new Map(nodes.map(n => [n.id, n])),
    edges,
    groups: new Map(),
    direction,
  };
}

describe('port assignment: star topology pipeline', () => {
  it('all connection points on center node are distinct', async () => {
    // Center node connected to 4 nodes above
    const model = makeDiagramModel(
      [
        { id: 'C', label: 'Center', shape: 'rect' },
        { id: 'A', label: 'Left', shape: 'rect' },
        { id: 'B', label: 'MidLeft', shape: 'rect' },
        { id: 'D', label: 'MidRight', shape: 'rect' },
        { id: 'E', label: 'Right', shape: 'rect' },
      ],
      [
        { source: 'A', target: 'C' },
        { source: 'B', target: 'C' },
        { source: 'D', target: 'C' },
        { source: 'E', target: 'C' },
      ],
    );

    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    // Get all target endpoints (last waypoint) on center node C
    const cEndpoints = [];
    for (const edge of positions.edges) {
      if (edge.target === 'C') {
        const lastPt = edge.waypoints[edge.waypoints.length - 1];
        cEndpoints.push(lastPt);
      }
    }

    assert.equal(cEndpoints.length, 4, 'center node should have 4 incoming edges');

    // All endpoints should be distinct
    for (let i = 0; i < cEndpoints.length; i++) {
      for (let j = i + 1; j < cEndpoints.length; j++) {
        const dx = cEndpoints[i][0] - cEndpoints[j][0];
        const dy = cEndpoints[i][1] - cEndpoints[j][1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        assert.ok(
          dist >= MIN_PORT_SPACING - 0.01,
          `endpoints ${i} and ${j} too close: dist=${dist.toFixed(2)}, min=${MIN_PORT_SPACING}`
        );
      }
    }
  });

  it('endpoints stay within node side boundaries', async () => {
    const model = makeDiagramModel(
      [
        { id: 'C', label: 'Center', shape: 'rect' },
        { id: 'A', label: 'A', shape: 'rect' },
        { id: 'B', label: 'B', shape: 'rect' },
        { id: 'D', label: 'D', shape: 'rect' },
      ],
      [
        { source: 'A', target: 'C' },
        { source: 'B', target: 'C' },
        { source: 'D', target: 'C' },
      ],
    );

    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    const cPos = positions.nodes.get('C');
    const halfW = cPos.width / 2;
    const halfH = cPos.height / 2;

    for (const edge of positions.edges) {
      if (edge.target === 'C') {
        const [px, py] = edge.waypoints[edge.waypoints.length - 1];
        // Point should be on or very near the node border
        const onLeftRight = Math.abs(Math.abs(px - cPos.x) - halfW) < 1;
        const onTopBottom = Math.abs(Math.abs(py - cPos.y) - halfH) < 1;
        assert.ok(
          onLeftRight || onTopBottom,
          `endpoint (${px.toFixed(1)}, ${py.toFixed(1)}) should be on border of C at (${cPos.x}, ${cPos.y}) with half-dims (${halfW}, ${halfH})`
        );
      }
    }
  });
});

describe('port assignment: linear chain', () => {
  it('single edge per side uses center placement', async () => {
    const model = makeDiagramModel(
      [
        { id: 'A', label: 'Top', shape: 'rect' },
        { id: 'B', label: 'Middle', shape: 'rect' },
        { id: 'C', label: 'Bottom', shape: 'rect' },
      ],
      [
        { source: 'A', target: 'B' },
        { source: 'B', target: 'C' },
      ],
    );

    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    const bPos = positions.nodes.get('B');

    // B has one incoming (from A) and one outgoing (to C)
    // In TD layout, incoming is on top, outgoing on bottom
    // Both should be at center X of B
    for (const edge of positions.edges) {
      if (edge.target === 'B') {
        const [px] = edge.waypoints[edge.waypoints.length - 1];
        assert.ok(
          Math.abs(px - bPos.x) < 1,
          `incoming edge to B should land at center X (${bPos.x}), got ${px}`
        );
      }
      if (edge.source === 'B') {
        const [px] = edge.waypoints[0];
        assert.ok(
          Math.abs(px - bPos.x) < 1,
          `outgoing edge from B should start at center X (${bPos.x}), got ${px}`
        );
      }
    }
  });
});

describe('port assignment: drag reassignment', () => {
  it('ports update after node position change', async () => {
    const model = makeDiagramModel(
      [
        { id: 'C', label: 'Center', shape: 'rect' },
        { id: 'A', label: 'Left', shape: 'rect' },
        { id: 'B', label: 'Right', shape: 'rect' },
      ],
      [
        { source: 'A', target: 'C' },
        { source: 'B', target: 'C' },
      ],
    );

    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    // Record initial endpoints
    const before = positions.edges.map(e => [...e.waypoints[e.waypoints.length - 1]]);

    // Simulate drag: moveNode resets edges to 2-waypoint border-clipped lines
    const cPos = positions.nodes.get('C');
    cPos.x += 200;
    cPos.y += 100;

    // Reset affected edges to 2 waypoints (as moveNode would)
    for (const edge of positions.edges) {
      if (edge.source === 'C' || edge.target === 'C') {
        const srcPos = positions.nodes.get(edge.source);
        const tgtPos = positions.nodes.get(edge.target);
        edge.waypoints = [[srcPos.x, srcPos.y], [tgtPos.x, tgtPos.y]];
      }
    }

    reassignPorts('C', positions, spec);

    // Endpoints should have changed
    const after = positions.edges.map(e => [...e.waypoints[e.waypoints.length - 1]]);
    let anyChanged = false;
    for (let i = 0; i < before.length; i++) {
      if (before[i][0] !== after[i][0] || before[i][1] !== after[i][1]) {
        anyChanged = true;
        break;
      }
    }
    assert.ok(anyChanged, 'at least one endpoint should change after node moves');
  });
});

describe('port assignment: LR direction', () => {
  it('distributes on left/right sides for horizontal layout', async () => {
    const model = makeDiagramModel(
      [
        { id: 'A', label: 'Start', shape: 'rect' },
        { id: 'B', label: 'End1', shape: 'rect' },
        { id: 'C', label: 'End2', shape: 'rect' },
      ],
      [
        { source: 'A', target: 'B' },
        { source: 'A', target: 'C' },
      ],
      'LR',
    );

    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    // A has 2 outgoing edges. In LR layout, both go to the right side
    const aPos = positions.nodes.get('A');
    const sourcePoints = [];
    for (const edge of positions.edges) {
      if (edge.source === 'A') {
        sourcePoints.push(edge.waypoints[0]);
      }
    }

    assert.equal(sourcePoints.length, 2, 'A has 2 outgoing edges');

    // Both points should be on the right side of A
    const rightX = aPos.x + aPos.width / 2;
    for (const pt of sourcePoints) {
      assert.ok(
        Math.abs(pt[0] - rightX) < 1,
        `source point should be on right side (x=${rightX}), got x=${pt[0]}`
      );
    }

    // Y values should be distinct (distributed)
    assert.notEqual(
      sourcePoints[0][1].toFixed(2),
      sourcePoints[1][1].toFixed(2),
      'two edges on same side should have distinct Y positions'
    );
  });
});
