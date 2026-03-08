import { parse } from './parse/parser.js';
import { buildGraph } from './layout/graph-builder.js';
import { computeLayout, initTopology, moveNode, releaseNode } from './layout/layout-engine.js';
import { SvgRenderer } from './render/svg-renderer.js';
import { enableInteraction } from './render/interaction.js';
import { PARSE_DEBOUNCE_MS } from './util/constants.js';

/**
 * Initialize a mermaker editor instance.
 * @param {HTMLTextAreaElement} textarea - Text input element
 * @param {HTMLElement} svgContainer - Container for SVG output
 * @returns {Promise<void>}
 */
export async function init(textarea, svgContainer) {
  const renderer = new SvgRenderer(svgContainer);
  let currentModel = null;
  let currentPositions = null;
  let currentSpec = null;
  let currentRouterState = null;
  let debounceTimer = null;
  let interactionCleanup = null;

  const layoutEngine = { initTopology, moveNode, releaseNode };

  async function processText(text) {
    try {
      const model = await parse(text);
      currentModel = model;
      currentSpec = buildGraph(model);
      const result = await computeLayout(currentSpec);
      currentPositions = result.positions;
      currentRouterState = result.routerState;
      renderer.renderDiagram(model, currentPositions);

      // Clean up previous interaction listeners before adding new ones
      if (interactionCleanup) interactionCleanup();
      interactionCleanup = enableInteraction(renderer, layoutEngine, currentPositions, currentSpec, currentRouterState);
    } catch (err) {
      if (err.constructor?.name === 'ParseError' || err.type) {
        renderer.showError(err);
      } else {
        console.error('Unexpected error:', err);
        renderer.showError({ message: err.message, line: null, column: null, type: 'internal' });
      }
    }
  }

  textarea.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      processText(textarea.value);
    }, PARSE_DEBOUNCE_MS);
  });

  if (textarea.value.trim()) {
    await processText(textarea.value);
  }
}
