import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DiagramModel } from '../../src/model/diagram-model.js';
import { buildGraph } from '../../src/layout/graph-builder.js';
import { computeLayout, moveNode, computeGroupBounds } from '../../src/layout/layout-engine.js';
import { TREE_GROWTH, SHAPES } from '../../src/util/constants.js';

/**
 * Integration tests for the parse → buildGraph → computeLayout pipeline.
 * These run in Node.js (no browser), using the char-count measurement fallback.
 */

function makeFlowchartModel(direction = 'TB') {
  const model = new DiagramModel();
  model.direction = direction;
  model.addNode('A', 'Start', SHAPES.ROUNDED_RECT);
  model.addNode('B', 'Process', SHAPES.RECT);
  model.addNode('C', 'Decision', SHAPES.DIAMOND);
  model.addNode('D', 'End', SHAPES.ROUNDED_RECT);
  model.addEdge('A', 'B');
  model.addEdge('B', 'C');
  model.addEdge('C', 'D');
  return model;
}

describe('buildGraph', () => {
  it('creates nodes with dimensions from model', () => {
    const model = makeFlowchartModel();
    const spec = buildGraph(model);

    assert.equal(spec.nodes.length, 4);
    assert.equal(spec.edges.length, 3);
    assert.equal(spec.treeGrowthDir, TREE_GROWTH.SOUTH);

    for (const node of spec.nodes) {
      assert.ok(node.width > 0, `node ${node.id} has positive width`);
      assert.ok(node.height > 0, `node ${node.id} has positive height`);
    }
  });

  it('maps direction to tree growth correctly', () => {
    const directions = { TB: TREE_GROWTH.SOUTH, LR: TREE_GROWTH.EAST, BT: TREE_GROWTH.NORTH, RL: TREE_GROWTH.WEST };
    for (const [dir, expected] of Object.entries(directions)) {
      const model = makeFlowchartModel(dir);
      const spec = buildGraph(model);
      assert.equal(spec.treeGrowthDir, expected, `direction ${dir} → growth ${expected}`);
    }
  });

  it('filters edges with missing endpoints', () => {
    const model = new DiagramModel();
    model.addNode('A', 'A');
    model.addEdge('A', 'MISSING');
    const spec = buildGraph(model);
    assert.equal(spec.edges.length, 0);
  });

  it('builds subgraph children map', () => {
    const model = makeFlowchartModel();
    model.addGroup('g1', 'Group', ['A', 'B']);
    const spec = buildGraph(model);
    assert.deepEqual(spec.subgraphChildren.get('g1'), ['A', 'B']);
  });
});

describe('computeLayout (hierarchical)', () => {
  it('produces positions for all nodes', async () => {
    const model = makeFlowchartModel();
    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    assert.equal(positions.nodes.size, 4);
    for (const [id, pos] of positions.nodes) {
      assert.ok(Number.isFinite(pos.x), `${id}.x is finite`);
      assert.ok(Number.isFinite(pos.y), `${id}.y is finite`);
      assert.ok(pos.width > 0);
      assert.ok(pos.height > 0);
    }
  });

  it('assigns increasing Y for TB direction (top-to-bottom)', async () => {
    const model = makeFlowchartModel('TB');
    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    const yA = positions.nodes.get('A').y;
    const yB = positions.nodes.get('B').y;
    const yC = positions.nodes.get('C').y;
    const yD = positions.nodes.get('D').y;

    assert.ok(yA < yB, `A.y (${yA}) < B.y (${yB})`);
    assert.ok(yB < yC, `B.y (${yB}) < C.y (${yC})`);
    assert.ok(yC < yD, `C.y (${yC}) < D.y (${yD})`);
  });

  it('assigns increasing X for LR direction (left-to-right)', async () => {
    const model = makeFlowchartModel('LR');
    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    const xA = positions.nodes.get('A').x;
    const xB = positions.nodes.get('B').x;
    const xC = positions.nodes.get('C').x;
    const xD = positions.nodes.get('D').x;

    assert.ok(xA < xB, `A.x (${xA}) < B.x (${xB})`);
    assert.ok(xB < xC, `B.x (${xB}) < C.x (${xC})`);
    assert.ok(xC < xD, `C.x (${xC}) < D.x (${xD})`);
  });

  it('computes edge routes for all edges', async () => {
    const model = makeFlowchartModel();
    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    assert.equal(positions.edges.length, 3);
    for (const edge of positions.edges) {
      assert.ok(edge.source);
      assert.ok(edge.target);
      assert.equal(edge.waypoints.length, 2, 'each edge has start and end waypoints');
      for (const wp of edge.waypoints) {
        assert.equal(wp.length, 2, 'waypoint is [x, y]');
        assert.ok(Number.isFinite(wp[0]));
        assert.ok(Number.isFinite(wp[1]));
      }
    }
  });

  it('nodes do not overlap', async () => {
    const model = makeFlowchartModel();
    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    const posArray = [...positions.nodes.values()];
    for (let i = 0; i < posArray.length; i++) {
      for (let j = i + 1; j < posArray.length; j++) {
        const a = posArray[i];
        const b = posArray[j];
        const overlapX = Math.abs(a.x - b.x) < (a.width + b.width) / 2;
        const overlapY = Math.abs(a.y - b.y) < (a.height + b.height) / 2;
        assert.ok(!(overlapX && overlapY), `nodes ${i} and ${j} should not overlap`);
      }
    }
  });

  it('computes group bounds for subgraphs', async () => {
    const model = makeFlowchartModel();
    model.addGroup('g1', 'Group', ['A', 'B']);
    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    assert.ok(positions.groups.has('g1'));
    const group = positions.groups.get('g1');
    assert.ok(group.width > 0);
    assert.ok(group.height > 0);

    // Group should contain both nodes
    const posA = positions.nodes.get('A');
    const posB = positions.nodes.get('B');
    assert.ok(posA.x >= group.x && posA.x <= group.x + group.width, 'A inside group X');
    assert.ok(posB.x >= group.x && posB.x <= group.x + group.width, 'B inside group X');
  });
});

