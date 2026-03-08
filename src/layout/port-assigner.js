import { MIN_PORT_SPACING } from '../util/constants.js';
import { detectSide } from '../util/geometry.js';

/**
 * Assign distributed connection points on nodes so multiple edges
 * don't land at the same spot.
 *
 * Distributes endpoints along node borders for all edges.
 * Mutates positions.edges waypoints in place.
 *
 * @param {import('./layout-engine.js').PositionMap} positions
 * @param {import('./graph-builder.js').HolaGraphSpec} spec
 */
export function assignPorts(positions, spec) {
  // Straighten edges between aligned nodes that the router unnecessarily jogged
  straightenAlignedEdges(positions);

  // Distribute ports for straight-line edges (2 waypoints)
  const nodeEdges = buildNodeEdgeMap(positions, spec);

  for (const [nodeId, edgeRefs] of nodeEdges) {
    const nodePos = positions.nodes.get(nodeId);
    if (!nodePos || edgeRefs.length === 0) continue;

    distributeForNode(nodeId, nodePos, edgeRefs, positions);
  }

  // Fix 2-waypoint edges that are diagonal after port assignment — insert L-bend
  fixDiagonalEdges(positions);
}

/**
 * Reassign ports for a moved node and its direct neighbors.
 *
 * @param {string} movedNodeId
 * @param {import('./layout-engine.js').PositionMap} positions
 * @param {import('./graph-builder.js').HolaGraphSpec} spec
 */
export function reassignPorts(movedNodeId, positions, spec) {
  // Straighten aligned edges globally — the router may have updated any edge
  straightenAlignedEdges(positions);

  const nodeEdges = buildNodeEdgeMap(positions, spec);

  // Collect affected nodes: the moved node + all its neighbors
  const affectedNodes = new Set([movedNodeId]);
  const movedRefs = nodeEdges.get(movedNodeId);
  if (movedRefs) {
    for (const ref of movedRefs) {
      const edge = positions.edges[ref.edgeIdx];
      const neighborId = ref.end === 'source' ? edge.target : edge.source;
      affectedNodes.add(neighborId);
    }
  }

  // Distribute ports for affected nodes
  for (const nodeId of affectedNodes) {
    const nodePos = positions.nodes.get(nodeId);
    const edgeRefs = nodeEdges.get(nodeId);
    if (!nodePos || !edgeRefs || edgeRefs.length === 0) continue;

    distributeForNode(nodeId, nodePos, edgeRefs, positions);
  }

  // Fix diagonal 2-wp edges globally
  fixDiagonalEdges(positions);
}

/**
 * Build a map from nodeId to its connected edge references.
 * @returns {Map<string, Array<{edgeIdx: number, end: 'source'|'target'}>>}
 */
function buildNodeEdgeMap(positions, spec) {
  const nodeEdges = new Map();

  for (let i = 0; i < positions.edges.length; i++) {
    const edge = positions.edges[i];

    if (!nodeEdges.has(edge.source)) nodeEdges.set(edge.source, []);
    nodeEdges.get(edge.source).push({ edgeIdx: i, end: 'source' });

    if (!nodeEdges.has(edge.target)) nodeEdges.set(edge.target, []);
    nodeEdges.get(edge.target).push({ edgeIdx: i, end: 'target' });
  }

  return nodeEdges;
}

/**
 * Distribute connection points for a single node across its sides.
 */
function distributeForNode(nodeId, nodePos, edgeRefs, positions) {
  // Determine which side each edge approaches from
  const bySide = { top: [], bottom: [], left: [], right: [] };

  for (const ref of edgeRefs) {
    const edge = positions.edges[ref.edgeIdx];
    const oppositeId = ref.end === 'source' ? edge.target : edge.source;
    const oppositePos = positions.nodes.get(oppositeId);
    if (!oppositePos) continue;

    const side = detectSide(nodePos, oppositePos.x, oppositePos.y);
    bySide[side].push({ ref, oppositePos });
  }

  // Distribute each side independently
  for (const [side, entries] of Object.entries(bySide)) {
    if (entries.length === 0) continue;

    // Sort by approach angle (projection-based)
    sortByApproach(entries, nodePos, side);

    // Compute distributed positions along the side
    const points = computeSidePoints(nodePos, side, entries.length);

    // Apply to waypoints — only for straight-line edges (2 waypoints).
    // Multi-waypoint edges (from router) are already properly placed.
    for (let i = 0; i < entries.length; i++) {
      const { ref } = entries[i];
      const edge = positions.edges[ref.edgeIdx];
      if (edge.waypoints.length > 2) continue;

      const [px, py] = points[i];

      if (ref.end === 'source') {
        edge.waypoints[0] = [px, py];
      } else {
        edge.waypoints[edge.waypoints.length - 1] = [px, py];
      }
    }
  }
}

/**
 * Sort edges by approach angle using projection.
 * Horizontal sides (top/bottom): sort by opposite X.
 * Vertical sides (left/right): sort by opposite Y.
 */
function sortByApproach(entries, nodePos, side) {
  if (side === 'top' || side === 'bottom') {
    entries.sort((a, b) => a.oppositePos.x - b.oppositePos.x);
  } else {
    entries.sort((a, b) => a.oppositePos.y - b.oppositePos.y);
  }
}

/**
 * Compute evenly-distributed points along a node side.
 *
 * @param {{ x: number, y: number, width: number, height: number }} nodePos
 * @param {'top'|'bottom'|'left'|'right'} side
 * @param {number} count
 * @returns {number[][]} Array of [x, y] points
 */
