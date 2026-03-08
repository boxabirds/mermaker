import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractFlowchart } from '../../src/parse/flowchart-extractor.js';
import { SHAPES } from '../../src/util/constants.js';

/**
 * Unit tests for the flowchart extractor.
 * Uses mock db objects instead of real mermaid to test pure extraction logic.
 */

function mockDb({ vertices = new Map(), edges = [], subGraphs = [], direction = 'TB' } = {}) {
  return {
    getVertices: () => vertices,
    getEdges: () => edges,
    getSubGraphs: () => subGraphs,
    getDirection: () => direction,
  };
}

function vertex(id, text, type = 'square') {
  return [id, { id, text, type }];
}

describe('extractFlowchart', () => {
  it('extracts simple graph: 2 nodes, 1 edge', () => {
    const db = mockDb({
      vertices: new Map([vertex('A', 'Start'), vertex('B', 'End')]),
      edges: [{ start: 'A', end: 'B', text: '', type: 'normal', stroke: 'normal' }],
    });

    const model = extractFlowchart(db, 'flowchart-v2');

    assert.equal(model.nodes.size, 2);
    assert.equal(model.edges.length, 1);
    assert.equal(model.edges[0].source, 'A');
    assert.equal(model.edges[0].target, 'B');
  });

  it('extracts multi-edge graph with correct mapping', () => {
    const db = mockDb({
      vertices: new Map([vertex('A', 'A'), vertex('B', 'B'), vertex('C', 'C')]),
      edges: [
        { start: 'A', end: 'B', text: 'first' },
        { start: 'B', end: 'C', text: 'second' },
        { start: 'A', end: 'C', text: 'skip' },
      ],
    });

    const model = extractFlowchart(db, 'flowchart-v2');

    assert.equal(model.edges.length, 3);
    assert.equal(model.edges[0].label, 'first');
    assert.equal(model.edges[1].label, 'second');
    assert.equal(model.edges[2].source, 'A');
    assert.equal(model.edges[2].target, 'C');
  });

  it('extracts subgraphs with correct children', () => {
    const db = mockDb({
      vertices: new Map([vertex('A', 'A'), vertex('B', 'B'), vertex('C', 'C')]),
      edges: [{ start: 'A', end: 'B' }],
      subGraphs: [{ id: 'sg1', title: 'Group 1', nodes: ['A', 'B'] }],
    });

    const model = extractFlowchart(db, 'flowchart-v2');

    assert.equal(model.groups.size, 1);
    const group = model.groups.get('sg1');
    assert.ok(group);
    assert.equal(group.label, 'Group 1');
    assert.deepEqual(group.children, ['A', 'B']);
  });

  describe('shape mapping', () => {
    const shapeTests = [
      ['round', SHAPES.ROUNDED_RECT],
      ['square', SHAPES.RECT],
      ['diamond', SHAPES.DIAMOND],
      ['question', SHAPES.DIAMOND],
      ['circle', SHAPES.CIRCLE],
      ['hexagon', SHAPES.HEXAGON],
      ['stadium', SHAPES.STADIUM],
      ['cylinder', SHAPES.RECT],
      ['doublecircle', SHAPES.CIRCLE],
    ];

    for (const [mermaidType, expectedShape] of shapeTests) {
      it(`maps ${mermaidType} to ${expectedShape}`, () => {
        const db = mockDb({
          vertices: new Map([vertex('X', 'X', mermaidType)]),
        });
        const model = extractFlowchart(db, 'flowchart-v2');
        assert.equal(model.nodes.get('X').shape, expectedShape);
      });
    }

    it('falls back to RECT for unknown shapes', () => {
      const db = mockDb({
        vertices: new Map([vertex('X', 'X', 'completely_unknown')]),
      });
      const model = extractFlowchart(db, 'flowchart-v2');
      assert.equal(model.nodes.get('X').shape, SHAPES.RECT);
    });
  });

  it('throws ParseError for unsupported diagram type', () => {
    const db = mockDb();
    assert.throws(
      () => extractFlowchart(db, 'pie'),
      (err) => {
        assert.equal(err.type, 'unsupported-type');
        assert.ok(err.message.includes('pie'));
        return true;
      }
    );
  });

  it('throws ParseError for sequence diagram type', () => {
    const db = mockDb();
    assert.throws(
      () => extractFlowchart(db, 'sequence'),
      (err) => {
        assert.equal(err.type, 'unsupported-type');
        return true;
      }
    );
  });

  it('handles empty vertices and edges', () => {
    const db = mockDb();
    const model = extractFlowchart(db, 'flowchart');

    assert.equal(model.nodes.size, 0);
    assert.equal(model.edges.length, 0);
    assert.equal(model.groups.size, 0);
  });

  it('handles single node with no edges', () => {
    const db = mockDb({
      vertices: new Map([vertex('Solo', 'Solo Node')]),
    });
    const model = extractFlowchart(db, 'flowchart');

    assert.equal(model.nodes.size, 1);
    assert.equal(model.edges.length, 0);
    assert.equal(model.nodes.get('Solo').label, 'Solo Node');
  });

  it('extracts direction correctly', () => {
    const db = mockDb({ direction: 'LR' });
    const model = extractFlowchart(db, 'flowchart');
    assert.equal(model.direction, 'LR');
  });

  it('defaults direction to TB when not provided', () => {
    const db = {
      getVertices: () => new Map(),
      getEdges: () => [],
      getSubGraphs: () => [],
      // no getDirection
    };
    const model = extractFlowchart(db, 'flowchart');
    assert.equal(model.direction, 'TB');
  });

  describe('label extraction', () => {
    it('extracts text string label', () => {
      const db = mockDb({
        vertices: new Map([['A', { id: 'A', text: 'Hello', type: 'square' }]]),
      });
      const model = extractFlowchart(db, 'flowchart');
      assert.equal(model.nodes.get('A').label, 'Hello');
    });

    it('extracts labelText when text is missing', () => {
      const db = mockDb({
        vertices: new Map([['A', { id: 'A', labelText: 'Label', type: 'square' }]]),
      });
      const model = extractFlowchart(db, 'flowchart');
      assert.equal(model.nodes.get('A').label, 'Label');
    });

    it('extracts nested text.text', () => {
      const db = mockDb({
        vertices: new Map([['A', { id: 'A', text: { text: 'Nested' }, type: 'square' }]]),
      });
      const model = extractFlowchart(db, 'flowchart');
      assert.equal(model.nodes.get('A').label, 'Nested');
    });

    it('falls back to id when no label', () => {
      const db = mockDb({
        vertices: new Map([['A', { id: 'A', type: 'square' }]]),
      });
      const model = extractFlowchart(db, 'flowchart');
      assert.equal(model.nodes.get('A').label, 'A');
    });
  });
});
