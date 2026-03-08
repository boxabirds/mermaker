import { SHAPES } from '../util/constants.js';

/**
 * Unified intermediate representation for diagrams.
 * Decouples parsing from layout and rendering.
 */
export class DiagramModel {
  constructor() {
    /** @type {Map<string, DiagramNode>} */
    this.nodes = new Map();
    /** @type {DiagramEdge[]} */
    this.edges = [];
    /** @type {Map<string, DiagramGroup>} */
    this.groups = new Map();
    /** @type {string} */
    this.direction = 'TB';
    /** @type {string} */
    this.type = 'flowchart';
  }

  addNode(id, label, shape = SHAPES.RECT) {
    const node = { id, label, shape };
    this.nodes.set(id, node);
    return node;
  }

  addEdge(source, target, label = '', lineType = 'normal', arrowType = 'arrow_point') {
    const edge = { source, target, label, lineType, arrowType };
    this.edges.push(edge);
    return edge;
  }

  addGroup(id, label, children = []) {
    const group = { id, label, children: [...children] };
    this.groups.set(id, group);
    return group;
  }
}

/**
 * @typedef {Object} DiagramNode
 * @property {string} id
 * @property {string} label
 * @property {string} shape - One of SHAPES constants
 */

/**
 * @typedef {Object} DiagramEdge
 * @property {string} source
 * @property {string} target
 * @property {string} label
 * @property {string} lineType
 * @property {string} arrowType
 */

/**
 * @typedef {Object} DiagramGroup
 * @property {string} id
 * @property {string} label
 * @property {string[]} children - Node IDs
 */

/**
 * Parse error with location info.
 */
export class ParseError {
  constructor(message, line = null, column = null, type = 'syntax') {
    this.message = message;
    this.line = line;
    this.column = column;
    this.type = type;
  }
}
