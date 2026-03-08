import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DiagramModel } from '../../src/model/diagram-model.js';
import { buildGraph } from '../../src/layout/graph-builder.js';
import { TREE_GROWTH, SHAPES, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, NODE_PADDING_X, NODE_PADDING_Y } from '../../src/util/constants.js';

/**
 * Unit tests for the graph builder (constraint builder).
 * Tests the mapping from DiagramModel to HolaGraphSpec.
 */

describe('buildGraph', () => {
  it('TB direction produces SOUTH tree growth', () => {
    const model = new DiagramModel();
    model.direction = 'TB';
    model.addNode('A', 'A');
    const spec = buildGraph(model);
    assert.equal(spec.treeGrowthDir, TREE_GROWTH.SOUTH);
  });

  it('LR direction produces EAST tree growth', () => {
    const model = new DiagramModel();
    model.direction = 'LR';
    model.addNode('A', 'A');
    const spec = buildGraph(model);
    assert.equal(spec.treeGrowthDir, TREE_GROWTH.EAST);
  });

  it('BT direction produces NORTH tree growth (reversed)', () => {
    const model = new DiagramModel();
    model.direction = 'BT';
    model.addNode('A', 'A');
    const spec = buildGraph(model);
    assert.equal(spec.treeGrowthDir, TREE_GROWTH.NORTH);
  });

  it('RL direction produces WEST tree growth (reversed)', () => {
    const model = new DiagramModel();
    model.direction = 'RL';
    model.addNode('A', 'A');
    const spec = buildGraph(model);
    assert.equal(spec.treeGrowthDir, TREE_GROWTH.WEST);
  });

  it('single node produces no edges and one node entry', () => {
    const model = new DiagramModel();
    model.addNode('A', 'Solo');
    const spec = buildGraph(model);

    assert.equal(spec.nodes.length, 1);
    assert.equal(spec.edges.length, 0);
    assert.equal(spec.nodes[0].id, 'A');
  });

  it('diamond pattern has correct edge count', () => {
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
    assert.equal(spec.edges.length, 4);
    assert.equal(spec.nodes.length, 4);
  });

  it('subgraph children mapped correctly', () => {
    const model = new DiagramModel();
    model.addNode('A', 'A');
    model.addNode('B', 'B');
    model.addNode('C', 'C');
    model.addGroup('g1', 'Group', ['A', 'B']);
    model.addGroup('g2', 'Other', ['C']);

    const spec = buildGraph(model);
    assert.deepEqual(spec.subgraphChildren.get('g1'), ['A', 'B']);
    assert.deepEqual(spec.subgraphChildren.get('g2'), ['C']);
  });

  it('node dimensions reflect label width', () => {
    const model = new DiagramModel();
    model.addNode('A', 'Short');
    model.addNode('B', 'This is a much longer label text');

    const spec = buildGraph(model);
    const nodeA = spec.nodes.find(n => n.id === 'A');
    const nodeB = spec.nodes.find(n => n.id === 'B');

    // Both should have minimum width
    assert.ok(nodeA.width >= DEFAULT_NODE_WIDTH, `nodeA width >= ${DEFAULT_NODE_WIDTH}`);
    assert.ok(nodeB.width >= DEFAULT_NODE_WIDTH, `nodeB width >= ${DEFAULT_NODE_WIDTH}`);

    // Longer label should produce wider node (using char-count fallback in Node.js)
    assert.ok(nodeB.width > nodeA.width, 'longer label produces wider node');

    // Height should include padding
    assert.equal(nodeA.height, DEFAULT_NODE_HEIGHT + NODE_PADDING_Y);
  });

  it('builds nodeIndex mapping id to sequential index', () => {
    const model = new DiagramModel();
    model.addNode('X', 'X');
    model.addNode('Y', 'Y');
    model.addNode('Z', 'Z');

    const spec = buildGraph(model);
    assert.equal(spec.nodeIndex.get('X'), 0);
    assert.equal(spec.nodeIndex.get('Y'), 1);
    assert.equal(spec.nodeIndex.get('Z'), 2);
  });

  it('filters edges with invalid endpoints', () => {
    const model = new DiagramModel();
    model.addNode('A', 'A');
    model.addEdge('A', 'MISSING');
    model.addEdge('GHOST', 'A');

    const spec = buildGraph(model);
    assert.equal(spec.edges.length, 0, 'both edges with missing endpoints filtered');
  });

  it('defaults unknown direction to SOUTH', () => {
    const model = new DiagramModel();
    model.direction = 'UNKNOWN';
    model.addNode('A', 'A');
    const spec = buildGraph(model);
    assert.equal(spec.treeGrowthDir, TREE_GROWTH.SOUTH);
  });
});
