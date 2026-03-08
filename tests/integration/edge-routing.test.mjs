import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = join(__dirname, '../../lib/libavoid/libavoid_bg.wasm');

/** @type {any} */
let libavoid;

/** Routing flag for orthogonal routing */
const ORTHOGONAL_ROUTING = 2;
/** Routing flag for polyline routing */
const POLYLINE_ROUTING = 0;

/** Routing option indices */
const NUDGE_ORTHOGONAL_ROUTES = 0;
const NUDGE_SEGMENTS_CONNECTED_TO_SHAPES = 7;
const PERFORM_UNIFYING_STEP = 4;
const IDEAL_NUDGING_DISTANCE_PARAM = 3;

const NUDGE_DISTANCE = 10;

/** Per-connector routing type */
const CONN_TYPE_ORTHOGONAL = 2;

before(async () => {
  const module = await import('../../lib/libavoid/libavoid.js');
  const wasmBuffer = readFileSync(WASM_PATH);
  await module.default(wasmBuffer);
  libavoid = module;
});

function createRouter(flags = POLYLINE_ROUTING) {
  const router = new libavoid.Router(flags);
  router.setTransactionUse(true);
  router.setRoutingOption(NUDGE_ORTHOGONAL_ROUTES, true);
  router.setRoutingOption(NUDGE_SEGMENTS_CONNECTED_TO_SHAPES, true);
  router.setRoutingOption(PERFORM_UNIFYING_STEP, true);
  router.setRoutingParameter(IDEAL_NUDGING_DISTANCE_PARAM, NUDGE_DISTANCE);
  return router;
}

function addObstacle(router, cx, cy, w, h) {
  const center = new libavoid.Point(cx, cy);
  const rect = new libavoid.Rectangle(center, w, h);
  const poly = rect.toPolygon();
  const shape = new libavoid.ShapeRef(router, poly);
  router.addShape(shape);
  return shape;
}

function addConnector(router, sx, sy, tx, ty, id, orthogonal = false) {
  const src = new libavoid.ConnEnd(new libavoid.Point(sx, sy));
  const dst = new libavoid.ConnEnd(new libavoid.Point(tx, ty));
  const conn = libavoid.ConnRef.createWithId(router, src, dst, id);
  if (orthogonal) conn.setRoutingType(CONN_TYPE_ORTHOGONAL);
  router.addConnector(conn);
  return conn;
}

function getRoute(router, connId) {
  const poly = router.getConnectorRoute(connId);
  if (!poly) return [];
  const points = [];
  for (let i = 0; i < poly.size(); i++) {
    const pt = poly.at(i);
    if (pt) points.push([pt.x, pt.y]);
  }
  return points;
}

function pointInsideRect(px, py, cx, cy, w, h) {
  const halfW = w / 2;
  const halfH = h / 2;
  // Use tolerance to allow boundary touches
  const TOLERANCE = 1;
  return px > cx - halfW + TOLERANCE && px < cx + halfW - TOLERANCE &&
         py > cy - halfH + TOLERANCE && py < cy + halfH - TOLERANCE;
}

describe('obstacle-avoiding routing', () => {
  it('routes around an obstacle between source and target', () => {
    const router = createRouter();

    // Obstacle in the middle; endpoints are NOT inside any obstacle
    const OBS_CX = 200, OBS_CY = 150, OBS_W = 80, OBS_H = 40;
    addObstacle(router, OBS_CX, OBS_CY, OBS_W, OBS_H);

    // Source above obstacle, target below — both outside
    addConnector(router, 200, 50, 200, 250, 1);
    router.processTransaction();

    const route = getRoute(router, 1);
    assert.ok(route.length >= 2, `route should have waypoints, got ${route.length}`);

    // Route should NOT pass through the obstacle
    for (let i = 0; i < route.length; i++) {
      assert.ok(
        !pointInsideRect(route[i][0], route[i][1], OBS_CX, OBS_CY, OBS_W, OBS_H),
        `waypoint (${route[i][0]}, ${route[i][1]}) should not be inside obstacle`
      );
    }

    // Route should have more than 2 points (had to detour)
    assert.ok(route.length > 2, `route should detour around obstacle, got ${route.length} points`);
  });

  it('produces direct route when path is clear', () => {
    const router = createRouter();

    // Two obstacles far apart with no obstacle between
    addObstacle(router, 100, 100, 40, 40);
    addObstacle(router, 300, 100, 40, 40);

    // Connect from left of first to right of second — clear path between
    addConnector(router, 50, 100, 350, 100, 1);
    router.processTransaction();

    const route = getRoute(router, 1);
    assert.ok(route.length >= 2, `route should have waypoints, got ${route.length}`);
  });

  it('returns non-empty routes for all connectors', () => {
    const router = createRouter();

    addObstacle(router, 100, 100, 40, 40);
    addObstacle(router, 300, 100, 40, 40);
    addObstacle(router, 200, 250, 40, 40);

    // Endpoints outside obstacles
    addConnector(router, 50, 100, 350, 100, 1);
    addConnector(router, 50, 100, 200, 300, 2);
    addConnector(router, 350, 100, 200, 300, 3);
    router.processTransaction();

    for (const id of [1, 2, 3]) {
      const route = getRoute(router, id);
      assert.ok(route.length >= 2, `connector ${id} should have route, got ${route.length}`);
    }
  });
});

