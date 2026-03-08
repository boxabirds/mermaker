import { getTopologyLayout } from './wasm-loader.js';
import { IDEAL_EDGE_LENGTH, SUBGRAPH_MARGIN } from '../util/constants.js';
import { hierarchicalLayout } from './hierarchical-layout.js';
import { clipToNodeBorder } from '../util/geometry.js';
import { assignPorts } from './port-assigner.js';
import { routeEdges } from './edge-router.js';

/**
 * @typedef {Object} NodePosition
 * @property {number} x - Center X
 * @property {number} y - Center Y
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} EdgeRoute
 * @property {string} source
 * @property {string} target
 * @property {number[][]} waypoints - Array of [x, y] pairs
 */

/**
 * @typedef {Object} PositionMap
 * @property {Map<string, NodePosition>} nodes
 * @property {EdgeRoute[]} edges
 * @property {Map<string, {x: number, y: number, width: number, height: number}>} groups
 */

/** @type {any} */
let topoInstance = null;
let topoNodeIdMap = null;

/**
 * Compute initial layout.
 * Uses hierarchical layout (pure JS) for now.
 * HOLA (libdialect WASM) deferred until bugs are fixed:
 * - Node dimensions reset to 30x30
 * - Edge routes in wrong coordinate space
 * - Tree growth direction not respected
 *
 * @param {import('./graph-builder.js').HolaGraphSpec} spec
 * @returns {Promise<PositionMap>}
 */
export async function computeLayout(spec) {
  const positions = hierarchicalLayout(spec);

  // Compute subgraph boundaries from child positions
  computeGroupBounds(positions, spec.subgraphChildren);

  // Route edges around obstacles using libavoid (falls back to straight lines)
  const edgeRouterState = await routeEdges(positions, spec);

  // Distribute connection points so multiple edges don't overlap at same spot
  assignPorts(positions, spec);

  return { positions, routerState: edgeRouterState };
}

/**
 * Compute bounding rectangles for subgraphs from child node positions.
 */
export function computeGroupBounds(positions, subgraphChildren) {
  if (!subgraphChildren) return;

  for (const [groupId, childIds] of subgraphChildren) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasChildren = false;

    for (const childId of childIds) {
      const pos = positions.nodes.get(childId);
      if (!pos) continue;
      hasChildren = true;
      const left = pos.x - pos.width / 2;
      const top = pos.y - pos.height / 2;
      const right = pos.x + pos.width / 2;
      const bottom = pos.y + pos.height / 2;
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    }

    if (hasChildren) {
      positions.groups.set(groupId, {
        x: minX - SUBGRAPH_MARGIN,
        y: minY - SUBGRAPH_MARGIN,
        width: (maxX - minX) + SUBGRAPH_MARGIN * 2,
        height: (maxY - minY) + SUBGRAPH_MARGIN * 2,
      });
    }
  }
}

/**
 * Initialize topology layout for drag operations.
 * @param {PositionMap} positions
 * @param {import('./graph-builder.js').HolaGraphSpec} spec
 */
export async function initTopology(positions, spec) {
  try {
    const TopologyLayout = await getTopologyLayout();
    topoInstance = new TopologyLayout();
    topoNodeIdMap = new Map();

    for (const node of spec.nodes) {
      const pos = positions.nodes.get(node.id);
      if (!pos) continue;
      const topoId = topoInstance.addNode(
        spec.nodeIndex.get(node.id),
        pos.x, pos.y,
        pos.width, pos.height
      );
      topoNodeIdMap.set(node.id, topoId);
    }

    let edgeIdx = 0;
    for (const edge of spec.edges) {
      const srcTopoId = topoNodeIdMap.get(edge.source);
      const tgtTopoId = topoNodeIdMap.get(edge.target);
      if (srcTopoId !== undefined && tgtTopoId !== undefined) {
        topoInstance.addEdge(edgeIdx, srcTopoId, tgtTopoId, IDEAL_EDGE_LENGTH);
        edgeIdx++;
      }
    }

    return true;
  } catch (err) {
    console.warn('TopologyLayout init failed, falling back to simple drag:', err);
    topoInstance = null;
    topoNodeIdMap = null;
    return false;
  }
}

/**
 * Move a node during drag. Simple position update with edge rerouting.
 * TopologyLayout integration deferred until moveNode is exposed in WASM.
 * @param {string} nodeId
 * @param {number} x
 * @param {number} y
 * @param {PositionMap} currentPositions - mutated in place
 * @returns {PositionMap}
 */
export function moveNode(nodeId, x, y, currentPositions) {
  const pos = currentPositions.nodes.get(nodeId);
  if (pos) {
    pos.x = x;
    pos.y = y;
  }

  // Recompute edge routes for affected edges
  for (const edge of currentPositions.edges) {
    if (edge.source === nodeId || edge.target === nodeId) {
      const srcPos = currentPositions.nodes.get(edge.source);
      const tgtPos = currentPositions.nodes.get(edge.target);
      if (srcPos && tgtPos) {
        const srcExit = clipToNodeBorder(srcPos, tgtPos.x, tgtPos.y);
        const tgtEntry = clipToNodeBorder(tgtPos, srcPos.x, srcPos.y);
        edge.waypoints = [srcExit, tgtEntry];
      }
    }
  }

  return currentPositions;
}

/**
 * Release node after drag completes.
 */
export function releaseNode() {
  // TopologyLayout cleanup would go here when moveNode is available
}