function computeSidePoints(nodePos, side, count) {
  const halfW = nodePos.width / 2;
  const halfH = nodePos.height / 2;
  const points = [];

  if (side === 'top' || side === 'bottom') {
    const y = side === 'top' ? nodePos.y - halfH : nodePos.y + halfH;
    const sideLength = nodePos.width;
    const naturalSpacing = sideLength / (count + 1);
    const spacing = Math.max(naturalSpacing, MIN_PORT_SPACING);

    // If spacing was clamped, center the distributed span on the side
    const totalSpan = spacing * (count - 1);
    const firstOffset = (sideLength - totalSpan) / 2;
    const sideStart = nodePos.x - halfW;

    for (let i = 0; i < count; i++) {
      points.push([sideStart + firstOffset + spacing * i, y]);
    }
  } else {
    const x = side === 'left' ? nodePos.x - halfW : nodePos.x + halfW;
    const sideLength = nodePos.height;
    const naturalSpacing = sideLength / (count + 1);
    const spacing = Math.max(naturalSpacing, MIN_PORT_SPACING);

    const totalSpan = spacing * (count - 1);
    const firstOffset = (sideLength - totalSpan) / 2;
    const sideStart = nodePos.y - halfH;

    for (let i = 0; i < count; i++) {
      points.push([x, sideStart + firstOffset + spacing * i]);
    }
  }

  return points;
}

/** Tolerance for alignment checks */
const ALIGN_TOLERANCE = 5;

/** Tolerance for considering a segment already orthogonal */
const ORTHO_TOLERANCE = 1;

/**
 * Straighten edges between nodes that are aligned on one axis.
 * The router sometimes adds small jogs when nudging parallel routes.
 * For edges where source and target share an x or y coordinate (within tolerance),
 * replace the multi-waypoint route with a straight 2-point edge.
 */
function straightenAlignedEdges(positions, affectedIndices) {
  for (let idx = 0; idx < positions.edges.length; idx++) {
    if (affectedIndices && !affectedIndices.has(idx)) continue;
    const edge = positions.edges[idx];
    if (edge.waypoints.length <= 2) continue;

    const srcPos = positions.nodes.get(edge.source);
    const tgtPos = positions.nodes.get(edge.target);
    if (!srcPos || !tgtPos) continue;

    const dx = Math.abs(srcPos.x - tgtPos.x);
    const dy = Math.abs(srcPos.y - tgtPos.y);

    if (dx <= ALIGN_TOLERANCE && dy > ALIGN_TOLERANCE) {
      // Vertically aligned — check if straightening would cross intermediate nodes
      const x = (srcPos.x + tgtPos.x) / 2;
      const minY = Math.min(srcPos.y, tgtPos.y);
      const maxY = Math.max(srcPos.y, tgtPos.y);
      if (pathBlockedByNode(positions, edge.source, edge.target, x, x, minY, maxY)) continue;

      const srcY = srcPos.y < tgtPos.y ? srcPos.y + srcPos.height / 2 : srcPos.y - srcPos.height / 2;
      const tgtY = srcPos.y < tgtPos.y ? tgtPos.y - tgtPos.height / 2 : tgtPos.y + tgtPos.height / 2;
      edge.waypoints = [[x, srcY], [x, tgtY]];
    } else if (dy <= ALIGN_TOLERANCE && dx > ALIGN_TOLERANCE) {
      // Horizontally aligned — check if straightening would cross intermediate nodes
      const y = (srcPos.y + tgtPos.y) / 2;
      const minX = Math.min(srcPos.x, tgtPos.x);
      const maxX = Math.max(srcPos.x, tgtPos.x);
      if (pathBlockedByNode(positions, edge.source, edge.target, minX, maxX, y, y)) continue;

      const srcX = srcPos.x < tgtPos.x ? srcPos.x + srcPos.width / 2 : srcPos.x - srcPos.width / 2;
      const tgtX = srcPos.x < tgtPos.x ? tgtPos.x - tgtPos.width / 2 : tgtPos.x + tgtPos.width / 2;
      edge.waypoints = [[srcX, y], [tgtX, y]];
    }
  }
}

/**
 * Check if a straight path would pass through any node other than source/target.
 */
function pathBlockedByNode(positions, srcId, tgtId, minX, maxX, minY, maxY) {
  for (const [nodeId, pos] of positions.nodes) {
    if (nodeId === srcId || nodeId === tgtId) continue;
    const halfW = pos.width / 2;
    const halfH = pos.height / 2;
    const nodeMinX = pos.x - halfW;
    const nodeMaxX = pos.x + halfW;
    const nodeMinY = pos.y - halfH;
    const nodeMaxY = pos.y + halfH;
    // Check if the path line overlaps with this node's bounding box
    if (nodeMaxX >= minX && nodeMinX <= maxX &&
        nodeMaxY >= minY && nodeMinY <= maxY) {
      return true;
    }
  }
  return false;
}

/**
 * For 2-waypoint edges where endpoints aren't aligned (diagonal),
 * insert an L-bend midpoint to maintain orthogonality.
 */
function fixDiagonalEdges(positions, affectedIndices) {
  for (let idx = 0; idx < positions.edges.length; idx++) {
    if (affectedIndices && !affectedIndices.has(idx)) continue;
    const edge = positions.edges[idx];
    if (edge.waypoints.length !== 2) continue;
    const [sx, sy] = edge.waypoints[0];
    const [tx, ty] = edge.waypoints[1];
    const dx = Math.abs(sx - tx);
    const dy = Math.abs(sy - ty);
    if (dx <= ORTHO_TOLERANCE || dy <= ORTHO_TOLERANCE) continue;

    // Insert L-bend: vertical first, then horizontal
    edge.waypoints = [[sx, sy], [sx, ty], [tx, ty]];
  }
}