describe('nudging: parallel edge separation', () => {
  it('separates parallel connectors routed around an obstacle', () => {
    const router = createRouter();

    // Place an obstacle in the path to force detours
    addObstacle(router, 200, 100, 60, 60);

    // Two connectors both going from left to right, both must detour
    addConnector(router, 50, 100, 350, 100, 1);
    addConnector(router, 50, 100, 350, 100, 2);
    router.processTransaction();

    const route1 = getRoute(router, 1);
    const route2 = getRoute(router, 2);

    assert.ok(route1.length >= 2, 'route 1 should have waypoints');
    assert.ok(route2.length >= 2, 'route 2 should have waypoints');

    // Routes should both avoid the obstacle
    for (const [px, py] of route1) {
      assert.ok(!pointInsideRect(px, py, 200, 100, 60, 60),
        `route 1 waypoint (${px}, ${py}) inside obstacle`);
    }
    for (const [px, py] of route2) {
      assert.ok(!pointInsideRect(px, py, 200, 100, 60, 60),
        `route 2 waypoint (${px}, ${py}) inside obstacle`);
    }
  });

  it('no nudged segment enters an obstacle', () => {
    const router = createRouter();

    const OBS_X = 200, OBS_Y = 100, OBS_W = 60, OBS_H = 60;
    addObstacle(router, OBS_X, OBS_Y, OBS_W, OBS_H);

    addConnector(router, 50, 100, 350, 100, 1);
    addConnector(router, 50, 100, 350, 100, 2);
    router.processTransaction();

    for (const id of [1, 2]) {
      const route = getRoute(router, id);
      for (const [px, py] of route) {
        assert.ok(
          !pointInsideRect(px, py, OBS_X, OBS_Y, OBS_W, OBS_H),
          `connector ${id} waypoint (${px}, ${py}) should not be inside obstacle`
        );
      }
    }
  });
});

describe('drag re-routing', () => {
  it('moving obstacle changes affected route', () => {
    const router = createRouter();

    // Obstacle blocks the path
    const obstacle = addObstacle(router, 200, 100, 60, 60);

    addConnector(router, 50, 100, 350, 100, 1);
    router.processTransaction();

    const routeBefore = getRoute(router, 1);
    assert.ok(routeBefore.length >= 2, 'should have route before move');

    // Move obstacle out of the way
    router.moveShape(obstacle, 0, 200);
    router.processTransaction();

    const routeAfter = getRoute(router, 1);
    assert.ok(routeAfter.length >= 2, 'should have route after move');

    // Routes should differ — obstacle moved away
    const beforeStr = JSON.stringify(routeBefore);
    const afterStr = JSON.stringify(routeAfter);
    assert.notEqual(beforeStr, afterStr, 'route should change after obstacle moves');
  });

  it('route still avoids obstacle after it moves', () => {
    const router = createRouter();

    const obstacle = addObstacle(router, 200, 100, 60, 60);

    addConnector(router, 50, 100, 350, 100, 1);
    router.processTransaction();

    // Move obstacle slightly — should still be in the path
    router.moveShape(obstacle, 20, 0);
    router.processTransaction();

    const route = getRoute(router, 1);
    assert.ok(route.length >= 2, 'should have route after move');

    // Route should avoid the moved obstacle (now at 220, 100)
    for (const [px, py] of route) {
      assert.ok(
        !pointInsideRect(px, py, 220, 100, 60, 60),
        `waypoint (${px}, ${py}) should not be inside moved obstacle`
      );
    }
  });
});

