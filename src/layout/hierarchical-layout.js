import { IDEAL_EDGE_LENGTH } from '../util/constants.js';
import { clipToNodeBorder } from '../util/geometry.js';

/**
 * Simple hierarchical layout for flowcharts.
 * Assigns nodes to ranks (levels) via BFS from roots,
 * then spaces them evenly within each rank.
 *
 * @param {import('./graph-builder.js').HolaGraphSpec} spec
 * @returns {import('./layout-engine.js').PositionMap}
 */
export function hierarchicalLayout(spec) {
  const { nodes, edges, treeGrowthDir } = spec;

  const nodeById = new Map();
  for (const n of nodes) nodeById.set(n.id, n);

  // Build adjacency
  const children = new Map(); // outgoing edges
  const parents = new Map();  // incoming edges
  for (const n of nodes) {
    children.set(n.id, []);
    parents.set(n.id, []);
  }
  for (const e of edges) {
    children.get(e.source)?.push(e.target);
    parents.get(e.target)?.push(e.source);
  }

  // Find roots (no incoming edges)
  const roots = nodes.filter(n => parents.get(n.id).length === 0).map(n => n.id);
  // If no roots (cyclic graph), pick the first node
  if (roots.length === 0 && nodes.length > 0) {
    roots.push(nodes[0].id);
  }

  // BFS to assign ranks (longest path from root for better layout)
  const rank = new Map();
  const visited = new Set();
  const queue = [];

  for (const root of roots) {
    rank.set(root, 0);
    visited.add(root);
    queue.push(root);
  }

  while (queue.length > 0) {
    const nodeId = queue.shift();
    const nodeRank = rank.get(nodeId);
    for (const childId of children.get(nodeId) ?? []) {
      // Skip back-edges: don't demote already-ranked nodes in cycles
      if (visited.has(childId)) continue;

      const existingRank = rank.get(childId);
      // Use max rank to handle multiple parents (ensures child is below all parents)
      const newRank = nodeRank + 1;
      if (existingRank === undefined || existingRank < newRank) {
        rank.set(childId, newRank);
      }
      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push(childId);
      }
    }
  }

  // Handle disconnected nodes
  for (const n of nodes) {
    if (!rank.has(n.id)) {
      rank.set(n.id, 0);
    }
  }

  // Group nodes by rank
  const ranks = new Map();
  for (const n of nodes) {
    const r = rank.get(n.id);
    if (!ranks.has(r)) ranks.set(r, []);
    ranks.get(r).push(n);
  }

  // Sort ranks by rank number
  const sortedRanks = [...ranks.entries()].sort((a, b) => a[0] - b[0]);

  // Determine if layout is vertical (TB/BT) or horizontal (LR/RL)
  // treeGrowthDir: 0=N(BT), 1=S(TB), 2=E(LR), 3=W(RL)
  const isVertical = treeGrowthDir === 0 || treeGrowthDir === 1;
  const isReversed = treeGrowthDir === 0 || treeGrowthDir === 3; // BT or RL

  const RANK_GAP = IDEAL_EDGE_LENGTH + 20;
  const NODE_GAP = 30;

  // Compute positions
  const nodePositions = new Map();

  // First pass: compute rank positions and max dimensions.
  // Sort nodes within each rank by the order of their parents in the previous rank
  // to minimize edge crossings (barycenter heuristic).
  let rankOffset = 0;
  for (const [, rankNodes] of sortedRanks) {
    // Sort by average parent position (cross-axis) to reduce crossings
    if (nodePositions.size > 0) {
      rankNodes.sort((a, b) => {
        const aParents = parents.get(a.id) ?? [];
        const bParents = parents.get(b.id) ?? [];
        const aAvg = aParents.length > 0
          ? aParents.reduce((s, pid) => s + (nodePositions.get(pid)?.[isVertical ? 'x' : 'y'] ?? 0), 0) / aParents.length
          : 0;
        const bAvg = bParents.length > 0
          ? bParents.reduce((s, pid) => s + (nodePositions.get(pid)?.[isVertical ? 'x' : 'y'] ?? 0), 0) / bParents.length
          : 0;
        return aAvg - bAvg;
      });
    }
    let crossOffset = 0;
    const maxMainDim = Math.max(
      ...rankNodes.map(n => isVertical ? n.height : n.width)
    );

    // Center nodes within this rank
    const totalCross = rankNodes.reduce((sum, n) => {
      return sum + (isVertical ? n.width : n.height) + NODE_GAP;
    }, -NODE_GAP);

    let startCross = -totalCross / 2;

    for (const n of rankNodes) {
      const mainDim = isVertical ? n.height : n.width;
      const crossDim = isVertical ? n.width : n.height;

      const mainPos = rankOffset + maxMainDim / 2;
      const crossPos = startCross + crossDim / 2;

      const x = isVertical ? crossPos : mainPos;
      const y = isVertical ? mainPos : crossPos;

      nodePositions.set(n.id, {
        x: isReversed ? -x : x,
        y: isReversed ? -y : y,
        width: n.width,
        height: n.height,
        shape: n.shape,
      });

      startCross += crossDim + NODE_GAP;
    }

    rankOffset += maxMainDim + RANK_GAP;
  }

  // Shift all positions so minimum is at origin with padding
  const PADDING = 50;
  let minX = Infinity, minY = Infinity;
  for (const pos of nodePositions.values()) {
    minX = Math.min(minX, pos.x - pos.width / 2);
    minY = Math.min(minY, pos.y - pos.height / 2);
  }
  for (const pos of nodePositions.values()) {
    pos.x -= minX - PADDING;
    pos.y -= minY - PADDING;
  }

  // Compute edge routes
  const edgeRoutes = computeEdgeRoutes(edges, nodePositions);

  return {
    nodes: nodePositions,
    edges: edgeRoutes,
    groups: new Map(),
  };
}

/**
 * Compute edge routes as straight lines clipped to node borders.
 */
function computeEdgeRoutes(edges, nodePositions) {
  const routes = [];

  for (const edge of edges) {
    const srcPos = nodePositions.get(edge.source);
    const tgtPos = nodePositions.get(edge.target);
    if (!srcPos || !tgtPos) continue;

    const srcExit = clipToNodeBorder(srcPos, tgtPos.x, tgtPos.y);
    const tgtEntry = clipToNodeBorder(tgtPos, srcPos.x, srcPos.y);

    routes.push({
      source: edge.source,
      target: edge.target,
      waypoints: [srcExit, tgtEntry],
    });
  }

  return routes;
}
