import { MIN_PORT_SPACING } from '../util/constants.js';
import { detectSide, clipToNodeBorder } from '../util/geometry.js';

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
 * For rectangular nodes: distributes points along the flat border edge.
 * For diamond nodes: distributes points then projects each onto the
 * actual diamond border using clipToNodeBorder.
 *
 * @param {{ x: number, y: number, width: number, height: number, shape?: string }} nodePos
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

    const totalSpan = spacing * (count - 1);
    const firstOffset = (sideLength - totalSpan) / 2;
    const sideStart = nodePos.x - halfW;

    for (let i = 0; i < count; i++) {
      const x = sideStart + firstOffset + spacing * i;
      points.push([x, y]);
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
      const y = sideStart + firstOffset + spacing * i;
      points.push([x, y]);
    }
  }

  // For non-rectangular shapes (diamond, etc.), project each point onto
  // the actual shape border so edges connect to the visible shape, not
  // the bounding box.
  if (nodePos.shape === 'diamond') {
    for (let i = 0; i < points.length; i++) {
      points[i] = clipToNodeBorder(nodePos, points[i][0], points[i][1]);
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
  // Only straighten edges that the hierarchical layout produced as straight lines
  // but became multi-waypoint through port assignment. Router-produced multi-waypoint
  // routes should not be straightened — the router already placed them correctly
  // with obstacle avoidance and nudge separation.
  //
  // This function is now a no-op. The router handles orthogonal routing,
  // and distributeForNode + fixDiagonalEdges handle 2-waypoint edges.
  // Straightening was destructive: it replaced router routes with straight lines,
  // which then needed re-processing by distributeForNode and fixDiagonalEdges,
  // producing worse results (horizontal approach segments, lost nudge separation).
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
 *
 * The bend direction is chosen so the final segment approaches the target
 * from the same direction as the target endpoint's side:
 * - Target on top/bottom border → last segment is vertical (arrow points down/up)
 * - Target on left/right border → last segment is horizontal (arrow points right/left)
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

    const tgtPos = positions.nodes.get(edge.target);
    const tgtSide = tgtPos ? detectSide(tgtPos, sx, sy) : null;

    if (tgtSide === 'top' || tgtSide === 'bottom') {
      // Arrow should approach vertically: horizontal first, then vertical
      edge.waypoints = [[sx, sy], [tx, sy], [tx, ty]];
    } else {
      // Arrow should approach horizontally: vertical first, then horizontal
      edge.waypoints = [[sx, sy], [sx, ty], [tx, ty]];
    }
  }
}

