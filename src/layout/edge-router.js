import { getLibavoid } from './wasm-loader.js';
import { ARROW_SIZE } from '../util/constants.js';
import { clipToNodeBorder } from '../util/geometry.js';

/** libavoid routing flag for orthogonal routing (Router constructor — currently unused by WASM) */
const ORTHOGONAL_ROUTING = 2;

/** Per-connector routing type: orthogonal produces only H/V segments */
const CONN_TYPE_ORTHOGONAL = 2;

/** libavoid routing option indices (must match wasm.rs constants) */
const ROUTING_OPTION = Object.freeze({
  NUDGE_ORTHOGONAL_SEGMENTS: 0,
  IMPROVE_HYPEREDGE_ROUTES: 1,
  PENALISE_PORT_DIRECTIONS: 2,
  NUDGE_COLINEAR_SEGMENTS: 3,
  UNIFYING_NUDGING_STEP: 4,
  IMPROVE_HYPEREDGE_ADD_DELETE: 5,
  NUDGE_SHARED_PATHS_COMMON_END: 6,
  NUDGE_SEGMENTS_CONNECTED_TO_SHAPES: 7,
  PENALISE_SHARED_PATHS_AT_CONN_ENDS: 8,
});

/** libavoid routing parameter indices (must match wasm.rs constants) */
const ROUTING_PARAM = Object.freeze({
  SEGMENT_PENALTY: 0,
  BEND_PENALTY: 1,
  CROSSING_PENALTY: 2,
  CLUSTER_CROSSING_PENALTY: 3,
  FIXED_SHARED_PATH_PENALTY: 4,
  PORT_DIRECTION_PENALTY: 5,
  SHAPE_BUFFER_DISTANCE: 6,
  IDEAL_NUDGING_DISTANCE: 7,
  REVERSE_DIRECTION_PENALTY: 8,
});

/** Nudging gap between parallel edge segments (px) */
const NUDGE_DISTANCE = 15;

/**
 * Shape buffer — padding around obstacles for routing clearance (px).
 * Must be large enough that routed edges don't hug node borders,
 * leaving room for arrowheads and edge labels to be readable.
 */
const SHAPE_BUFFER = 20;

/**
 * Persistent router state for incremental updates during drag.
 * @typedef {Object} RouterState
 * @property {any} router - libavoid Router instance
 * @property {Map<string, any>} shapes - nodeId -> ShapeRef
 * @property {Map<number, {source: string, target: string}>} connectors - connId -> edge info
 * @property {any} libavoid - the loaded WASM module
 */

/** @type {RouterState|null} */
let routerState = null;

/**
 * Create a router, add all node obstacles and edge connectors,
 * process routing, and extract orthogonal waypoints.
 *
 * Replaces straight-line waypoints in positions.edges with routed paths.
 * Falls back to existing waypoints if WASM is unavailable.
 *
 * @param {import('./layout-engine.js').PositionMap} positions
 * @param {import('./graph-builder.js').HolaGraphSpec} spec
 * @returns {Promise<RouterState|null>} router state for use during drag, or null on failure
 */
export async function routeEdges(positions, spec) {
  let libavoid;
  try {
    libavoid = await getLibavoid();
  } catch (err) {
    console.warn('libavoid WASM unavailable, using straight-line edges:', err);
    return null;
  }

  try {
    const router = new libavoid.Router(ORTHOGONAL_ROUTING);
    router.setTransactionUse(true);

    // Enable nudging to separate parallel edge segments
    router.setRoutingOption(ROUTING_OPTION.NUDGE_ORTHOGONAL_SEGMENTS, true);
    router.setRoutingOption(ROUTING_OPTION.NUDGE_COLINEAR_SEGMENTS, true);
    router.setRoutingOption(ROUTING_OPTION.UNIFYING_NUDGING_STEP, true);
    router.setRoutingOption(ROUTING_OPTION.NUDGE_SHARED_PATHS_COMMON_END, true);
    router.setRoutingOption(ROUTING_OPTION.NUDGE_SEGMENTS_CONNECTED_TO_SHAPES, true);
    router.setRoutingParameter(ROUTING_PARAM.IDEAL_NUDGING_DISTANCE, NUDGE_DISTANCE);

    // Add node obstacles
    const shapes = new Map();
    for (const [nodeId, pos] of positions.nodes) {
      const center = new libavoid.Point(pos.x, pos.y);
      const rect = new libavoid.Rectangle(center, pos.width + SHAPE_BUFFER * 2, pos.height + SHAPE_BUFFER * 2);
      const poly = rect.toPolygon();
      const shape = new libavoid.ShapeRef(router, poly);
      router.addShape(shape);
      shapes.set(nodeId, shape);
    }

    // Add connectors with center-point endpoints
    const connectors = new Map();
    let connId = 1;
    for (const edge of positions.edges) {
      const srcPos = positions.nodes.get(edge.source);
      const tgtPos = positions.nodes.get(edge.target);
      if (!srcPos || !tgtPos) continue;

      const srcPt = new libavoid.ConnEnd(new libavoid.Point(srcPos.x, srcPos.y));
      const dstPt = new libavoid.ConnEnd(new libavoid.Point(tgtPos.x, tgtPos.y));
      const conn = libavoid.ConnRef.createWithId(router, srcPt, dstPt, connId);
      conn.setRoutingType(CONN_TYPE_ORTHOGONAL);
      router.addConnector(conn);
      connectors.set(connId, { source: edge.source, target: edge.target, connRef: conn });
      connId++;
    }

    // Route
    router.processTransaction();

    // Extract routes
    for (const [id, info] of connectors) {
      const route = router.getConnectorRoute(id);
      if (!route || route.size() < 2) continue;

      const rawWaypoints = polygonToWaypoints(route, libavoid);
      if (rawWaypoints.length >= 2) {
        const edge = positions.edges.find(
          e => e.source === info.source && e.target === info.target
        );
        if (edge) {
          const srcPos = positions.nodes.get(info.source);
          const tgtPos = positions.nodes.get(info.target);
          edge.waypoints = (srcPos && tgtPos)
            ? clipRouterWaypoints(rawWaypoints, srcPos, tgtPos)
            : rawWaypoints;
        }
      }
    }

    routerState = { router, shapes, connectors, libavoid };
    return routerState;
  } catch (err) {
    console.warn('libavoid routing failed, keeping straight-line edges:', err);
    routerState = null;
    return null;
  }
}