describe('moveNode', () => {
  it('updates node position and recalculates affected edge routes', async () => {
    const model = makeFlowchartModel();
    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    const origY = positions.nodes.get('B').y;
    const NEW_X = 300;
    const NEW_Y = 400;
    moveNode('B', NEW_X, NEW_Y, positions);

    assert.equal(positions.nodes.get('B').x, NEW_X);
    assert.equal(positions.nodes.get('B').y, NEW_Y);

    // Edges involving B should have updated waypoints
    const edgesWithB = positions.edges.filter(e => e.source === 'B' || e.target === 'B');
    assert.ok(edgesWithB.length >= 2, 'B has at least 2 connected edges');
    for (const edge of edgesWithB) {
      // Waypoints should reflect the new position of B
      const bWp = edge.source === 'B' ? edge.waypoints[0] : edge.waypoints[1];
      // The waypoint should be near B's new position (on its border)
      const dist = Math.sqrt((bWp[0] - NEW_X) ** 2 + (bWp[1] - NEW_Y) ** 2);
      const maxBorderDist = Math.sqrt(positions.nodes.get('B').width ** 2 + positions.nodes.get('B').height ** 2) / 2;
      assert.ok(dist <= maxBorderDist + 1, `waypoint should be on B's border, dist=${dist}`);
    }
  });

  it('does not affect unrelated edges', async () => {
    const model = new DiagramModel();
    model.addNode('A', 'A');
    model.addNode('B', 'B');
    model.addNode('C', 'C');
    model.addNode('D', 'D');
    model.addEdge('A', 'B');
    model.addEdge('C', 'D');
    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    const cdEdge = positions.edges.find(e => e.source === 'C' && e.target === 'D');
    const origWaypoints = JSON.parse(JSON.stringify(cdEdge.waypoints));

    moveNode('A', 500, 500, positions);

    assert.deepEqual(cdEdge.waypoints, origWaypoints, 'C→D edge unchanged');
  });
});

describe('pipeline: branching graph', () => {
  it('handles diamond patterns (multiple paths)', async () => {
    const model = new DiagramModel();
    model.addNode('A', 'Start');
    model.addNode('B', 'Left');
    model.addNode('C', 'Right');
    model.addNode('D', 'End');
    model.addEdge('A', 'B');
    model.addEdge('A', 'C');
    model.addEdge('B', 'D');
    model.addEdge('C', 'D');

    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    assert.equal(positions.nodes.size, 4);
    assert.equal(positions.edges.length, 4);

    // B and C should be at the same rank (same Y in TB)
    const yB = positions.nodes.get('B').y;
    const yC = positions.nodes.get('C').y;
    assert.equal(yB, yC, 'B and C at same rank');

    // D should be below B and C
    const yD = positions.nodes.get('D').y;
    assert.ok(yD > yB, 'D below B');
  });

  it('handles single node graph', async () => {
    const model = new DiagramModel();
    model.addNode('X', 'Solo');
    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    assert.equal(positions.nodes.size, 1);
    assert.equal(positions.edges.length, 0);
  });
});

