/* @ts-self-types="./libtopology.d.ts" */

/**
 * JavaScript-facing topology layout engine.
 */
export class TopologyLayout {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        TopologyLayoutFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_topologylayout_free(ptr, 0);
    }
    /**
     * Add a simple edge between two nodes (straight line, no bends).
     * @param {number} id
     * @param {number} source
     * @param {number} target
     * @param {number} ideal_length
     * @returns {number}
     */
    addEdge(id, source, target, ideal_length) {
        const ret = wasm.topologylayout_addEdge(this.__wbg_ptr, id, source, target, ideal_length);
        return ret >>> 0;
    }
    /**
     * Add an edge with bend points.
     * `path` is a flat array: [node0, ri0, node1, ri1, ...]
     * where ri is: 0=TR, 1=BR, 2=BL, 3=TL, 4=Centre
     * @param {number} id
     * @param {number} ideal_length
     * @param {Uint32Array} path
     * @returns {number}
     */
    addEdgeWithBends(id, ideal_length, path) {
        const ptr0 = passArray32ToWasm0(path, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.topologylayout_addEdgeWithBends(this.__wbg_ptr, id, ideal_length, ptr0, len0);
        return ret >>> 0;
    }
    /**
     * Add a node with position and size.
     * @param {number} id
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @returns {number}
     */
    addNode(id, x, y, width, height) {
        const ret = wasm.topologylayout_addNode(this.__wbg_ptr, id, x, y, width, height);
        return ret >>> 0;
    }
    /**
     * Get the current stress of the topology.
     * @returns {number}
     */
    computeStress() {
        const ret = wasm.topologylayout_computeStress(this.__wbg_ptr);
        return ret;
    }
    /**
     * Get the number of edges.
     * @returns {number}
     */
    edgeCount() {
        const ret = wasm.topologylayout_edgeCount(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Get node positions as flat array [x0, y0, x1, y1, ...].
     * @returns {Float64Array}
     */
    getPositions() {
        const ret = wasm.topologylayout_getPositions(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Get edge routes as a flat array.
     * Format: [n_points, x0, y0, x1, y1, ..., n_points, x0, y0, ...]
     * @returns {Float64Array}
     */
    getRoutes() {
        const ret = wasm.topologylayout_getRoutes(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Create a new topology layout.
     */
    constructor() {
        const ret = wasm.topologylayout_new();
        this.__wbg_ptr = ret >>> 0;
        TopologyLayoutFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Get the number of nodes.
     * @returns {number}
     */
    nodeCount() {
        const ret = wasm.topologylayout_nodeCount(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Generate SVG representation.
     * @returns {string}
     */
    toSVG() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.topologylayout_toSVG(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) TopologyLayout.prototype[Symbol.dispose] = TopologyLayout.prototype.free;

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_6ddd609b62940d55: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./libtopology_bg.js": import0,
    };
}

const TopologyLayoutFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_topologylayout_free(ptr >>> 0, 1));

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat64ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('libtopology_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