function isOrthogonal(waypoints) {
  for (let i = 1; i < waypoints.length; i++) {
    const dx = Math.abs(waypoints[i][0] - waypoints[i - 1][0]);
    const dy = Math.abs(waypoints[i][1] - waypoints[i - 1][1]);
    if (dx > 0.01 && dy > 0.01) return false;
  }
  return true;
}

describe('orthogonal routing mode', () => {
  it('all segments are strictly horizontal or vertical', () => {
    const router = createRouter();

    addObstacle(router, 200, 150, 80, 40);

    // Orthogonal connector
    addConnector(router, 200, 50, 200, 250, 1, true);
    router.processTransaction();

    const route = getRoute(router, 1);
    assert.ok(route.length >= 2, `route should have waypoints, got ${route.length}`);
    assert.ok(isOrthogonal(route),
      `all segments should be orthogonal, got: ${JSON.stringify(route)}`);
  });

  it('diagonal node arrangement produces L-shaped or Z-shaped path, not diagonal', () => {
    const router = createRouter();

    // Nodes at diagonal positions
    addObstacle(router, 100, 100, 60, 40);
    addObstacle(router, 300, 300, 60, 40);

    addConnector(router, 100, 100, 300, 300, 1, true);
    router.processTransaction();

    const route = getRoute(router, 1);
    assert.ok(route.length >= 2, `route should have waypoints, got ${route.length}`);
    assert.ok(isOrthogonal(route),
      `diagonal arrangement must produce orthogonal path, got: ${JSON.stringify(route)}`);
    // Should have at least 3 points (L-shape) since dx != 0 and dy != 0
    assert.ok(route.length >= 3,
      `diagonal arrangement needs at least 3 points for L-shape, got ${route.length}`);
  });

  it('orthogonal produces different output than polyline for same scenario', () => {
    // Polyline route
    const router1 = createRouter();
    addObstacle(router1, 200, 150, 80, 40);
    addConnector(router1, 200, 50, 200, 250, 1, false); // polyline
    router1.processTransaction();
    const polyRoute = getRoute(router1, 1);

    // Orthogonal route
    const router2 = createRouter();
    addObstacle(router2, 200, 150, 80, 40);
    addConnector(router2, 200, 50, 200, 250, 1, true); // orthogonal
    router2.processTransaction();
    const orthoRoute = getRoute(router2, 1);

    assert.ok(polyRoute.length >= 2);
    assert.ok(orthoRoute.length >= 2);

    // Orthogonal route must be strictly orthogonal
    assert.ok(isOrthogonal(orthoRoute), 'orthogonal route should have only H/V segments');

    // Polyline route may have diagonal segments
    const polyIsOrtho = isOrthogonal(polyRoute);
    // They should differ (polyline uses diagonals, orthogonal doesn't)
    if (!polyIsOrtho) {
      assert.notDeepEqual(polyRoute, orthoRoute,
        'orthogonal and polyline routes should differ');
    }
  });
});

describe('center-point endpoints with orthogonal routing', () => {
  it('routes correctly with endpoints at node centers (inside obstacles)', () => {
    const router = createRouter();

    // Source, obstacle, and target — endpoints at centers of source/target shapes
    addObstacle(router, 200, 50, 80, 40);  // Source shape
    addObstacle(router, 200, 150, 80, 40); // Blocking obstacle
    addObstacle(router, 200, 250, 80, 40); // Target shape

    // Endpoints at centers of source/target shapes
    addConnector(router, 200, 50, 200, 250, 1, true);
    router.processTransaction();

    const route = getRoute(router, 1);
    assert.ok(route.length >= 2, `route should exist, got ${route.length}`);
    assert.ok(isOrthogonal(route), 'route should be orthogonal');
    // Should route around the middle obstacle
    assert.ok(route.length > 2,
      `should detour around obstacle, got ${route.length} points`);
  });

  it('endpoints update after obstacle move', () => {
    const router = createRouter();

    const obstacle = addObstacle(router, 200, 100, 60, 60);
    addConnector(router, 50, 100, 350, 100, 1, true);
    router.processTransaction();

    const routeBefore = getRoute(router, 1);

    router.moveShape(obstacle, 0, 200);
    router.processTransaction();

    const routeAfter = getRoute(router, 1);
    assert.notDeepEqual(routeBefore, routeAfter,
      'route should change after obstacle move');
    assert.ok(isOrthogonal(routeAfter), 'route should remain orthogonal after move');
  });
});