describe('pipeline: cyclic and edge cases', () => {
  it('cyclic graph completes without error', async () => {
    const model = new DiagramModel();
    model.addNode('A', 'A');
    model.addNode('B', 'B');
    model.addNode('C', 'C');
    model.addEdge('A', 'B');
    model.addEdge('B', 'C');
    model.addEdge('C', 'A');

    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    assert.equal(positions.nodes.size, 3);
    assert.equal(positions.edges.length, 3);
    // All nodes should have valid positions
    for (const pos of positions.nodes.values()) {
      assert.ok(Number.isFinite(pos.x));
      assert.ok(Number.isFinite(pos.y));
    }
  });

  it('self-loop edge: layout completes and edge route exists', async () => {
    const model = new DiagramModel();
    model.addNode('A', 'Self');
    model.addNode('B', 'Other');
    model.addEdge('A', 'B');
    model.addEdge('A', 'A'); // self-loop

    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    assert.equal(positions.nodes.size, 2);
    // Self-loop edge should have a route (even if degenerate)
    const selfEdge = positions.edges.find(e => e.source === 'A' && e.target === 'A');
    assert.ok(selfEdge, 'self-loop edge route exists');
    assert.ok(selfEdge.waypoints.length >= 2, 'self-loop has waypoints');
  });

  it('every edge connects valid source/target positions', async () => {
    const model = new DiagramModel();
    model.addNode('A', 'A');
    model.addNode('B', 'B');
    model.addNode('C', 'C');
    model.addNode('D', 'D');
    model.addEdge('A', 'B');
    model.addEdge('B', 'C');
    model.addEdge('C', 'D');
    model.addEdge('A', 'D');

    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    for (const edge of positions.edges) {
      assert.ok(positions.nodes.has(edge.source), `edge source ${edge.source} has position`);
      assert.ok(positions.nodes.has(edge.target), `edge target ${edge.target} has position`);
    }
  });

  it('50-node graph completes within 1 second', async () => {
    const NODE_COUNT = 50;
    const model = new DiagramModel();
    for (let i = 0; i < NODE_COUNT; i++) {
      model.addNode(`n${i}`, `Node ${i}`);
    }
    // Chain edges
    for (let i = 0; i < NODE_COUNT - 1; i++) {
      model.addEdge(`n${i}`, `n${i + 1}`);
    }
    // Add some cross edges
    for (let i = 0; i < NODE_COUNT - 5; i += 5) {
      model.addEdge(`n${i}`, `n${i + 5}`);
    }

    const spec = buildGraph(model);
    const TIMEOUT_MS = 1000;
    const start = performance.now();
    const positions = await computeLayout(spec);
    const elapsed = performance.now() - start;

    assert.ok(elapsed < TIMEOUT_MS, `layout took ${elapsed.toFixed(0)}ms, expected < ${TIMEOUT_MS}ms`);
    assert.equal(positions.nodes.size, NODE_COUNT);
  });

  it('disconnected components all get positioned', async () => {
    const model = new DiagramModel();
    model.addNode('A', 'A');
    model.addNode('B', 'B');
    model.addEdge('A', 'B');
    // Disconnected
    model.addNode('X', 'X');
    model.addNode('Y', 'Y');
    model.addEdge('X', 'Y');

    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    assert.equal(positions.nodes.size, 4);
    for (const pos of positions.nodes.values()) {
      assert.ok(Number.isFinite(pos.x));
      assert.ok(Number.isFinite(pos.y));
    }
  });
});

