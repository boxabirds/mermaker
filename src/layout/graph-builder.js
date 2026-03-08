import {
  DIRECTION_TO_GROWTH,
  TREE_GROWTH,
  SHAPES,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  NODE_PADDING_X,
  NODE_PADDING_Y,
  LABEL_FONT_FAMILY,
  LABEL_FONT_SIZE,
} from '../util/constants.js';

/**
 * Measures text width using a canvas context.
 * Falls back to character-count heuristic if canvas unavailable.
 */
let measureCtx = null;

function measureTextWidth(text) {
  if (typeof document !== 'undefined') {
    if (!measureCtx) {
      const canvas = document.createElement('canvas');
      measureCtx = canvas.getContext('2d');
    }
    measureCtx.font = `${LABEL_FONT_SIZE}px ${LABEL_FONT_FAMILY}`;
    return measureCtx.measureText(text).width;
  }
  // Fallback: rough estimate based on character count
  const AVG_CHAR_WIDTH = 8;
  return text.length * AVG_CHAR_WIDTH;
}

/**
 * @typedef {Object} HolaGraphSpec
 * @property {{ id: string, x: number, y: number, width: number, height: number }[]} nodes
 * @property {{ source: string, target: string }[]} edges
 * @property {number} treeGrowthDir - HOLA direction constant
 * @property {Map<string, string[]>} subgraphChildren - group ID -> child node IDs
 */

/**
 * Build a HolaGraphSpec from a DiagramModel.
 * @param {import('../model/diagram-model.js').DiagramModel} model
 * @returns {HolaGraphSpec}
 */
export function buildGraph(model) {
  const nodes = [];
  const nodeIndex = new Map();
  let idx = 0;

  for (const [id, node] of model.nodes) {
    const textWidth = measureTextWidth(node.label);
    let width = Math.max(DEFAULT_NODE_WIDTH, textWidth + NODE_PADDING_X * 2);
    let height = DEFAULT_NODE_HEIGHT + NODE_PADDING_Y;

    // Circle shapes render with radius = max(halfW, halfH),
    // so the layout dimensions must be square to match the visual.
    if (node.shape === SHAPES.CIRCLE) {
      const diameter = Math.max(width, height);
      width = diameter;
      height = diameter;
    }

    nodes.push({ id, x: 0, y: 0, width, height, shape: node.shape });
    nodeIndex.set(id, idx);
    idx++;
  }

  const edges = [];
  for (const edge of model.edges) {
    if (nodeIndex.has(edge.source) && nodeIndex.has(edge.target)) {
      edges.push({ source: edge.source, target: edge.target });
    }
  }

  const treeGrowthDir = DIRECTION_TO_GROWTH[model.direction] ?? TREE_GROWTH.SOUTH;

  const subgraphChildren = new Map();
  for (const [groupId, group] of model.groups) {
    subgraphChildren.set(groupId, group.children);
  }

  return { nodes, edges, treeGrowthDir, direction: model.direction || 'TD', subgraphChildren, nodeIndex };
}
