/**
 * Lazy-loads WASM modules. Each module is initialized at most once.
 */

let holaInitPromise = null;
let topoInitPromise = null;
let avoidInitPromise = null;

let HolaLayoutClass = null;
let TopologyLayoutClass = null;
let avoidModule = null;

/**
 * Load and initialize the HolaLayout (libdialect) WASM module.
 * @returns {Promise<typeof import('../../lib/libdialect/libdialect.js').HolaLayout>}
 */
export async function getHolaLayout() {
  if (HolaLayoutClass) return HolaLayoutClass;

  if (!holaInitPromise) {
    holaInitPromise = (async () => {
      const module = await import('../../lib/libdialect/libdialect.js');
      await module.default();
      HolaLayoutClass = module.HolaLayout;
      return HolaLayoutClass;
    })();
  }

  return holaInitPromise;
}

/**
 * Load and initialize the TopologyLayout (libtopology) WASM module.
 * @returns {Promise<typeof import('../../lib/libtopology/libtopology.js').TopologyLayout>}
 */
export async function getTopologyLayout() {
  if (TopologyLayoutClass) return TopologyLayoutClass;

  if (!topoInitPromise) {
    topoInitPromise = (async () => {
      const module = await import('../../lib/libtopology/libtopology.js');
      await module.default();
      TopologyLayoutClass = module.TopologyLayout;
      return TopologyLayoutClass;
    })();
  }

  return topoInitPromise;
}

/**
 * Load and initialize the libavoid (connector routing) WASM module.
 * @returns {Promise<typeof import('../../lib/libavoid/libavoid.js')>}
 */
export async function getLibavoid() {
  if (avoidModule) return avoidModule;

  if (!avoidInitPromise) {
    avoidInitPromise = (async () => {
      const module = await import('../../lib/libavoid/libavoid.js');
      await module.default();
      avoidModule = module;
      return module;
    })();
  }

  return avoidInitPromise;
}