describe('diamond border clipping in layout', () => {
  it('edge waypoints to diamond node lie on diamond border', async () => {
    const model = new DiagramModel();
    model.addNode('A', 'Start', SHAPES.RECT);
    model.addNode('B', 'Decision', SHAPES.DIAMOND);
    model.addEdge('A', 'B');

    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    const bPos = positions.nodes.get('B');
    const halfW = bPos.width / 2;
    const halfH = bPos.height / 2;

    // Find edge A->B, check target entry point is on diamond border
    const edge = positions.edges.find(e => e.source === 'A' && e.target === 'B');
    assert.ok(edge);
    const [entryX, entryY] = edge.waypoints[1];
    const relX = Math.abs(entryX - bPos.x) / halfW;
    const relY = Math.abs(entryY - bPos.y) / halfH;
    assert.ok(Math.abs(relX + relY - 1) < 0.01,
      `entry point should be on diamond border: |x/halfW| + |y/halfH| = ${relX + relY}, expected 1`);
  });

  it('moveNode with diamond node keeps waypoints on diamond border', async () => {
    const model = new DiagramModel();
    model.addNode('A', 'Top', SHAPES.RECT);
    model.addNode('B', 'Diamond', SHAPES.DIAMOND);
    model.addEdge('A', 'B');

    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    const NEW_X = 300;
    const NEW_Y = 200;
    moveNode('B', NEW_X, NEW_Y, positions);

    const bPos = positions.nodes.get('B');
    const halfW = bPos.width / 2;
    const halfH = bPos.height / 2;

    const edge = positions.edges.find(e => e.target === 'B');
    const [entryX, entryY] = edge.waypoints[1];
    const relX = Math.abs(entryX - NEW_X) / halfW;
    const relY = Math.abs(entryY - NEW_Y) / halfH;
    assert.ok(Math.abs(relX + relY - 1) < 0.01,
      `after move, entry still on diamond border: ${relX + relY}`);
  });
});

describe('subgraph group move', () => {
  it('shifting all children preserves relative positions', async () => {
    const model = new DiagramModel();
    model.addNode('A', 'A', SHAPES.RECT);
    model.addNode('B', 'B', SHAPES.RECT);
    model.addNode('C', 'C', SHAPES.RECT);
    model.addEdge('A', 'B');
    model.addGroup('g1', 'Group', ['A', 'B']);

    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    const origAx = positions.nodes.get('A').x;
    const origAy = positions.nodes.get('A').y;
    const origBx = positions.nodes.get('B').x;
    const origBy = positions.nodes.get('B').y;
    const relDx = origBx - origAx;
    const relDy = origBy - origAy;

    const SHIFT_X = 50;
    const SHIFT_Y = 30;

    // Simulate group move
    for (const childId of ['A', 'B']) {
      const pos = positions.nodes.get(childId);
      pos.x += SHIFT_X;
      pos.y += SHIFT_Y;
    }

    assert.equal(positions.nodes.get('A').x, origAx + SHIFT_X);
    assert.equal(positions.nodes.get('A').y, origAy + SHIFT_Y);
    assert.equal(positions.nodes.get('B').x, origBx + SHIFT_X);
    assert.equal(positions.nodes.get('B').y, origBy + SHIFT_Y);

    // Relative positions unchanged
    const newRelDx = positions.nodes.get('B').x - positions.nodes.get('A').x;
    const newRelDy = positions.nodes.get('B').y - positions.nodes.get('A').y;
    assert.equal(newRelDx, relDx);
    assert.equal(newRelDy, relDy);
  });

  it('group bounds update after children move', async () => {
    const model = new DiagramModel();
    model.addNode('A', 'A', SHAPES.RECT);
    model.addNode('B', 'B', SHAPES.RECT);
    model.addGroup('g1', 'Group', ['A', 'B']);

    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    const origBounds = { ...positions.groups.get('g1') };

    const SHIFT_X = 100;
    const SHIFT_Y = 50;
    for (const childId of ['A', 'B']) {
      const pos = positions.nodes.get(childId);
      pos.x += SHIFT_X;
      pos.y += SHIFT_Y;
    }
    computeGroupBounds(positions, spec.subgraphChildren);

    const newBounds = positions.groups.get('g1');
    assert.ok(Math.abs(newBounds.x - (origBounds.x + SHIFT_X)) < 0.01, 'group x shifted');
    assert.ok(Math.abs(newBounds.y - (origBounds.y + SHIFT_Y)) < 0.01, 'group y shifted');
    assert.ok(Math.abs(newBounds.width - origBounds.width) < 0.01, 'group width unchanged');
    assert.ok(Math.abs(newBounds.height - origBounds.height) < 0.01, 'group height unchanged');
  });

  it('single child group moves correctly', async () => {
    const model = new DiagramModel();
    model.addNode('A', 'Solo', SHAPES.RECT);
    model.addGroup('g1', 'Solo Group', ['A']);

    const spec = buildGraph(model);
    const positions = await computeLayout(spec);

    const origX = positions.nodes.get('A').x;
    positions.nodes.get('A').x += 42;
    positions.nodes.get('A').y += 17;
    computeGroupBounds(positions, spec.subgraphChildren);

    assert.equal(positions.nodes.get('A').x, origX + 42);
    assert.ok(positions.groups.has('g1'));
  });
});
