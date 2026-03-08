/* tslint:disable */
/* eslint-disable */

/**
 * JavaScript-facing topology layout engine.
 */
export class TopologyLayout {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Add a simple edge between two nodes (straight line, no bends).
     */
    addEdge(id: number, source: number, target: number, ideal_length: number): number;
    /**
     * Add an edge with bend points.
     * `path` is a flat array: [node0, ri0, node1, ri1, ...]
     * where ri is: 0=TR, 1=BR, 2=BL, 3=TL, 4=Centre
     */
    addEdgeWithBends(id: number, ideal_length: number, path: Uint32Array): number;
    /**
     * Add a node with position and size.
     */
    addNode(id: number, x: number, y: number, width: number, height: number): number;
    /**
     * Get the current stress of the topology.
     */
    computeStress(): number;
    /**
     * Get the number of edges.
     */
    edgeCount(): number;
    /**
     * Get node positions as flat array [x0, y0, x1, y1, ...].
     */
    getPositions(): Float64Array;
    /**
     * Get edge routes as a flat array.
     * Format: [n_points, x0, y0, x1, y1, ..., n_points, x0, y0, ...]
     */
    getRoutes(): Float64Array;
    /**
     * Create a new topology layout.
     */
    constructor();
    /**
     * Get the number of nodes.
     */
    nodeCount(): number;
    /**
     * Generate SVG representation.
     */
    toSVG(): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_topologylayout_free: (a: number, b: number) => void;
    readonly topologylayout_addEdge: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly topologylayout_addEdgeWithBends: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly topologylayout_addNode: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly topologylayout_computeStress: (a: number) => number;
    readonly topologylayout_edgeCount: (a: number) => number;
    readonly topologylayout_getPositions: (a: number) => [number, number];
    readonly topologylayout_getRoutes: (a: number) => [number, number];
    readonly topologylayout_new: () => number;
    readonly topologylayout_nodeCount: (a: number) => number;
    readonly topologylayout_toSVG: (a: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
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
