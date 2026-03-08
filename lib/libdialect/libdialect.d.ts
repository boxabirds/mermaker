/* tslint:disable */
/* eslint-disable */

/**
 * HOLA layout engine for JavaScript.
 */
export class HolaLayout {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Add an edge between two nodes. Returns the edge ID.
     */
    addEdge(src: number, tgt: number): number;
    /**
     * Add a node with position and dimensions. Returns the node ID.
     */
    addNode(x: number, y: number, w: number, h: number): number;
    /**
     * Clear the graph.
     */
    clear(): void;
    /**
     * Load a graph from TGLF format string.
     */
    loadTglf(tglf: string): boolean;
    /**
     * Create a new HOLA layout.
     */
    constructor();
    /**
     * Get the number of edges.
     */
    numEdges(): number;
    /**
     * Get the number of nodes.
     */
    numNodes(): number;
    /**
     * Run the HOLA layout algorithm.
     * Returns a JSON string with node positions and edge routes.
     */
    run(): string;
    /**
     * Enable/disable near-alignment post-processing.
     */
    setDoNearAlign(enable: boolean): void;
    /**
     * Set the ideal edge length.
     */
    setIdealEdgeLength(length: number): void;
    /**
     * Enable/disable convex tree preference.
     */
    setPreferConvexTrees(prefer: boolean): void;
    /**
     * Enable/disable ULC-at-origin.
     */
    setPutUlcAtOrigin(enable: boolean): void;
    /**
     * Set the preferred tree growth direction (0=N, 1=S, 2=E, 3=W).
     */
    setTreeGrowthDir(dir: number): void;
    /**
     * Enable/disable ACA for links.
     */
    setUseAcaForLinks(enable: boolean): void;
    /**
     * Export the current graph state as JSON.
     */
    toJson(): string;
    /**
     * Export the current graph as SVG.
     */
    toSvg(): string;
    /**
     * Export the graph as TGLF format string.
     */
    toTglf(): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_holalayout_free: (a: number, b: number) => void;
    readonly holalayout_addEdge: (a: number, b: number, c: number) => number;
    readonly holalayout_addNode: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly holalayout_clear: (a: number) => void;
    readonly holalayout_loadTglf: (a: number, b: number, c: number) => number;
    readonly holalayout_new: () => number;
    readonly holalayout_numEdges: (a: number) => number;
    readonly holalayout_numNodes: (a: number) => number;
    readonly holalayout_run: (a: number) => [number, number];
    readonly holalayout_setDoNearAlign: (a: number, b: number) => void;
    readonly holalayout_setIdealEdgeLength: (a: number, b: number) => void;
    readonly holalayout_setPreferConvexTrees: (a: number, b: number) => void;
    readonly holalayout_setPutUlcAtOrigin: (a: number, b: number) => void;
    readonly holalayout_setTreeGrowthDir: (a: number, b: number) => void;
    readonly holalayout_setUseAcaForLinks: (a: number, b: number) => void;
    readonly holalayout_toJson: (a: number) => [number, number];
    readonly holalayout_toSvg: (a: number) => [number, number];
    readonly holalayout_toTglf: (a: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
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