/**
 * Move an obstacle and re-route affected connectors.
 *
 * @param {string} nodeId
 * @param {number} newX
 * @param {number} newY
 * @param {import('./layout-engine.js').PositionMap} positions
 * @param {RouterState} [state] - Router state from routeEdges(). Falls back to module singleton.
 * @returns {boolean} true if re-routing succeeded
 */
export function moveObstacleAndReroute(nodeId, newX, newY, positions, state) {
  const rs = state || routerState;
  if (!rs) return false;

  const { router, shapes, connectors, libavoid } = rs;
  const shape = shapes.get(nodeId);
  if (!shape) return false;

  const pos = positions.nodes.get(nodeId);
  if (!pos) return false;

  // Update node position immediately so clipping uses correct coordinates
  pos.x = newX;
  pos.y = newY;

  // Compute delta from current shape position
  const currentPos = shape.position();
  const dx = newX - currentPos.x;
  const dy = newY - currentPos.y;

  if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return true;

  // Move the obstacle
  router.moveShape(shape, dx, dy);

  // Update connector endpoints for edges connected to this node
  for (const [id, info] of connectors) {
    if (info.source === nodeId || info.target === nodeId) {
      const srcX = info.source === nodeId ? newX : positions.nodes.get(info.source)?.x;
      const srcY = info.source === nodeId ? newY : positions.nodes.get(info.source)?.y;
      const tgtX = info.target === nodeId ? newX : positions.nodes.get(info.target)?.x;
      const tgtY = info.target === nodeId ? newY : positions.nodes.get(info.target)?.y;
      if (srcX == null || tgtX == null) continue;

      const srcPt = new libavoid.ConnEnd(new libavoid.Point(srcX, srcY));
      const dstPt = new libavoid.ConnEnd(new libavoid.Point(tgtX, tgtY));
      info.connRef.setSourceEndpoint(srcPt);
      info.connRef.setDestEndpoint(dstPt);
      router.updateConnector(info.connRef);
    }
  }

  // Re-route
  router.processTransaction();

  // Extract updated routes
  for (const [id, info] of connectors) {
    const route = router.getConnectorRoute(id);
    if (!route || route.size() < 2) continue;

    const rawWaypoints = polygonToWaypoints(route, libavoid);
    if (rawWaypoints.length >= 2) {
      const edge = positions.edges.find(
        e => e.source === info.source && e.target === info.target
      );
      if (edge) {
        const srcPos = positions.nodes.get(info.source);
        const tgtPos = positions.nodes.get(info.target);
        edge.waypoints = (srcPos && tgtPos)
          ? clipRouterWaypoints(rawWaypoints, srcPos, tgtPos)
          : rawWaypoints;
      }
    }
  }

  return true;
}

/**
 * Get the current router state (for use by interaction layer).
 * @returns {RouterState|null}
 */
export function getRouterState() {
  return routerState;
}

/**
 * Clear the persistent router state.
 */
export function clearRouterState() {
  if (routerState) {
    routerState.router.free();
    routerState = null;
  }
}

/**
 * Convert a libavoid Polygon route to a waypoints array.
 * @param {any} polygon - libavoid Polygon
 * @param {any} libavoid - WASM module
 * @returns {number[][]} Array of [x, y] pairs
 */
function polygonToWaypoints(polygon, libavoid) {
  const points = [];
  const size = polygon.size();
  for (let i = 0; i < size; i++) {
    const pt = polygon.at(i);
    if (pt) {
      points.push([pt.x, pt.y]);
    }
  }
  return points;
}

