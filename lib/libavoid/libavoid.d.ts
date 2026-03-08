/* tslint:disable */
/* eslint-disable */
export function main(): void;
export class AvoidLib {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Load the library (compatibility with libavoid-js)
   * In wasm-pack, actual loading is handled by the generated init function
   */
  static load(): AvoidLib;
  /**
   * Get instance (compatibility with libavoid-js)
   */
  static getInstance(): AvoidLib;
}
export class Box {
  free(): void;
  [Symbol.dispose](): void;
  constructor();
  /**
   * Create a Box from coordinates
   */
  static fromCoords(x1: number, y1: number, x2: number, y2: number): Box;
  width(): number;
  height(): number;
  /**
   * Returns length along the specified dimension (0 = width, 1 = height)
   */
  length(dimension: number): number;
  /**
   * Checks if the box contains a point
   */
  contains(point: Point): boolean;
  min: Point;
  max: Point;
}
export class ConnEnd {
  free(): void;
  [Symbol.dispose](): void;
  constructor(point: Point);
  /**
   * Create a ConnEnd attached to a shape's connection pin class
   */
  static fromShapePin(shape: ShapeRef, pin_class_id: number): ConnEnd;
}
export class ConnRef {
  free(): void;
  [Symbol.dispose](): void;
  constructor(router: Router);
  /**
   * Create a ConnRef with source and destination endpoints
   */
  static createWithEndpoints(router: Router, src: ConnEnd, dst: ConnEnd): ConnRef;
  /**
   * Create a ConnRef with endpoints and a specific ID
   */
  static createWithId(router: Router, src: ConnEnd, dst: ConnEnd, id: number): ConnRef;
  setCallback(_callback: any, _context: any): void;
  displayRoute(): Polygon | undefined;
  id(): number;
  setSourceEndpoint(conn_end: ConnEnd): void;
  setDestEndpoint(conn_end: ConnEnd): void;
  routingType(): number;
  setRoutingType(routing_type: number): void;
  /**
   * Set whether this connector hates crossings
   */
  setHateCrossings(value: boolean): void;
  /**
   * Check if this connector hates crossings
   */
  doesHateCrossings(): boolean;
}
export class HyperedgeRerouter {
  free(): void;
  [Symbol.dispose](): void;
  constructor();
  /**
   * Register a hyperedge for rerouting based on a junction
   * Returns the index/ID of the registered hyperedge
   */
  registerHyperedgeForRerouting(junction: JunctionRef): number;
}
export class JunctionRef {
  free(): void;
  [Symbol.dispose](): void;
  constructor(router: Router, position: Point);
  /**
   * Create a JunctionRef with a specific ID
   */
  static createWithId(_router: Router, position: Point, id: number): JunctionRef;
  id(): number;
  /**
   * Returns the junction's position
   */
  position(): Point;
  /**
   * Sets the junction's position
   */
  setPosition(position: Point): void;
}
export class Point {
  free(): void;
  [Symbol.dispose](): void;
  constructor(x: number, y: number);
  /**
   * Create a Point at origin (0, 0)
   */
  static origin(): Point;
  /**
   * Check equality with another point
   */
  equal(other: Point): boolean;
  x: number;
  y: number;
  id: number;
  vn: number;
}
export class Polygon {
  free(): void;
  [Symbol.dispose](): void;
  constructor(vertex_count: number);
  set_ps(index: number, point: Point): void;
  get_ps(index: number): Point | undefined;
  size(): number;
  clear(): void;
  empty(): boolean;
  setPoint(index: number, point: Point): void;
  id(): number;
  at(index: number): Point | undefined;
  /**
   * Returns the bounding rectangle as a polygon
   */
  boundingRectPolygon(): Polygon;
  /**
   * Returns the bounding box offset by the given amount
   */
  offsetBoundingBox(offset: number): Box;
  /**
   * Returns an offset polygon
   */
  offsetPolygon(offset: number): Polygon;
}
export class Rectangle {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Create a rectangle from center point, width, and height
   */
  constructor(center: Point, width: number, height: number);
  /**
   * Create a rectangle from two corner points
   */
  static fromCorners(p1: Point, p2: Point): Rectangle;
  width(): number;
  height(): number;
  center(): Point;
  /**
   * Convert rectangle to a polygon (for use with ShapeRef)
   */
  toPolygon(): Polygon;
}
export class Router {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Create a new router with the specified routing flags
   * flags should be PolyLineRouting (1) or OrthogonalRouting (2)
   */
  constructor(flags: number);
  processTransaction(): boolean;
  /**
   * Enable or disable transaction mode
   * When enabled, changes are batched until processTransaction is called
   * This is required for nudging to work correctly
   */
  setTransactionUse(use_transactions: boolean): void;
  /**
   * Move shape by offset from current position
   * x_diff, y_diff are offsets (deltas) from current position, matching libavoid-js semantics
   */
  moveShape(shape: ShapeRef, x_diff: number, y_diff: number): void;
  /**
   * Move shape to a new polygon position
   */
  moveShapeTo(shape: ShapeRef, new_polygon: Polygon): void;
  setRoutingParameter(param: number, value: number): void;
  routingParameter(param: number): number;
  setRoutingOption(option: number, value: boolean): void;
  routingOption(option: number): boolean;
  /**
   * Add a shape to the router for routing consideration
   */
  addShape(shape: ShapeRef): void;
  /**
   * Add a connector to the router for routing
   */
  addConnector(conn: ConnRef): void;
  /**
   * Get the display route for a connector by ID
   * Use this after processTransaction to get the computed route
   */
  getConnectorRoute(conn_id: number): Polygon | undefined;
  /**
   * Update a connector's endpoints in the router
   * Call this after modifying connector endpoints to sync with router
   */
  updateConnector(conn: ConnRef): void;
  deleteShape(shape: ShapeRef): void;
  deleteConnector(conn: ConnRef): void;
  /**
   * Output info about the router (for debugging)
   */
  outputInstanceToSVG(): string;
}
export class ShapeConnectionPin {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Create a connection pin on a shape
   * shape: The shape to attach the pin to
   * class_id: Class ID for grouping pins
   * x_offset: X offset from shape center (or proportion if proportional)
   * y_offset: Y offset from shape center (or proportion if proportional)
   * inside_offset: Offset inside the shape boundary
   * vis_dirs: Visibility directions (ConnDir flags)
   */
  constructor(shape: ShapeRef, class_id: number, x_offset: number, y_offset: number, inside_offset: number, vis_dirs: number);
  /**
   * Create a connection pin on a junction
   */
  static createOnJunction(_junction: JunctionRef, class_id: number, vis_dirs?: number | null): ShapeConnectionPin;
  /**
   * Set the connection cost for this pin
   */
  setConnectionCost(cost: number): void;
  /**
   * Get the pin's position
   */
  position(): Point;
  /**
   * Get the visibility directions
   */
  directions(): number;
  /**
   * Set whether this pin is exclusive
   */
  setExclusive(exclusive: boolean): void;
  /**
   * Check if this pin is exclusive
   */
  isExclusive(): boolean;
}
export class ShapeRef {
  free(): void;
  [Symbol.dispose](): void;
  constructor(router: Router, polygon: Polygon);
  /**
   * Create a ShapeRef with a specific ID
   */
  static createWithId(_router: Router, polygon: Polygon, id: number): ShapeRef;
  id(): number;
  /**
   * Returns the shape's polygon
   */
  polygon(): Polygon;
  /**
   * Returns the shape's position (center of bounding box)
   */
  position(): Point;
  /**
   * Updates the shape's polygon
   */
  setNewPoly(polygon: Polygon): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_avoidlib_free: (a: number, b: number) => void;
  readonly __wbg_point_free: (a: number, b: number) => void;
  readonly point_new: (a: number, b: number) => number;
  readonly point_origin: () => number;
  readonly point_x: (a: number) => number;
  readonly point_set_x: (a: number, b: number) => void;
  readonly point_y: (a: number) => number;
  readonly point_set_y: (a: number, b: number) => void;
  readonly point_id: (a: number) => number;
  readonly point_set_id: (a: number, b: number) => void;
  readonly point_vn: (a: number) => number;
  readonly point_set_vn: (a: number, b: number) => void;
  readonly point_equal: (a: number, b: number) => number;
  readonly __wbg_polygon_free: (a: number, b: number) => void;
  readonly polygon_new: (a: number) => number;
  readonly polygon_set_ps: (a: number, b: number, c: number) => void;
  readonly polygon_size: (a: number) => number;
  readonly polygon_clear: (a: number) => void;
  readonly polygon_empty: (a: number) => number;
  readonly polygon_setPoint: (a: number, b: number, c: number) => void;
  readonly polygon_at: (a: number, b: number) => number;
  readonly polygon_boundingRectPolygon: (a: number) => number;
  readonly polygon_offsetBoundingBox: (a: number, b: number) => number;
  readonly polygon_offsetPolygon: (a: number, b: number) => number;
  readonly __wbg_connend_free: (a: number, b: number) => void;
  readonly connend_new: (a: number) => number;
  readonly connend_fromShapePin: (a: number, b: number) => number;
  readonly __wbg_connref_free: (a: number, b: number) => void;
  readonly connref_new: (a: number) => number;
  readonly connref_createWithEndpoints: (a: number, b: number, c: number) => number;
  readonly connref_createWithId: (a: number, b: number, c: number, d: number) => number;
  readonly connref_setCallback: (a: number, b: any, c: any) => void;
  readonly connref_displayRoute: (a: number) => number;
  readonly connref_id: (a: number) => number;
  readonly connref_setSourceEndpoint: (a: number, b: number) => void;
  readonly connref_setDestEndpoint: (a: number, b: number) => void;
  readonly connref_routingType: (a: number) => number;
  readonly connref_setRoutingType: (a: number, b: number) => void;
  readonly connref_setHateCrossings: (a: number, b: number) => void;
  readonly connref_doesHateCrossings: (a: number) => number;
  readonly __wbg_shaperef_free: (a: number, b: number) => void;
  readonly shaperef_new: (a: number, b: number) => number;
  readonly shaperef_createWithId: (a: number, b: number, c: number) => number;
  readonly shaperef_id: (a: number) => number;
  readonly shaperef_polygon: (a: number) => number;
  readonly shaperef_position: (a: number) => number;
  readonly shaperef_setNewPoly: (a: number, b: number) => void;
  readonly __wbg_shapeconnectionpin_free: (a: number, b: number) => void;
  readonly shapeconnectionpin_new: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly shapeconnectionpin_createOnJunction: (a: number, b: number, c: number) => number;
  readonly shapeconnectionpin_setConnectionCost: (a: number, b: number) => void;
  readonly shapeconnectionpin_directions: (a: number) => number;
  readonly shapeconnectionpin_setExclusive: (a: number, b: number) => void;
  readonly shapeconnectionpin_isExclusive: (a: number) => number;
  readonly __wbg_junctionref_free: (a: number, b: number) => void;
  readonly junctionref_new: (a: number, b: number) => number;
  readonly junctionref_createWithId: (a: number, b: number, c: number) => number;
  readonly junctionref_id: (a: number) => number;
  readonly junctionref_position: (a: number) => number;
  readonly junctionref_setPosition: (a: number, b: number) => void;
  readonly __wbg_hyperedgererouter_free: (a: number, b: number) => void;
  readonly hyperedgererouter_new: () => number;
  readonly hyperedgererouter_registerHyperedgeForRerouting: (a: number, b: number) => number;
  readonly __wbg_router_free: (a: number, b: number) => void;
  readonly router_new: (a: number) => number;
  readonly router_processTransaction: (a: number) => number;
  readonly router_setTransactionUse: (a: number, b: number) => void;
  readonly router_moveShape: (a: number, b: number, c: number, d: number) => void;
  readonly router_moveShapeTo: (a: number, b: number, c: number) => void;
  readonly router_setRoutingParameter: (a: number, b: number, c: number) => void;
  readonly router_routingParameter: (a: number, b: number) => number;
  readonly router_setRoutingOption: (a: number, b: number, c: number) => void;
  readonly router_routingOption: (a: number, b: number) => number;
  readonly router_addShape: (a: number, b: number) => void;
  readonly router_addConnector: (a: number, b: number) => void;
  readonly router_getConnectorRoute: (a: number, b: number) => number;
  readonly router_updateConnector: (a: number, b: number) => void;
  readonly router_deleteShape: (a: number, b: number) => void;
  readonly router_deleteConnector: (a: number, b: number) => void;
  readonly router_outputInstanceToSVG: (a: number) => [number, number];
  readonly __wbg_box_free: (a: number, b: number) => void;
  readonly box_new: () => number;
  readonly box_fromCoords: (a: number, b: number, c: number, d: number) => number;
  readonly box_min: (a: number) => number;
  readonly box_set_min: (a: number, b: number) => void;
  readonly box_max: (a: number) => number;
  readonly box_set_max: (a: number, b: number) => void;
  readonly box_width: (a: number) => number;
  readonly box_height: (a: number) => number;
  readonly box_length: (a: number, b: number) => number;
  readonly box_contains: (a: number, b: number) => number;
  readonly __wbg_rectangle_free: (a: number, b: number) => void;
  readonly rectangle_new: (a: number, b: number, c: number) => number;
  readonly rectangle_fromCorners: (a: number, b: number) => number;
  readonly rectangle_width: (a: number) => number;
  readonly rectangle_height: (a: number) => number;
  readonly rectangle_center: (a: number) => number;
  readonly rectangle_toPolygon: (a: number) => number;
  readonly main: () => void;
  readonly shapeconnectionpin_position: (a: number) => number;
  readonly polygon_id: (a: number) => number;
  readonly avoidlib_load: () => number;
  readonly avoidlib_getInstance: () => number;
  readonly polygon_get_ps: (a: number, b: number) => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