/**
 * Tolerance for boundary detection when clipping router waypoints.
 * Must be >= SHAPE_BUFFER since the router routes around padded obstacles,
 * placing waypoints up to SHAPE_BUFFER pixels outside the node border.
 * These points should be treated as "outside" the node for clipping purposes.
 */
const BORDER_TOLERANCE = SHAPE_BUFFER + 1;

/**
 * Clip center-to-center router waypoints to border-to-border.
 *
 * The router produces paths starting/ending at node centers (inside obstacles).
 * For multi-waypoint paths: removes interior waypoints and clips at borders.
 * For 2-waypoint paths: clips both endpoints at node borders.
 *
 * @param {number[][]} waypoints - Raw router waypoints (center-to-center)
 * @param {{ x: number, y: number, width: number, height: number }} srcPos
 * @param {{ x: number, y: number, width: number, height: number }} tgtPos
 * @returns {number[][]} Clipped waypoints (border-to-border)
 */
export function clipRouterWaypoints(waypoints, srcPos, tgtPos) {
  if (waypoints.length === 2) {
    return clipStraightRoute(waypoints, srcPos, tgtPos);
  }
  return trimMultiWaypointRoute(waypoints, srcPos, tgtPos);
}

/**
 * Clip a 2-waypoint (straight) route at node borders.
 * The SVG marker (refX=ARROW_SIZE) places the arrowhead tip at the path
 * endpoint, so the endpoint should be exactly ON the node border.
 */
function clipStraightRoute(waypoints, srcPos, tgtPos) {
  const srcClipped = clipToNodeBorder(srcPos, waypoints[1][0], waypoints[1][1]);
  const tgtClipped = clipToNodeBorder(tgtPos, srcClipped[0], srcClipped[1]);
  return [srcClipped, tgtClipped];
}

/**
 * Trim a multi-waypoint route from center-to-center to border-to-border.
 * Removes waypoints inside source/target nodes, clips at borders.
 *
 * Uses axis-aligned clipping (clipOrthogonalAtBorder) to maintain
 * orthogonality of the router's H/V segments.
 */
function trimMultiWaypointRoute(waypoints, srcPos, tgtPos) {
  const srcExit = findFirstOutside(waypoints, srcPos, BORDER_TOLERANCE);
  const tgtEntry = findLastOutside(waypoints, tgtPos, BORDER_TOLERANCE);

  if (srcExit < 0 || tgtEntry < 0 || srcExit > tgtEntry) return waypoints;

  const trimmed = waypoints.slice(srcExit, tgtEntry + 1);

  if (srcExit > 0) {
    trimmed.unshift(clipOrthogonalAtBorder(srcPos, waypoints[srcExit - 1], waypoints[srcExit]));
  }

  if (tgtEntry < waypoints.length - 1) {
    trimmed.push(clipOrthogonalAtBorder(tgtPos, waypoints[tgtEntry + 1], waypoints[tgtEntry]));
  }

  return trimmed;
}

/**
 * Clip an orthogonal segment at a rectangular node border.
 *
 * Preserves orthogonality: the returned point shares one coordinate with
 * the `outside` point and the other coordinate is on the node border.
 * This maintains the H/V alignment of router-produced segments.
 *
 * Segment goes from `inside` (inside node) toward `outside` (outside node).
 */
function clipOrthogonalAtBorder(nodePos, inside, outside) {
  const halfW = nodePos.width / 2;
  const halfH = nodePos.height / 2;
  const dx = Math.abs(inside[0] - outside[0]);
  const dy = Math.abs(inside[1] - outside[1]);

  if (dx <= dy) {
    // Primarily vertical segment — clip at top/bottom border
    const sign = outside[1] < inside[1] ? -1 : 1;
    const borderY = nodePos.y + sign * halfH;
    return [inside[0], borderY];
  }
  // Primarily horizontal segment — clip at left/right border
  const sign = outside[0] < inside[0] ? -1 : 1;
  const borderX = nodePos.x + sign * halfW;
  return [borderX, inside[1]];
}

/** Check if point is strictly inside a node's bounding box */
function pointInsideNode(pt, nodePos, tolerance) {
  const halfW = nodePos.width / 2;
  const halfH = nodePos.height / 2;
  return pt[0] > nodePos.x - halfW + tolerance &&
         pt[0] < nodePos.x + halfW - tolerance &&
         pt[1] > nodePos.y - halfH + tolerance &&
         pt[1] < nodePos.y + halfH - tolerance;
}

/** Find index of first waypoint outside the given node, or -1 */
function findFirstOutside(waypoints, nodePos, tolerance) {
  for (let i = 0; i < waypoints.length; i++) {
    if (!pointInsideNode(waypoints[i], nodePos, tolerance)) return i;
  }
  return -1;
}

/** Find index of last waypoint outside the given node, or -1 */
function findLastOutside(waypoints, nodePos, tolerance) {
  for (let i = waypoints.length - 1; i >= 0; i--) {
    if (!pointInsideNode(waypoints[i], nodePos, tolerance)) return i;
  }
  return -1;
}

